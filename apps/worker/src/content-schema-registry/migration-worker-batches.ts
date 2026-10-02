import { readAndScanBatch } from './migration-batch-read';
import { resolveTransform } from './migration-transform-registry';
import { SCHEMA_MIGRATION_RPC } from './migration-worker-constants';
import type {
  SchemaMigrationJobPayload,
  SchemaMigrationQueueEnvelope,
} from './migration-worker-input-schemas';
import type { MigrationPlanRecord } from './migration-worker-plan-schemas';
import type { MigrationWorkerRuntime } from './migration-worker-runtime';
import type { BatchRunResult } from './migration-worker-results';
import { isRecord } from './migration-worker-schema-core';
import type { SchemaMigrationBatchResult } from './migration-worker-plan-schemas';
import {
  decimalAtLeast,
  errorCode,
  parseBatchResult,
  planWithBatch,
} from './migration-worker-validation';

const stopped = (
  current: MigrationPlanRecord,
  outcome: 'retry' | 'failure',
  reasonCode: string,
): BatchRunResult => ({
  outcome,
  done: false,
  version: current.version,
  cursor: current.cursor,
  progress: current.progress,
  sourceCount: current.sourceCount,
  targetCount: current.targetCount,
  rowErrorCount: current.rowErrorCount,
  migratedCount: current.migratedCount,
  failedCount: current.failedCount,
  reasonCode,
});

export const runMigrationBatches = async (
  runtime: MigrationWorkerRuntime,
  plan: MigrationPlanRecord,
  event: SchemaMigrationQueueEnvelope | null,
  job: SchemaMigrationJobPayload,
  leaseToken: string | null,
  dryRun: boolean,
  signal: AbortSignal,
  attempt: number,
  batchLimit: number,
): Promise<BatchRunResult> => {
  let current = plan;
  const transform = resolveTransform(
    runtime.transformRegistry,
    plan.transformKey,
    plan.transformVersion,
  );
  if (transform.kind === 'unregistered')
    return stopped(current, 'failure', 'TRANSFORM_NOT_REGISTERED');
  const entry = transform.kind === 'entry' ? transform.entry : null;
  for (let batch = 0; batch < batchLimit; batch += 1) {
    const heartbeat = await runtime.call(
      SCHEMA_MIGRATION_RPC.heartbeatLease,
      {
        migrationPlanId: current.id,
        expectedVersion: current.version,
        cursor: current.cursor,
        leaseToken,
        workerId: runtime.workerId,
        now: new Date(runtime.now()).toISOString(),
        leaseDurationMs: runtime.leaseDurationMs,
      },
      signal,
    );
    if (!heartbeat.ok)
      return {
        outcome: 'retry',
        done: false,
        version: current.version,
        cursor: current.cursor,
        progress: current.progress,
        sourceCount: current.sourceCount,
        targetCount: current.targetCount,
        rowErrorCount: current.rowErrorCount,
        migratedCount: current.migratedCount,
        failedCount: current.failedCount,
        reasonCode: heartbeat.failure.code,
      };
    if (!isRecord(heartbeat.value) || heartbeat.value.renewed !== true)
      return {
        outcome: 'retry',
        done: false,
        version: current.version,
        cursor: current.cursor,
        progress: current.progress,
        sourceCount: current.sourceCount,
        targetCount: current.targetCount,
        rowErrorCount: current.rowErrorCount,
        migratedCount: current.migratedCount,
        failedCount: current.failedCount,
        reasonCode: 'LEASE_EXPIRED',
      };
    const scan = await readAndScanBatch(
      runtime,
      current,
      leaseToken,
      entry,
      signal,
    );
    if (!scan.ok)
      return stopped(
        current,
        scan.retryable ? 'retry' : 'failure',
        scan.reasonCode,
      );
    const rpc = dryRun
      ? SCHEMA_MIGRATION_RPC.processDryRunBatch
      : SCHEMA_MIGRATION_RPC.processBatch;
    const batchResult = await runtime.call(
      rpc,
      {
        migrationPlanId: current.id,
        schemaVersionId: job.schemaVersionId,
        expectedVersion: current.version,
        cursor: current.cursor,
        limit: runtime.maxBatchRows,
        leaseToken,
        rowEvidence: scan.evidence,
        transformKey: current.transformKey,
        transformVersion: current.transformVersion,
        compilerHash: current.compilerHash,
        sourceHash: current.sourceHash,
        targetHash: current.targetHash,
        correlationId: job.correlationId,
        causationId: job.causationId,
      },
      signal,
    );
    if (!batchResult.ok)
      return {
        outcome: batchResult.failure.retryable ? 'retry' : 'failure',
        done: false,
        version: current.version,
        cursor: current.cursor,
        progress: current.progress,
        sourceCount: current.sourceCount,
        targetCount: current.targetCount,
        rowErrorCount: current.rowErrorCount,
        migratedCount: current.migratedCount,
        failedCount: current.failedCount,
        reasonCode: batchResult.failure.code,
      };
    let parsed: SchemaMigrationBatchResult;
    try {
      parsed = parseBatchResult(batchResult.value);
    } catch (error) {
      return {
        outcome: 'failure',
        done: false,
        version: current.version,
        cursor: current.cursor,
        progress: current.progress,
        sourceCount: current.sourceCount,
        targetCount: current.targetCount,
        rowErrorCount: current.rowErrorCount,
        migratedCount: current.migratedCount,
        failedCount: current.failedCount,
        reasonCode: errorCode(error, 'DEPENDENCY_INVALID_RESPONSE'),
      };
    }
    if (
      !decimalAtLeast(parsed.cursor, current.cursor) ||
      parsed.progress < current.progress
    )
      return {
        outcome: 'failure',
        done: false,
        version: current.version,
        cursor: current.cursor,
        progress: current.progress,
        sourceCount: current.sourceCount,
        targetCount: current.targetCount,
        rowErrorCount: current.rowErrorCount,
        migratedCount: current.migratedCount,
        failedCount: current.failedCount,
        reasonCode:
          parsed.progress < current.progress
            ? 'MIGRATION_PROGRESS_REGRESSION'
            : 'MIGRATION_CURSOR_REGRESSION',
      };
    current = planWithBatch(current, parsed);
    if (parsed.done)
      return {
        outcome: 'progress',
        done: true,
        version: current.version,
        cursor: current.cursor,
        progress: current.progress,
        sourceCount: current.sourceCount,
        targetCount: current.targetCount,
        rowErrorCount: current.rowErrorCount,
        migratedCount: current.migratedCount,
        failedCount: current.failedCount,
        reasonCode: null,
      };
  }
  return {
    outcome: 'progress',
    done: false,
    version: current.version,
    cursor: current.cursor,
    progress: current.progress,
    sourceCount: current.sourceCount,
    targetCount: current.targetCount,
    rowErrorCount: current.rowErrorCount,
    migratedCount: current.migratedCount,
    failedCount: current.failedCount,
    reasonCode: null,
  };
};
