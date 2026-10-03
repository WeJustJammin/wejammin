import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  NOW,
  bodyOf,
  createWorld,
  mintJar,
  providerCalls,
  send,
} from '../authentication/dec111-composition.test-support';
import {
  BODY,
  KEY,
  PATH,
  REMOVE_A,
  REMOVE_B,
  handlers,
  names,
} from './phase-02-slice-09-cfg05b06-wire.test-support';

/**
 * AC1031 worker half for CFG-05B-06: the 401 STEP_UP_REQUIRED happens before any
 * rate charge, idempotency reservation or provider call, so the operator retries
 * the draft with the ORIGINAL Idempotency-Key and the reset runs exactly once.
 */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('[P2-S09-AC-1031] CFG-05B-06 step-up then retry with the original key', () => {
  it('[P2-S09-AC-1031] refuses a stale proof with the exact step_up details and no side effect, then the same Idempotency-Key resets once', async () => {
    const world = createWorld({ handlers: handlers({}) });
    const request = async (stepUpAt: string | null) =>
      send(world.app, {
        method: 'POST',
        path: PATH,
        body: BODY,
        jar: await mintJar({ stepUpAt }),
        headers: { 'idempotency-key': KEY },
      });

    const refused = await request(new Date(NOW - 601_000).toISOString());
    expect(refused.status).toBe(401);
    const refusal = await bodyOf(refused);
    expect(refusal.code).toBe('STEP_UP_REQUIRED');
    expect(refusal.details).toEqual({
      recoveryAction: 'step_up',
      allowedMethods: ['totp'],
    });
    expect(names(world.calls)).not.toContain('admin_mfa_factor_reset');
    expect(providerCalls(world.calls)).toStrictEqual([]);
    expect(world.calls.filter((call) => call.body?.p_limit === 5)).toHaveLength(
      0,
    );

    const retried = await request(new Date(NOW - 60_000).toISOString());
    expect(retried.status).toBe(200);
    expect(
      world.calls.filter((call) => call.rpc === 'admin_mfa_factor_reset'),
    ).toHaveLength(1);
    expect(providerCalls(world.calls)).toStrictEqual([REMOVE_A, REMOVE_B]);
  });
});
