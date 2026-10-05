import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AUTH_USER_ID,
  FACTOR_ID,
  MANUAL_KEY,
  NOW,
  PROVIDER_FACTOR_ID,
  bodyOf,
  collapseDeadline,
  createWorld,
  factorRow,
  hangUntilAborted,
  iso,
  json,
  mintJar,
  providerCalls,
  rpcNames,
  send,
} from './dec111-composition.test-support';
import { BASE } from './dec111-wire-scenarios.test-support';

/**
 * AUTH-API-16 behaviour through the production Worker
 * composition (real routes, MFA service, persistence adapter and Supabase MFA
 * provider; only the PostgREST and Supabase Auth HTTP endpoints are faked).
 */
const LIST = '/api/v1/account/mfa/factors';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('AUTH-API-16 factor list (production composition)', () => {
  it('[P2-S09-AC-717][P2-S09-AC-719] returns 200 with the exact MfaFactorsResource and the MFA version as a strong ETag', async () => {
    const world = createWorld();
    const response = await send(world.app, {
      ...BASE[16],
      jar: await mintJar(),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('etag')).toBe('"3"');
    const body = await bodyOf(response);
    expect(Object.keys(body).sort()).toStrictEqual([
      'allowedMethods',
      'factors',
      'stepUp',
      'version',
    ]);
    expect(body.version).toBe('3');
    const [factor] = body.factors as Record<string, unknown>[];
    expect(Object.keys(factor ?? {}).sort()).toStrictEqual([
      'friendlyName',
      'id',
      'lastUsedAt',
      'method',
      'pendingExpiresAt',
      'state',
      'verifiedAt',
    ]);
    expect(Object.keys(body.stepUp as object).sort()).toStrictEqual([
      'fresh',
      'freshUntil',
    ]);
  });

  it('[P2-S09-AC-718] takes no body, query, Idempotency-Key or If-Match: a query is refused before any dependency and the headers never reach persistence', async () => {
    const world = createWorld();
    const jar = await mintJar();
    const withQuery = await send(world.app, {
      ...BASE[16],
      path: `${LIST}?personId=x`,
      jar,
    });
    expect(withQuery.status).toBe(400);
    // BE00: the session is verified (step 4) before the strict query (step 6),
    // but no operation or rate-limit RPC is reached.
    expect(
      world.calls.filter(
        (call) =>
          call.rpc !== null &&
          (call.rpc.startsWith('auth_mfa') ||
            call.rpc.startsWith('auth_rate_limit')),
      ),
    ).toStrictEqual([]);
    const ignored = await send(world.app, {
      ...BASE[16],
      jar,
      headers: { 'idempotency-key': 'k'.repeat(24), 'if-match': '"9"' },
    });
    expect(ignored.status).toBe(200);
    const read = world.calls.find(
      (call) => call.rpc === 'auth_mfa_factors_read',
    );
    expect(Object.keys(read?.body ?? {}).sort()).toStrictEqual([
      'p_auth_user_id',
      'p_correlation_id',
      'p_request_id',
    ]);
  });

  it('[P2-S09-AC-720] returns only the application factor UUID: a registry row that carries a provider factor id or a removed state is refused with 502', async () => {
    const leaky = createWorld({
      handlers: {
        auth_mfa_factors_read: () =>
          json({
            factors: [factorRow({ providerFactorId: PROVIDER_FACTOR_ID })],
            version: '3',
          }),
      },
    });
    const jar = await mintJar();
    const leakedResponse = await send(leaky.app, { ...BASE[16], jar });
    expect(leakedResponse.status).toBe(502);
    expect(JSON.stringify(await leakedResponse.json())).not.toContain(
      PROVIDER_FACTOR_ID,
    );
    for (const state of ['removed', 'expired']) {
      const world = createWorld({
        handlers: {
          auth_mfa_factors_read: () =>
            json({ factors: [factorRow({ state })], version: '3' }),
        },
      });
      expect((await send(world.app, { ...BASE[16], jar })).status).toBe(502);
    }
    const live = createWorld({
      handlers: {
        auth_mfa_factors_read: () =>
          json({
            factors: ['pending', 'verified', 'reconciling'].map((state) =>
              factorRow({
                id: `${FACTOR_ID.slice(0, -1)}${state.length % 9}`,
                state,
              }),
            ),
            version: '8',
          }),
      },
    });
    const liveBody = await bodyOf(await send(live.app, { ...BASE[16], jar }));
    expect(
      (liveBody.factors as { state: string }[]).map((row) => row.state),
    ).toStrictEqual(['pending', 'verified', 'reconciling']);
  });

  it.each([
    [-60, true, 540],
    [-600, true, 0],
    [-601, false, null],
    [-30, true, 570],
  ] as const)(
    '[P2-S09-AC-721] computes stepUp from the verified token proof only (proof %i s old -> fresh %s)',
    async (age, fresh, untilOffset) => {
      const world = createWorld();
      const jar = await mintJar({ stepUpAt: iso(age) });
      const body = await bodyOf(await send(world.app, { ...BASE[16], jar }));
      expect(body.stepUp).toStrictEqual({
        fresh,
        freshUntil: untilOffset === null ? null : iso(untilOffset),
      });
    },
  );

  it('[P2-S09-AC-721] reports fresh false and freshUntil null when no proof is present', async () => {
    const world = createWorld();
    const jar = await mintJar({ stepUpAt: null });
    const body = await bodyOf(await send(world.app, { ...BASE[16], jar }));
    expect(body.stepUp).toStrictEqual({ fresh: false, freshUntil: null });
  });

  it('[P2-S09-AC-722] excludes any secret, URI, provider id, challenge id, token or IP and makes no provider call', async () => {
    const world = createWorld();
    const response = await send(world.app, {
      ...BASE[16],
      jar: await mintJar(),
      headers: { 'cf-connecting-ip': '203.0.113.9' },
    });
    const text = await response.text();
    for (const forbidden of [
      PROVIDER_FACTOR_ID,
      'otpauth',
      MANUAL_KEY,
      'caller-refresh-token-secret',
      '203.0.113.9',
      'challenge',
    ])
      expect(text).not.toContain(forbidden);
    expect(providerCalls(world.calls)).toStrictEqual([]);
  });

  it('[P2-S09-AC-723][P2-S09-AC-724] lets the signed-in user read only their own factors: the read is keyed by the session Auth UUID and no request field can select another account', async () => {
    const world = createWorld();
    const jar = await mintJar();
    expect((await send(world.app, { ...BASE[16], jar })).status).toBe(200);
    const read = world.calls.find(
      (call) => call.rpc === 'auth_mfa_factors_read',
    );
    expect(read?.body?.p_auth_user_id).toBe(AUTH_USER_ID);
    for (const selector of ['personId', 'authUserId', 'userId', 'accountId']) {
      const other = createWorld();
      const refused = await send(other.app, {
        ...BASE[16],
        path: `${LIST}?${selector}=99999999-9999-4999-8999-999999999999`,
        jar,
      });
      expect(refused.status).toBe(400);
      expect(rpcNames(other.calls)).not.toContain('auth_mfa_factors_read');
    }
    const nested = await send(world.app, {
      ...BASE[16],
      path: `${LIST}/99999999-9999-4999-8999-999999999999`,
      jar,
    });
    expect(nested.status).toBe(404);
  });

  it('[P2-S09-AC-725] is limited to 300 per minute per user with no-store, an 8 s deadline and a 429 at the limit', async () => {
    const world = createWorld();
    const jar = await mintJar();
    const ok = await send(world.app, { ...BASE[16], jar });
    expect(ok.headers.get('cache-control')).toBe('no-store');
    const rate = world.calls.find((call) => call.rpc === 'auth_rate_limit');
    expect(rate?.body).toMatchObject({ p_limit: 300, p_window_seconds: 60 });
    const delays = collapseDeadline(8_000);
    const slow = createWorld({
      handlers: { auth_mfa_factors_read: hangUntilAborted },
    });
    const response = await send(slow.app, { ...BASE[16], jar });
    expect(delays).toContain(8_000);
    expect(response.status).toBe(504);
    expect((await bodyOf(response)).code).toBe('DEPENDENCY_UNAVAILABLE');
  });
});
