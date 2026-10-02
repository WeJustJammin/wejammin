/**
 * Rate scope is explicit: the CMS per-user bucket is keyed by operation plus
 * the server-derived auth user only; the per-party bucket by operation plus
 * the server-derived party only. These tests run the CMS limiter over the REAL
 * shared limiter adapter (`authentication/production-rate-limit.ts`) and count
 * hits per digest the way the database does, so a bucket that still carries
 * the client address or the acting party fragments visibly.
 */
import { describe, expect, it, vi } from 'vitest';

import { normalizeAuthProductionOptions } from '../authentication/production-configuration';
import { createOperationalDependencies } from '../authentication/production-rate-limit';
import type { WorkerBindings } from '../index';
import { createRateLimiter } from './production-rate';

const USER_A = '10000000-0000-4000-8000-00000000000a';
const USER_B = '10000000-0000-4000-8000-00000000000b';
const USER_C = '10000000-0000-4000-8000-00000000000c';
const PARTY_P = '20000000-0000-4000-8000-0000000000aa';
const PARTY_Q = '20000000-0000-4000-8000-0000000000bb';
const PARTY_R = '20000000-0000-4000-8000-0000000000cc';
const environment: WorkerBindings = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'rate-scope',
  SUPABASE_SECRET_KEY: 'sb_secret_rate_scope',
  SUPABASE_URL: 'https://supabase.example.test',
};
const signal = new AbortController().signal;

const harness = () => {
  const hits = new Map<string, number>();
  const digests: string[] = [];
  const fetchImpl = vi.fn<typeof fetch>(async (_url, init) => {
    const body = JSON.parse(String(init?.body)) as {
      p_bucket_digest: string;
      p_limit: number;
    };
    digests.push(body.p_bucket_digest);
    const count = (hits.get(body.p_bucket_digest) ?? 0) + 1;
    hits.set(body.p_bucket_digest, count);
    return new Response(
      JSON.stringify({
        allowed: count <= body.p_limit,
        limit: body.p_limit,
        remaining: Math.max(0, body.p_limit - count),
        resetAt: 1_757_000_000,
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  });
  const config = normalizeAuthProductionOptions({ environment, fetchImpl });
  const rateLimit = createRateLimiter({
    environment,
    fetchImpl,
    auth: {
      rateLimit: createOperationalDependencies(config).rateLimit,
    },
  } as never);
  const hit = (
    actorId: string,
    actingPartyId: string,
    address: string,
    limits: { limit: number; partyLimit: number },
  ) =>
    rateLimit(
      {
        operationId: 'CMS-03A-09',
        request: new Request('https://api.example.test/cms', {
          headers: { 'cf-connecting-ip': address },
        }),
        principalClass: 'human',
        actorId,
        actingPartyId,
        windowSeconds: 60,
        ...limits,
      } as never,
      signal,
    );
  return { hit, digests };
};

const allowed = (
  result: Awaited<ReturnType<ReturnType<typeof harness>['hit']>>,
) => result.ok && result.value.allowed;

describe('CMS rate scope (real shared limiter)', () => {
  it('enforces one per-user quota for a user across acting parties and client addresses', async () => {
    const { hit } = harness();
    const limits = { limit: 2, partyLimit: 100 };
    const outcomes = [
      await hit(USER_A, PARTY_P, '203.0.113.1', limits),
      await hit(USER_A, PARTY_Q, '203.0.113.2', limits),
      await hit(USER_A, PARTY_R, '203.0.113.3', limits),
    ].map(allowed);
    expect(outcomes).toEqual([true, true, false]);
  });

  it('keys the user bucket by operation and user only, never by party or address', async () => {
    const first = harness();
    await first.hit(USER_A, PARTY_P, '203.0.113.1', {
      limit: 5,
      partyLimit: 9,
    });
    const second = harness();
    await second.hit(USER_A, PARTY_Q, '198.51.100.9', {
      limit: 5,
      partyLimit: 9,
    });
    expect(first.digests[0]).toBe(second.digests[0]);
  });

  it('enforces one per-party quota across users and client addresses', async () => {
    const { hit } = harness();
    const limits = { limit: 100, partyLimit: 2 };
    const outcomes = [
      await hit(USER_A, PARTY_P, '203.0.113.1', limits),
      await hit(USER_B, PARTY_P, '203.0.113.2', limits),
      await hit(USER_C, PARTY_P, '203.0.113.3', limits),
    ].map(allowed);
    expect(outcomes).toEqual([true, true, false]);
  });

  it('keys the party bucket by operation and party only, never by user or address', async () => {
    const first = harness();
    await first.hit(USER_A, PARTY_P, '203.0.113.1', {
      limit: 5,
      partyLimit: 9,
    });
    const second = harness();
    await second.hit(USER_B, PARTY_P, '198.51.100.9', {
      limit: 5,
      partyLimit: 9,
    });
    expect(first.digests[1]).toBe(second.digests[1]);
  });

  it('keeps user, party and different-operation buckets distinct', async () => {
    const { hit, digests } = harness();
    await hit(USER_A, PARTY_P, '203.0.113.1', { limit: 5, partyLimit: 9 });
    expect(new Set(digests).size).toBe(2);
  });
});
