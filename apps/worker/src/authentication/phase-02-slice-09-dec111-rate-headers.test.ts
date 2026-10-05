import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  NOW,
  bodyOf,
  countingRateLimiter,
  createWorld,
  mintJar,
  rpcRefusal,
  send,
} from './dec111-composition.test-support';
import { BASE, P_VERIFY } from './dec111-wire-scenarios.test-support';

/**
 * BE00 / BE01a single-decision contract: every 429 carries exactly one rate
 * decision. The RateLimit-* headers, Retry-After and the body details are all
 * derived from the response's own decision, whichever layer (local limiter,
 * persisted verification lockout, provider) refused. A request that passed the
 * local limiter first must never leak that earlier, unrelated decision.
 */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

type Decision = Readonly<{
  retryAfterSeconds: number;
  limit: number;
  resetAt: string;
}>;

const expectCanonical429 = async (
  response: Response,
  expected: Decision,
): Promise<void> => {
  expect(response.status).toBe(429);
  const body = await bodyOf(response);
  expect(body.code).toBe('RATE_LIMITED');
  expect(body.details).toStrictEqual(expected);
  expect(response.headers.get('ratelimit-limit')).toBe(String(expected.limit));
  expect(response.headers.get('ratelimit-remaining')).toBe('0');
  expect(response.headers.get('ratelimit-reset')).toBe(
    String(Date.parse(expected.resetAt) / 1000),
  );
  expect(response.headers.get('retry-after')).toBe(
    String(expected.retryAfterSeconds),
  );
};

describe('single canonical rate decision on every MFA 429', () => {
  it('[P2-S09-AC-787] local limiter 429: headers and body come from the one limiter decision', async () => {
    const world = createWorld({
      handlers: { auth_rate_limit: countingRateLimiter() },
    });
    const spec = { ...BASE[18], jar: await mintJar() };
    for (let n = 0; n < 10; n += 1) await send(world.app, spec);
    await expectCanonical429(await send(world.app, spec), {
      retryAfterSeconds: 900,
      limit: 10,
      resetAt: new Date(NOW + 900_000).toISOString(),
    });
  });

  it('[P2-S09-AC-865] persisted verification lockout 429 overwrites the allowing local limiter headers', async () => {
    const world = createWorld({
      handlers: {
        auth_mfa_enrollment_verify_prepare: () =>
          rpcRefusal('MFA_VERIFICATION_LOCKED:742'),
      },
    });
    await expectCanonical429(
      await send(world.app, { ...BASE[18], jar: await mintJar() }),
      {
        retryAfterSeconds: 742,
        limit: 10,
        resetAt: new Date(NOW + 742_000).toISOString(),
      },
    );
  });

  it('[P2-S09-AC-787] provider 429 overwrites the allowing local limiter headers', async () => {
    const world = createWorld({
      handlers: {
        [P_VERIFY]: () =>
          new Response(
            JSON.stringify({ error_code: 'over_request_rate_limit' }),
            {
              status: 429,
              headers: {
                'content-type': 'application/json',
                'retry-after': '30',
              },
            },
          ),
      },
    });
    await expectCanonical429(
      await send(world.app, { ...BASE[18], jar: await mintJar() }),
      {
        retryAfterSeconds: 30,
        limit: 10,
        resetAt: new Date(NOW + 30_000).toISOString(),
      },
    );
  });

  it('overwrites stale RateLimit-* headers from the decision the 429 carries', async () => {
    const { responseForAuthError, applyRateHeaders, authError } =
      await import('./boundary');
    const headers = new Map<string, string>();
    const context = {
      header: (name: string, value: string | undefined) => {
        if (value === undefined) headers.delete(name);
        else headers.set(name, value);
      },
      set: () => undefined,
      get: () => '11111111-1111-4111-8111-111111111111',
      json: (body: unknown, status: number) =>
        new Response(JSON.stringify(body), { status }),
    };
    applyRateHeaders(context as never, {
      allowed: true,
      limit: 99,
      remaining: 98,
      resetAt: Math.floor(NOW / 1000) + 5,
    });
    responseForAuthError(
      context as never,
      authError(429, 'RATE_LIMITED', 'Too many requests.', {
        retryAfterSeconds: 42,
        limit: 10,
        resetAt: new Date(NOW + 42_000).toISOString(),
      }),
    );
    expect(Object.fromEntries(headers)).toStrictEqual({
      'cache-control': 'no-store',
      'retry-after': '42',
      'ratelimit-limit': '10',
      'ratelimit-remaining': '0',
      'ratelimit-reset': String(Math.floor(NOW / 1000) + 42),
    });
  });
});
