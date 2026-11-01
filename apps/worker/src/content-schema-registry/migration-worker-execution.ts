import {
  admitMigrationInput,
  type MigrationAdmission,
} from './migration-worker-admission';
import { runBackfillStage } from './migration-worker-backfill';
import { runDryRunStage } from './migration-worker-dry-run';
import { acquireMigrationLease } from './migration-worker-lease';
import { completedResult } from './migration-worker-results';
import type { MigrationWorkerRuntime } from './migration-worker-runtime';
import type {
  MigrationWorkerResult,
  NormalizedInput,
} from './migration-worker-types';
import { resultWith, retryAfter } from './migration-worker-validation';
import { runVerificationStage } from './migration-worker-verification';

export const processNormalized = async (
  runtime: MigrationWorkerRuntime,
  normalized: NormalizedInput,
  signal: AbortSignal,
  attempt: number,
  replay: boolean,
): Promise<MigrationWorkerResult> => {
  const admitted = await admitMigrationInput(
    runtime,
    normalized,
    signal,
    attempt,
    replay,
  );
  if ('outcome' in admitted) return admitted;
  return processAdmittedMigration(runtime, admitted, signal, attempt);
};

export const processAdmittedMigration = async (
  runtime: MigrationWorkerRuntime,
  admitted: Exclude<MigrationAdmission, MigrationWorkerResult>,
  signal: AbortSignal,
  attempt: number,
): Promise<MigrationWorkerResult> => {
  let current = admitted.plan;
  let leaseToken: string | null = null;
  if (current.state === 'draft' || current.state === 'dry_running') {
    const lease = await acquireMigrationLease(
      runtime,
      current,
      admitted.event,
      admitted.job,
      signal,
      attempt,
    );
    if (lease.kind === 'result') return lease.result;
    current = lease.plan;
    leaseToken = lease.leaseToken;
  }
  if (current.state === 'dry_running') {
    const dryRun = await runDryRunStage({
      runtime,
      plan: current,
      event: admitted.event,
      job: admitted.job,
      leaseToken,
      signal,
      attempt,
    });
    if ('outcome' in dryRun) return dryRun;
    current = dryRun.plan;
    leaseToken = dryRun.leaseToken;
  }
  if (current.state === 'blocked')
    return resultWith('blocked', {
      migrationPlanId: current.id,
      schemaVersionId: current.toVersionId,
      eventId: admitted.event?.eventId ?? null,
      state: current.state,
      cursor: current.cursor,
      progress: current.progress,
      reasonCode: 'MIGRATION_BLOCKED',
    });
  // READY is the sealed boundary; provisional zero counters are not enough.
  if (
    runtime.executionPurpose === 'dry_run' &&
    current.state === 'ready' &&
    current.cursor === '0' &&
    current.sourceCount === '0' &&
    current.targetCount === '0' &&
    current.rowErrorCount === '0' &&
    current.migratedCount === '0' &&
    current.failedCount === '0' &&
    current.leaseOwner === null &&
    current.leaseToken === null
  )
    return completedResult(
      current,
      admitted.event,
      false,
      attempt,
      runtime.now,
      runtime.emit,
    );
  if (
    current.state === 'ready' ||
    current.state === 'running' ||
    current.state === 'failed_retryable'
  ) {
    const backfill = await runBackfillStage({
      runtime,
      plan: current,
      event: admitted.event,
      job: admitted.job,
      leaseToken,
      signal,
      attempt,
    });
    if ('outcome' in backfill) return backfill;
    current = backfill.plan;
    leaseToken = backfill.leaseToken;
  }
  if (current.state === 'verifying') {
    return runVerificationStage({
      runtime,
      plan: current,
      event: admitted.event,
      job: admitted.job,
      leaseToken,
      signal,
      attempt,
    });
  }
  return resultWith('retry', {
    migrationPlanId: current.id,
    schemaVersionId: current.toVersionId,
    eventId: admitted.event?.eventId ?? null,
    state: current.state,
    cursor: current.cursor,
    progress: current.progress,
    retryAfterMs: retryAfter(attempt),
    reasonCode: 'UNEXPECTED_MIGRATION_STATE',
  });
};
