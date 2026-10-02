import { describe, expect, it, vi } from 'vitest';

import {
  createReconcilingAgeProbe,
  createRpcReconcilingAgePort,
  RECONCILING_AGE_EVENT,
} from './reconciling-age';
import { fakeRpc, NOW, recordingTelemetry } from './test-support';

const probe = (read: () => Promise<unknown>) => {
  const { logs, telemetry } = recordingTelemetry();
  const observer = createReconcilingAgeProbe({
    age: { read: vi.fn(read) as never },
    telemetry,
    clock: { now: () => NOW, randomUuid: () => 'unused' },
  });
  return { logs, observer };
};

describe('MFA reconciling-age gauge', () => {
  it('[P2-S09-AC-908] emits the oldest reconciling age and the row count', async () => {
    const { logs, observer } = probe(async () => ({
      count: 3,
      oldestAgeSeconds: 742,
    }));
    await observer.observe();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      level: 'info',
      details: {
        eventName: RECONCILING_AGE_EVENT,
        operation: 'sample',
        outcome: 'success',
        metrics: {
          'identity.mfa.reconciling.age.seconds': 742,
          'identity.mfa.reconciling.count': 3,
        },
      },
      options: { samplingClass: 'always' },
    });
  });

  it('[P2-S09-AC-908] reports zero age and zero count when nothing is reconciling', async () => {
    const { logs, observer } = probe(async () => ({
      count: 0,
      oldestAgeSeconds: null,
    }));
    await observer.observe();
    expect(logs[0]?.details.metrics).toEqual({
      'identity.mfa.reconciling.age.seconds': 0,
      'identity.mfa.reconciling.count': 0,
    });
  });

  it('[P2-S09-AC-908] a failed sample is a failure event and never throws', async () => {
    const { logs, observer } = probe(async () => {
      throw new Error('rpc down');
    });
    await expect(observer.observe()).resolves.toBeUndefined();
    expect(logs[0]).toMatchObject({
      level: 'warn',
      details: {
        eventName: RECONCILING_AGE_EVENT,
        outcome: 'failure',
        errorCode: 'RECONCILING_AGE_UNAVAILABLE',
      },
    });
  });

  it('[P2-S09-AC-908] reads the age through the protected RPC and rejects malformed answers', async () => {
    const good = fakeRpc({
      auth_mfa_reconciling_age: () => ({ count: 2, oldestAgeSeconds: 61.5 }),
    });
    await expect(
      createRpcReconcilingAgePort(good.rpc).read(new AbortController().signal),
    ).resolves.toEqual({ count: 2, oldestAgeSeconds: 61.5 });
    expect(good.calls).toEqual([
      { operation: 'auth_mfa_reconciling_age', input: {} },
    ]);
    for (const bad of [
      null,
      { count: -1, oldestAgeSeconds: 1 },
      { count: 1, oldestAgeSeconds: -5 },
      { count: 1, oldestAgeSeconds: null },
      { count: 0, oldestAgeSeconds: 4 },
      { count: 1.5, oldestAgeSeconds: 1 },
      { count: 1, oldestAgeSeconds: 1, extra: true },
    ]) {
      const { rpc } = fakeRpc({ auth_mfa_reconciling_age: () => bad });
      await expect(
        createRpcReconcilingAgePort(rpc).read(new AbortController().signal),
      ).rejects.toThrow('Malformed reconciling age response');
    }
  });
});
