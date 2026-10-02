import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PERSON_ID,
  REQUEST_ID,
  collapseDeadline,
  countingRateLimiter,
  createWorld,
  expectApiError,
  hangUntilAborted,
  json,
  mintJar,
  NOW,
  providerCalls,
  rpcRefusal,
  send,
} from '../authentication/dec111-composition.test-support';
import { resetResponse } from './admin-mfa-reset.test-support';
import {
  BODY,
  FACTOR_A,
  FACTOR_B,
  KEY,
  PATH,
  REMOVE_A,
  REMOVE_B,
  TARGET_AUTH,
  handlers,
  names,
  post,
} from './phase-02-slice-09-cfg05b06-wire.test-support';

/**
 * CFG-05B-06 through the production Worker composition: Hono route, the real
 * session cookie jar and CSRF binding, the production request-context
 * resolver, the production port and the operator-only provider adapter. Only
 * the PostgREST RPC endpoint and Supabase Auth admin endpoint are faked.
 */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('CFG-05B-06 production composition wire', () => {
  it('[P2-S09-AC-918][P2-S09-AC-925][P2-S09-AC-924] returns 200 completed after every provider removal is confirmed, with exactly the six response fields and no factor identifier', async () => {
    const { world, response } = await post();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const text = await response.text();
    const body = JSON.parse(text) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toStrictEqual(
      [
        'mfaVersion',
        'outboxEventId',
        'removedFactorCount',
        'resetId',
        'state',
        'targetPersonId',
      ].sort(),
    );
    expect(body.state).toBe('completed');
    for (const secret of [FACTOR_A, FACTOR_B, TARGET_AUTH])
      expect(text).not.toContain(secret);
    expect(names(world.calls)).toStrictEqual([
      'auth_session_read',
      'admin_context_capabilities',
      'auth_rate_limit',
      'auth_rate_limit',
      'admin_mfa_factor_reset',
      'admin_mfa_factor_reset_settle',
    ]);
    expect(providerCalls(world.calls)).toStrictEqual([REMOVE_A, REMOVE_B]);
  });

  it('[P2-S09-AC-919] returns 202 reconciling when a provider removal is ambiguous and never reports completed first', async () => {
    const { world, response } = await post(
      {
        [REMOVE_B]: () => new Response('{}', { status: 500 }),
        admin_mfa_factor_reset_settle: () =>
          json(resetResponse({ state: 'reconciling', removedFactorCount: 1 })),
      },
      {},
    );
    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({
      state: 'reconciling',
      removedFactorCount: 1,
    });
    const settle = world.calls.find(
      (call) => call.rpc === 'admin_mfa_factor_reset_settle',
    );
    const outcomes = (
      settle?.body?.p_request as { outcomes: { outcome: string }[] }
    ).outcomes.map((entry) => entry.outcome);
    expect(outcomes).toStrictEqual(['removed', 'failed']);
  });

  it('[P2-S09-AC-932][P2-S09-AC-933] calls the operator adapter once per factor with the service credential and no retry after send, then settles in a second call without touching the first', async () => {
    const attempts: string[] = [];
    const { world, response } = await post({
      [REMOVE_A]: (call) => {
        attempts.push(call.headers.get('authorization') ?? 'none');
        return new Response('{}', { status: 503 });
      },
    });
    expect(response.status).toBeLessThan(500);
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).not.toContain('caller-access-token-secret');
    expect(
      world.calls
        .filter((call) => call.rpc === null && call.method === 'DELETE')
        .map((call) => call.headers.get('apikey')),
    ).toStrictEqual(['sb_secret_test_only', 'sb_secret_test_only']);
    const reserve = names(world.calls).indexOf('admin_mfa_factor_reset');
    const settle = names(world.calls).indexOf('admin_mfa_factor_reset_settle');
    expect(reserve).toBeGreaterThan(-1);
    expect(settle).toBeGreaterThan(reserve);
    expect(
      names(world.calls).filter((name) => name === 'admin_mfa_factor_reset'),
    ).toHaveLength(1);
  });

  it('[P2-S09-AC-932] registers a 5,000 ms per-call provider deadline and a 15,000 ms route deadline', async () => {
    const delays = collapseDeadline(5000);
    await post({ [REMOVE_A]: () => json({}) });
    expect(delays).toContain(5000);
    expect(delays).toContain(15_000);
  });

  it('[P2-S09-AC-944] returns 503 IDENTITY_UNAVAILABLE for an unavailable identity RPC', async () => {
    const { response } = await post({
      admin_mfa_factor_reset: () => rpcRefusal('boom', 500),
    });
    await expectApiError(response, {
      status: 503,
      code: 'IDENTITY_UNAVAILABLE',
      shape: { keys: [], optional: ['retryable', 'dependencyClass'] },
    });
  });

  it('fails with 504 when the reserve RPC outlives the 15 s route deadline (the BE00 deadline row, not the AC-944 503 row)', async () => {
    collapseDeadline(15_000);
    const { response } = await post({
      admin_mfa_factor_reset: hangUntilAborted,
    });
    expect(response.status).toBe(504);
  });

  it('[P2-S09-AC-937] returns 401 STEP_UP_REQUIRED for a stale or absent proof before any rate charge or idempotency reservation', async () => {
    for (const stepUpAt of [
      new Date(NOW - 601_000).toISOString(),
      new Date(NOW + 31_000).toISOString(),
      null,
    ]) {
      const { world, response } = await post({}, { stepUpAt });
      await expectApiError(response, {
        status: 401,
        code: 'STEP_UP_REQUIRED',
        shape: {
          exact: { recoveryAction: 'step_up', allowedMethods: ['totp'] },
        },
      });
      expect(names(world.calls)).not.toContain('admin_mfa_factor_reset');
      expect(
        world.calls.filter((call) => call.body?.p_limit === 5),
      ).toHaveLength(0);
    }
  });

  it('[P2-S09-AC-926][P2-S09-AC-938] requires admin.identity.mfa_reset: 403 FORBIDDEN without it, before the step-up check and the database', async () => {
    const { world, response } = await post(
      {},
      {
        capabilities: ['admin.inbox.read'],
        stepUpAt: new Date(NOW - 9_999_000).toISOString(),
      },
    );
    await expectApiError(response, {
      status: 403,
      code: 'FORBIDDEN',
      shape: { keys: [], optional: ['reasonCode', 'recoveryAction'] },
    });
    expect(names(world.calls)).not.toContain('admin_mfa_factor_reset');
  });

  it('[P2-S09-AC-936] returns 401 UNAUTHENTICATED without a session', async () => {
    const world = createWorld({ handlers: handlers() });
    const response = await send(world.app, {
      method: 'POST',
      path: PATH,
      body: BODY,
      jar: null,
      headers: { 'idempotency-key': KEY },
    });
    expect(response.status).toBe(401);
    expect((await response.json()) as { code: string }).toMatchObject({
      code: 'UNAUTHENTICATED',
    });
    expect(names(world.calls)).not.toContain('admin_mfa_factor_reset');
  });

  it('[P2-S09-AC-928][P2-S09-AC-942] refuses a self-target with 422 MFA_RESET_INVALID before the database', async () => {
    const { world, response } = await post(
      {},
      { body: { ...BODY, targetPersonId: PERSON_ID } },
    );
    const body = await expectApiError(response, {
      status: 422,
      code: 'MFA_RESET_INVALID',
      shape: { keys: [], optional: ['reasonCode', 'violations'] },
    });
    expect(body.code).toBe('MFA_RESET_INVALID');
    expect(names(world.calls)).not.toContain('admin_mfa_factor_reset');
  });

  it('[P2-S09-AC-934][P2-S09-AC-943] charges 5 per hour per user and 10 per hour per party and returns 429 at the limit', async () => {
    const limiter = countingRateLimiter();
    const world = createWorld({
      handlers: handlers({ auth_rate_limit: limiter }),
    });
    const jar = await mintJar();
    const attempt = () =>
      send(world.app, {
        method: 'POST',
        path: PATH,
        body: BODY,
        jar,
        headers: { 'idempotency-key': KEY },
      });
    const statuses: number[] = [];
    for (let index = 0; index < 6; index += 1)
      statuses.push((await attempt()).status);
    expect(statuses.slice(0, 5)).toStrictEqual([200, 200, 200, 200, 200]);
    expect(statuses[5]).toBe(429);
    const limits = new Set(
      world.calls
        .filter(
          (call) =>
            call.rpc === 'auth_rate_limit' &&
            call.body?.p_window_seconds === 3600,
        )
        .map((call) => call.body?.p_limit),
    );
    expect(limits).toStrictEqual(new Set([5, 10]));
  });

  it('[P2-S09-AC-939][P2-S09-AC-940][P2-S09-AC-941] maps TARGET_NOT_FOUND to 404 and IDEMPOTENCY_CONFLICT and MFA_RESET_IN_PROGRESS to 409 with the BE00 envelope', async () => {
    for (const [message, status] of [
      ['TARGET_NOT_FOUND', 404],
      ['IDEMPOTENCY_CONFLICT', 409],
      ['MFA_RESET_IN_PROGRESS', 409],
    ] as const) {
      const { world, response } = await post({
        admin_mfa_factor_reset: () => rpcRefusal(message),
      });
      const body = (await response.json()) as Record<string, unknown>;
      expect(response.status).toBe(status);
      expect(body.code).toBe(message);
      expect(body.requestId).toBe(REQUEST_ID);
      expect(Object.keys(body).sort()).toStrictEqual([
        'code',
        'details',
        'message',
        'requestId',
      ]);
      expect(providerCalls(world.calls)).toStrictEqual([]);
    }
  });
});
