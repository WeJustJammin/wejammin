import type { MigrationAdmission } from './migration-worker-admission';
import {
  acknowledgeEventOrRecover,
  releaseBlockedClaim,
} from './migration-worker-event-recovery';
import type {
  SchemaMigrationQueueEnvelope,
  SchemaMigrationJobPayload,
} from './migration-worker-input-schemas';
import type { MigrationPlanRecord } from './migration-worker-plan-schemas';
import { inputFromNormalized } from './migration-worker-results';
import type { MigrationWorkerRuntime } from './migration-worker-runtime';
import { resultWith } from './migration-worker-validation';

export const admitResolvedMigrationInput = async (
  runtime: MigrationWorkerRuntime,
  normalized: Readonly<{
    event: SchemaMigrationQueueEnvelope | null;
    job: SchemaMigrationJobPayload;
  }>,
  plan: MigrationPlanRecord,
  signal: AbortSignal,
  attempt: number,
  startedAt: number,
): Promise<MigrationAdmission> => {
  const event = normalized.event;
  const job = normalized.job;
  if (
    plan.id !== job.migrationPlanId ||
    plan.toVersionId !== job.schemaVersionId
  ) {
    const stale = resultWith('stale', {
      migrationPlanId: job.migrationPlanId,
      schemaVersionId: job.schemaVersionId,
      eventId: event?.eventId ?? null,
      state: plan.state,
      reasonCode: 'PLAN_TARGET_MISMATCH',
    });
    if (event !== null) {
      const acknowledgementRecovery = await acknowledgeEventOrRecover({
        runtime,
        event,
        input: inputFromNormalized(normalized),
        signal,
        attempt,
        migrationPlanId: plan.id,
        schemaVersionId: plan.toVersionId,
        state: plan.state,
        cursor: plan.cursor,
        progress: plan.progress,
        correlationId: event.correlationId,
        startedAt,
        outcome: 'failure',
      });
      if (acknowledgementRecovery !== null) return acknowledgementRecovery;
    }
    return stale;
  }
  if (plan.version !== job.expectedVersion && plan.state !== 'completed') {
    const stale = resultWith('stale', {
      migrationPlanId: job.migrationPlanId,
      schemaVersionId: job.schemaVersionId,
      eventId: event?.eventId ?? null,
      state: plan.state,
      cursor: plan.cursor,
      progress: plan.progress,
      reasonCode: 'PLAN_VERSION_MISMATCH',
    });
    if (event !== null) {
      const acknowledgementRecovery = await acknowledgeEventOrRecover({
        runtime,
        event,
        input: inputFromNormalized(normalized),
        signal,
        attempt,
        migrationPlanId: plan.id,
        schemaVersionId: plan.toVersionId,
        state: plan.state,
        cursor: plan.cursor,
        progress: plan.progress,
        correlationId: event.correlationId,
        startedAt,
        outcome: 'failure',
      });
      if (acknowledgementRecovery !== null) return acknowledgementRecovery;
    }
    return stale;
  }
  if (plan.state === 'completed') {
    const completed = resultWith('completed', {
      migrationPlanId: plan.id,
      schemaVersionId: plan.toVersionId,
      eventId: event?.eventId ?? null,
      state: plan.state,
      cursor: plan.cursor,
      progress: plan.progress,
    });
    if (event !== null) {
      const acknowledgementRecovery = await acknowledgeEventOrRecover({
        runtime,
        event,
        input: inputFromNormalized(normalized),
        signal,
        attempt,
        migrationPlanId: plan.id,
        schemaVersionId: plan.toVersionId,
        state: plan.state,
        cursor: plan.cursor,
        progress: plan.progress,
        correlationId: event.correlationId,
        startedAt,
        outcome: 'success',
      });
      if (acknowledgementRecovery !== null) return acknowledgementRecovery;
    }
    await runtime.emit({
      operation: 'migration.consume',
      outcome: 'success',
      migrationPlanId: plan.id,
      schemaVersionId: plan.toVersionId,
      eventId: event?.eventId ?? null,
      correlationId: event?.correlationId ?? job.correlationId,
      cursor: plan.cursor,
      progress: plan.progress,
      attempt,
      retryable: false,
      reasonCode: null,
      durationMs: Math.max(0, runtime.now() - startedAt),
    });
    return completed;
  }
  if (plan.state === 'failed_terminal') {
    if (event !== null) {
      const acknowledgementRecovery = await acknowledgeEventOrRecover({
        runtime,
        event,
        input: inputFromNormalized(normalized),
        signal,
        attempt,
        migrationPlanId: plan.id,
        schemaVersionId: plan.toVersionId,
        state: plan.state,
        cursor: plan.cursor,
        progress: plan.progress,
        correlationId: event.correlationId,
        startedAt,
        outcome: 'failure',
      });
      if (acknowledgementRecovery !== null) return acknowledgementRecovery;
    }
    return resultWith('failed_terminal', {
      migrationPlanId: plan.id,
      schemaVersionId: plan.toVersionId,
      eventId: event?.eventId ?? null,
      state: plan.state,
      cursor: plan.cursor,
      progress: plan.progress,
      reasonCode: 'MIGRATION_TERMINAL',
    });
  }
  if (plan.state === 'blocked') {
    const blocked = resultWith('blocked', {
      migrationPlanId: plan.id,
      schemaVersionId: plan.toVersionId,
      eventId: event?.eventId ?? null,
      state: plan.state,
      cursor: plan.cursor,
      progress: plan.progress,
      reasonCode: 'MIGRATION_BLOCKED',
    });
    if (event !== null) {
      const releaseFailure = await releaseBlockedClaim(
        runtime,
        event,
        plan,
        signal,
        attempt,
        startedAt,
      );
      if (releaseFailure !== null) return releaseFailure;
    }
    return blocked;
  }
  return { plan, event, job };
};
