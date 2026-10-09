import { describe, expect, it } from 'vitest';

import { SCHEMA_MIGRATION_RPC as RPC } from './migration-worker-constants';
import { createSchemaMigrationWorker } from './migration-worker-engine';
import { SchemaMigrationJobPayloadSchema } from './migration-worker-job-schema';
import { SchemaMigrationQueueEnvelopeSchema } from './migration-worker-queue-schema';
import {
  activationCalls,
  CLAIM_TOKEN,
  purposeFixture,
  readCall,
  READY_RESULT,
  scanCalls,
  sealCall,
} from './migration-worker-dry-run-purpose-test-support';
import {
  EXPIRES,
  FINGERPRINTS,
  INSTANT,
  OLD_TOKEN,
  WORKER,
} from './migration-worker-sealed-lease-test-support';
import {
  event,
  job,
  OLD_VERSION_ID,
  PLAN_ID,
  TARGET_VERSION_ID,
} from './migration-worker-test-support';

const OTHER_TARGET_VERSION_ID = '90000000-0000-4000-8000-000000000009';

describe('trusted dry-run execution purpose', () => {
  it('trusted dry-run completes a nonzero bounded scan at canonical ready without crossing into backfill', async () => {
    const f = purposeFixture();
    const result = await f.worker.process(job, {
      signal: f.signal,
      attempt: 1,
    });

    expect(f.call.mock.calls).toEqual([
      ...scanCalls(f.signal),
      sealCall(f.signal),
    ]);
    expect(result).toEqual(READY_RESULT);
    expect(f.sealed).toMatchObject({
      state: 'ready',
      version: '9',
      cursor: '2',
      progress: 1,
      sourceCount: '2',
      targetCount: '2',
      rowErrorCount: '0',
      migratedCount: '0',
      failedCount: '0',
      leaseOwner: null,
      leaseToken: null,
      leaseExpiresAt: INSTANT,
    });
    expect(f.held.leaseToken).toBe(OLD_TOKEN);
  });

  it.each(['process', 'replayDlq'] as const)(
    'trusted dry-run %s accepts newer canonical ready without reclaim or effects',
    async (method) => {
      const f = purposeFixture('ready');
      expect(f.sealed.version).toBe('9');
      expect(job.expectedVersion).toBe('7');

      const result = await f.worker[method](job, {
        signal: f.signal,
        attempt: 1,
      });

      expect(f.call.mock.calls).toEqual([readCall(f.signal)]);
      expect(result).toEqual(READY_RESULT);
    },
  );

  it('trusted dry-run remains seal-only on a later replay of the same worker', async () => {
    const f = purposeFixture();
    const first = await f.worker.process(job, { signal: f.signal });
    const replay = await f.worker.replayDlq(job, { signal: f.signal });

    expect(first).toEqual(READY_RESULT);
    expect(replay).toEqual(READY_RESULT);
    expect(f.call.mock.calls).toEqual([
      ...scanCalls(f.signal),
      sealCall(f.signal),
      readCall(f.signal),
    ]);
  });

  it('trusted dry-run ready retry retains target identity checks', async () => {
    const f = purposeFixture('ready');
    f.call.mockResolvedValueOnce({
      ...f.sealed,
      toVersionId: OTHER_TARGET_VERSION_ID,
    });

    const result = await f.worker.process(job, { signal: f.signal });

    expect(f.call.mock.calls).toEqual([readCall(f.signal)]);
    expect(result).toEqual({
      ...READY_RESULT,
      outcome: 'stale',
      cursor: null,
      progress: null,
      reasonCode: 'PLAN_TARGET_MISMATCH',
    });
  });

  it('trusted dry-run yields exact partial progress with its held lease and no seal', async () => {
    const f = purposeFixture('partial');
    const result = await f.worker.process(job, {
      signal: f.signal,
      attempt: 1,
    });

    expect(f.call.mock.calls).toEqual(scanCalls(f.signal));
    expect(result).toEqual({
      ...READY_RESULT,
      outcome: 'progress',
      state: 'dry_running',
      progress: 2 / 3,
      retryAfterMs: 15_000,
    });
    expect(f.held).toMatchObject({
      leaseOwner: WORKER,
      leaseToken: OLD_TOKEN,
      leaseExpiresAt: EXPIRES,
    });
  });

  it.each([
    {
      mode: 'finalize_retryable',
      outcome: 'retry',
      reasonCode: 'DEPENDENCY_UNAVAILABLE',
      retryAfterMs: 60_000,
    },
    {
      mode: 'finalize_terminal',
      outcome: 'failed_terminal',
      reasonCode: 'CONFLICT',
      retryAfterMs: null,
    },
    {
      mode: 'finalize_invalid',
      outcome: 'failed_terminal',
      reasonCode: 'DEPENDENCY_INVALID_RESPONSE',
      retryAfterMs: null,
    },
  ] as const)(
    'trusted dry-run preserves $mode finalize semantics without phase crossing',
    async ({ mode, outcome, reasonCode, retryAfterMs }) => {
      const f = purposeFixture(mode);
      const result = await f.worker.process(job, {
        signal: f.signal,
        attempt: 1,
      });

      expect(f.call.mock.calls).toEqual([
        ...scanCalls(f.signal),
        sealCall(f.signal),
      ]);
      expect(result).toEqual({
        ...READY_RESULT,
        outcome,
        state: 'dry_running',
        cursor: '1',
        progress: 0.5,
        reasonCode,
        retryAfterMs,
      });
    },
  );

  it('trusted dry-run preserves malformed-source failure and its allowed rollback cleanup', async () => {
    const f = purposeFixture('scan_invalid');
    const result = await f.worker.process(job, { signal: f.signal });

    expect(f.call.mock.calls).toEqual([
      ...scanCalls(f.signal).slice(0, 4),
      [
        RPC.rollback,
        {
          migrationPlanId: PLAN_ID,
          schemaVersionId: TARGET_VERSION_ID,
          expectedVersion: '8',
          cursor: '1',
          leaseToken: OLD_TOKEN,
          reasonCode: 'DEPENDENCY_INVALID_RESPONSE',
          retryable: false,
          fallbackVersionId: OLD_VERSION_ID,
          preserveOldActive: true,
          deleteRows: false,
          ...FINGERPRINTS,
        },
        f.signal,
      ],
    ]);
    expect(result).toEqual({
      ...READY_RESULT,
      outcome: 'failed_terminal',
      state: 'blocked',
      cursor: '1',
      progress: 0.5,
      reasonCode: 'DEPENDENCY_INVALID_RESPONSE',
    });
  });

  it('trusted dry-run keeps a blocked plan blocked without claiming or activating', async () => {
    const f = purposeFixture('blocked');
    const result = await f.worker.process(job, { signal: f.signal });

    expect(f.call.mock.calls).toEqual([readCall(f.signal)]);
    expect(result).toEqual({
      ...READY_RESULT,
      outcome: 'blocked',
      state: 'blocked',
      reasonCode: 'MIGRATION_BLOCKED',
    });
  });

  it.each(['default', 'activation'] as const)(
    '%s purpose retains canonical reclaim and bounded backfill after sealing',
    async (purpose) => {
      const f = purposeFixture();
      const dependencies =
        purpose === 'default'
          ? f.baseDependencies
          : { ...f.baseDependencies, executionPurpose: 'activation' as const };
      const worker = createSchemaMigrationWorker(dependencies);

      const result = await worker.process(job, {
        signal: f.signal,
        attempt: 1,
      });

      expect(f.call.mock.calls).toEqual([
        ...scanCalls(f.signal),
        sealCall(f.signal),
        ...activationCalls(f.signal),
      ]);
      expect(result).toEqual({
        ...READY_RESULT,
        outcome: 'progress',
        state: 'running',
        cursor: '1',
        progress: 0.5,
        retryAfterMs: 15_000,
      });
    },
  );

  it.each([
    { label: 'unsupported purpose', value: 'preview' },
    { label: 'empty purpose', value: '' },
    { label: 'whitespace purpose', value: ' dry_run' },
    { label: 'uppercase purpose', value: 'DRY_RUN' },
    { label: 'null purpose', value: null },
    { label: 'number purpose', value: 1 },
    { label: 'boolean purpose', value: true },
    { label: 'array purpose', value: ['dry_run'] },
    { label: 'object purpose', value: { executionPurpose: 'dry_run' } },
  ])('private constructor rejects $label before effects', ({ value }) => {
    const f = purposeFixture();
    Object.defineProperty(f.dependencies, 'executionPurpose', { value });

    expect(() => createSchemaMigrationWorker(f.dependencies)).toThrow(
      'executionPurpose is invalid',
    );
    expect(f.call.mock.calls).toEqual([]);
    expect(f.telemetry).not.toHaveBeenCalled();
  });

  it.each(['dry_run', 'activation', null])(
    'strict job wire rejects executionPurpose %s instead of granting a private purpose',
    async (executionPurpose) => {
      const f = purposeFixture();
      const input = { ...job, executionPurpose };
      expect(SchemaMigrationJobPayloadSchema.safeParse(input).success).toBe(
        false,
      );

      const result = await f.worker.process(input, { signal: f.signal });

      expect(f.call.mock.calls).toEqual([
        [
          RPC.deadLetter,
          {
            eventId: null,
            eventType: null,
            schemaVersion: null,
            aggregateType: null,
            aggregateId: null,
            aggregateVersion: null,
            claimToken: CLAIM_TOKEN,
            reasonCode: 'INVALID_QUEUE_PAYLOAD',
          },
          f.signal,
        ],
      ]);
      expect(result).toEqual({
        outcome: 'dead_letter',
        migrationPlanId: null,
        schemaVersionId: null,
        eventId: null,
        state: null,
        cursor: null,
        progress: null,
        retryAfterMs: null,
        reasonCode: 'INVALID_QUEUE_PAYLOAD',
        activationSwitched: false,
      });
    },
  );

  it.each([
    { method: 'process', migrationPlanId: PLAN_ID },
    { method: 'process', migrationPlanId: null },
    { method: 'replayDlq', migrationPlanId: PLAN_ID },
    { method: 'replayDlq', migrationPlanId: null },
  ] as const)(
    'trusted dry-run $method refuses a valid activation envelope with plan $migrationPlanId before any RPC',
    async ({ method, migrationPlanId }) => {
      const f = purposeFixture();
      const input = {
        ...event,
        payload: { ...event.payload, migrationPlanId },
      };
      expect(SchemaMigrationQueueEnvelopeSchema.safeParse(input).success).toBe(
        true,
      );

      const result = await f.worker[method](input, { signal: f.signal });

      expect(f.call.mock.calls).toEqual([]);
      expect(result).toEqual({
        outcome: 'failed_terminal',
        migrationPlanId,
        schemaVersionId: TARGET_VERSION_ID,
        eventId: event.eventId,
        state: null,
        cursor: null,
        progress: null,
        retryAfterMs: null,
        reasonCode: 'EXECUTION_PURPOSE_MISMATCH',
        activationSwitched: false,
      });
    },
  );
});
