import { isDeepStrictEqual } from 'node:util';

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
  JobEffectResult,
  JobLeaseClaimResult,
  JobPersistencePort,
} from './runtime-types.ts';

const ORIGINAL_VERSION = '9007199254740993';
const CLAIMED_VERSION = '9007199254741011';
const CLAIMED_CAS = '"9007199254741011"';
const NEXT_VERSION = '"9007199254741012"';
const CORRELATION_ID = '33333333-3333-4333-8333-333333333333';
const CAUSATION_ID = '55555555-5555-4555-8555-555555555555';
type NextState = 'queued' | 'succeeded' | 'failed' | 'cancelled';
type Call = Readonly<{ operation: string; args: readonly unknown[] }>;

// Boolean diagnostics never render sensitive request/receipt/lease values.
const same = (actual: unknown, expected: unknown, label: string) =>
  expect(isDeepStrictEqual(actual, expected), label).toBe(true);
const metadata = (value: object) => ({
  prototype: Object.getPrototypeOf(value),
  properties: Reflect.ownKeys(value).map((key) => [
    key,
    Object.getOwnPropertyDescriptor(value, key),
  ]),
  frozen: Object.isFrozen(value),
  extensible: Object.isExtensible(value),
});

const fixture = (state: NextState, applied = true) => {
  const calls: Call[] = [];
  const canonical: CanonicalJob = Object.freeze({
    id: JOB_ID,
    type: 'cms.schema.dry_run',
    state: 'queued',
    version: ORIGINAL_VERSION,
    leaseUntilMs: null,
  });
  const envelope = QueueEnvelopeSchema.parse({
    eventId: EVENT_ID,
    eventType: 'job.requested',
    schemaVersion: 1,
    aggregateType: 'job',
    aggregateId: JOB_ID,
    aggregateVersion: ORIGINAL_VERSION,
    correlationId: CORRELATION_ID,
    causationId: CAUSATION_ID,
  });
  // Controlled non-adjacent receipt; not a claim_job SQL adjacency witness.
  const receipt: JobLeaseClaimResult = Object.freeze({
    jobId: JOB_ID,
    expectedVersion: ORIGINAL_VERSION,
    version: CLAIMED_VERSION,
    leaseToken: LEASE_TOKEN,
    leaseUntilMs: 301_000,
  });
  const effectResult: JobEffectResult = Object.freeze({
    state,
    resultRef: 'controlled-result-reference',
    errorCode: null,
  });
  const readCanonicalJob = vi.fn<JobPersistencePort['readCanonicalJob']>(
    async (...args) => {
      calls.push({ operation: 'readCanonicalJob', args });
      return canonical;
    },
  );
  const readRestoreFence = vi.fn<JobPersistencePort['readRestoreFence']>(
    async (...args) => {
      calls.push({ operation: 'readRestoreFence', args });
      return openFence;
    },
  );
  const claimJobLease = vi.fn<JobPersistencePort['claimJobLease']>(
    async (...args) => {
      calls.push({ operation: 'claimJobLease', args });
      return receipt;
    },
  );
  const execute = vi.fn<JobEffectPort['execute']>(async (...args) => {
    calls.push({ operation: 'execute', args });
    return effectResult;
  });
  const applyJobOutcome = vi.fn<JobPersistencePort['applyJobOutcome']>(
    async (...args) => {
      calls.push({ operation: 'applyJobOutcome', args });
      return applied;
    },
  );
  const recordProcessedEvent = vi.fn<
    JobPersistencePort['recordProcessedEvent']
  >(async (...args) => {
    calls.push({ operation: 'recordProcessedEvent', args });
    return 'recorded';
  });
  const persistence = Object.freeze({
    readCanonicalJob,
    readRestoreFence,
    claimJobLease,
    applyJobOutcome,
    recordProcessedEvent,
  } satisfies JobConsumerInput['persistence']);
  const eventPayload = Object.freeze({
    jobId: JOB_ID,
    jobType: 'cms.schema.dry_run',
  });
  const processedEventIds = Object.freeze([]);
  const input: JobConsumerInput = Object.freeze({
    persistence,
    effect: Object.freeze({ execute }),
    envelope,
    leaseToken: LEASE_TOKEN,
    leaseSeconds: 300,
    nowMs: 1_000,
    processedEventIds,
    eventJobType: 'cms.schema.dry_run',
    eventPayload,
  });
  const objects = [
    input,
    canonical,
    envelope,
    receipt,
    effectResult,
    eventPayload,
    processedEventIds,
  ];
  const before = objects.map(metadata);
  const unchanged = () => {
    same(objects.map(metadata), before, 'frozen fixture metadata unchanged');
    for (const object of objects) expect(Object.isFrozen(object)).toBe(true);
    expect(input.envelope === envelope).toBe(true);
    expect(canonical.version === ORIGINAL_VERSION).toBe(true);
    expect(envelope.aggregateVersion === ORIGINAL_VERSION).toBe(true);
    expect(receipt.version === CLAIMED_VERSION).toBe(true);
    expect(receipt.expectedVersion === ORIGINAL_VERSION).toBe(true);
  };
  return {
    input,
    canonical,
    envelope,
    receipt,
    calls,
    execute,
    unchanged,
    ...persistence,
  };
};
type Fixture = ReturnType<typeof fixture>;

const assertHistory = (f: Fixture, state: NextState, processed: boolean) => {
  const claim = {
    expectedVersion: ORIGINAL_VERSION,
    jobId: JOB_ID,
    leaseSeconds: 300,
    leaseToken: LEASE_TOKEN,
    nowMs: 1_000,
  };
  const effect = {
    envelope: f.envelope,
    job: f.canonical,
    leaseToken: LEASE_TOKEN,
    claimedLease: f.receipt,
  };
  const apply = {
    currentState: 'running',
    currentVersion: CLAIMED_CAS,
    errorCode: null,
    expectedVersion: CLAIMED_CAS,
    jobId: JOB_ID,
    leaseToken: LEASE_TOKEN,
    nextState: state,
    resultRef: 'controlled-result-reference',
    retryable: state === 'queued',
    nextVersion: NEXT_VERSION,
  };
  const record = {
    aggregateId: JOB_ID,
    eventId: EVENT_ID,
    eventType: 'job.requested',
    pendingManualReview: false,
    schemaVersion: 1,
  };
  const expected: Call[] = [
    { operation: 'readCanonicalJob', args: [JOB_ID] },
    { operation: 'readRestoreFence', args: [] },
    { operation: 'readRestoreFence', args: [] },
    { operation: 'claimJobLease', args: [claim] },
    { operation: 'execute', args: [effect] },
    { operation: 'applyJobOutcome', args: [apply] },
    ...(processed
      ? [{ operation: 'recordProcessedEvent', args: [record] }]
      : []),
  ];
  same(f.calls, expected, 'complete ordered consumer calls and arguments');
  same(f.readCanonicalJob.mock.calls, [[JOB_ID]], 'one canonical read');
  same(f.readRestoreFence.mock.calls, [[], []], 'two restore reads');
  same(f.claimJobLease.mock.calls, [[claim]], 'one exact preclaim CAS');
  same(f.execute.mock.calls, [[effect]], 'one exact effect');
  same(
    f.applyJobOutcome.mock.calls,
    [[apply]],
    'one actual-receipt outcome CAS',
  );
  same(
    f.recordProcessedEvent.mock.calls,
    processed ? [[record]] : [],
    'exact processed-event write cardinality and arguments',
  );
  const captured = f.execute.mock.calls[0]?.[0];
  if (captured === undefined) throw new Error('Expected controlled effect');
  expect(captured.job === f.canonical).toBe(true);
  expect(captured.claimedLease === f.receipt).toBe(true);
  expect(QueueEnvelopeSchema.safeParse(captured.envelope).success).toBe(true);
  same(captured.envelope, f.envelope, 'complete immutable original event');
  expect(Object.isFrozen(captured.envelope)).toBe(true);
  expect(BigInt(CLAIMED_VERSION) > BigInt(ORIGINAL_VERSION) + 1n).toBe(true);
  f.unchanged();
};

describe('consumer queued continuation without premature event dedupe', () => {
  it('returns an applied queued outcome with processed null and no processed-event write', async () => {
    const f = fixture('queued');
    const result = await executeJobDispatch(f.input);
    same(
      result,
      {
        kind: 'completed',
        outcome: {
          kind: 'applied',
          jobId: JOB_ID,
          nextState: 'queued',
          nextVersion: NEXT_VERSION,
        },
        processed: null,
      },
      'queued durable outcome remains unprocessed',
    );
    assertHistory(f, 'queued', false);
  });

  it('retains queued CAS-conflict outcome without recording the original event', async () => {
    const f = fixture('queued', false);
    const result = await executeJobDispatch(f.input);
    same(
      result,
      {
        kind: 'completed',
        outcome: {
          kind: 'conflict',
          reason: 'VERSION_MISMATCH',
          canonicalWrite: false,
        },
        processed: null,
      },
      'queued CAS conflict remains unprocessed',
    );
    assertHistory(f, 'queued', false);
  });

  it.each(['succeeded', 'failed', 'cancelled'] as const)(
    'records the original event only after the applied %s terminal outcome',
    async (state) => {
      const f = fixture(state);
      const result = await executeJobDispatch(f.input);
      same(
        result,
        {
          kind: 'completed',
          outcome: {
            kind: 'applied',
            jobId: JOB_ID,
            nextState: state,
            nextVersion: NEXT_VERSION,
          },
          processed: {
            kind: 'recorded',
            canonicalWrite: true,
            replayable: true,
          },
        },
        'terminal durable outcome and processed receipt',
      );
      assertHistory(f, state, true);
    },
  );
});
