import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PERSON_ID,
  NOW,
  providerCalls,
} from '../authentication/dec111-composition.test-support';
import {
  BODY,
  FACTOR_A,
  FACTOR_B,
  REMOVE_A,
  REMOVE_B,
  TARGET_AUTH,
  names,
  post,
} from './phase-02-slice-09-cfg05b06-wire.test-support';

/**
 * AC1142 Worker half: a person who lost every verified factor is recovered by
 * the administrative factor reset of a capable operator (CFG-05B-06), through
 * the production composition (cookie jar, CSRF, request-context resolver,
 * port and operator-only provider adapter; only PostgREST and Supabase Auth
 * are faked). There is no recovery code, no support bypass and no self-service
 * reset; the sole administrator, who cannot reset themself, uses the audited
 * runbook instead.
 */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('[P2-S09-AC-1142] administrative reset for a person who lost every verified factor', () => {
  it('[P2-S09-AC-1142] a capable operator with a fresh step-up removes every factor of the target and the reset completes, with no recovery code or bypass in the answer', async () => {
    const { world, response } = await post();
    expect(response.status).toBe(200);
    const text = await response.text();
    const body = JSON.parse(text) as Record<string, unknown>;
    expect(body.state).toBe('completed');
    expect(body.removedFactorCount).toBe(2);
    expect(Object.keys(body).sort()).toStrictEqual([
      'mfaVersion',
      'outboxEventId',
      'removedFactorCount',
      'resetId',
      'state',
      'targetPersonId',
    ]);
    expect(text).not.toMatch(/recovery[_ -]?code|bypass|backup/iu);
    expect(providerCalls(world.calls)).toStrictEqual([REMOVE_A, REMOVE_B]);
    expect(text).not.toContain(FACTOR_A);
    expect(text).not.toContain(FACTOR_B);
    expect(text).not.toContain(TARGET_AUTH);
  });

  it('[P2-S09-AC-1142] an operator without the named capability cannot reset anyone: 403 and no database reset or provider removal', async () => {
    const { world, response } = await post({}, { capabilities: [] });
    expect(response.status).toBe(403);
    expect(names(world.calls)).not.toContain('admin_mfa_factor_reset');
    expect(providerCalls(world.calls)).toStrictEqual([]);
  });

  it('[P2-S09-AC-1142] the sole administrator cannot reset their own factors: 422 MFA_RESET_INVALID, no database reset and no provider removal, so the audited runbook is the only path', async () => {
    const { world, response } = await post(
      {},
      { body: { ...BODY, targetPersonId: PERSON_ID } },
    );
    expect(response.status).toBe(422);
    expect(((await response.json()) as { code: string }).code).toBe(
      'MFA_RESET_INVALID',
    );
    expect(names(world.calls)).not.toContain('admin_mfa_factor_reset');
    expect(providerCalls(world.calls)).toStrictEqual([]);
  });
});
