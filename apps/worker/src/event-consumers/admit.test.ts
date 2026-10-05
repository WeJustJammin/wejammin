import { IdentityMfaFactorChangedQueueEnvelopeSchema } from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import { admitConsumerEvent } from './admit';
import {
  IDS,
  queueBody,
  recordingDeadLetter,
  recordingTelemetry,
} from './test-support';

const run = async (body: unknown, deadLetterFails = false, attempts = 1) => {
  const deadLetter = recordingDeadLetter(deadLetterFails);
  const { logs, telemetry } = recordingTelemetry();
  const admitted = await admitConsumerEvent({
    consumer: 'identity.auth-state-reconciler',
    schema: IdentityMfaFactorChangedQueueEnvelopeSchema,
    message: { body, attempts },
    deadLetter: deadLetter.port,
    telemetry,
    signal: new AbortController().signal,
  });
  return { admitted, records: deadLetter.records, logs };
};

describe('consumer event admission', () => {
  it('admits the exact known envelope', async () => {
    const { admitted, records } = await run(
      queueBody('identity.mfa-factor.changed.v1', 'mfa_factor'),
    );
    expect(admitted.ok).toBe(true);
    expect(records).toEqual([]);
  });

  it('[P2-S09-AC-689] dead-letters an unknown event version durably and acknowledges the message', async () => {
    const { admitted, records, logs } = await run(
      queueBody('identity.mfa-factor.changed.v2', 'mfa_factor', {
        schemaVersion: 2,
      }),
    );
    expect(admitted).toEqual({ ok: false, outcome: { outcome: 'ack' } });
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      consumer: 'identity.auth-state-reconciler',
      reasonCode: 'UNKNOWN_EVENT_VERSION',
      identity: {
        eventId: IDS.event,
        eventType: 'identity.mfa-factor.changed.v2',
        schemaVersion: 2,
        aggregateId: IDS.aggregate,
        aggregateVersion: '4',
      },
    });
    expect(logs[0]?.details).toMatchObject({
      outcome: 'failure',
      errorCode: 'UNKNOWN_EVENT_VERSION',
    });
  });

  it('treats a known type carrying schemaVersion 2 as an unknown version', async () => {
    const { records } = await run(
      queueBody('identity.mfa-factor.changed.v1', 'mfa_factor', {
        schemaVersion: 2,
      }),
    );
    expect(records[0]?.reasonCode).toBe('UNKNOWN_EVENT_VERSION');
  });

  it('dead-letters a malformed known-version envelope as invalid payload', async () => {
    const { records } = await run(
      queueBody('identity.mfa-factor.changed.v1', 'mfa_factor', {
        aggregateId: 'not-a-uuid',
        payload: { email: 'a@example.com' },
      }),
    );
    expect(records[0]?.reasonCode).toBe('INVALID_QUEUE_PAYLOAD');
    expect(records[0]?.identity.aggregateId).toBeNull();
    expect(JSON.stringify(records)).not.toContain('example.com');
  });

  it('retries when the durable dead letter cannot be recorded', async () => {
    const { admitted, logs } = await run(
      queueBody('identity.mfa-factor.changed.v2', 'mfa_factor', {
        schemaVersion: 2,
      }),
      true,
    );
    expect(admitted).toEqual({ ok: false, outcome: { outcome: 'retry' } });
    expect(logs[0]?.details).toMatchObject({
      outcome: 'retry',
      errorCode: 'DEAD_LETTER_UNAVAILABLE',
    });
  });

  it('retries an unrecordable dead letter for a body with no usable identity', async () => {
    const { admitted, logs } = await run('garbage', true);
    expect(admitted).toEqual({ ok: false, outcome: { outcome: 'retry' } });
    expect(logs[0]?.details).not.toHaveProperty('traceId');
  });

  it('dead-letters a non-object body with a null identity', async () => {
    const { records } = await run('garbage');
    expect(records[0]).toMatchObject({
      reasonCode: 'INVALID_QUEUE_PAYLOAD',
      identity: { eventId: null, eventType: null, aggregateId: null },
    });
  });
});
