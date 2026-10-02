import { describe, expect, it } from 'vitest';

import { createRpcReconcilerFactorPort } from './auth-state-reconciler-rpc';
import { fakeRpc, IDS } from './test-support';

const signal = new AbortController().signal;
const row = {
  found: true,
  state: 'reconciling',
  authUserId: IDS.authUser,
  providerFactorId: IDS.providerFactor,
  version: '5',
};

describe('reconciler factor RPC port', () => {
  it('[P2-S09-AC-913] reads the reconciliation view by factor id', async () => {
    const { calls, rpc } = fakeRpc({
      auth_mfa_factor_reconcile_read: () => row,
    });
    await expect(
      createRpcReconcilerFactorPort(rpc).read(IDS.aggregate, signal),
    ).resolves.toEqual({
      state: 'reconciling',
      authUserId: IDS.authUser,
      providerFactorId: IDS.providerFactor,
      version: '5',
    });
    expect(calls).toEqual([
      {
        operation: 'auth_mfa_factor_reconcile_read',
        input: { p_factor_id: IDS.aggregate },
      },
    ]);
  });

  it('maps found:false to null', async () => {
    const { rpc } = fakeRpc({
      auth_mfa_factor_reconcile_read: () => ({ found: false }),
    });
    await expect(
      createRpcReconcilerFactorPort(rpc).read(IDS.aggregate, signal),
    ).resolves.toBeNull();
  });

  it.each([
    ['null', null],
    ['unknown state', { ...row, state: 'bogus' }],
    ['bad auth user', { ...row, authUserId: 'x' }],
    ['bad provider id', { ...row, providerFactorId: 7 }],
    ['bad version', { ...row, version: '0' }],
    ['extra key', { ...row, secret: 'x' }],
    ['found:false with extra keys', { found: false, state: 'verified' }],
  ])('rejects a malformed read response (%s)', async (_, response) => {
    const { rpc } = fakeRpc({
      auth_mfa_factor_reconcile_read: () => response,
    });
    await expect(
      createRpcReconcilerFactorPort(rpc).read(IDS.aggregate, signal),
    ).rejects.toThrow('Malformed factor reconciliation response');
  });

  it('[P2-S09-AC-913] settles through the existing reconcile RPC with the closed outcome', async () => {
    const { calls, rpc } = fakeRpc({
      auth_mfa_factor_reconcile: () => ({ state: 'verified' }),
    });
    await createRpcReconcilerFactorPort(rpc).settle(
      {
        authUserId: IDS.authUser,
        factorId: IDS.aggregate,
        outcome: 'verified',
        requestId: IDS.request,
        correlationId: IDS.correlation,
      },
      signal,
    );
    expect(calls).toEqual([
      {
        operation: 'auth_mfa_factor_reconcile',
        input: {
          p_auth_user_id: IDS.authUser,
          p_factor_id: IDS.aggregate,
          p_outcome: 'verified',
          p_request_id: IDS.request,
          p_correlation_id: IDS.correlation,
        },
      },
    ]);
  });

  it('rejects a settle response that is not a settled factor state', async () => {
    const { rpc } = fakeRpc({
      auth_mfa_factor_reconcile: () => ({ state: 'reconciling' }),
    });
    await expect(
      createRpcReconcilerFactorPort(rpc).settle(
        {
          authUserId: IDS.authUser,
          factorId: IDS.aggregate,
          outcome: 'removed',
          requestId: IDS.request,
          correlationId: IDS.correlation,
        },
        signal,
      ),
    ).rejects.toThrow('Malformed factor settlement response');
  });
});
