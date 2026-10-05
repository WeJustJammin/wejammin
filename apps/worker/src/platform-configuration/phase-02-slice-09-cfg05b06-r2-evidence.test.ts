import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  NOW,
  PERSON_ID,
  SHAPES,
  createWorld,
  expectApiError,
  json,
  mintJar,
  providerCalls,
  rpcRefusal,
  send,
} from '../authentication/dec111-composition.test-support';
import { resetResponse } from './admin-mfa-reset.test-support';
import {
  BODY,
  CAPABILITY,
  FACTOR_A,
  FACTOR_B,
  KEY,
  PATH,
  REMOVE_A,
  REMOVE_B,
  handlers,
  names,
  post,
} from './phase-02-slice-09-cfg05b06-wire.test-support';

/**
 * Evidence added by the 2026-10-02 audit remediation (lane r2-auth) for
 * CFG-05B-06, through the production Worker composition. Only the PostgREST
 * and Supabase Auth admin endpoints are faked. The database halves are proven
 * by supabase/tests/phase_02_slice_09_dec111_admin_mfa_reset.sql, cited per
 * test.
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

describe('CFG-05B-06 authorization (AC-926)', () => {
  it('[P2-S09-AC-926] proceeds to the reservation only for an operator whose capability list holds admin.identity.mfa_reset and whose step-up is recent (the action, organization and CFG-11 grant lifecycle halves are proven by dec111_admin_mfa_reset.sql:144-167)', async () => {
    const allowed = await post({}, { capabilities: [CAPABILITY] });
    expect(allowed.response.status).toBe(200);
    expect(names(allowed.world.calls)).toContain('admin_mfa_factor_reset');
    for (const capabilities of [
      [],
      ['admin.inbox.read'],
      ['admin.identity.mfa_reset.preview'],
    ]) {
      const { world, response } = await post({}, { capabilities });
      await expectApiError(response, {
        status: 403,
        code: 'FORBIDDEN',
        shape: { keys: [], optional: ['reasonCode', 'recoveryAction'] },
      });
      expect(names(world.calls)).not.toContain('admin_mfa_factor_reset');
      expect(providerCalls(world.calls)).toStrictEqual([]);
    }
  });
});

describe('CFG-05B-06 reconciliation hand-off (AC-933)', () => {
  it('[P2-S09-AC-933] a provider failure on one factor answers exactly 202 reconciling, settles in a second RPC after the reservation and attempts each provider removal once with no rollback RPC (database: dec111_admin_mfa_reset.sql:259-260)', async () => {
    const attempts: string[] = [];
    const { world, response } = await post({
      [REMOVE_A]: () => {
        attempts.push('A');
        return json({});
      },
      [REMOVE_B]: () => {
        attempts.push('B');
        return new Response('{}', { status: 503 });
      },
      admin_mfa_factor_reset_settle: () =>
        json(resetResponse({ state: 'reconciling', removedFactorCount: 1 })),
    });
    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({
      state: 'reconciling',
      removedFactorCount: 1,
    });
    expect(attempts).toStrictEqual(['A', 'B']);
    expect(
      names(world.calls).filter((name) => name.startsWith('admin_mfa')),
    ).toStrictEqual([
      'admin_mfa_factor_reset',
      'admin_mfa_factor_reset_settle',
    ]);
    const settle = world.calls.find(
      (call) => call.rpc === 'admin_mfa_factor_reset_settle',
    );
    expect(
      (settle?.body?.p_request as { outcomes: unknown[] }).outcomes,
    ).toStrictEqual([
      { providerFactorId: FACTOR_A, outcome: 'removed' },
      { providerFactorId: FACTOR_B, outcome: 'failed' },
    ]);
  });

  it('[P2-S09-AC-933] a settle outage after the provider calls is 503 IDENTITY_UNAVAILABLE and the committed reservation is never undone: no second reservation or compensating RPC follows', async () => {
    const { world, response } = await post({
      admin_mfa_factor_reset_settle: () => rpcRefusal('boom', 500),
    });
    await expectApiError(response, {
      status: 503,
      code: 'IDENTITY_UNAVAILABLE',
      shape: { exact: {} },
    });
    expect(
      names(world.calls).filter((name) => name.startsWith('admin_mfa')),
    ).toStrictEqual([
      'admin_mfa_factor_reset',
      'admin_mfa_factor_reset_settle',
    ]);
  });
});

describe('CFG-05B-06 error rows (AC-942, AC-944)', () => {
  it('[P2-S09-AC-942] a self-target is 422 MFA_RESET_INVALID with the BE00 envelope and empty details before any database call', async () => {
    const { world, response } = await post(
      {},
      { body: { ...BODY, targetPersonId: PERSON_ID } },
    );
    await expectApiError(response, {
      status: 422,
      code: 'MFA_RESET_INVALID',
      shape: { exact: {} },
    });
    expect(names(world.calls)).not.toContain('admin_mfa_factor_reset');
  });

  it('[P2-S09-AC-942] a schema violation is 400 INVALID_REQUEST with the BE00 envelope and at most the violations detail before any database call', async () => {
    for (const body of [
      { ...BODY, unknownKey: true },
      { ...BODY, targetPersonId: 'someone' },
      { targetPersonId: BODY.targetPersonId },
      { ...BODY, reason: '' },
      { ...BODY, reason: 'r'.repeat(513) },
    ]) {
      const { world, response } = await post({}, { body });
      await expectApiError(response, {
        status: 400,
        code: 'INVALID_REQUEST',
        shape: SHAPES.invalidRequest,
      });
      expect(names(world.calls)).not.toContain('admin_mfa_factor_reset');
    }
  });

  it('[P2-S09-AC-942] a schema violation and a self-target are distinguished: the self-target stays 422 and the malformed body stays 400', async () => {
    const self = await post(
      {},
      { body: { ...BODY, targetPersonId: PERSON_ID } },
    );
    const malformed = await post({}, { body: { ...BODY, reason: '' } });
    expect([self.response.status, malformed.response.status]).toStrictEqual([
      422, 400,
    ]);
  });

  it('[P2-S09-AC-944] an unavailable identity RPC is 503 IDENTITY_UNAVAILABLE with the BE00 envelope and no provider call', async () => {
    const { world, response } = await post({
      admin_mfa_factor_reset: () => rpcRefusal('boom', 500),
    });
    await expectApiError(response, {
      status: 503,
      code: 'IDENTITY_UNAVAILABLE',
      shape: { exact: {} },
    });
    expect(providerCalls(world.calls)).toStrictEqual([]);
  });

  it('[P2-S09-AC-944] an open provider circuit, produced by real provider failures, is 503 IDENTITY_UNAVAILABLE with the BE00 envelope, no admin provider call and no settle after the committed reservation', async () => {
    const world = createWorld({
      handlers: handlers({
        [REMOVE_A]: () => new Response('{}', { status: 503 }),
        [REMOVE_B]: () => new Response('{}', { status: 503 }),
        // The database leaves the reset reconciling when any outcome failed
        // (dec111_admin_mfa_reset.sql:259, 'any failed factor leaves ...').
        admin_mfa_factor_reset_settle: (call) =>
          json(
            resetResponse({
              state: (
                call.body?.p_request as { outcomes: { outcome: string }[] }
              ).outcomes.some((entry) => entry.outcome === 'failed')
                ? 'reconciling'
                : 'completed',
            }),
          ),
      }),
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
    // Two failures per request: the third request opens the breaker (5 in 60 s).
    for (let index = 0; index < 3; index += 1)
      expect((await attempt()).status).toBe(202);
    const adminCallsBefore = providerCalls(world.calls).filter((call) =>
      call.includes('/admin/'),
    ).length;
    const settlesBefore = names(world.calls).filter(
      (name) => name === 'admin_mfa_factor_reset_settle',
    ).length;
    const refused = await attempt();
    await expectApiError(refused, {
      status: 503,
      code: 'IDENTITY_UNAVAILABLE',
      shape: { exact: {} },
    });
    expect(
      providerCalls(world.calls).filter((call) => call.includes('/admin/')),
    ).toHaveLength(adminCallsBefore);
    expect(
      names(world.calls).filter(
        (name) => name === 'admin_mfa_factor_reset_settle',
      ),
    ).toHaveLength(settlesBefore);
  });
});
