import { describe, expect, it } from 'vitest';

import { SCHEMA_MIGRATION_RPC as RPC } from './migration-worker-constants';
import {
  MigrationPlanRecordSchema,
  type MigrationPlanRecord,
} from './migration-worker-plan-schemas';
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

describe('pre-review completion state and empty response guards', () => {
  it('dry_run rejects a schema-valid verifying completion response without activating', async () => {
    const f = preparationFixture();
    expect(MigrationPlanRecordSchema.safeParse(f.verifying)).toEqual({
      success: true,
      data: f.verifying,
    });
    expect(f.verifying.state).toBe('verifying');
    const original = f.call.getMockImplementation();
    if (original === undefined)
      throw new Error('Preparation fixture has no RPC implementation');
    f.call.mockImplementation(async (rpc, request, signal) => {
      if (rpc === RPC.complete) return f.verifying;
      return original(rpc, request, signal);
    });

    const result = await f.worker.process(f.job, {
      signal: f.signal,
      attempt: 1,
    });

    expect(f.call.mock.calls).toEqual(preparationCalls(f.signal));
    expect(result).toEqual({
      outcome: 'failed_terminal',
      migrationPlanId: PLAN_ID,
      schemaVersionId: TARGET_VERSION_ID,
      eventId: null,
      state: 'verifying',
      cursor: '1',
      progress: 1,
      retryAfterMs: null,
      reasonCode: 'DEPENDENCY_INVALID_RESPONSE',
      activationSwitched: false,
    });
    expect(f.verifying.activeVersionId).toBe(OLD_VERSION_ID);
  });

  // Defensive dependency responses, not legal sealed SQL states or evidence
  // of an empty census, lease authority, races, approval or persisted dispatch.
  it.each([
    { label: 'source count one', overrides: { sourceCount: '1' } },
    { label: 'cursor one', overrides: { cursor: '1' } },
    { label: 'row error count one', overrides: { rowErrorCount: '1' } },
    { label: 'migrated count one', overrides: { migratedCount: '1' } },
    { label: 'failed count one', overrides: { failedCount: '1' } },
    { label: 'lease owner only', overrides: { leaseOwner: WORKER } },
    { label: 'lease token only', overrides: { leaseToken: TOKEN } },
  ] satisfies Array<{
    label: string;
    overrides: Partial<MigrationPlanRecord>;
  }>)(
    'dry_run zero-source ready with $label cannot bypass claim denial',
    async ({ overrides }) => {
      const f = preparationFixture();
      const ready: MigrationPlanRecord = {
        ...f.ready,
        cursor: '0',
        sourceCount: '0',
        targetCount: '0',
        rowErrorCount: '0',
        migratedCount: '0',
        failedCount: '0',
        leaseOwner: null,
        leaseToken: null,
        ...overrides,
      };
      expect(MigrationPlanRecordSchema.safeParse(ready)).toEqual({
        success: true,
        data: ready,
      });
      expect(ready).toMatchObject({
        state: 'ready',
        version: f.job.expectedVersion,
        fromVersionId: OLD_VERSION_ID,
        activeVersionId: OLD_VERSION_ID,
        cursor: '0',
        progress: 1,
        sourceCount: '0',
        targetCount: '0',
        rowErrorCount: '0',
        migratedCount: '0',
        failedCount: '0',
        leaseOwner: null,
        leaseToken: null,
        ...overrides,
      });
      const original = f.call.getMockImplementation();
      if (original === undefined)
        throw new Error('Preparation fixture has no RPC implementation');
      f.call.mockImplementation(async (rpc, request, signal) => {
        if (rpc === RPC.readPlan) return ready;
        if (rpc === RPC.claimLease)
          return {
            acquired: false,
            leaseToken: null,
            plan: null,
            reasonCode: 'LEASE_UNAVAILABLE',
          };
        return original(rpc, request, signal);
      });

      const result = await f.worker.process(f.job, {
        signal: f.signal,
        attempt: 1,
      });

      expect(f.call.mock.calls).toEqual([
        readCall(f.signal),
        call(
          RPC.claimLease,
          { ...claimBody, cursor: overrides.cursor ?? '0' },
          f.signal,
        ),
      ]);
      expect(result).toEqual({
        outcome: 'retry',
        migrationPlanId: PLAN_ID,
        schemaVersionId: TARGET_VERSION_ID,
        eventId: null,
        state: 'ready',
        cursor: overrides.cursor ?? '0',
        progress: 1,
        retryAfterMs: 60_000,
        reasonCode: 'LEASE_UNAVAILABLE',
        activationSwitched: false,
      });
    },
  );
});
