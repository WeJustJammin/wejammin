import { describe, expect, it } from 'vitest';

import { SCHEMA_MIGRATION_RPC as RPC } from './migration-worker-constants';
import { MigrationPlanRecordSchema } from './migration-worker-plan-schemas';
import {
  preparationFixture,
  expectedCall as call,
  claimBody,
  readCall,
  FINGERPRINTS,
  INSTANT,
  ROW_HASH,
  ROW_ID,
  TOKEN,
  WORKER,
  type RpcCall,
} from './migration-worker-pre-review-purpose-test-support';
import {
  CONTENT_TYPE_ID,
  job,
  OLD_VERSION_ID,
  PLAN_ID,
  TARGET_VERSION_ID,
} from './migration-worker-test-support';

const preparationCalls = (signal: AbortSignal): RpcCall[] => [
  readCall(signal),
  call(RPC.claimLease, claimBody, signal),
  call(
    RPC.heartbeatLease,
    {
      migrationPlanId: PLAN_ID,
      expectedVersion: '8',
      cursor: '0',
      leaseToken: TOKEN,
      workerId: WORKER,
      now: INSTANT,
      leaseDurationMs: 30_000,
    },
    signal,
  ),
  call(
    RPC.readSourceRows,
    {
      migrationPlanId: PLAN_ID,
      expectedVersion: '8',
      cursor: '0',
      limit: 1,
      leaseToken: TOKEN,
    },
    signal,
  ),
  call(
    RPC.processBatch,
    {
      migrationPlanId: PLAN_ID,
      schemaVersionId: TARGET_VERSION_ID,
      expectedVersion: '8',
      cursor: '0',
      limit: 1,
      leaseToken: TOKEN,
      rowEvidence: [
        {
          sourceTable: 'cms_entry_revisions',
          sourceRowId: ROW_ID,
          sourceHash: ROW_HASH,
          outputHash: ROW_HASH,
          errorCode: null,
        },
      ],
      ...FINGERPRINTS,
      correlationId: job.correlationId,
      causationId: job.causationId,
    },
    signal,
  ),
  call(
    RPC.beginVerification,
    {
      migrationPlanId: PLAN_ID,
      expectedVersion: '8',
      cursor: '1',
      sourceCount: '1',
      targetCount: '1',
      rowErrorCount: '0',
      migratedCount: '1',
      failedCount: '0',
      ...FINGERPRINTS,
    },
    signal,
  ),
  call(
    RPC.verify,
    {
      migrationPlanId: PLAN_ID,
      schemaVersionId: TARGET_VERSION_ID,
      expectedVersion: '9',
      cursor: '1',
      leaseToken: TOKEN,
      sourceCount: '1',
      targetCount: '1',
      rowErrorCount: '0',
      migratedCount: '1',
      failedCount: '0',
      ...FINGERPRINTS,
    },
    signal,
  ),
  call(
    RPC.complete,
    {
      migrationPlanId: PLAN_ID,
      expectedVersion: '9',
      leaseToken: TOKEN,
    },
    signal,
  ),
];
const activationCall = (signal: AbortSignal) =>
  call(
    RPC.activate,
    {
      migrationPlanId: PLAN_ID,
      contentTypeId: CONTENT_TYPE_ID,
      schemaVersionId: TARGET_VERSION_ID,
      expectedVersion: '10',
      expectedActiveVersionId: OLD_VERSION_ID,
      ...FINGERPRINTS,
      idempotencyKey: `cms-migration:${PLAN_ID}`,
      switchOnlyOnce: true,
    },
    signal,
  );
const rollbackCall = (signal: AbortSignal) =>
  call(
    RPC.rollback,
    {
      migrationPlanId: PLAN_ID,
      schemaVersionId: TARGET_VERSION_ID,
      expectedVersion: '9',
      cursor: '1',
      leaseToken: TOKEN,
      reasonCode: 'VERIFICATION_FAILED',
      retryable: false,
      fallbackVersionId: OLD_VERSION_ID,
      preserveOldActive: true,
      deleteRows: false,
      ...FINGERPRINTS,
    },
    signal,
  );
const completedResult = {
  outcome: 'completed',
  migrationPlanId: PLAN_ID,
  schemaVersionId: TARGET_VERSION_ID,
  eventId: null,
  state: 'completed',
  cursor: '1',
  progress: 1,
  retryAfterMs: null,
  reasonCode: null,
  activationSwitched: false,
};
const methods: Array<'process' | 'replayDlq'> = ['process', 'replayDlq'];
const purposes: Array<'default' | 'activation'> = ['default', 'activation'];

describe('DEC-108 pre-review preparation boundary', () => {
  it.each(methods)(
    'dry_run %s completes nonzero preparation without private activation',
    async (method) => {
      const f = preparationFixture();
      expect(MigrationPlanRecordSchema.safeParse(f.ready)).toEqual({
        success: true,
        data: f.ready,
      });
      expect(f.ready.version).toBe(f.job.expectedVersion);
      const result = await f.worker[method](f.job, {
        signal: f.signal,
        attempt: 1,
      });

      expect(f.call.mock.calls).toEqual(preparationCalls(f.signal));
      expect(result).toEqual(completedResult);
      expect(f.completed).toMatchObject({
        state: 'completed',
        version: '10',
        cursor: '1',
        sourceCount: '1',
        targetCount: '1',
        migratedCount: '1',
        activeVersionId: OLD_VERSION_ID,
        leaseOwner: null,
        leaseToken: null,
      });
    },
  );

  it.each(purposes)(
    '%s purpose retains one private switch after nonzero completion',
    async (purpose) => {
      const f = preparationFixture(purpose);
      const result = await f.worker.process(f.job, {
        signal: f.signal,
        attempt: 1,
      });

      expect(f.call.mock.calls).toEqual([
        ...preparationCalls(f.signal),
        activationCall(f.signal),
      ]);
      expect(result).toEqual({ ...completedResult, activationSwitched: true });
    },
  );

  it.each(methods)(
    'dry_run %s completes an empty job read-only with truthful ready plan metadata',
    async (method) => {
      const f = preparationFixture('dry_run', 'none', true);
      expect(MigrationPlanRecordSchema.safeParse(f.ready)).toEqual({
        success: true,
        data: f.ready,
      });
      expect(f.ready).toMatchObject({
        state: 'ready',
        version: '7',
        fromVersionId: null,
        activeVersionId: null,
        cursor: '0',
        sourceCount: '0',
        targetCount: '0',
        rowErrorCount: '0',
        migratedCount: '0',
        failedCount: '0',
        leaseOwner: null,
        leaseToken: null,
      });
      const result = await f.worker[method](f.job, {
        signal: f.signal,
        attempt: 1,
      });

      expect(f.call.mock.calls).toEqual([readCall(f.signal)]);
      expect(result).toEqual({
        ...completedResult,
        state: 'ready',
        cursor: '0',
      });
    },
  );

  it.each([
    {
      failure: 'verify_invalid',
      reason: 'DEPENDENCY_INVALID_RESPONSE',
      retry: null,
    },
    { failure: 'verify_negative', reason: 'VERIFICATION_FAILED', retry: null },
    {
      failure: 'complete_retryable',
      reason: 'DEPENDENCY_UNAVAILABLE',
      retry: 60_000,
    },
    {
      failure: 'complete_invalid',
      reason: 'DEPENDENCY_INVALID_RESPONSE',
      retry: null,
    },
  ] satisfies Array<{
    failure: Parameters<typeof preparationFixture>[1];
    reason: string;
    retry: number | null;
  }>)(
    'dry_run $failure preserves exact failure and cleanup without activation',
    async ({ failure, reason, retry }) => {
      const f = preparationFixture('dry_run', failure);
      const result = await f.worker.process(f.job, {
        signal: f.signal,
        attempt: 1,
      });
      const failedVerification = failure === 'verify_negative';
      const completionAttempted =
        failure === 'complete_retryable' || failure === 'complete_invalid';

      expect(f.call.mock.calls).toEqual([
        ...preparationCalls(f.signal).slice(0, completionAttempted ? 8 : 7),
        ...(failedVerification ? [rollbackCall(f.signal)] : []),
      ]);
      expect(result).toEqual({
        ...completedResult,
        outcome: retry === null ? 'failed_terminal' : 'retry',
        state: failedVerification ? 'failed_terminal' : 'verifying',
        retryAfterMs: retry,
        reasonCode: reason,
      });
      expect(f.verifying.activeVersionId).toBe(OLD_VERSION_ID);
      expect(f.rolledBack.activeVersionId).toBe(OLD_VERSION_ID);
    },
  );

  it.each(['mixed_counter', 'held_lease'] satisfies Array<
    'mixed_counter' | 'held_lease'
  >)(
    'dry_run zero-source %s is not an empty completed job and obeys claim denial',
    async (shape) => {
      const f = preparationFixture('dry_run', 'none', shape);
      expect(MigrationPlanRecordSchema.safeParse(f.ready)).toEqual({
        success: true,
        data: f.ready,
      });
      expect(f.ready).toMatchObject(
        shape === 'mixed_counter'
          ? {
              sourceCount: '0',
              targetCount: '1',
              fromVersionId: OLD_VERSION_ID,
              activeVersionId: OLD_VERSION_ID,
              leaseOwner: null,
              leaseToken: null,
            }
          : {
              sourceCount: '0',
              targetCount: '0',
              rowErrorCount: '0',
              migratedCount: '0',
              failedCount: '0',
              cursor: '0',
              leaseOwner: WORKER,
              leaseToken: TOKEN,
            },
      );
      const result = await f.worker.process(f.job, {
        signal: f.signal,
        attempt: 1,
      });

      expect(f.call.mock.calls).toEqual([
        readCall(f.signal),
        call(
          RPC.claimLease,
          {
            ...claimBody,
            cursor: '0',
            ...(shape === 'held_lease'
              ? {
                  transformKey: null,
                  transformVersion: null,
                  sourceHash: '0'.repeat(64),
                }
              : {}),
          },
          f.signal,
        ),
      ]);
      expect(result).toEqual({
        ...completedResult,
        outcome: 'retry',
        state: 'ready',
        cursor: '0',
        retryAfterMs: 60_000,
        reasonCode: 'LEASE_UNAVAILABLE',
      });
    },
  );
});
