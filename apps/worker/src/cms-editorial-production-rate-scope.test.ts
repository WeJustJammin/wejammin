import { describe, expect, it, vi } from 'vitest';

import { normalizeAuthProductionOptions } from './authentication/production-configuration';
import { createOperationalDependencies } from './authentication/production-rate-limit';
import type { CmsEditorialRateLimitInput } from './cms-editorial-production-types';
import {
  appendRequest,
  authoringContextRequest,
  conflictDetailRequest,
  createRequest,
  draftDetailRequest,
  historyRequest,
  listRequest,
  rateSeam,
  resolveRequest,
  restoreRequest,
  wiredApp,
} from './cms-editorial-production-app.test-support';
import {
  PARTY_ID,
  USER_ID,
  compose,
  environment,
} from './cms-editorial-production.test-support';

/**
 * BE03b:1351 keys the per-user bucket by actor and the per-party bucket by
 * acting party, independently. These tests drive the REAL shared limiter and
 * read the bucket digest it persists, so a user bucket that also hashed in the
 * client address or the acting party (the legacy `client` scope) is caught.
 */

const sha256 = async (value: string): Promise<string> =>
  [
    ...new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
    ),
  ]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

const harness = () => {
  const fetchImpl = vi.fn<typeof fetch>(async (_url, init) => {
    const { p_limit: limit } = JSON.parse(String(init?.body)) as {
      p_limit: number;
    };
    return new Response(
      JSON.stringify({
        allowed: true,
        limit,
        remaining: limit - 1,
        resetAt: 1_757_000_000,
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  });
  const shared = createOperationalDependencies(
    normalizeAuthProductionOptions({ environment, fetchImpl }),
  );
  const dependencies = compose(vi.fn() as unknown as typeof fetch, {
    auth: { resolveSession: vi.fn() as never, rateLimit: shared.rateLimit },
  });
  const digestFor = async (
    overrides: Partial<CmsEditorialRateLimitInput>,
    address = '203.0.113.7',
  ): Promise<string> => {
    fetchImpl.mockClear();
    const result = await dependencies.rateLimit(
      {
        operationId: 'CMS-03B-01',
        request: new Request('https://api.example.test/x', {
          headers: { 'cf-connecting-ip': address },
        }),
        actorId: USER_ID,
        actingPartyId: PARTY_ID,
        principalClass: 'human',
        rateClass: 'cms-entry-write',
        limit: 120,
        windowSeconds: 60,
        rateScope: 'user',
        ...overrides,
      },
      new AbortController().signal,
    );
    expect(result.ok).toBe(true);
    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body)) as {
      p_bucket_digest: string;
    };
    return body.p_bucket_digest;
  };
  return { digestFor };
};

describe('CMS editorial rate bucket scope through the shared limiter', () => {
  it('[P2-S10-AC-007] keys the user bucket by operation and actor only: no client address, no acting party', async () => {
    const { digestFor } = harness();
    const expected = await sha256(`CMS-03B-01\u0000user\u0000${USER_ID}`);
    expect(await digestFor({ rateScope: 'user' })).toBe(expected);
    expect(await digestFor({ rateScope: 'user' }, '198.51.100.9')).toBe(
      expected,
    );
    expect(
      await digestFor({
        rateScope: 'user',
        actingPartyId: '20000000-0000-4000-8000-0000000000bb',
      }),
    ).toBe(expected);
  });

  it('[P2-S10-AC-007] keys the party bucket by operation and acting party only: no client address, no user', async () => {
    const { digestFor } = harness();
    const expected = await sha256(`CMS-03B-01\u0000party\u0000${PARTY_ID}`);
    expect(
      await digestFor({ rateScope: 'party', actorId: PARTY_ID, limit: 240 }),
    ).toBe(expected);
    expect(
      await digestFor(
        { rateScope: 'party', actorId: PARTY_ID, limit: 240 },
        '198.51.100.9',
      ),
    ).toBe(expected);
  });

  it('keeps the same actor and party in two operations in two buckets', async () => {
    const { digestFor } = harness();
    const append = await digestFor({ rateScope: 'user' });
    const restore = await digestFor({
      rateScope: 'user',
      operationId: 'CMS-03B-04',
    });
    expect(append).not.toBe(restore);
  });
});

/**
 * BE03b route registry (:152-165): per-user / per-party limits for every Slice
 * 10 operation, each enforced as two independent buckets keyed by actor and by
 * acting party. Driven through the real routes; the limiter seam records what
 * each route asks for.
 */
const REGISTRY = [
  ['CMS-03B-01', 120, 240, (app: App) => appendRequest(app)],
  ['CMS-03B-02', 60, 120, (app: App) => resolveRequest(app)],
  ['CMS-03B-03', 300, 600, (app: App) => historyRequest(app)],
  ['CMS-03B-04', 30, 60, (app: App) => restoreRequest(app)],
  ['CMS-03B-10', 120, 240, (app: App) => createRequest(app)],
  ['CMS-03B-11', 300, 600, (app: App) => draftDetailRequest(app)],
  ['CMS-03B-12', 300, 600, (app: App) => conflictDetailRequest(app)],
  ['CMS-03B-13', 300, 600, (app: App) => listRequest(app)],
  ['CMS-03B-14', 300, 600, (app: App) => authoringContextRequest(app)],
] as const;

type App = ReturnType<typeof wiredApp>;

describe('route registry rate limits (BE03b:152-165)', () => {
  it.each(REGISTRY)(
    '%s asks the limiter for %i/min per actor and %i/min per acting party, never mixed',
    async (operationId, userLimit, partyLimit, send) => {
      const calls: CmsEditorialRateLimitInput[] = [];
      const app = wiredApp(
        vi.fn(async () => new Response('{}')) as unknown as typeof fetch,
        {
          rateLimit: async (input: CmsEditorialRateLimitInput) => {
            calls.push(input);
            return rateSeam(input);
          },
        },
      );
      await send(app);
      expect(calls.map((call) => call.operationId)).toEqual([
        operationId,
        operationId,
      ]);
      expect(calls[0]).toMatchObject({
        rateScope: 'user',
        actorId: USER_ID,
        limit: userLimit,
        windowSeconds: 60,
      });
      expect(calls[1]).toMatchObject({
        rateScope: 'party',
        actorId: PARTY_ID,
        limit: partyLimit,
        windowSeconds: 60,
      });
    },
  );
});
