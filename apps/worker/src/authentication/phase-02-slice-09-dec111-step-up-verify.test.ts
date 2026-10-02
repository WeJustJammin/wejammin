import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AUTH_USER_ID,
  CHALLENGE_ID,
  FACTOR_ID,
  NOW,
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
import { BASE, P_VERIFY } from './dec111-wire-scenarios.test-support';

/** AUTH-API-21 through the production Worker composition. */
const CHALLENGES = '/api/v1/auth/step-up/challenges';

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

describe('AUTH-API-21 step-up verify (production composition)', () => {
  it('[P2-S09-AC-853][P2-S09-AC-858] returns 200 with exactly { verified, method, stepUpAt, freshUntil } and rotated cookies, with no token in the body', async () => {
    const world = createWorld();
    const response = await send(world.app, {
      ...BASE[21],
      jar: await mintJar(),
    });
    expect(response.status).toBe(200);
    const text = await response.text();
    const body = JSON.parse(text) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toStrictEqual([
      'freshUntil',
      'method',
      'stepUpAt',
      'verified',
    ]);
    expect(body).toMatchObject({
      verified: true,
      method: 'totp',
      stepUpAt: iso(0),
      freshUntil: iso(600),
    });
    for (const secret of [
      '34343434-3434',
      'caller-refresh',
      'r2',
      'eyJ',
      PROVIDER_FACTOR_ID,
    ])
      expect(text).not.toContain(secret);
    expect(setCookies(response).map((cookie) => cookie.name)).toContain(
      'wj_access',
    );
  });

  it('[P2-S09-AC-854][P2-S09-AC-855] accepts a strict object containing only a six-digit code, else 422 code_invalid', async () => {
    const jar = await mintJar();
    const extra = createWorld();
    const strict = await send(extra.app, {
      ...BASE[21],
      body: { code: '123456', challengeId: CHALLENGE_ID },
      jar,
    });
    expect([400, 422]).toContain(strict.status);
    for (const code of ['12345', '1234567', 'abc123', ' 12345', '12-345']) {
      const world = createWorld();
      const response = await send(world.app, {
        ...BASE[21],
        body: { code },
        jar,
      });
      expect(response.status).toBe(422);
      expect((await bodyOf(response)).details).toMatchObject({
        violations: [{ path: '/code', code: 'code_invalid' }],
      });
      expect(providerCalls(world.calls)).toStrictEqual([]);
    }
  });

  it('[P2-S09-AC-856][P2-S09-AC-859] binds the challenge to the caller Auth UUID and exact session: 400 malformed, 404 for another user or session, never a provider call', async () => {
    const jar = await mintJar();
    const malformed = createWorld();
    expect(
      (
        await send(malformed.app, {
          ...BASE[21],
          path: `${CHALLENGES}/${CHALLENGE_ID}0/verify`,
          jar,
        })
      ).status,
    ).toBe(400);
    const foreign = createWorld({
      handlers: {
        auth_step_up_challenge_verify_prepare: () =>
          rpcRefusal('NOT_FOUND', 404),
      },
    });
    const response = await send(foreign.app, { ...BASE[21], jar });
    expect(response.status).toBe(404);
    expect((await bodyOf(response)).details).toStrictEqual({});
    expect(
      rpc(foreign, 'auth_step_up_challenge_verify_prepare')?.body,
    ).toMatchObject({
      p_auth_user_id: AUTH_USER_ID,
      p_session_id: SESSION_ID,
      p_challenge_id: CHALLENGE_ID,
    });
    expect(providerCalls(foreign.calls)).toStrictEqual([]);
  });

  it.each([
    ['CHALLENGE_EXPIRED', 'challenge_expired'],
    ['CHALLENGE_CONSUMED', 'challenge_consumed'],
  ] as const)(
    '[P2-S09-AC-857] answers 409 %s as %s with recoveryAction new_challenge',
    async (refusal, reasonCode) => {
      const world = createWorld({
        handlers: {
          auth_step_up_challenge_verify_prepare: () => rpcRefusal(refusal, 409),
        },
      });
      const response = await send(world.app, {
        ...BASE[21],
        jar: await mintJar(),
      });
      expect(response.status).toBe(409);
      expect((await bodyOf(response)).details).toStrictEqual({
        conflict: 'INVALID_TRANSITION',
        reasonCode,
        recoveryAction: 'new_challenge',
      });
      expect(providerCalls(world.calls)).toStrictEqual([]);
    },
  );

  it('[P2-S09-AC-857] refuses a challenge past its own expiry before any provider call', async () => {
    const world = createWorld({
      handlers: {
        auth_step_up_challenge_verify_prepare: () =>
          json({
            factorId: FACTOR_ID,
            providerFactorId: PROVIDER_FACTOR_ID,
            providerChallengeId: PROVIDER_CHALLENGE_ID,
            expiresAt: iso(-1),
          }),
      },
    });
    const response = await send(world.app, {
      ...BASE[21],
      jar: await mintJar(),
    });
    expect(response.status).toBe(409);
    expect((await bodyOf(response)).details).toMatchObject({
      reasonCode: 'challenge_expired',
      recoveryAction: 'new_challenge',
    });
    expect(providerCalls(world.calls)).toStrictEqual([]);
  });

  it('[P2-S09-AC-860] keeps the challenge pending on a wrong code: 422 code_incorrect, the failure is recorded as incorrect, nothing is settled and no cookie is set', async () => {
    const world = createWorld({
      handlers: {
        [P_VERIFY]: () => json({ error_code: 'mfa_verification_failed' }, 400),
      },
    });
    const response = await send(world.app, {
      ...BASE[21],
      jar: await mintJar(),
    });
    expect(response.status).toBe(422);
    expect((await bodyOf(response)).details).toMatchObject({
      violations: [{ path: '/code', code: 'code_incorrect' }],
    });
    expect(
      rpc(world, 'auth_step_up_challenge_failure_record')?.body,
    ).toMatchObject({ p_challenge_id: CHALLENGE_ID, p_outcome: 'incorrect' });
    expect(rpcNames(world.calls)).not.toContain(
      'auth_step_up_challenge_verify_settle',
    );
    expect(setCookies(response)).toHaveLength(0);
  });

  it('[P2-S09-AC-860] fails closed with 503 when the wrong-code attempt cannot be recorded', async () => {
    const world = createWorld({
      handlers: {
        [P_VERIFY]: () => json({ error_code: 'mfa_verification_failed' }, 400),
        auth_step_up_challenge_failure_record: () => rpcRefusal('boom', 500),
      },
    });
    const response = await send(world.app, {
      ...BASE[21],
      jar: await mintJar(),
    });
    expect(response.status).toBe(503);
  });

  it('[P2-S09-AC-861] carries no client Idempotency-Key: none is required and none reaches persistence', async () => {
    const world = createWorld();
    const response = await send(world.app, {
      ...BASE[21],
      jar: await mintJar(),
      headers: { 'idempotency-key': 'k'.repeat(24) },
    });
    expect(response.status).toBe(200);
    for (const call of world.calls)
      expect(Object.keys(call.body ?? {})).not.toContain('p_key_hash');
  });

  it.each([
    [
      'an invalid 2xx provider shape',
      () => new Response('not json', { status: 200 }),
      502,
    ],
    [
      'a returned token that fails validation',
      () => json({ access_token: 'not-a-jwt', refresh_token: 'r' }),
      502,
    ],
    [
      'a post-send timeout',
      () => {
        throw new DOMException('slow', 'AbortError');
      },
      504,
    ],
  ] as const)(
    '[P2-S09-AC-863] fails the challenge on %s: recorded ambiguous, no settle, no cookie (%i)',
    async (_label, failure, status) => {
      const world = createWorld({ handlers: { [P_VERIFY]: failure } });
      const response = await send(world.app, {
        ...BASE[21],
        jar: await mintJar(),
      });
      expect(response.status).toBe(status);
      expect(
        rpc(world, 'auth_step_up_challenge_failure_record')?.body?.p_outcome,
      ).toBe('ambiguous');
      expect(rpcNames(world.calls)).not.toContain(
        'auth_step_up_challenge_verify_settle',
      );
      expect(setCookies(response)).toHaveLength(0);
    },
  );

  it.each([
    [{ 'retry-after': '120' }, 120],
    [{}, 900],
  ] as const)(
    '[P2-S09-AC-864] returns 429 with the provider retry delay (%j -> %i s), defaulting to 900',
    async (headers, seconds) => {
      const world = createWorld({
        handlers: {
          [P_VERIFY]: () =>
            new Response('{}', {
              status: 429,
              headers: { 'content-type': 'application/json', ...headers },
            }),
        },
      });
      const response = await send(world.app, {
        ...BASE[21],
        jar: await mintJar(),
      });
      expect(response.status).toBe(429);
      expect(response.headers.get('retry-after')).toBe(String(seconds));
      expect((await bodyOf(response)).details).toMatchObject({
        retryAfterSeconds: seconds,
      });
      expect(rpcNames(world.calls)).not.toContain(
        'auth_step_up_challenge_verify_settle',
      );
    },
  );

  it('[P2-S09-AC-862] verifies at the provider, validates the returned session, then consumes and rotates in one settle transaction', async () => {
    const world = createWorld();
    await send(world.app, { ...BASE[21], jar: await mintJar() });
    const order = world.calls
      .filter((call) => call.path !== '/auth/v1/user')
      .map((call) => call.rpc ?? `${call.method} ${call.path}`)
      .filter(
        (name) => name !== 'auth_rate_limit' && name !== 'auth_session_read',
      );
    expect(order).toStrictEqual([
      'auth_step_up_challenge_verify_prepare',
      P_VERIFY,
      'auth_step_up_challenge_verify_settle',
    ]);
    expect(
      rpc(world, 'auth_step_up_challenge_verify_settle')?.body,
    ).toMatchObject({
      p_session_id: SESSION_ID,
      p_challenge_id: CHALLENGE_ID,
      p_new_session_id: '34343434-3434-4434-8434-343434343434',
    });
  });

  it('is limited to 10 per 15 minutes with an 8 s deadline', async () => {
    const jar = await mintJar();
    const world = createWorld();
    await send(world.app, { ...BASE[21], jar });
    expect(rpc(world, 'auth_rate_limit')?.body).toMatchObject({
      p_limit: 10,
      p_window_seconds: 900,
    });
    const delays = collapseDeadline(8_000);
    const slow = createWorld({
      handlers: { auth_step_up_challenge_verify_prepare: hangUntilAborted },
    });
    const response = await send(slow.app, { ...BASE[21], jar });
    expect(delays).toContain(8_000);
    expect(response.status).toBe(504);
  });
});
