import { QueueEnvelopeSchema } from '@wejammin/contracts';
import { describe, expect, it, vi } from 'vitest';

import { executeJobDispatch } from './consumer.ts';
import {
  EVENT_ID,
  JOB_ID,
  LEASE_TOKEN,
  openFence,
} from './persistence.test-support.ts';
import type {
  CanonicalJob,
  JobConsumerInput,
  JobEffectPort,
  JobLeaseClaimResult,
  JobPersistencePort,
} from './runtime-types.ts';

const REQUESTED_VERSION = '9007199254740993';
const CLAIMED_VERSION = '9007199254740994';
const NEXT_VERSION = '"9007199254740995"';
const CORRELATION_ID = '33333333-3333-4333-8333-333333333333';
const NOW_MS = 1_000;
const LEASE_UNTIL_MS = 301_000;

const fixture = (
  type = 'cms.schema.dry_run',
  claimedVersion = CLAIMED_VERSION,
) => {
  const order: string[] = [];
  const canonical: CanonicalJob = Object.freeze({
    id: JOB_ID,
    type,
    state: 'queued',
    version: REQUESTED_VERSION,
    leaseUntilMs: null,
  });
  const envelope = QueueEnvelopeSchema.parse({
    eventId: EVENT_ID,
    eventType: 'job.requested',
    schemaVersion: 1,
    aggregateType: 'job',
    aggregateId: JOB_ID,
    aggregateVersion: REQUESTED_VERSION,
    correlationId: CORRELATION_ID,
    causationId: null,
  });
  const receipt: JobLeaseClaimResult = Object.freeze({
    jobId: JOB_ID,
    leaseToken: LEASE_TOKEN,
    expectedVersion: REQUESTED_VERSION,
    version: claimedVersion,
    leaseUntilMs: LEASE_UNTIL_MS,
  });
  const readCanonicalJob = vi.fn<JobPersistencePort['readCanonicalJob']>(
    async () => {
      order.push('readCanonicalJob');
      return canonical;
    },
  );
  const readRestoreFence = vi.fn<JobPersistencePort['readRestoreFence']>(
    async () => {
      order.push('readRestoreFence');
      return openFence;
    },
  );
  const claimJobLease = vi.fn<JobPersistencePort['claimJobLease']>(async () => {
    order.push('claimJobLease');
    return receipt;
  });
  const execute = vi.fn<JobEffectPort['execute']>(async () => {
    order.push('execute');
    return { state: 'succeeded', resultRef: null, errorCode: null };
  });
  const applyJobOutcome = vi.fn<JobPersistencePort['applyJobOutcome']>(
    async () => {
      order.push('applyJobOutcome');
      return true;
    },
  );
  const recordProcessedEvent = vi.fn<
    JobPersistencePort['recordProcessedEvent']
  >(async () => {
    order.push('recordProcessedEvent');
    return 'recorded';
  });
  const persistence = {
    readCanonicalJob,
    readRestoreFence,
    claimJobLease,
    applyJobOutcome,
    recordProcessedEvent,
  } satisfies JobConsumerInput['persistence'];
  const input: JobConsumerInput = {
    persistence,
    effect: { execute },
    envelope,
    leaseToken: LEASE_TOKEN,
    leaseSeconds: 300,
    nowMs: NOW_MS,
    processedEventIds: [],
    eventJobType: type,
    eventPayload: { jobId: JOB_ID, jobType: type },
  };
  return {
    input,
    canonical,
    envelope,
    receipt,
    order,
    execute,
    ...persistence,
  };
};

const expectReceiptAndCompletion = async (
  f: ReturnType<typeof fixture>,
  nextVersion: string,
) => {
  const result = await executeJobDispatch(f.input);
  expect(result).toEqual({
    kind: 'completed',
    outcome: {
      kind: 'applied',
      jobId: JOB_ID,
      nextState: 'succeeded',
      nextVersion,
    },
    processed: { kind: 'recorded', canonicalWrite: true, replayable: true },
  });
  expect(f.readCanonicalJob.mock.calls).toEqual([[JOB_ID]]);
  expect(f.readRestoreFence.mock.calls).toEqual([[], []]);
  expect(f.claimJobLease.mock.calls).toEqual([
    [
      {
        expectedVersion: REQUESTED_VERSION,
        jobId: JOB_ID,
        leaseSeconds: 300,
        leaseToken: LEASE_TOKEN,
        nowMs: NOW_MS,
      },
    ],
  ]);
  expect(f.applyJobOutcome.mock.calls).toEqual([
    [
      {
        currentState: 'running',
        currentVersion: `"${f.receipt.version}"`,
        errorCode: null,
        expectedVersion: `"${f.receipt.version}"`,
        jobId: JOB_ID,
        leaseToken: LEASE_TOKEN,
        nextState: 'succeeded',
        resultRef: null,
        retryable: false,
        nextVersion,
      },
    ],
  ]);
  expect(f.recordProcessedEvent.mock.calls).toEqual([
    [
      {
        aggregateId: JOB_ID,
        eventId: EVENT_ID,
        eventType: 'job.requested',
        pendingManualReview: false,
        schemaVersion: 1,
      },
    ],
  ]);
  expect(f.order).toEqual([
    'readCanonicalJob',
    'readRestoreFence',
    'readRestoreFence',
    'claimJobLease',
    'execute',
    'applyJobOutcome',
    'recordProcessedEvent',
  ]);
  expect(f.execute.mock.calls).toEqual([
    [
      {
        envelope: f.envelope,
        job: f.canonical,
        leaseToken: LEASE_TOKEN,
        claimedLease: f.receipt,
      },
    ],
  ]);
  const captured = f.execute.mock.calls[0]?.[0];
  expect(captured).toBeDefined();
  if (captured === undefined) throw new Error('Expected effect invocation');
  // Unknown-property narrowing compiles before the private member is added.
  expect('claimedLease' in captured).toBe(true);
  if (!('claimedLease' in captured)) throw new Error('Claim receipt missing');
  expect(captured.claimedLease).toBe(f.receipt);
  expect(captured.claimedLease).toEqual({
    jobId: JOB_ID,
    leaseToken: LEASE_TOKEN,
    expectedVersion: REQUESTED_VERSION,
    version: f.receipt.version,
    leaseUntilMs: LEASE_UNTIL_MS,
  });
  expect(captured.job).toBe(f.canonical);
  expect(captured.job).toEqual({
    id: JOB_ID,
    type: f.canonical.type,
    state: 'queued',
    version: REQUESTED_VERSION,
    leaseUntilMs: null,
  });
  expect(captured.envelope).toEqual(f.envelope);
  expect(captured.envelope.aggregateVersion).toBe(REQUESTED_VERSION);
  expect(QueueEnvelopeSchema.safeParse(captured.envelope).success).toBe(true);
  expect(Object.keys(captured.envelope).sort()).toEqual([
    'aggregateId',
    'aggregateType',
    'aggregateVersion',
    'causationId',
    'correlationId',
    'eventId',
    'eventType',
    'schemaVersion',
  ]);
  expect(f.input.envelope).toBe(f.envelope);
  expect(f.envelope.aggregateVersion).toBe(REQUESTED_VERSION);
};

const expectNoEffects = (f: ReturnType<typeof fixture>) => {
  expect(f.execute.mock.calls).toEqual([]);
  expect(f.applyJobOutcome.mock.calls).toEqual([]);
  expect(f.recordProcessedEvent.mock.calls).toEqual([]);
};

describe('job consumer claimed lease receipt conveyance', () => {
  it.each(['cms.schema.dry_run', 'object.verify', 'platform.object.verify'])(
    'conveys the actual full %s claim receipt without rewriting the preclaim job or envelope',
    async (type) => {
      const f = fixture(type);
      await expectReceiptAndCompletion(f, NEXT_VERSION);
    },
  );

  it('preserves a synthetic non-adjacent unit-port claim version without asserting SQL adjacency', async () => {
    // This controlled valid-shape receipt is not evidence of claim_job SQL.
    const f = fixture('cms.schema.dry_run', '9007199254741011');
    expect(f.receipt.version).not.toBe(
      (BigInt(REQUESTED_VERSION) + 1n).toString(),
    );
    await expectReceiptAndCompletion(f, '"9007199254741012"');
  });

  it('does not invoke an effect or terminal writes when the actual claim port returns null', async () => {
    const f = fixture();
    f.claimJobLease.mockImplementation(async () => {
      f.order.push('claimJobLease');
      return null;
    });

    expect(await executeJobDispatch(f.input)).toEqual({
      kind: 'retry',
      reason: 'lease_conflict',
      acknowledge: false,
    });
    expect(f.claimJobLease.mock.calls).toEqual([
      [
        {
          expectedVersion: REQUESTED_VERSION,
          jobId: JOB_ID,
          leaseSeconds: 300,
          leaseToken: LEASE_TOKEN,
          nowMs: NOW_MS,
        },
      ],
    ]);
    expect(f.order).toEqual([
      'readCanonicalJob',
      'readRestoreFence',
      'readRestoreFence',
      'claimJobLease',
    ]);
    expectNoEffects(f);
  });

  it('does not claim or execute when the restore fence closes at lease acquisition', async () => {
    const f = fixture();
    let reads = 0;
    f.readRestoreFence.mockImplementation(async () => {
      f.order.push('readRestoreFence');
      reads += 1;
      return { ...openFence, reconciliationComplete: reads === 1 };
    });

    expect(await executeJobDispatch(f.input)).toEqual({
      kind: 'retry',
      reason: 'lease_conflict',
      acknowledge: false,
    });
    expect(f.order).toEqual([
      'readCanonicalJob',
      'readRestoreFence',
      'readRestoreFence',
    ]);
    expect(f.claimJobLease.mock.calls).toEqual([]);
    expectNoEffects(f);
  });

  it.each([
    ['restore', 'retry', 'restore_fenced', false],
    ['duplicate', 'skip', 'duplicate', true],
    ['terminal', 'skip', 'terminal', true],
    ['stale', 'skip', 'stale', true],
    ['future', 'retry', 'future_version', false],
    ['type', 'dead_letter', 'JOB_TYPE_MISMATCH', true],
  ] as const)(
    'retains %s dispatch refusal without claiming or invoking an effect',
    async (mode, kind, reason, acknowledge) => {
      const f = fixture();
      let input = f.input;
      if (mode === 'restore')
        f.readRestoreFence.mockImplementation(async () => {
          f.order.push('readRestoreFence');
          return { ...openFence, reconciliationComplete: false };
        });
      if (mode === 'duplicate')
        input = { ...input, processedEventIds: [EVENT_ID] };
      if (mode === 'terminal' || mode === 'stale')
        f.readCanonicalJob.mockImplementation(async () => {
          f.order.push('readCanonicalJob');
          return {
            ...f.canonical,
            ...(mode === 'terminal'
              ? { state: 'succeeded' as const }
              : { version: CLAIMED_VERSION }),
          };
        });
      if (mode === 'future')
        input = {
          ...input,
          envelope: QueueEnvelopeSchema.parse({
            ...f.envelope,
            aggregateVersion: CLAIMED_VERSION,
          }),
        };
      if (mode === 'type') input = { ...input, eventJobType: 'object.verify' };

      expect(await executeJobDispatch(input)).toEqual({
        kind,
        reason,
        acknowledge,
      });
      expect(f.readCanonicalJob.mock.calls).toEqual([[JOB_ID]]);
      expect(f.readRestoreFence.mock.calls).toEqual([[]]);
      expect(f.order).toEqual(['readCanonicalJob', 'readRestoreFence']);
      expect(f.claimJobLease.mock.calls).toEqual([]);
      expectNoEffects(f);
    },
  );
});
