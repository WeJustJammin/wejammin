import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AUTH_USER_ID,
  NOW,
  OTHER_FACTOR_ID,
  bodyOf,
  countingRateLimiter,
  createWorld,
  json,
  mintJar,
  providerCalls,
  rpcNames,
  rpcRefusal,
  send,
  setCookies,
} from './dec111-composition.test-support';
import {
  BASE,
  P_CHALLENGE,
  P_VERIFY,
} from './dec111-wire-scenarios.test-support';

/** AUTH-API-18 through the production Worker composition. */
const LIST = '/api/v1/account/mfa/factors';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const sequence = (world: ReturnType<typeof createWorld>): string[] =>
  world.calls
    .filter((call) => call.path !== '/auth/v1/user')
    .map((call) => call.rpc ?? `${call.method} ${call.path}`)
    .filter(
      (name) => name !== 'auth_rate_limit' && name !== 'auth_session_read',
    );

describe('AUTH-API-18 enrollment verify (production composition)', () => {
  it('[P2-S09-AC-765] returns 200 with the new ETag, stepUp.fresh true and the four rotated aal2 cookies after a correct code', async () => {
    const world = createWorld();
    const response = await send(world.app, {
      ...BASE[18],
      jar: await mintJar(),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('etag')).toBe('"6"');
    const body = await bodyOf(response);
    expect(body.version).toBe('6');
    expect((body.stepUp as { fresh: boolean }).fresh).toBe(true);
    const names = setCookies(response).map((cookie) => cookie.name);
    for (const name of ['wj_access', 'wj_refresh', 'wj_session_ref', 'wj_csrf'])
      expect(names).toContain(name);
  });

  it('[P2-S09-AC-766] accepts a strict object containing only code', async () => {
    const jar = await mintJar();
    for (const body of [
      { code: '123456', factorId: OTHER_FACTOR_ID },
      { code: '123456', extra: true },
      {},
    ]) {
      const world = createWorld();
      const response = await send(world.app, { ...BASE[18], body, jar });
      expect([400, 422]).toContain(response.status);
      expect(rpcNames(world.calls)).not.toContain(
        'auth_mfa_enrollment_verify_prepare',
      );
    }
  });

  it.each([
    '12345',
    '1234567',
    'abcdef',
    ' 123456',
    '123 456',
    '123-456',
    '١٢٣٤٥٦',
  ])(
    '[P2-S09-AC-767][P2-S09-AC-771] rejects code %j with 422 code_invalid before any dependency call',
    async (code) => {
      const world = createWorld();
      const response = await send(world.app, {
        ...BASE[18],
        body: { code },
        jar: await mintJar(),
      });
      expect(response.status).toBe(422);
      expect((await bodyOf(response)).details).toMatchObject({
        violations: [{ path: '/code', code: 'code_invalid' }],
      });
      expect(providerCalls(world.calls)).toStrictEqual([]);
    },
  );

  it('[P2-S09-AC-768][P2-S09-AC-773] binds the path factorId to the caller: 400 for a malformed id, 404 for a concealed one, identity from the session only', async () => {
    const jar = await mintJar();
    const malformed = createWorld();
    expect(
      (
        await send(malformed.app, {
          ...BASE[18],
          path: `${LIST}/${OTHER_FACTOR_ID}x/verify`,
          jar,
        })
      ).status,
    ).toBe(400);
    const concealed = createWorld({
      handlers: {
        auth_mfa_enrollment_verify_prepare: () => rpcRefusal('NOT_FOUND', 404),
      },
    });
    const response = await send(concealed.app, { ...BASE[18], jar });
    expect(response.status).toBe(404);
    expect((await bodyOf(response)).details).toStrictEqual({});
    const prepare = concealed.calls.find(
      (call) => call.rpc === 'auth_mfa_enrollment_verify_prepare',
    );
    expect(prepare?.body).toMatchObject({
      p_auth_user_id: AUTH_USER_ID,
      p_factor_id: OTHER_FACTOR_ID,
    });
    expect(providerCalls(concealed.calls)).toStrictEqual([]);
  });

  it('[P2-S09-AC-769] requires a strong quoted positive decimal If-Match and forwards it as the expected version', async () => {
    const jar = await mintJar();
    for (const header of [null, '5', 'W/"5"', '"0"', '"05"', '*']) {
      const world = createWorld();
      const response = await send(world.app, {
        ...BASE[18],
        jar,
        headers: { 'if-match': header },
      });
      expect(response.status).toBe(400);
      expect(rpcNames(world.calls)).not.toContain(
        'auth_mfa_enrollment_verify_prepare',
      );
    }
    const world = createWorld();
    await send(world.app, {
      ...BASE[18],
      jar,
      headers: { 'if-match': '"12"' },
    });
    expect(
      world.calls.find((c) => c.rpc === 'auth_mfa_enrollment_verify_prepare')
        ?.body?.p_expected_version,
    ).toBe('12');
  });

  it.each([
    ['FACTOR_NOT_PENDING', 'factor_not_pending', 'restart_enrollment'],
    ['ENROLLMENT_EXPIRED', 'enrollment_expired', 'restart_enrollment'],
  ] as const)(
    '[P2-S09-AC-770] answers 409 %s as %s with recoveryAction %s and no provider call',
    async (refusal, reasonCode, recoveryAction) => {
      const world = createWorld({
        handlers: {
          auth_mfa_enrollment_verify_prepare: () => rpcRefusal(refusal, 409),
        },
      });
      const response = await send(world.app, {
        ...BASE[18],
        jar: await mintJar(),
      });
      expect(response.status).toBe(409);
      expect((await bodyOf(response)).details).toStrictEqual({
        conflict: 'INVALID_TRANSITION',
        reasonCode,
        recoveryAction,
      });
      expect(providerCalls(world.calls)).toStrictEqual([]);
    },
  );

  it('[P2-S09-AC-772] reports 422 code_incorrect for a well-formed wrong code, leaves the factor pending (never reconciling, never settled) and spends one verification attempt', async () => {
    const world = createWorld({
      handlers: {
        [P_VERIFY]: () =>
          json({ error_code: 'mfa_verification_failed', msg: 'x' }, 400),
      },
    });
    const response = await send(world.app, {
      ...BASE[18],
      jar: await mintJar(),
    });
    expect(response.status).toBe(422);
    expect((await bodyOf(response)).details).toMatchObject({
      violations: [{ path: '/code', code: 'code_incorrect' }],
    });
    const names = rpcNames(world.calls);
    expect(names).not.toContain('auth_mfa_factor_mark_reconciling');
    expect(names).not.toContain('auth_mfa_enrollment_verify_settle');
    expect(setCookies(response)).toHaveLength(0);
    expect(names.filter((n) => n === 'auth_rate_limit')).toHaveLength(1);
  });

  it('[P2-S09-AC-775] carries no client Idempotency-Key: none is required and none reaches persistence', async () => {
    const world = createWorld();
    const response = await send(world.app, {
      ...BASE[18],
      jar: await mintJar(),
      headers: { ...BASE[18].headers, 'idempotency-key': 'k'.repeat(24) },
    });
    expect(response.status).toBe(200);
    for (const call of world.calls)
      expect(Object.keys(call.body ?? {})).not.toContain('p_key_hash');
  });

  it('[P2-S09-AC-776] runs prepare, the provider challenge and verify, session validation, then one settle transaction carrying the rotation target', async () => {
    const world = createWorld();
    await send(world.app, { ...BASE[18], jar: await mintJar() });
    expect(sequence(world)).toStrictEqual([
      'auth_mfa_enrollment_verify_prepare',
      P_CHALLENGE,
      P_VERIFY,
      'auth_mfa_enrollment_verify_settle',
    ]);
    const settle = world.calls.find(
      (call) => call.rpc === 'auth_mfa_enrollment_verify_settle',
    );
    expect(settle?.body).toMatchObject({
      p_factor_id: OTHER_FACTOR_ID,
      p_new_session_id: '34343434-3434-4434-8434-343434343434',
      p_issued_at: new Date(NOW).toISOString(),
    });
  });

  it.each([
    [
      'a post-send timeout',
      {
        [P_VERIFY]: () => {
          throw new DOMException('slow', 'AbortError');
        },
      },
      504,
    ],
    [
      'an invalid 2xx provider body',
      { [P_VERIFY]: () => new Response('not json', { status: 200 }) },
      502,
    ],
    [
      'a failed local finalization',
      { auth_mfa_enrollment_verify_settle: () => rpcRefusal('boom', 500) },
      500,
    ],
  ] as const)(
    '[P2-S09-AC-777] marks the factor reconciling, sets no cookie and returns %s -> %i',
    async (_label, handlers, status) => {
      const world = createWorld({ handlers });
      const response = await send(world.app, {
        ...BASE[18],
        jar: await mintJar(),
      });
      expect(response.status).toBe(status);
      expect(setCookies(response)).toHaveLength(0);
      const mark = world.calls.find(
        (call) => call.rpc === 'auth_mfa_factor_mark_reconciling',
      );
      expect(mark?.body).toMatchObject({ p_factor_id: OTHER_FACTOR_ID });
    },
  );

  it('[P2-S09-AC-778][P2-S09-AC-865] shares one 10-per-15-minute verification bucket with AUTH-API-21 and locks both routes once it is spent', async () => {
    const world = createWorld({
      handlers: { auth_rate_limit: countingRateLimiter() },
    });
    const jar = await mintJar();
    const verifyFactor = () => send(world.app, { ...BASE[18], jar });
    const verifyStepUp = () => send(world.app, { ...BASE[21], jar });
    for (let attempt = 0; attempt < 5; attempt += 1)
      expect((await verifyFactor()).status).toBe(200);
    for (let attempt = 0; attempt < 5; attempt += 1)
      expect((await verifyStepUp()).status).toBe(200);
    const lockedStepUp = await verifyStepUp();
    expect(lockedStepUp.status).toBe(429);
    expect((await verifyFactor()).status).toBe(429);
    const limits = world.calls
      .filter((call) => call.rpc === 'auth_rate_limit')
      .map((call) => [call.body?.p_limit, call.body?.p_window_seconds]);
    expect(new Set(limits.map(String))).toStrictEqual(new Set(['10,900']));
  });
});
