import { describe, expect, it, vi } from 'vitest';

import type { WorkerBindings } from '../index';
import { callRpc } from './production-http';
import { normalizeAuthProductionOptions } from './production-support';

const environment: WorkerBindings = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'dec-111-test',
  SUPABASE_SECRET_KEY: 'sb_secret_test_only',
  SUPABASE_URL: 'https://staging.example.supabase.co',
};

const failing = (message: string) =>
  normalizeAuthProductionOptions({
    environment,
    fetchImpl: vi.fn(
      async () =>
        new Response(JSON.stringify({ message }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        }),
    ) as unknown as typeof fetch,
  });

const rpcFailure = async (message: string): Promise<unknown> => {
  try {
    await callRpc(
      failing(message),
      'test_rpc',
      {},
      new AbortController().signal,
    );
  } catch (error) {
    return error;
  }
  throw new Error('callRpc did not throw');
};

describe('DEC-111 RPC failure mapping', () => {
  it('maps a database step-up refusal to 401 with the registry-backed recovery body, never 403', async () => {
    expect(await rpcFailure('STEP_UP_REQUIRED')).toEqual({
      ok: false,
      status: 401,
      code: 'STEP_UP_REQUIRED',
      message: 'Recent verification is required.',
      details: { recoveryAction: 'step_up', allowedMethods: ['totp'] },
    });
  });

  it.each([
    ['MFA_FACTOR_LIMIT', 'mfa_factor_limit', 'refetch'],
    ['FACTOR_NAME_TAKEN', 'factor_name_taken', 'refetch'],
    ['FACTOR_NOT_PENDING', 'factor_not_pending', 'restart_enrollment'],
    ['ENROLLMENT_EXPIRED', 'enrollment_expired', 'restart_enrollment'],
    ['FACTOR_NOT_VERIFIED', 'factor_not_verified', 'refetch'],
    ['FACTOR_STATE_CONFLICT', 'factor_state_conflict', 'refetch'],
    ['NO_VERIFIED_FACTOR', 'no_verified_factor', 'enroll_factor'],
    ['LAST_FACTOR_REQUIRED', 'last_factor_required', 'enroll_factor'],
    ['CHALLENGE_EXPIRED', 'challenge_expired', 'new_challenge'],
    ['CHALLENGE_CONSUMED', 'challenge_consumed', 'new_challenge'],
  ] as const)(
    'maps %s to a 409 CONFLICT with reason %s and recovery %s',
    async (message, reasonCode, recoveryAction) => {
      expect(await rpcFailure(message)).toMatchObject({
        ok: false,
        status: 409,
        code: 'CONFLICT',
        details: { conflict: 'INVALID_TRANSITION', reasonCode, recoveryAction },
      });
    },
  );

  it('maps a missing factor id requirement to a 422 field violation', async () => {
    expect(await rpcFailure('FACTOR_ID_REQUIRED')).toMatchObject({
      ok: false,
      status: 422,
      code: 'VALIDATION_FAILED',
      details: {
        violations: [{ path: '/factorId', code: 'factor_id_required' }],
      },
    });
  });

  it('keeps the existing mappings for unrelated failures', async () => {
    expect(await rpcFailure('FINAL_LOGIN_METHOD')).toMatchObject({
      status: 409,
      code: 'FINAL_LOGIN_METHOD',
    });
    expect(await rpcFailure('NOT_FOUND')).toMatchObject({ status: 404 });
  });
});
