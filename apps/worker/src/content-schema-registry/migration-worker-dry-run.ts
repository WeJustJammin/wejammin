import { SCHEMA_MIGRATION_RPC } from './migration-worker-constants';
import { runMigrationBatches } from './migration-worker-batches';
import type {
  MigrationExecutionInput,
  MigrationStageResult,
} from './migration-worker-stage-types';
import {
  failAndRollback,
  failureResult,
  workerResultFromBatch,
} from './migration-worker-results';
import { errorCode, parsePlanResult } from './migration-worker-validation';

export const runDryRunStage = async (
  input: MigrationExecutionInput,
): Promise<MigrationStageResult> => {
  const { runtime, plan, event, job, leaseToken, signal, attempt } = input;
  let current = plan;
  if (current.state === 'dry_running') {
    const dryRun = await runMigrationBatches(
      runtime,
      current,
      event,
      job,
      leaseToken,
      true,
      signal,
      attempt,
      runtime.maxBatches,
    );
    if (dryRun.outcome === 'retry')
      return failureResult(
        current,
        event,
        {
          code: dryRun.reasonCode ?? 'DRY_RUN_RETRY',
          retryable: true,
        },
        attempt,
        runtime.now,
        runtime.emit,
        { signal, call: runtime.call, deadLetter: runtime.deadLetter },
      );
    if (dryRun.outcome === 'failure')
      return failAndRollback(
        current,
        event,
        job,
        leaseToken,
        dryRun.reasonCode ?? 'DRY_RUN_FAILED',
        false,
        attempt,
        signal,
        runtime.now,
        runtime.emit,
        runtime.call,
        { signal, call: runtime.call, deadLetter: runtime.deadLetter },
      );
    if (dryRun.done !== true)
      return workerResultFromBatch(
        current,
        event,
        dryRun,
        attempt,
        runtime.now,
        runtime.emit,
      );
    const finalized = await runtime.call(
      SCHEMA_MIGRATION_RPC.finalizeDryRun,
      {
        migrationPlanId: current.id,
        expectedVersion: dryRun.version,
        cursor: dryRun.cursor,
        sourceCount: dryRun.sourceCount,
        targetCount: dryRun.targetCount,
        rowErrorCount: dryRun.rowErrorCount,
        transformKey: current.transformKey,
        transformVersion: current.transformVersion,
        compilerHash: current.compilerHash,
        sourceHash: current.sourceHash,
        targetHash: current.targetHash,
      },
      signal,
    );
    if (!finalized.ok)
      return failureResult(
        current,
        event,
        finalized.failure,
        attempt,
        runtime.now,
        runtime.emit,
        { signal, call: runtime.call, deadLetter: runtime.deadLetter },
      );
    try {
      current = parsePlanResult(finalized.value);
    } catch (error) {
      return failureResult(
        current,
        event,
        {
          code: errorCode(error, 'DEPENDENCY_INVALID_RESPONSE'),
          retryable: false,
        },
        attempt,
        runtime.now,
        runtime.emit,
        { signal, call: runtime.call, deadLetter: runtime.deadLetter },
      );
    }
    return { plan: current, leaseToken: current.leaseToken };
  }
  return { plan: current, leaseToken };
};
