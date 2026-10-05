import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { authRoutePolicies } from '@wejammin/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  bodyOf,
  countingRateLimiter,
  createWorld,
  providerUserOfBearer,
  mintJar,
  NOW,
  send,
  type Send,
} from './dec111-composition.test-support';
import { BASE } from './dec111-wire-scenarios.test-support';

/**
 * BE01a Route Registry rate keys for AUTH-API-16..21, produced through the
 * production Worker composition: real routes, the real production limiter
 * (`production-rate-limit.ts`) and a PostgREST fake that models
 * `platform_api.auth_rate_limit` (one counter per operation id and bucket
 * digest, `allowed` while count <= limit). The DB function itself is proven
 * by supabase/tests/phase_02_slice_09_dec111_mfa_retention.sql (operation ids
 * AUTH-API-16..21 accepted) and, for the count boundary, by the needs-db item
 * recorded in the r2-auth report.
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

const IP_A = '203.0.113.7';
const IP_B = '198.51.100.9';
const OTHER_USER = '99999999-9999-4999-8999-999999999999';

const from = (spec: Send, ip: string): Send => ({
  ...spec,
  headers: { ...(spec.headers ?? {}), 'cf-connecting-ip': ip },
});

const world = () =>
  createWorld({
    handlers: {
      auth_rate_limit: countingRateLimiter(),
      'GET /auth/v1/user': providerUserOfBearer,
    },
  });

const limiterCalls = (calls: ReturnType<typeof world>['calls']) =>
  calls.filter((call) => call.rpc === 'auth_rate_limit');

describe('AUTH-API rate keys (BE01a Route Registry)', () => {
  it('[P2-S09-AC-725] AUTH-API-16 is limited to 300 per minute per user, whichever client address the requests come from', async () => {
    const w = world();
    const jar = await mintJar();
    for (let n = 0; n < 300; n += 1) {
      const ok = await send(
        w.app,
        from({ ...BASE[16], jar }, n % 2 === 0 ? IP_A : IP_B),
      );
      expect(ok.status).toBe(200);
    }
    const limited = await send(w.app, from({ ...BASE[16], jar }, IP_B));
    expect(limited.status).toBe(429);
    const body = await bodyOf(limited);
    expect(body.code).toBe('RATE_LIMITED');
    expect(body.details).toStrictEqual({
      retryAfterSeconds: 60,
      limit: 300,
      resetAt: new Date(NOW + 60_000).toISOString(),
    });
    expect(limited.headers.get('retry-after')).toBe('60');
    expect(limited.headers.get('ratelimit-limit')).toBe('300');
    expect(limited.headers.get('ratelimit-remaining')).toBe('0');
    const other = await send(
      w.app,
      from(
        { ...BASE[16], jar: await mintJar({ authUserId: OTHER_USER }) },
        IP_A,
      ),
    );
    expect(other.status).toBe(200);
  }, 30_000);

  it('[P2-S09-AC-751] AUTH-API-17 is limited to 5 per hour per user and answers 429 at the limit from any client address', async () => {
    const w = world();
    const jar = await mintJar();
    for (let n = 0; n < 5; n += 1)
      expect(
        (
          await send(
            w.app,
            from({ ...BASE[17], jar }, n % 2 === 0 ? IP_A : IP_B),
          )
        ).status,
      ).toBe(201);
    const limited = await send(w.app, from({ ...BASE[17], jar }, IP_B));
    expect(limited.status).toBe(429);
    expect((await bodyOf(limited)).details).toStrictEqual({
      retryAfterSeconds: 3600,
      limit: 5,
      resetAt: new Date(NOW + 3600_000).toISOString(),
    });
    const again = await send(w.app, from({ ...BASE[17], jar }, IP_A));
    expect(again.status).toBe(429);
    const other = await send(
      w.app,
      from(
        { ...BASE[17], jar: await mintJar({ authUserId: OTHER_USER }) },
        IP_A,
      ),
    );
    expect(other.status).toBe(201);
  });

  it('[P2-S09-AC-809] AUTH-API-19 is limited to 5 per hour per user and answers 429 at the limit from any client address', async () => {
    const w = world();
    const jar = await mintJar();
    for (let n = 0; n < 5; n += 1)
      expect(
        (
          await send(
            w.app,
            from({ ...BASE[19], jar }, n % 2 === 0 ? IP_A : IP_B),
          )
        ).status,
      ).toBe(200);
    const limited = await send(w.app, from({ ...BASE[19], jar }, IP_B));
    expect(limited.status).toBe(429);
    expect((await bodyOf(limited)).details).toStrictEqual({
      retryAfterSeconds: 3600,
      limit: 5,
      resetAt: new Date(NOW + 3600_000).toISOString(),
    });
    const other = await send(
      w.app,
      from(
        { ...BASE[19], jar: await mintJar({ authUserId: OTHER_USER }) },
        IP_A,
      ),
    );
    expect(other.status).toBe(200);
  });

  it('[P2-S09-AC-839] AUTH-API-20 is limited to 10 per 15 minutes per IP and account: the 11th request from one address is 429 and another address has its own bucket', async () => {
    const w = world();
    const jar = await mintJar();
    for (let n = 0; n < 10; n += 1)
      expect((await send(w.app, from({ ...BASE[20], jar }, IP_A))).status).toBe(
        201,
      );
    const limited = await send(w.app, from({ ...BASE[20], jar }, IP_A));
    expect(limited.status).toBe(429);
    expect((await bodyOf(limited)).details).toStrictEqual({
      retryAfterSeconds: 900,
      limit: 10,
      resetAt: new Date(NOW + 900_000).toISOString(),
    });
    expect((await send(w.app, from({ ...BASE[20], jar }, IP_B))).status).toBe(
      201,
    );
    const otherAccount = await send(
      w.app,
      from(
        { ...BASE[20], jar: await mintJar({ authUserId: OTHER_USER }) },
        IP_A,
      ),
    );
    expect(otherAccount.status).toBe(201);
  });

  it('[P2-S09-AC-751] [P2-S09-AC-809] each operation keeps its own bucket: exhausting AUTH-API-17 does not limit AUTH-API-19 for the same user', async () => {
    const w = world();
    const jar = await mintJar();
    for (let n = 0; n < 5; n += 1) await send(w.app, { ...BASE[17], jar });
    expect((await send(w.app, { ...BASE[17], jar })).status).toBe(429);
    expect((await send(w.app, { ...BASE[19], jar })).status).toBe(200);
    expect((await send(w.app, { ...BASE[16], jar })).status).toBe(200);
  });

  it('[P2-S09-AC-725] [P2-S09-AC-751] [P2-S09-AC-809] [P2-S09-AC-839] the limiter receives the real operation id of AUTH-API-16, 17, 19 and 20', async () => {
    const w = world();
    const jar = await mintJar();
    for (const op of [16, 17, 19, 20] as const)
      await send(w.app, { ...BASE[op], jar });
    expect(
      limiterCalls(w.calls).map((call) => call.body?.p_operation_id),
    ).toStrictEqual([
      'AUTH-API-16',
      'AUTH-API-17',
      'AUTH-API-19',
      'AUTH-API-20',
    ]);
  });
});

/** Rate-key column of the BE01a Route Registry, read from the settled spec. */
const specRateKeys = (): ReadonlyMap<string, 'client' | 'user'> => {
  const spec = readFileSync(
    fileURLToPath(
      new URL(
        '../../../../.memory/wiki/specs/be/01a-auth-account-linking.md',
        import.meta.url,
      ),
    ),
    'utf8',
  );
  const keys = new Map<string, 'client' | 'user'>();
  for (const line of spec.split('\n')) {
    const cells = line.split('|').map((cell) => cell.trim());
    const id = /^AUTH-API-\d\d$/u.exec(cells[1] ?? '')?.[0];
    if (
      id === undefined ||
      cells.length < 9 ||
      !/^`(?:GET|POST|DELETE) /u.test(cells[2] ?? '')
    )
      continue;
    const rate = cells[7] ?? '';
    keys.set(id, /\/user\b/u.test(rate) ? 'user' : 'client');
  }
  return keys;
};

describe('AUTH-API rate bucket scope table', () => {
  it('[P2-S09-AC-725] [P2-S09-AC-751] [P2-S09-AC-809] every registered operation is keyed by the scope its BE01a rate column names', () => {
    const expected = specRateKeys();
    expect(expected.size).toBe(21);
    expect(
      authRoutePolicies.map((policy) => [
        policy.operationId,
        (policy as { rateScope?: string }).rateScope,
      ]),
    ).toStrictEqual([...expected.entries()]);
  });
});
