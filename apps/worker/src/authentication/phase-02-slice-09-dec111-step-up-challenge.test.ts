import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AUTH_USER_ID,
  CHALLENGE_ID,
  FACTOR_ID,
  NOW,
  OTHER_FACTOR_ID,
  PROVIDER_CHALLENGE_ID,
  PROVIDER_FACTOR_ID,
  SESSION_ID,
  bodyOf,
  collapseDeadline,
  createWorld,
  hangUntilAborted,
  iso,
  json,
  mintJar,
  providerCalls,
  rpcNames,
  rpcRefusal,
  send,
  setCookies,
} from './dec111-composition.test-support';
import { BASE, P_CHALLENGE } from './dec111-wire-scenarios.test-support';

/** AUTH-API-20 through the production Worker composition. */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const rpc = (world: ReturnType<typeof createWorld>, name: string) =>
  world.calls.find((call) => call.rpc === name);

describe('AUTH-API-20 step-up challenge (production composition)', () => {
  it('[P2-S09-AC-824][P2-S09-AC-833] returns 201 with exactly the StepUpChallenge for a verified session with no step-up precondition, never the provider challenge id', async () => {
    const world = createWorld();
    const response = await send(world.app, {
      ...BASE[20],
      jar: await mintJar({ stepUpAt: null }),
    });
    expect(response.status).toBe(201);
    const text = await response.text();
    expect(text).not.toContain(PROVIDER_CHALLENGE_ID);
    expect(text).not.toContain(PROVIDER_FACTOR_ID);
    const body = JSON.parse(text) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toStrictEqual([
      'challengeId',
      'expiresAt',
      'factorId',
      'friendlyName',
      'method',
    ]);
    expect(body.challengeId).toBe(CHALLENGE_ID);
  });

  it('[P2-S09-AC-825] accepts a strict object containing only method and an optional factorId', async () => {
    const jar = await mintJar();
    for (const body of [
      { method: 'totp', extra: 1 },
      { method: 'totp', factorId: FACTOR_ID, sessionId: SESSION_ID },
      {},
    ]) {
      const world = createWorld();
      const response = await send(world.app, { ...BASE[20], body, jar });
      expect([400, 422]).toContain(response.status);
      expect(rpcNames(world.calls)).not.toContain(
        'auth_step_up_challenge_begin',
      );
    }
    const named = createWorld();
    const ok = await send(named.app, {
      ...BASE[20],
      body: { method: 'totp', factorId: FACTOR_ID },
      jar,
    });
    expect(ok.status).toBe(201);
  });

  it.each(['sms', 'webauthn', 'TOTP', ''])(
    '[P2-S09-AC-826] rejects method %j with 422 method_not_available',
    async (method) => {
      const world = createWorld();
      const response = await send(world.app, {
        ...BASE[20],
        body: { method },
        jar: await mintJar(),
      });
      expect(response.status).toBe(422);
      expect((await bodyOf(response)).details).toMatchObject({
        violations: [{ path: '/method', code: 'method_not_available' }],
      });
    },
  );

  it.each(['not-a-uuid', '12345', 7])(
    '[P2-S09-AC-827][P2-S09-AC-831] rejects factorId %j with 422 factor_id_invalid before any dependency call',
    async (factorId) => {
      const world = createWorld();
      const response = await send(world.app, {
        ...BASE[20],
        body: { method: 'totp', factorId },
        jar: await mintJar(),
      });
      expect(response.status).toBe(422);
      expect((await bodyOf(response)).details).toMatchObject({
        violations: [{ path: '/factorId', code: 'factor_id_invalid' }],
      });
      expect(rpcNames(world.calls)).not.toContain(
        'auth_step_up_challenge_begin',
      );
    },
  );

  it('[P2-S09-AC-828][P2-S09-AC-832] forwards an absent factorId as null and reports 422 factor_id_required when the registry needs one', async () => {
    const jar = await mintJar();
    const single = createWorld();
    await send(single.app, { ...BASE[20], jar });
    expect(rpc(single, 'auth_step_up_challenge_begin')?.body?.p_factor_id).toBe(
      null,
    );
    const ambiguous = createWorld({
      handlers: {
        auth_step_up_challenge_begin: () =>
          rpcRefusal('FACTOR_ID_REQUIRED', 422),
      },
    });
    const response = await send(ambiguous.app, { ...BASE[20], jar });
    expect(response.status).toBe(422);
    expect((await bodyOf(response)).details).toMatchObject({
      violations: [{ path: '/factorId', code: 'factor_id_required' }],
    });
    expect(providerCalls(ambiguous.calls)).toStrictEqual([]);
  });

  it('[P2-S09-AC-829] answers 409 no_verified_factor with recoveryAction enroll_factor and no provider call', async () => {
    const world = createWorld({
      handlers: {
        auth_step_up_challenge_begin: () =>
          rpcRefusal('NO_VERIFIED_FACTOR', 409),
      },
    });
    const response = await send(world.app, {
      ...BASE[20],
      jar: await mintJar(),
    });
    expect(response.status).toBe(409);
    expect((await bodyOf(response)).details).toStrictEqual({
      conflict: 'INVALID_TRANSITION',
      reasonCode: 'no_verified_factor',
      recoveryAction: 'enroll_factor',
    });
    expect(providerCalls(world.calls)).toStrictEqual([]);
  });

  it.each([
    ['NOT_FOUND', 404, null],
    ['FACTOR_NOT_VERIFIED', 409, 'factor_not_verified'],
    ['FACTOR_STATE_CONFLICT', 409, 'factor_state_conflict'],
  ] as const)(
    '[P2-S09-AC-830] maps a supplied-factor refusal %s to %i',
    async (refusal, status, reason) => {
      const world = createWorld({
        handlers: {
          auth_step_up_challenge_begin: () => rpcRefusal(refusal, status),
        },
      });
      const response = await send(world.app, {
        ...BASE[20],
        body: { method: 'totp', factorId: OTHER_FACTOR_ID },
        jar: await mintJar(),
      });
      expect(response.status).toBe(status);
      const body = await bodyOf(response);
      if (reason === null) expect(body.details).toStrictEqual({});
      else expect(body.details).toMatchObject({ reasonCode: reason });
      expect(providerCalls(world.calls)).toStrictEqual([]);
    },
  );

  it.each([
    [1200, 600],
    [180, 180],
  ] as const)(
    '[P2-S09-AC-834] caps expires_at at the earlier of the provider expiry (+%i s) and ten minutes (+%i s) and grants nothing',
    async (providerSeconds, expected) => {
      const world = createWorld({
        handlers: {
          [P_CHALLENGE]: () =>
            json({
              id: PROVIDER_CHALLENGE_ID,
              expires_at: Math.floor(NOW / 1000) + providerSeconds,
            }),
        },
      });
      const response = await send(world.app, {
        ...BASE[20],
        jar: await mintJar({ stepUpAt: null }),
      });
      expect(response.status).toBe(201);
      expect(
        rpc(world, 'auth_step_up_challenge_finish')?.body?.p_expires_at,
      ).toBe(iso(expected));
      expect(setCookies(response)).toHaveLength(0);
    },
  );

  it('[P2-S09-AC-835] allows only the self user with a verified session and an eligible account', async () => {
    const anonymous = createWorld();
    const jar = await mintJar();
    const stripped = {
      ...jar,
      cookie: jar.cookie
        .split('; ')
        .filter((pair) => !pair.startsWith('wj_access='))
        .join('; '),
    };
    expect(
      (await send(anonymous.app, { ...BASE[20], jar: stripped })).status,
    ).toBe(401);
    const ineligible = createWorld({
      handlers: {
        auth_session_read: () =>
          json({
            accountState: 'suspended',
            bootstrapState: 'complete',
            personId: '44444444-4444-4444-8444-444444444444',
            actingPartyId: '44444444-4444-4444-8444-444444444444',
          }),
      },
    });
    expect((await send(ineligible.app, { ...BASE[20], jar })).status).toBe(403);
    expect(rpcNames(ineligible.calls)).not.toContain(
      'auth_step_up_challenge_begin',
    );
  });

  it('[P2-S09-AC-836] binds the challenge to the Auth UUID, the exact session id and the factor on both transactions', async () => {
    const world = createWorld();
    await send(world.app, { ...BASE[20], jar: await mintJar() });
    expect(rpc(world, 'auth_step_up_challenge_begin')?.body).toMatchObject({
      p_auth_user_id: AUTH_USER_ID,
      p_session_id: SESSION_ID,
      p_method: 'totp',
    });
    expect(rpc(world, 'auth_step_up_challenge_finish')?.body).toMatchObject({
      p_auth_user_id: AUTH_USER_ID,
      p_session_id: SESSION_ID,
      p_factor_id: FACTOR_ID,
      p_provider_challenge_id: PROVIDER_CHALLENGE_ID,
    });
  });

  it('[P2-S09-AC-838] supersedes in one transaction, creates the provider challenge, then records the pending row in a second transaction', async () => {
    const world = createWorld();
    await send(world.app, { ...BASE[20], jar: await mintJar() });
    const order = world.calls
      .filter((call) => call.path !== '/auth/v1/user')
      .map((call) => call.rpc ?? `${call.method} ${call.path}`)
      .filter(
        (name) => name !== 'auth_rate_limit' && name !== 'auth_session_read',
      );
    expect(order).toStrictEqual([
      'auth_step_up_challenge_begin',
      P_CHALLENGE,
      'auth_step_up_challenge_finish',
    ]);
  });

  it('[P2-S09-AC-837] carries no client Idempotency-Key: none is required and none reaches persistence', async () => {
    const world = createWorld();
    const response = await send(world.app, {
      ...BASE[20],
      jar: await mintJar(),
      headers: { 'idempotency-key': 'k'.repeat(24) },
    });
    expect(response.status).toBe(201);
    for (const call of world.calls)
      expect(Object.keys(call.body ?? {})).not.toContain('p_key_hash');
  });

  it('[P2-S09-AC-839] is limited to 10 per 15 minutes with an 8 s deadline', async () => {
    const jar = await mintJar();
    const world = createWorld();
    await send(world.app, { ...BASE[20], jar });
    expect(rpc(world, 'auth_rate_limit')?.body).toMatchObject({
      p_limit: 10,
      p_window_seconds: 900,
    });
    const delays = collapseDeadline(8_000);
    const slow = createWorld({
      handlers: { auth_step_up_challenge_begin: hangUntilAborted },
    });
    const response = await send(slow.app, { ...BASE[20], jar });
    expect(delays).toContain(8_000);
    expect(response.status).toBe(504);
  });
});
