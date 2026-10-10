import { SCHEMA_MIGRATION_RPC } from './migration-worker-constants';
import { acknowledgeEventOrRecover } from './migration-worker-event-recovery';
import { admitResolvedMigrationInput } from './migration-worker-resolved-admission';
import type {
  SchemaMigrationQueueEnvelope,
  SchemaMigrationJobPayload,
} from './migration-worker-input-schemas';
import type { MigrationPlanRecord } from './migration-worker-plan-schemas';
import type { MigrationWorkerRuntime } from './migration-worker-runtime';
import type {
  MigrationWorkerResult,
  NormalizedInput,
} from './migration-worker-types';
import {
  errorCode,
  eventClaimStatus,
  parsePlanResult,
  resultWith,
  retryAfter,
} from './migration-worker-validation';
import { inputFromNormalized } from './migration-worker-results';

export type MigrationAdmission =
  | MigrationWorkerResult
  | Readonly<{
      plan: MigrationPlanRecord;
      event: SchemaMigrationQueueEnvelope | null;
      job: SchemaMigrationJobPayload;
    }>;

export const admitMigrationInput = async (
  runtime: MigrationWorkerRuntime,
  normalized: NormalizedInput,
  signal: AbortSignal,
  attempt: number,
  replay: boolean,
): Promise<MigrationAdmission> => {
  const startedAt = runtime.now();
  const event = normalized.event;
  const job = normalized.job;
  if (event !== null) {
    const claim = await runtime.call(
      SCHEMA_MIGRATION_RPC.claimEvent,
      {
        eventId: event.eventId,
        aggregateId: event.aggregateId,
        aggregateVersion: event.aggregateVersion,
        migrationPlanId: job?.migrationPlanId ?? null,
        replay,
      },
      signal,
    );
    if (!claim.ok) {
      const retry = resultWith('retry', {
        migrationPlanId: job?.migrationPlanId ?? null,
        schemaVersionId: job?.schemaVersionId ?? event.payload.schemaVersionId,
        eventId: event.eventId,
        retryAfterMs: retryAfter(attempt),
        reasonCode: claim.failure.code,
      });
      await runtime.emit({
        operation: 'migration.consume',
        outcome: 'retry',
        migrationPlanId: job?.migrationPlanId ?? null,
        schemaVersionId: job?.schemaVersionId ?? event.payload.schemaVersionId,
        eventId: event.eventId,
        correlationId: event.correlationId,
        cursor: null,
        progress: null,
        attempt,
        retryable: true,
        reasonCode: claim.failure.code,
        durationMs: Math.max(0, runtime.now() - startedAt),
      });
      return retry;
    }
    let status: ReturnType<typeof eventClaimStatus>;
    try {
      status = eventClaimStatus(claim.value);
    } catch (error) {
      const reason = errorCode(error, 'DEPENDENCY_INVALID_RESPONSE');
      return resultWith('retry', {
        migrationPlanId: job?.migrationPlanId ?? null,
        schemaVersionId: job?.schemaVersionId ?? event.payload.schemaVersionId,
        eventId: event.eventId,
        retryAfterMs: retryAfter(attempt),
        reasonCode: reason,
      });
    }
    if (status === 'in_progress')
      return resultWith('retry', {
        migrationPlanId: job?.migrationPlanId ?? null,
        schemaVersionId: job?.schemaVersionId ?? event.payload.schemaVersionId,
        eventId: event.eventId,
        retryAfterMs: retryAfter(attempt),
        reasonCode: 'EVENT_IN_PROGRESS',
      });
    if (status === 'duplicate')
      return resultWith('duplicate', {
        migrationPlanId: job?.migrationPlanId ?? null,
        schemaVersionId: job?.schemaVersionId ?? event.payload.schemaVersionId,
        eventId: event.eventId,
        reasonCode: 'EVENT_DUPLICATE',
      });
    if (status === 'stale')
      return resultWith('stale', {
        migrationPlanId: job?.migrationPlanId ?? null,
        schemaVersionId: job?.schemaVersionId ?? event.payload.schemaVersionId,
        eventId: event.eventId,
        reasonCode: 'EVENT_OUT_OF_ORDER',
      });
    runtime.markEventClaimAcquired();
  }

  if (job === null) {
    const ignored = resultWith('completed', {
      eventId: event?.eventId ?? null,
      schemaVersionId: event?.payload.schemaVersionId ?? null,
      state: 'completed',
    });
    if (event !== null) {
      const acknowledgementRecovery = await acknowledgeEventOrRecover({
        runtime,
        event,
        input: inputFromNormalized(normalized),
        signal,
        attempt,
        migrationPlanId: null,
        schemaVersionId: event.payload.schemaVersionId,
        state: 'completed',
        cursor: null,
        progress: null,
        correlationId: event.correlationId,
        startedAt,
        outcome: 'ignored',
      });
      if (acknowledgementRecovery !== null) return acknowledgementRecovery;
    }
    await runtime.emit({
      operation: 'migration.consume',
      outcome: 'success',
      migrationPlanId: null,
      schemaVersionId: event?.payload.schemaVersionId ?? null,
      eventId: event?.eventId ?? null,
      correlationId: event?.correlationId ?? null,
      cursor: null,
      progress: null,
      attempt,
      retryable: false,
      reasonCode: 'NO_MIGRATION_REQUIRED',
      durationMs: Math.max(0, runtime.now() - startedAt),
    });
    return ignored;
  }

  const read = await runtime.call(
    SCHEMA_MIGRATION_RPC.readPlan,
    {
      migrationPlanId: job.migrationPlanId,
      schemaVersionId: job.schemaVersionId,
      expectedVersion: job.expectedVersion,
    },
    signal,
  );
  if (!read.ok) {
    const retry = resultWith('retry', {
      migrationPlanId: job.migrationPlanId,
      schemaVersionId: job.schemaVersionId,
      eventId: event?.eventId ?? null,
      retryAfterMs: retryAfter(attempt),
      reasonCode: read.failure.code,
    });
    await runtime.emit({
      operation: 'migration.consume',
      outcome: 'retry',
      migrationPlanId: job.migrationPlanId,
      schemaVersionId: job.schemaVersionId,
      eventId: event?.eventId ?? null,
      correlationId: event?.correlationId ?? job.correlationId,
      cursor: null,
      progress: null,
      attempt,
      retryable: read.failure.retryable,
      reasonCode: read.failure.code,
      durationMs: Math.max(0, runtime.now() - startedAt),
    });
    return retry;
  }

  let plan: MigrationPlanRecord;
  try {
    plan = parsePlanResult(read.value);
  } catch (error) {
    const reason = errorCode(error, 'DEPENDENCY_INVALID_RESPONSE');
    await runtime.deadLetter(inputFromNormalized(normalized), reason, signal);
    return resultWith('dead_letter', {
      migrationPlanId: job.migrationPlanId,
      schemaVersionId: job.schemaVersionId,
      eventId: event?.eventId ?? null,
      reasonCode: reason,
    });
  }
  return admitResolvedMigrationInput(
    runtime,
    { event, job },
    plan,
    signal,
    attempt,
    startedAt,
  );
};
