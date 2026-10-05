import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AUTH_USER_ID,
  FACTOR_ID,
  NOW,
  PROVIDER_FACTOR_ID,
  bodyOf,
  collapseDeadline,
  countingRateLimiter,
  createWorld,
  factorRow,
  hangUntilAborted,
  json,
  mintJar,
  pendingRow,
  providerCalls,
  rpcNames,
  rpcRefusal,
  send,
} from './dec111-composition.test-support';
import { BASE, P_DELETE } from './dec111-wire-scenarios.test-support';

/** AUTH-API-19 through the production Worker composition. */
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

describe('AUTH-API-19 factor removal (production composition)', () => {
  it('[P2-S09-AC-792][P2-S09-AC-807] returns 200 with the new ETag after reserving, unenrolling at the provider and then confirming', async () => {
    const world = createWorld();
    const response = await send(world.app, {
      ...BASE[19],
      jar: await mintJar(),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('etag')).toBe('"7"');
    expect((await bodyOf(response)).version).toBe('7');
    expect(sequence(world)).toStrictEqual([
      'auth_mfa_factors_read',
      'auth_mfa_removal_begin',
      P_DELETE,
      'auth_mfa_removal_finish',
    ]);
  });

  it('[P2-S09-AC-793] accepts a strict object containing only reason', async () => {
    const jar = await mintJar();
    for (const body of [
      { reason: 'user_request', factorId: FACTOR_ID },
      { reason: 'user_request', note: 'x' },
      {},
    ]) {
      const world = createWorld();
      const response = await send(world.app, { ...BASE[19], body, jar });
      // A strict-object violation (an unknown or missing member) is the one
      // 422 VALIDATION_FAILED outcome, never a 400.
      expect(response.status).toBe(422);
      expect(((await response.clone().json()) as { code: string }).code).toBe(
        'VALIDATION_FAILED',
      );
      expect(rpcNames(world.calls)).not.toContain('auth_mfa_removal_begin');
    }
  });

  it.each(['other', '', 'USER_REQUEST', 'user_request '])(
    '[P2-S09-AC-794][P2-S09-AC-799] rejects reason %j with 422 reason_invalid',
    async (reason) => {
      const world = createWorld();
      const response = await send(world.app, {
        ...BASE[19],
        body: { reason },
        jar: await mintJar(),
      });
      expect(response.status).toBe(422);
      expect((await bodyOf(response)).details).toMatchObject({
        violations: [{ path: '/reason', code: 'reason_invalid' }],
      });
      expect(rpcNames(world.calls)).not.toContain('auth_mfa_removal_begin');
    },
  );

  it('[P2-S09-AC-795][P2-S09-AC-800] binds the path factorId to the caller: 400 malformed, 404 when the caller does not own it, identity from the session', async () => {
    const jar = await mintJar();
    const malformed = createWorld();
    expect(
      (
        await send(malformed.app, {
          ...BASE[19],
          path: `${LIST}/not-a-uuid`,
          jar,
        })
      ).status,
    ).toBe(400);
    const foreign = createWorld({
      handlers: {
        auth_mfa_factors_read: () => json({ factors: [], version: '3' }),
      },
    });
    const response = await send(foreign.app, { ...BASE[19], jar });
    expect(response.status).toBe(404);
    expect(providerCalls(foreign.calls)).toStrictEqual([]);
    const read = foreign.calls.find(
      (call) => call.rpc === 'auth_mfa_factors_read',
    );
    expect(read?.body?.p_auth_user_id).toBe(AUTH_USER_ID);
  });

  it('[P2-S09-AC-796] requires a strong quoted positive decimal If-Match and forwards it as the expected version', async () => {
    const jar = await mintJar();
    for (const header of [null, '3', 'W/"3"', '"0"', '*']) {
      const world = createWorld();
      const response = await send(world.app, {
        ...BASE[19],
        jar,
        headers: { ...BASE[19].headers, 'if-match': header },
      });
      expect(response.status).toBe(400);
      expect(rpcNames(world.calls)).not.toContain('auth_mfa_removal_begin');
    }
    const world = createWorld();
    await send(world.app, {
      ...BASE[19],
      jar,
      headers: { ...BASE[19].headers, 'if-match': '"9"' },
    });
    expect(
      world.calls.find((call) => call.rpc === 'auth_mfa_removal_begin')?.body
        ?.p_expected_version,
    ).toBe('9');
  });

  it('[P2-S09-AC-797] requires an Idempotency-Key, sends only its hash, and replays a completed removal without touching the provider again', async () => {
    const jar = await mintJar();
    for (const key of [null, 'short', 'k'.repeat(200)]) {
      const world = createWorld();
      const response = await send(world.app, {
        ...BASE[19],
        jar,
        headers: { ...BASE[19].headers, 'idempotency-key': key },
      });
      expect(response.status).toBe(400);
      expect(rpcNames(world.calls)).not.toContain('auth_mfa_removal_begin');
    }
    const replay = createWorld({
      handlers: {
        auth_mfa_removal_begin: () =>
          json({
            providerFactorId: PROVIDER_FACTOR_ID,
            replay: { factors: [], version: '7' },
          }),
      },
    });
    const response = await send(replay.app, { ...BASE[19], jar });
    expect(response.status).toBe(200);
    expect((await bodyOf(response)).version).toBe('7');
    expect(providerCalls(replay.calls)).toStrictEqual([]);
    const begin = replay.calls.find(
      (call) => call.rpc === 'auth_mfa_removal_begin',
    );
    expect(JSON.stringify(begin?.body)).not.toContain('idem-key-0123456789');
    expect(String(begin?.body?.p_key_hash)).toMatch(/^[0-9a-f\\x]{16,}/u);
  });

  it('[P2-S09-AC-798] refuses a reconciling factor with 409 factor_state_conflict and never calls the provider', async () => {
    const world = createWorld({
      handlers: {
        auth_mfa_factors_read: () =>
          json({
            factors: [factorRow({ state: 'reconciling' })],
            version: '3',
          }),
      },
    });
    const response = await send(world.app, {
      ...BASE[19],
      jar: await mintJar(),
    });
    expect(response.status).toBe(409);
    expect((await bodyOf(response)).details).toMatchObject({
      conflict: 'INVALID_TRANSITION',
      reasonCode: 'factor_state_conflict',
    });
    expect(providerCalls(world.calls)).toStrictEqual([]);
    expect(rpcNames(world.calls)).not.toContain('auth_mfa_removal_begin');
  });

  it('[P2-S09-AC-801] requires recent step-up to remove a verified factor and none to cancel a pending one', async () => {
    const stale = await mintJar({ stepUpAt: null });
    const verified = createWorld();
    const refused = await send(verified.app, { ...BASE[19], jar: stale });
    expect(refused.status).toBe(401);
    expect((await bodyOf(refused)).code).toBe('STEP_UP_REQUIRED');
    expect(rpcNames(verified.calls)).not.toContain('auth_mfa_removal_begin');
    const pending = createWorld({
      handlers: {
        auth_mfa_factors_read: () =>
          json({ factors: [pendingRow({ id: FACTOR_ID })], version: '3' }),
      },
    });
    const cancelled = await send(pending.app, { ...BASE[19], jar: stale });
    expect(cancelled.status).toBe(200);
  });

  it('[P2-S09-AC-802][P2-S09-AC-803] answers 409 last_factor_required with recoveryAction enroll_factor and never reaches the provider', async () => {
    const world = createWorld({
      handlers: {
        auth_mfa_removal_begin: () => rpcRefusal('LAST_FACTOR_REQUIRED', 409),
      },
    });
    const response = await send(world.app, {
      ...BASE[19],
      jar: await mintJar(),
    });
    expect(response.status).toBe(409);
    expect((await bodyOf(response)).details).toStrictEqual({
      conflict: 'INVALID_TRANSITION',
      reasonCode: 'last_factor_required',
      recoveryAction: 'enroll_factor',
    });
    expect(providerCalls(world.calls)).toStrictEqual([]);
    expect(rpcNames(world.calls)).not.toContain('auth_mfa_removal_finish');
  });

  it('[P2-S09-AC-805] forwards factor_compromise so the database revokes the other sessions by exact session id', async () => {
    const world = createWorld();
    await send(world.app, {
      ...BASE[19],
      body: { reason: 'factor_compromise' },
      jar: await mintJar(),
    });
    const begin = world.calls.find(
      (call) => call.rpc === 'auth_mfa_removal_begin',
    );
    expect(begin?.body).toMatchObject({
      p_reason: 'factor_compromise',
      p_session_id: '33333333-3333-4333-8333-333333333333',
    });
  });

  it.each([
    [
      'a timeout',
      () => {
        throw new DOMException('slow', 'AbortError');
      },
      504,
    ],
    ['a provider failure', () => new Response('{}', { status: 500 }), 503],
  ] as const)(
    '[P2-S09-AC-808] leaves the factor reconciling after %s: no confirmation, no blind resend, and a repeat request is blocked',
    async (_label, failure, status) => {
      const world = createWorld({ handlers: { [P_DELETE]: failure } });
      const jar = await mintJar();
      const response = await send(world.app, { ...BASE[19], jar });
      expect(response.status).toBe(status);
      expect(rpcNames(world.calls)).not.toContain('auth_mfa_removal_finish');
      expect(
        providerCalls(world.calls).filter((call) => call === P_DELETE),
      ).toHaveLength(1);
      const blocked = createWorld({
        handlers: {
          auth_mfa_factors_read: () =>
            json({
              factors: [factorRow({ state: 'reconciling' })],
              version: '4',
            }),
        },
      });
      const repeat = await send(blocked.app, { ...BASE[19], jar });
      expect(repeat.status).toBe(409);
      expect(providerCalls(blocked.calls)).toStrictEqual([]);
    },
  );

  it('[P2-S09-AC-809] is limited to 5 per hour per user with a 15 s deadline and a 429 at the limit', async () => {
    const jar = await mintJar();
    const world = createWorld({
      handlers: { auth_rate_limit: countingRateLimiter() },
    });
    for (let attempt = 0; attempt < 5; attempt += 1)
      expect((await send(world.app, { ...BASE[19], jar })).status).toBe(200);
    const limited = await send(world.app, { ...BASE[19], jar });
    expect(limited.status).toBe(429);
    expect(
      world.calls.find((call) => call.rpc === 'auth_rate_limit')?.body,
    ).toMatchObject({ p_limit: 5, p_window_seconds: 3600 });
    const delays = collapseDeadline(15_000);
    const slow = createWorld({
      handlers: { auth_mfa_removal_begin: hangUntilAborted },
    });
    const response = await send(slow.app, { ...BASE[19], jar });
    expect(delays).toContain(15_000);
    expect(response.status).toBe(504);
  });
});
