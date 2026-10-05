import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  bodyOf,
  countingRateLimiter,
  createWorld,
  mintJar,
  NOW,
  providerUserOfBearer,
  send,
} from '../authentication/dec111-composition.test-support';
import {
  BODY,
  KEY,
  PATH,
  handlers,
} from './phase-02-slice-09-cfg05b06-wire.test-support';

/**
 * CFG-05B-06 rate keys (BE05b: 5 per hour per user and 10 per hour per party)
 * through the production Worker composition and the real production limiter,
 * with a PostgREST fake that models `platform_api.auth_rate_limit` (one counter
 * per operation id and bucket digest). Neither bucket may depend on the client
 * address, and the party bucket may not depend on which member calls.
 */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  for (const level of ['log', 'info', 'warn', 'error'] as const)
    vi.spyOn(console, level).mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const USERS = [
  '90000000-0000-4000-8000-00000000000a',
  '90000000-0000-4000-8000-00000000000b',
  '90000000-0000-4000-8000-00000000000c',
] as const;
const IPS = ['203.0.113.7', '198.51.100.9', '192.0.2.44'] as const;

const setup = async () => {
  const world = createWorld({
    handlers: handlers({
      auth_rate_limit: countingRateLimiter(),
      'GET /auth/v1/user': providerUserOfBearer,
    }),
  });
  const jars = await Promise.all(
    USERS.map((authUserId) => mintJar({ authUserId })),
  );
  const call = (user: number, ip: number) =>
    send(world.app, {
      method: 'POST',
      path: PATH,
      body: BODY,
      jar: jars[user] ?? null,
      headers: {
        'idempotency-key': KEY,
        'cf-connecting-ip': IPS[ip] ?? IPS[0],
      },
    });
  return { world, call };
};

describe('CFG-05B-06 rate keys', () => {
  it('[P2-S09-AC-934] the user bucket is 5 per hour for the operator whatever client address the requests come from', async () => {
    const { call } = await setup();
    for (let n = 0; n < 5; n += 1)
      expect((await call(0, n % 3)).status).toBe(200);
    const limited = await call(0, 2);
    expect(limited.status).toBe(429);
    expect((await bodyOf(limited)).details).toStrictEqual({
      retryAfterSeconds: 3600,
      limit: 5,
      resetAt: new Date(NOW + 3600_000).toISOString(),
    });
    expect(limited.headers.get('ratelimit-limit')).toBe('5');
  });

  it('[P2-S09-AC-943] the party bucket is 10 per hour shared by every operator of the acting party, so a third operator is refused after two have used 5 each', async () => {
    const { call } = await setup();
    for (let n = 0; n < 5; n += 1) {
      expect((await call(0, n % 3)).status).toBe(200);
      expect((await call(1, (n + 1) % 3)).status).toBe(200);
    }
    const limited = await call(2, 0);
    expect(limited.status).toBe(429);
    expect((await bodyOf(limited)).details).toStrictEqual({
      retryAfterSeconds: 3600,
      limit: 10,
      resetAt: new Date(NOW + 3600_000).toISOString(),
    });
  });

  it('[P2-S09-AC-934] [P2-S09-AC-943] the limiter sees the same party bucket digest for every member and address and a distinct user digest per operator', async () => {
    const { world, call } = await setup();
    await call(0, 0);
    await call(1, 1);
    await call(0, 2);
    const digests = world.calls
      .filter((c) => c.rpc === 'auth_rate_limit')
      .map((c) => [c.body?.p_limit, c.body?.p_bucket_digest] as const);
    const party = new Set(
      digests.filter(([limit]) => limit === 10).map(([, digest]) => digest),
    );
    const user = digests.filter(([limit]) => limit === 5).map(([, d]) => d);
    expect(party.size).toBe(1);
    expect(new Set(user).size).toBe(2);
  });
});
