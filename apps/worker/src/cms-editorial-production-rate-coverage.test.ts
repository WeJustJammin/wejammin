import { describe, it } from 'vitest';

import type { AuthRateLimitDecision } from './authentication/types';
import type {
  CmsEditorialRateLimitDecision,
  CmsEditorialRateLimitInput,
} from './cms-editorial-production-types';
import {
  PARTY_ID,
  USER_ID,
  compose,
  expect,
  json,
  revisionResource,
  vi,
} from './cms-editorial-production.test-support';

const input = (
  overrides: Partial<CmsEditorialRateLimitInput> = {},
): CmsEditorialRateLimitInput => ({
  operationId: 'CMS-03B-01',
  request: new Request('https://api.example.test/x'),
  actorId: '10000000-0000-4000-8000-000000000001',
  actingPartyId: '20000000-0000-4000-8000-000000000002',
  principalClass: 'human',
  rateClass: 'cms-entry-write',
  limit: 120,
  windowSeconds: 60,
  rateScope: 'user',
  ...overrides,
});

const decision = (
  overrides: Partial<CmsEditorialRateLimitDecision> = {},
): CmsEditorialRateLimitDecision => ({
  allowed: true,
  limit: 120,
  remaining: 119,
  resetAt: 1_800_000_000,
  ...overrides,
});

const withRateLimit = (rateLimit: unknown) =>
  compose(vi.fn() as unknown as typeof fetch, { rateLimit });

const authDecision = (
  overrides: Partial<AuthRateLimitDecision> = {},
): AuthRateLimitDecision => ({
  allowed: true,
  limit: 120,
  remaining: 119,
  resetAt: 1_800_000_000,
  ...overrides,
});

describe('cms editorial production rate limiter', () => {
  it('fails closed when no rate limiter is composed', async () => {
    const dependencies = withRateLimit(undefined);
    const result = await dependencies.rateLimit(
      input(),
      new AbortController().signal,
    );
    expect(result).toMatchObject({
      ok: false,
      status: 503,
      code: 'DEPENDENCY_UNAVAILABLE',
      details: { dependencyClass: 'rate_limiter' },
    });
  });

  it('passes through a decision inside the declared window', async () => {
    const dependencies = withRateLimit(async () => ({
      ok: true,
      value: decision(),
    }));
    const result = await dependencies.rateLimit(
      input(),
      new AbortController().signal,
    );
    expect(result).toMatchObject({ ok: true, value: { remaining: 119 } });
  });

  it('treats a decision outside the declared window as an invalid response', async () => {
    for (const value of [
      decision({ allowed: 'yes' as unknown as boolean }),
      decision({ limit: 0 }),
      decision({ limit: 1.5 }),
      decision({ remaining: -1 }),
      decision({ remaining: 121 }),
      decision({ resetAt: 1.5 }),
      decision({ resetAt: -1 }),
    ]) {
      const dependencies = withRateLimit(async () => ({ ok: true, value }));
      const result = await dependencies.rateLimit(
        input(),
        new AbortController().signal,
      );
      expect(result).toMatchObject({
        ok: false,
        status: 502,
        code: 'BAD_GATEWAY',
      });
    }
  });

  it('fails closed when the direct limiter throws', async () => {
    const dependencies = withRateLimit(async () => {
      throw new Error('limiter exploded');
    });
    const result = await dependencies.rateLimit(
      input(),
      new AbortController().signal,
    );
    expect(result).toMatchObject({
      ok: false,
      status: 503,
      details: { dependencyClass: 'rate_limiter' },
    });
    expect(JSON.stringify(result)).not.toContain('limiter exploded');
  });

  it('treats an aborted limiter as a deadline', async () => {
    const controller = new AbortController();
    const dependencies = withRateLimit(async () => {
      controller.abort();
      throw new DOMException('aborted', 'AbortError');
    });
    const result = await dependencies.rateLimit(input(), controller.signal);
    expect(result).toMatchObject({ ok: false, status: 504 });
  });

  it('keys the user and party buckets distinctly through the shared limiter', async () => {
    const rateLimit = vi.fn(
      async (rateInput: unknown, environment?: unknown, signal?: unknown) => {
        void rateInput;
        void environment;
        void signal;
        return { ok: true as const, value: authDecision() };
      },
    );
    const dependencies = compose(vi.fn() as unknown as typeof fetch, {
      auth: {
        resolveSession: vi.fn() as never,
        rateLimit: rateLimit as never,
      },
    });
    const userResult = await dependencies.rateLimit(
      input({ rateScope: 'user', limit: 120, actorId: USER_ID }),
      new AbortController().signal,
    );
    expect(userResult).toMatchObject({ ok: true });
    const userForwarded = (rateLimit.mock.calls[0]?.[0] ?? {}) as unknown as {
      identifierDigest: string;
      authUserId: string | null;
      actingPartyId: string | null;
      limit: number;
      windowSeconds: number;
    };
    expect(userForwarded.identifierDigest).toMatch(/^[a-f0-9]{64}$/u);
    expect(userForwarded.authUserId).toBe(USER_ID);
    expect(userForwarded.actingPartyId).toBe(PARTY_ID);
    expect(userForwarded.limit).toBe(120);
    expect(userForwarded.windowSeconds).toBe(60);

    rateLimit.mockResolvedValueOnce({
      ok: true as const,
      value: authDecision({ limit: 240, remaining: 239 }),
    });
    const partyResult = await dependencies.rateLimit(
      input({ rateScope: 'party', limit: 240, actorId: PARTY_ID }),
      new AbortController().signal,
    );
    expect(partyResult).toMatchObject({ ok: true });
    const partyForwarded = (rateLimit.mock.calls[1]?.[0] ?? {}) as unknown as {
      identifierDigest: string;
      authUserId: string | null;
      actingPartyId: string | null;
      limit: number;
    };
    // The party id is the bucket identity; the user id is never substituted.
    expect(partyForwarded.authUserId).toBeNull();
    expect(partyForwarded.actingPartyId).toBe(PARTY_ID);
    expect(partyForwarded.limit).toBe(240);
    expect(partyForwarded.identifierDigest).not.toBe(
      userForwarded.identifierDigest,
    );
  });

  it('rejects a decision whose limit disagrees with the declared scope', async () => {
    const dependencies = withRateLimit(async () => ({
      ok: true,
      value: decision({ limit: 240, remaining: 239 }),
    }));
    const result = await dependencies.rateLimit(
      input({ rateScope: 'user', limit: 120 }),
      new AbortController().signal,
    );
    expect(result).toMatchObject({
      ok: false,
      status: 502,
      code: 'BAD_GATEWAY',
    });
  });
  it('maps a shared auth limiter rejection through the auth failure table', async () => {
    const dependencies = compose(vi.fn() as unknown as typeof fetch, {
      auth: {
        resolveSession: vi.fn() as never,
        rateLimit: (async () => ({
          ok: false,
          status: 429,
          code: 'RATE_LIMITED',
          message: 'Too many requests.',
        })) as never,
      },
    });
    const result = await dependencies.rateLimit(
      input(),
      new AbortController().signal,
    );
    expect(result).toMatchObject({
      ok: false,
      status: 429,
      code: 'RATE_LIMITED',
    });
    expect(revisionResource).toBeDefined();
    expect(json).toBeDefined();
  });
});
