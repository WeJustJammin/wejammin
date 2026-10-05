/**
 * Route policies declare `partyRateLimit` (BE03a rate rows: per-user AND
 * per-party buckets) but the production limiter used to enforce only the
 * per-user bucket. These tests model the shared limiter exactly as
 * `authentication/production-rate-limit.ts` buckets requests (operation,
 * auth user, acting party, identifier digest) so a "party" bucket that still
 * carries the user id is observable as a per-user bucket.
 */
import { describe, expect, it, vi } from 'vitest';

import type { AuthRateLimitInput } from '../authentication/types';
import type { WorkerBindings } from '../index';
import { createProductionContentSchemaRegistryDependencies } from './production';

const USER_A = '10000000-0000-4000-8000-00000000000a';
const USER_B = '10000000-0000-4000-8000-00000000000b';
const USER_C = '10000000-0000-4000-8000-00000000000c';
const PARTY_P = '20000000-0000-4000-8000-0000000000aa';
const PARTY_Q = '20000000-0000-4000-8000-0000000000bb';
const environment: WorkerBindings = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'rate-party',
  SUPABASE_SECRET_KEY: 'sb_secret_rate_party',
  SUPABASE_URL: 'https://supabase.example.test',
};
const request = new Request('https://api.example.test/cms');

type LimiterCall = Readonly<{
  authUserId: string | null;
  actingPartyId: string | null;
  identifierDigest: string | null;
  limit: number;
  allowed: boolean;
}>;

/** In-memory limiter keyed like the real shared limiter (minus client IP). */
const sharedLimiter = (options: { failParty?: boolean } = {}) => {
  const counts = new Map<string, number>();
  const calls: LimiterCall[] = [];
  const limiter = vi.fn(async (input: AuthRateLimitInput) => {
    const key = [
      input.operationId,
      input.authUserId ?? '',
      input.actingPartyId ?? '',
      input.identifierDigest ?? '',
    ].join('|');
    const isPartyBucket =
      input.authUserId === null && input.actingPartyId !== null;
    if (options.failParty === true && isPartyBucket)
      return {
        ok: false as const,
        status: 503 as const,
        code: 'DEPENDENCY_UNAVAILABLE',
        message: 'limiter down',
      };
    const count = (counts.get(key) ?? 0) + 1;
    counts.set(key, count);
    const allowed = count <= input.limit;
    calls.push({
      authUserId: input.authUserId,
      actingPartyId: input.actingPartyId ?? null,
      identifierDigest: input.identifierDigest,
      limit: input.limit,
      allowed,
    });
    return {
      ok: true as const,
      value: {
        allowed,
        limit: input.limit,
        remaining: Math.max(0, input.limit - count),
        resetAt: 1_757_000_000,
      },
    };
  });
  return { limiter, calls };
};

const dependenciesFor = (
  limiter: ReturnType<typeof sharedLimiter>['limiter'],
) =>
  createProductionContentSchemaRegistryDependencies({
    environment,
    fetchImpl: vi.fn<typeof fetch>(async () => new Response('{}')),
    auth: {
      resolveSession: vi.fn(async () => ({
        ok: false as const,
        status: 401 as const,
        code: 'UNAUTHENTICATED',
        message: 'invalid',
      })),
      rateLimit: limiter,
    },
    humanOrigins: [],
    releaseOrigins: [],
  });

type RateInput = Parameters<ReturnType<typeof dependenciesFor>['rateLimit']>[0];

const rateInput = (
  actorId: string,
  actingPartyId: string | null,
  overrides: Record<string, unknown> = {},
): RateInput =>
  ({
    operationId: 'CMS-03A-09',
    request,
    actorId,
    actingPartyId,
    principalClass: 'human',
    rateClass: 'cms-definition-write',
    limit: 30,
    partyLimit: 60,
    windowSeconds: 60,
    ...overrides,
  }) as unknown as RateInput;

const allow = async (
  dependencies: ReturnType<typeof dependenciesFor>,
  input: RateInput,
): Promise<boolean> => {
  const result = await dependencies.rateLimit(
    input,
    new AbortController().signal,
  );
  if (!result.ok) throw new Error(`limiter failure ${result.code}`);
  return result.value.allowed;
};

describe('production rate limiter enforces the per-user bucket (route policy rateLimit)', () => {
  it('allows exactly rateLimit requests per user, then refuses', async () => {
    const { limiter } = sharedLimiter();
    const dependencies = dependenciesFor(limiter);
    for (let index = 0; index < 30; index += 1)
      expect(await allow(dependencies, rateInput(USER_A, PARTY_P))).toBe(true);
    expect(await allow(dependencies, rateInput(USER_A, PARTY_P))).toBe(false);
  });

  it('does not charge one user against another user in the same party', async () => {
    const { limiter } = sharedLimiter();
    const dependencies = dependenciesFor(limiter);
    for (let index = 0; index < 30; index += 1)
      await allow(dependencies, rateInput(USER_A, PARTY_P));
    expect(await allow(dependencies, rateInput(USER_B, PARTY_P))).toBe(true);
  });

  it('keeps operations in one class on separate buckets (CMS-03A-12 versus CMS-03A-14)', async () => {
    const { limiter } = sharedLimiter();
    const dependencies = dependenciesFor(limiter);
    const decide = () =>
      allow(
        dependencies,
        rateInput(USER_A, null, {
          operationId: 'CMS-03A-12',
          rateClass: 'cms-activation',
          limit: 30,
          partyLimit: 60,
        }),
      );
    const assign = () =>
      allow(
        dependencies,
        rateInput(USER_A, null, {
          operationId: 'CMS-03A-14',
          rateClass: 'cms-activation',
          limit: 10,
          partyLimit: 20,
        }),
      );
    for (let index = 0; index < 10; index += 1) await assign();
    expect(await assign()).toBe(false);
    expect(await decide()).toBe(true);
  });
});

describe('production rate limiter enforces the per-party bucket (route policy partyRateLimit)', () => {
  it('refuses once the whole party passes partyLimit even when every user is under rateLimit', async () => {
    const { limiter } = sharedLimiter();
    const dependencies = dependenciesFor(limiter);
    const users = [USER_A, USER_B, USER_C];
    let allowed = 0;
    for (let round = 0; round < 25; round += 1)
      for (const user of users)
        if (await allow(dependencies, rateInput(user, PARTY_P))) allowed += 1;
    expect(allowed).toBe(60);
  });

  it('refuses the 61st party request for a user that is itself under 30', async () => {
    const { limiter } = sharedLimiter();
    const dependencies = dependenciesFor(limiter);
    for (let index = 0; index < 30; index += 1)
      await allow(dependencies, rateInput(USER_A, PARTY_P));
    for (let index = 0; index < 30; index += 1)
      await allow(dependencies, rateInput(USER_B, PARTY_P));
    expect(await allow(dependencies, rateInput(USER_C, PARTY_P))).toBe(false);
  });

  it('never shares a party bucket across parties', async () => {
    const { limiter } = sharedLimiter();
    const dependencies = dependenciesFor(limiter);
    for (const user of [USER_A, USER_B]) {
      for (let index = 0; index < 30; index += 1)
        await allow(dependencies, rateInput(user, PARTY_P));
    }
    expect(await allow(dependencies, rateInput(USER_C, PARTY_Q))).toBe(true);
  });

  it('keys the party bucket by party only: no auth user id, a distinct digest, and the party limit', async () => {
    const { limiter, calls } = sharedLimiter();
    const dependencies = dependenciesFor(limiter);
    await allow(dependencies, rateInput(USER_A, PARTY_P));
    const partyCall = calls.find(
      (call) => call.authUserId === null && call.actingPartyId === PARTY_P,
    );
    const userCall = calls.find((call) => call.authUserId === USER_A);
    expect(partyCall).toBeDefined();
    expect(userCall).toBeDefined();
    expect(partyCall?.limit).toBe(60);
    expect(userCall?.limit).toBe(30);
    expect(partyCall?.identifierDigest).toMatch(/^[a-f0-9]{64}$/u);
    expect(partyCall?.identifierDigest).not.toBe(userCall?.identifierDigest);
    expect(JSON.stringify(calls)).not.toContain(
      `"identifierDigest":"${PARTY_P}"`,
    );
  });

  it('applies only the user bucket when the session has no acting party', async () => {
    const { limiter, calls } = sharedLimiter();
    const dependencies = dependenciesFor(limiter);
    expect(await allow(dependencies, rateInput(USER_A, null))).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.authUserId).toBe(USER_A);
  });

  it('returns the stricter decision when both buckets allow the request', async () => {
    const { limiter } = sharedLimiter();
    const dependencies = dependenciesFor(limiter);
    const result = await dependencies.rateLimit(
      rateInput(USER_A, PARTY_P),
      new AbortController().signal,
    );
    expect(result).toMatchObject({
      ok: true,
      value: { allowed: true, limit: 30, remaining: 29 },
    });
  });

  it('fails closed when the party bucket cannot be evaluated', async () => {
    const { limiter } = sharedLimiter({ failParty: true });
    const dependencies = dependenciesFor(limiter);
    const result = await dependencies.rateLimit(
      rateInput(USER_A, PARTY_P),
      new AbortController().signal,
    );
    expect(result).toMatchObject({ ok: false, status: 503 });
  });
});
