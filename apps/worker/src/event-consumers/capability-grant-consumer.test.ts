import { describe, expect, it, vi } from 'vitest';

import {
  createCapabilityGrantConsumer,
  createRpcCapabilityGrantSource,
  type CurrentCapabilityGrant,
} from './capability-grant-consumer';
import {
  fakeRpc,
  IDS,
  NOW,
  queueBody,
  recordingDeadLetter,
  recordingTelemetry,
  serialized,
} from './test-support';

const body = (aggregateVersion = '4') =>
  queueBody('cms.capability.grant.changed.v1', 'cms_capability_grant', {
    aggregateVersion,
  });

const grant = (
  patch: Partial<CurrentCapabilityGrant> = {},
): CurrentCapabilityGrant => ({
  grantId: IDS.aggregate,
  subjectPersonId: IDS.person,
  version: '4',
  state: 'active',
  capabilityCode: 'cms.editor',
  ...patch,
});

const build = (
  options: Readonly<{
    current?: CurrentCapabilityGrant | null;
    readFails?: boolean;
    refreshFails?: boolean;
    deadLetterFails?: boolean;
  }> = {},
) => {
  const refresh = vi.fn(async () => {
    if (options.refreshFails) throw new Error('sink down');
  });
  const read = vi.fn(async () => {
    if (options.readFails) throw new Error('rpc down');
    return options.current === undefined ? grant() : options.current;
  });
  const deadLetter = recordingDeadLetter(options.deadLetterFails);
  const { logs, telemetry } = recordingTelemetry();
  const consumer = createCapabilityGrantConsumer({
    grants: { read },
    authorization: { refresh },
    deadLetter: deadLetter.port,
    telemetry,
    clock: { now: () => NOW, randomUuid: () => IDS.request },
  });
  return { consumer, read, refresh, deadLetter, logs };
};

const consume = (
  consumer: ReturnType<typeof build>['consumer'],
  attempts = 1,
  message: unknown = body(),
) => consumer.process({ body: message, attempts });

describe('cms.capability-grant-consumer', () => {
  it('[P2-S09-AC-689] refetches the current grant by id and hands only that authoritative state to authorization', async () => {
    const { consumer, read, refresh } = build();
    await expect(consume(consumer)).resolves.toEqual({ outcome: 'ack' });
    expect(read).toHaveBeenCalledWith(IDS.aggregate, expect.any(AbortSignal));
    expect(refresh).toHaveBeenCalledWith(grant(), expect.any(AbortSignal));
  });

  it('[P2-S09-AC-689] never treats the event as permission proof: a revoked current grant is what authorization receives', async () => {
    const { consumer, refresh } = build({
      current: grant({ state: 'revoked', version: '5' }),
    });
    await consume(consumer, 1, body('4'));
    expect(refresh).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'revoked', version: '5' }),
      expect.any(AbortSignal),
    );
  });

  it('[P2-S09-AC-689] retries instead of applying a read older than the event it answers', async () => {
    const { consumer, refresh } = build({ current: grant({ version: '3' }) });
    await expect(consume(consumer, 1, body('4'))).resolves.toEqual({
      outcome: 'retry',
      delaySeconds: 15,
    });
    expect(refresh).not.toHaveBeenCalled();
  });

  it('[P2-S09-AC-689] retries on a failed read and on a failed refresh, never acknowledging unapplied state', async () => {
    const read = build({ readFails: true });
    await expect(consume(read.consumer, 2)).resolves.toEqual({
      outcome: 'retry',
      delaySeconds: 60,
    });
    const refresh = build({ refreshFails: true });
    await expect(consume(refresh.consumer, 3)).resolves.toEqual({
      outcome: 'retry',
      delaySeconds: 300,
    });
  });

  it('[P2-S09-AC-689] dead-letters an unknown event version and never refetches', async () => {
    const { consumer, read, refresh, deadLetter } = build();
    for (const message of [
      queueBody('cms.capability.grant.changed.v2', 'cms_capability_grant', {
        schemaVersion: 2,
      }),
      queueBody('cms.capability.grant.changed.v1', 'cms_capability_grant', {
        schemaVersion: 2,
      }),
    ]) {
      await expect(consume(consumer, 1, message)).resolves.toEqual({
        outcome: 'ack',
      });
    }
    expect(deadLetter.records.map((record) => record.reasonCode)).toEqual([
      'UNKNOWN_EVENT_VERSION',
      'UNKNOWN_EVENT_VERSION',
    ]);
    expect(deadLetter.records[0]?.consumer).toBe(
      'cms.capability-grant-consumer',
    );
    expect(read).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('[P2-S09-AC-689] retries a dead letter that could not be persisted, so an unknown version is never dropped', async () => {
    const { consumer } = build({ deadLetterFails: true });
    await expect(
      consume(
        consumer,
        1,
        queueBody('cms.capability.grant.changed.v2', 'cms_capability_grant', {
          schemaVersion: 2,
        }),
      ),
    ).resolves.toEqual({ outcome: 'retry' });
  });

  it('dead-letters a grant that no longer exists', async () => {
    const { consumer, deadLetter, refresh } = build({ current: null });
    await expect(consume(consumer)).resolves.toEqual({ outcome: 'ack' });
    expect(deadLetter.records[0]?.reasonCode).toBe('SOURCE_RECORD_NOT_FOUND');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('retries a missing grant when its dead letter cannot be recorded', async () => {
    const { consumer } = build({ current: null, deadLetterFails: true });
    await expect(consume(consumer, 1)).resolves.toEqual({
      outcome: 'retry',
      delaySeconds: 15,
    });
  });

  it('logs the grant state and version but no subject, grant or capability identifier', async () => {
    const { consumer, logs } = build();
    await consume(consumer);
    const text = serialized(logs);
    expect(text).not.toContain(IDS.person);
    expect(text).not.toContain(IDS.aggregate);
    expect(text).not.toContain('cms.editor');
    expect(logs[0]?.details).toMatchObject({
      eventName: 'cms.capability_grant_consumer',
      consumer: 'cms.capability-grant-consumer',
      outcome: 'success',
      entityVersion: '4',
      attributes: { grantState: 'active' },
    });
  });
});

describe('capability grant RPC source', () => {
  const row = {
    found: true,
    grantId: IDS.aggregate,
    subjectPersonId: IDS.person,
    version: '4',
    state: 'active',
    capabilityCode: 'cms.editor',
  };

  it('[P2-S09-AC-689] reads the authoritative current grant through the protected RPC', async () => {
    const { calls, rpc } = fakeRpc({
      cms_capability_grant_read_current: () => row,
    });
    await expect(
      createRpcCapabilityGrantSource(rpc).read(
        IDS.aggregate,
        new AbortController().signal,
      ),
    ).resolves.toEqual(grant());
    expect(calls).toEqual([
      {
        operation: 'cms_capability_grant_read_current',
        input: { p_grant_id: IDS.aggregate },
      },
    ]);
  });

  it('maps found:false to null and rejects malformed responses', async () => {
    const missing = fakeRpc({
      cms_capability_grant_read_current: () => ({ found: false }),
    });
    await expect(
      createRpcCapabilityGrantSource(missing.rpc).read(
        IDS.aggregate,
        new AbortController().signal,
      ),
    ).resolves.toBeNull();
    for (const bad of [
      null,
      { ...row, state: 'bogus' },
      { ...row, version: '0' },
      { ...row, subjectPersonId: 'x' },
      { ...row, capabilityCode: 'Not A Code' },
      { ...row, extra: 1 },
      { found: false, grantId: IDS.aggregate },
    ]) {
      const { rpc } = fakeRpc({ cms_capability_grant_read_current: () => bad });
      await expect(
        createRpcCapabilityGrantSource(rpc).read(
          IDS.aggregate,
          new AbortController().signal,
        ),
      ).rejects.toThrow('Malformed capability grant response');
    }
  });
});
