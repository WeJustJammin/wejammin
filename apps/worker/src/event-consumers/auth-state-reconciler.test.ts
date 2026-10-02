import { describe, expect, it, vi } from 'vitest';

import {
  createAuthStateReconciler,
  type ProviderFactorStatus,
  type ReconcilableFactor,
} from './auth-state-reconciler';
import {
  IDS,
  NOW,
  queueBody,
  recordingDeadLetter,
  recordingTelemetry,
  serialized,
} from './test-support';

const body = () => queueBody('identity.mfa-factor.changed.v1', 'mfa_factor');

const factor = (
  patch: Partial<ReconcilableFactor> = {},
): ReconcilableFactor => ({
  state: 'reconciling',
  authUserId: IDS.authUser,
  providerFactorId: IDS.providerFactor,
  version: '5',
  ...patch,
});

const build = (
  options: Readonly<{
    row?: ReconcilableFactor | null;
    status?: ProviderFactorStatus;
    readFails?: boolean;
    settleFails?: boolean;
    providerFails?: boolean;
  }> = {},
) => {
  const settle = vi.fn(async () => {
    if (options.settleFails) throw new Error('rpc down');
  });
  const readStatus = vi.fn(async () => {
    if (options.providerFails) throw new Error('provider threw');
    return options.status ?? 'verified';
  });
  const deadLetter = recordingDeadLetter();
  const { logs, telemetry } = recordingTelemetry();
  const reconciler = createAuthStateReconciler({
    factors: {
      read: vi.fn(async () => {
        if (options.readFails) throw new Error('rpc down');
        return options.row === undefined ? factor() : options.row;
      }),
      settle,
    },
    provider: { readStatus },
    deadLetter: deadLetter.port,
    telemetry,
    clock: { now: () => NOW, randomUuid: () => IDS.request },
  });
  return { reconciler, settle, readStatus, deadLetter, logs };
};

const consume = (
  reconciler: ReturnType<typeof build>['reconciler'],
  attempts = 1,
  message: unknown = body(),
) => reconciler.process({ body: message, attempts });

describe('identity.auth-state-reconciler', () => {
  it.each([
    ['verified', 'verified'],
    ['unverified', 'pending'],
    ['absent', 'removed'],
  ] as const)(
    '[P2-S09-AC-913] settles a reconciling factor from provider status %s as %s, reading status only',
    async (status, outcome) => {
      const { reconciler, settle, readStatus } = build({ status });
      await expect(consume(reconciler)).resolves.toEqual({ outcome: 'ack' });
      expect(readStatus).toHaveBeenCalledTimes(1);
      expect(readStatus).toHaveBeenCalledWith(
        { authUserId: IDS.authUser, providerFactorId: IDS.providerFactor },
        expect.any(AbortSignal),
      );
      expect(settle).toHaveBeenCalledWith(
        {
          authUserId: IDS.authUser,
          factorId: IDS.aggregate,
          outcome,
          requestId: IDS.request,
          correlationId: IDS.correlation,
        },
        expect.any(AbortSignal),
      );
    },
  );

  it('[P2-S09-AC-913] keeps an unavailable provider answer reconciling and retries with the queue schedule', async () => {
    const { reconciler, settle } = build({ status: 'unavailable' });
    await expect(consume(reconciler, 1)).resolves.toEqual({
      outcome: 'retry',
      delaySeconds: 15,
    });
    await expect(consume(reconciler, 2)).resolves.toEqual({
      outcome: 'retry',
      delaySeconds: 60,
    });
    await expect(consume(reconciler, 4)).resolves.toEqual({ outcome: 'retry' });
    expect(settle).not.toHaveBeenCalled();
  });

  it('[P2-S09-AC-913] a throwing provider read is the same as unavailable', async () => {
    const { reconciler, settle } = build({ providerFails: true });
    await expect(consume(reconciler, 2)).resolves.toEqual({
      outcome: 'retry',
      delaySeconds: 60,
    });
    expect(settle).not.toHaveBeenCalled();
  });

  it.each(['pending', 'verified', 'removed', 'expired'] as const)(
    '[P2-S09-AC-913] acknowledges without a provider call when the row is already %s',
    async (state) => {
      const { reconciler, readStatus, settle } = build({
        row: factor({ state }),
      });
      await expect(consume(reconciler)).resolves.toEqual({ outcome: 'ack' });
      expect(readStatus).not.toHaveBeenCalled();
      expect(settle).not.toHaveBeenCalled();
    },
  );

  it('acknowledges an event whose factor row no longer exists', async () => {
    const { reconciler, readStatus, logs } = build({ row: null });
    await expect(consume(reconciler)).resolves.toEqual({ outcome: 'ack' });
    expect(readStatus).not.toHaveBeenCalled();
    expect(logs[0]?.details).toMatchObject({ errorCode: 'FACTOR_NOT_FOUND' });
  });

  it('retries when the factor read fails and when the settle fails', async () => {
    const read = build({ readFails: true });
    await expect(consume(read.reconciler)).resolves.toMatchObject({
      outcome: 'retry',
    });
    const settle = build({ settleFails: true });
    await expect(consume(settle.reconciler)).resolves.toMatchObject({
      outcome: 'retry',
    });
  });

  it('[P2-S09-AC-689] dead-letters an unknown event version without touching state', async () => {
    const { reconciler, readStatus, settle, deadLetter } = build();
    const result = await consume(
      reconciler,
      1,
      queueBody('identity.mfa-factor.changed.v2', 'mfa_factor', {
        schemaVersion: 2,
      }),
    );
    expect(result).toEqual({ outcome: 'ack' });
    expect(deadLetter.records[0]?.reasonCode).toBe('UNKNOWN_EVENT_VERSION');
    expect(readStatus).not.toHaveBeenCalled();
    expect(settle).not.toHaveBeenCalled();
  });

  it('never logs the Auth user, the provider factor id or a request secret', async () => {
    const { reconciler, logs } = build({ status: 'verified' });
    await consume(reconciler);
    const text = serialized(logs);
    expect(text).not.toContain(IDS.authUser);
    expect(text).not.toContain(IDS.providerFactor);
    expect(logs[0]?.details).toMatchObject({
      eventName: 'identity.auth_state_reconciler',
      consumer: 'identity.auth-state-reconciler',
      outcome: 'success',
    });
  });
});
