import { vi } from 'vitest';

import { SCHEMA_MIGRATION_RPC as RPC } from './migration-worker-constants';
import { createSchemaMigrationWorker } from './migration-worker-engine';
import { createMigrationWorkerRuntime } from './migration-worker-runtime';
import type { MigrationWorkerPort } from './migration-worker-types';
import {
  basePlan,
  job,
  NOW,
  PLAN_ID,
  TARGET_VERSION_ID,
} from './migration-worker-test-support';

// Controlled persistence responses test real stages/scanning/orchestration, not
// SQL leases, authority, sealing races, approval or activation. SQL 021830 seals
// ready with owner/token null and expiresAt = seal instant; 021490 reclaim resets
// its cursor/progress for backfill. Letter-leading tokens isolate UUID parsing.
export const WORKER = 'sealed-lease-worker';
export const OLD_TOKEN = 'aaaaaaaa-0000-4000-8000-000000000001';
export const NEW_TOKEN = 'bbbbbbbb-0000-4000-8000-000000000002';
export const INSTANT = new Date(NOW).toISOString();
export const EXPIRES = new Date(NOW + 30_000).toISOString();
export const ROW_ONE = 'c0000000-0000-4000-8000-000000000001';
export const ROW_TWO = 'c0000000-0000-4000-8000-000000000002';
const ROW_HASH =
  '44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a';
export const FINGERPRINTS = {
  transformKey: 'identity.revalidate',
  transformVersion: '1',
  compilerHash: 'c'.repeat(64),
  sourceHash: 'a'.repeat(64),
  targetHash: 'b'.repeat(64),
} as const;
type Reclaim = 'acquired' | 'unavailable' | 'retryable' | 'terminal';

export const fixture = (
  reclaim: Reclaim = 'acquired',
  dryDone = true,
  completed = false,
) => {
  const signal = new AbortController().signal;
  const pending = basePlan({
    ...FINGERPRINTS,
    state: 'dry_running',
    version: '7',
    cursor: '1',
    progress: dryDone ? 0.5 : 1 / 3,
    sourceCount: dryDone ? '2' : '3',
    targetCount: '1',
    leaseOwner: WORKER,
    leaseToken: OLD_TOKEN,
    leaseExpiresAt: EXPIRES,
  });
  const held = { ...pending, version: '8' };
  const sealed = basePlan({
    ...FINGERPRINTS,
    state: 'ready',
    version: '9',
    cursor: '2',
    progress: 1,
    sourceCount: '2',
    targetCount: '2',
    leaseOwner: null,
    leaseToken: null,
    leaseExpiresAt: INSTANT,
  });
  const running = {
    ...sealed,
    state: 'running' as const,
    version: '10',
    cursor: '0',
    progress: 0,
    leaseOwner: WORKER,
    leaseToken: NEW_TOKEN,
    leaseExpiresAt: EXPIRES,
  };
  let wasSealed = false;
  let reclaimed = false;
  const call = vi.fn<MigrationWorkerPort['call']>(async (rpc, request) => {
    switch (rpc) {
      case RPC.readPlan:
        return completed
          ? {
              ...sealed,
              state: 'completed',
              migratedCount: '2',
              leaseExpiresAt: null,
            }
          : pending;
      case RPC.claimLease:
        if (!wasSealed)
          return {
            acquired: true,
            leaseToken: OLD_TOKEN,
            plan: held,
            reasonCode: null,
          };
        if (reclaim === 'unavailable')
          return {
            acquired: false,
            leaseToken: null,
            plan: null,
            reasonCode: 'LEASE_UNAVAILABLE',
          };
        if (reclaim === 'retryable' || reclaim === 'terminal')
          throw {
            code: 'DEPENDENCY_UNAVAILABLE',
            retryable: reclaim === 'retryable',
          };
        reclaimed = true;
        return {
          acquired: true,
          leaseToken: NEW_TOKEN,
          plan: running,
          reasonCode: null,
        };
      case RPC.heartbeatLease:
        return {
          renewed: wasSealed
            ? reclaimed &&
              (request as { leaseToken: unknown }).leaseToken === NEW_TOKEN
            : (request as { leaseToken: unknown }).leaseToken === OLD_TOKEN,
        };
      case RPC.readSourceRows:
        return {
          rows: [
            {
              sourceTable: 'cms_entry_revisions',
              sourceRowId: wasSealed ? ROW_ONE : ROW_TWO,
              sourceHash: ROW_HASH,
              document: {},
            },
          ],
          nextCursor: wasSealed ? '1' : '2',
          done: !wasSealed && dryDone,
          targetFields: [],
          retiredFields: [],
        };
      case RPC.processDryRunBatch:
        return {
          done: dryDone,
          cursor: '2',
          progress: dryDone ? 1 : 2 / 3,
          sourceCount: dryDone ? '2' : '3',
          targetCount: '2',
          rowErrorCount: '0',
          migratedCount: '0',
          failedCount: '0',
        };
      case RPC.finalizeDryRun:
        wasSealed = true;
        return sealed;
      case RPC.processBatch:
        return {
          done: false,
          cursor: '1',
          progress: 0.5,
          sourceCount: '2',
          targetCount: '2',
          rowErrorCount: '0',
          migratedCount: '1',
          failedCount: '0',
        };
      default:
        throw new Error(`Unexpected RPC: ${rpc}`);
    }
  });
  const dependencies = {
    port: { call },
    workerId: WORKER,
    now: () => NOW,
    maxBatchRows: 1,
    maxBatchesPerInvocation: 1,
    leaseDurationMs: 30_000,
  };
  const runtime = createMigrationWorkerRuntime(dependencies);
  return {
    call,
    signal,
    held,
    sealed,
    runtime,
    worker: createSchemaMigrationWorker(dependencies),
    input: {
      runtime,
      plan: held,
      event: null,
      job,
      leaseToken: OLD_TOKEN,
      signal,
      attempt: 1,
    },
  };
};

const evidence = (sourceRowId: string) => [
  {
    sourceTable: 'cms_entry_revisions',
    sourceRowId,
    sourceHash: ROW_HASH,
    outputHash: ROW_HASH,
    errorCode: null,
  },
];
export const batchRequest = (
  expectedVersion: string,
  cursor: string,
  leaseToken: string,
  sourceRowId: string,
) => ({
  migrationPlanId: PLAN_ID,
  schemaVersionId: TARGET_VERSION_ID,
  expectedVersion,
  cursor,
  limit: 1,
  leaseToken,
  rowEvidence: evidence(sourceRowId),
  ...FINGERPRINTS,
  correlationId: job.correlationId,
  causationId: job.causationId,
});
export const reclaimRequest = {
  migrationPlanId: PLAN_ID,
  schemaVersionId: TARGET_VERSION_ID,
  expectedVersion: '9',
  cursor: '2',
  leaseOwner: WORKER,
  workerId: WORKER,
  leaseDurationMs: 30_000,
  now: INSTANT,
  ...FINGERPRINTS,
};
