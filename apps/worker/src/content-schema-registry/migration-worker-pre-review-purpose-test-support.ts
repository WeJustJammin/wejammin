import { vi } from 'vitest';

import {
  SCHEMA_MIGRATION_RPC as RPC,
  type SchemaMigrationRpcName,
} from './migration-worker-constants';
import { createSchemaMigrationWorker } from './migration-worker-engine';
import { SchemaMigrationJobPayloadSchema } from './migration-worker-job-schema';
import {
  MigrationPlanRecordSchema,
  SchemaMigrationBatchResultSchema,
  type MigrationPlanRecord,
} from './migration-worker-plan-schemas';
import { parseSourcePage } from './migration-source-read';
import type { MigrationWorkerPort } from './migration-worker-types';
import {
  basePlan,
  job,
  NOW,
  PLAN_ID,
  TARGET_VERSION_ID,
} from './migration-worker-test-support';

export const WORKER = 'pre-review-worker';
export const INSTANT = new Date(NOW).toISOString();
export const TOKEN = 'aaaaaaaa-0000-4000-8000-000000000011';
export const ROW_ID = 'bbbbbbbb-0000-4000-8000-000000000012';
export const ROW_HASH =
  '44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a';
export const FINGERPRINTS = {
  transformKey: 'identity.revalidate',
  transformVersion: '1',
  compilerHash: 'c'.repeat(64),
  sourceHash: 'a'.repeat(64),
  targetHash: 'b'.repeat(64),
};
type Failure =
  | 'none'
  | 'verify_invalid'
  | 'verify_negative'
  | 'complete_retryable'
  | 'complete_invalid';

// Controlled persistence only: real factory/scanner/stages, not SQL authority,
// concurrent fences, editorial approval, public activation or persisted dispatch.
export const preparationFixture = (
  purpose: 'dry_run' | 'activation' | 'default' = 'dry_run',
  failure: Failure = 'none',
  empty: boolean | 'mixed_counter' | 'held_lease' = false,
) => {
  const signal = new AbortController().signal;
  const count = empty ? '0' : '1';
  const ready: MigrationPlanRecord = MigrationPlanRecordSchema.parse(
    basePlan({
      ...FINGERPRINTS,
      state: 'ready',
      version: '7',
      cursor: count,
      progress: 1,
      sourceCount: count,
      targetCount: count,
      leaseExpiresAt: INSTANT,
      ...(empty === true || empty === 'held_lease'
        ? {
            fromVersionId: null,
            activeVersionId: null,
            classification: 'additive',
            transformKey: null,
            transformVersion: null,
            sourceHash: '0'.repeat(64),
          }
        : {}),
      ...(empty === 'mixed_counter' ? { targetCount: '1' } : {}),
      ...(empty === 'held_lease'
        ? {
            leaseOwner: WORKER,
            leaseToken: TOKEN,
            leaseExpiresAt: new Date(NOW + 30_000).toISOString(),
          }
        : {}),
    }),
  );
  const running: MigrationPlanRecord = MigrationPlanRecordSchema.parse({
    ...ready,
    state: 'running',
    version: '8',
    cursor: '0',
    progress: 0,
    leaseOwner: WORKER,
    leaseToken: TOKEN,
    leaseExpiresAt: new Date(NOW + 30_000).toISOString(),
  });
  const verifying: MigrationPlanRecord = MigrationPlanRecordSchema.parse({
    ...running,
    state: 'verifying',
    version: '9',
    cursor: count,
    progress: 1,
    migratedCount: count,
  });
  const completed: MigrationPlanRecord = MigrationPlanRecordSchema.parse({
    ...verifying,
    state: 'completed',
    version: '10',
    leaseOwner: null,
    leaseToken: null,
    leaseExpiresAt: INSTANT,
  });
  const rolledBack: MigrationPlanRecord = MigrationPlanRecordSchema.parse({
    ...verifying,
    state: 'failed_terminal',
    version: '10',
    leaseOwner: null,
    leaseToken: null,
    leaseExpiresAt: INSTANT,
  });
  const page = parseSourcePage(
    {
      rows: empty
        ? []
        : [
            {
              sourceTable: 'cms_entry_revisions',
              sourceRowId: ROW_ID,
              sourceHash: ROW_HASH,
              document: {},
            },
          ],
      nextCursor: count,
      done: true,
      targetFields: [],
      retiredFields: [],
    },
    1,
  );
  const batch = SchemaMigrationBatchResultSchema.parse({
    done: true,
    cursor: count,
    progress: 1,
    sourceCount: count,
    targetCount: count,
    rowErrorCount: '0',
    migratedCount: count,
    failedCount: '0',
  });
  const call = vi.fn<MigrationWorkerPort['call']>(async (rpc) => {
    switch (rpc) {
      case RPC.readPlan:
        return ready;
      case RPC.claimLease:
        if (empty === 'mixed_counter' || empty === 'held_lease')
          return {
            acquired: false,
            leaseToken: null,
            plan: null,
            reasonCode: 'LEASE_UNAVAILABLE',
          };
        return { acquired: true, leaseToken: TOKEN, plan: running };
      case RPC.heartbeatLease:
        return { renewed: true };
      case RPC.readSourceRows:
        return page;
      case RPC.processBatch:
        return batch;
      case RPC.beginVerification:
        return verifying;
      case RPC.verify:
        if (failure === 'verify_invalid') return { valid: 'true' };
        if (failure === 'verify_negative')
          return { valid: false, reasonCode: 'VERIFICATION_FAILED' };
        return { valid: true };
      case RPC.complete:
        if (failure === 'complete_retryable')
          throw { code: 'DEPENDENCY_UNAVAILABLE', retryable: true };
        if (failure === 'complete_invalid')
          return { ...completed, version: 'invalid' };
        return completed;
      case RPC.rollback:
        return { plan: rolledBack };
      case RPC.activate:
        return { activated: true };
      default:
        throw new Error(`Unexpected preparation RPC: ${rpc}`);
    }
  });
  // The variable permits testing this private option before its producer type
  // exists, without casting or adding it to the strict job wire payload.
  const dependencies = {
    port: { call },
    workerId: WORKER,
    now: () => NOW,
    maxBatchRows: 1,
    maxBatchesPerInvocation: 1,
    leaseDurationMs: 30_000,
    ...(purpose === 'default' ? {} : { executionPurpose: purpose }),
  };
  return {
    signal,
    call,
    ready,
    running,
    verifying,
    completed,
    rolledBack,
    page,
    job: SchemaMigrationJobPayloadSchema.parse(job),
    worker: createSchemaMigrationWorker(dependencies),
  };
};

export type RpcCall = readonly [SchemaMigrationRpcName, unknown, AbortSignal];
export const expectedCall = (
  rpc: SchemaMigrationRpcName,
  request: unknown,
  signal: AbortSignal,
): RpcCall => [rpc, request, signal];
export const readCall = (signal: AbortSignal) =>
  expectedCall(
    RPC.readPlan,
    {
      migrationPlanId: PLAN_ID,
      schemaVersionId: TARGET_VERSION_ID,
      expectedVersion: '7',
    },
    signal,
  );
export const claimBody = {
  migrationPlanId: PLAN_ID,
  schemaVersionId: TARGET_VERSION_ID,
  expectedVersion: '7',
  cursor: '1',
  leaseOwner: WORKER,
  workerId: WORKER,
  leaseDurationMs: 30_000,
  now: INSTANT,
  ...FINGERPRINTS,
};
