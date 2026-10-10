import { SCHEMA_MIGRATION_RPC } from './migration-worker-constants';
import type { SchemaMigrationQueueEnvelope } from './migration-worker-input-schemas';
import type { MigrationPlanRecord } from './migration-worker-plan-schemas';
import type { MigrationWorkerRuntime } from './migration-worker-runtime';
import type { MigrationWorkerResult } from './migration-worker-types';
import {
  eventFinalizationFailure,
  eventReleaseFailure,
  resultWith,
  retryAfter,
} from './migration-worker-validation';

type AcknowledgementRecoveryInput = Readonly<{
  runtime: MigrationWorkerRuntime;
  event: SchemaMigrationQueueEnvelope;
  input: unknown;
  signal: AbortSignal;
  attempt: number;
  migrationPlanId: string | null;
  schemaVersionId: string | null;
  state: MigrationWorkerResult['state'];
  cursor: string | null;
  progress: number | null;
  correlationId: string | null;
  startedAt: number;
  outcome: 'ignored' | 'success' | 'failure';
}>;

export const acknowledgeEventOrRecover = async ({
  runtime,
  event,
  input,
  signal,
  attempt,
  migrationPlanId,
  schemaVersionId,
  state,
  cursor,
  progress,
  correlationId,
  startedAt,
  outcome,
}: AcknowledgementRecoveryInput): Promise<MigrationWorkerResult | null> => {
  const acknowledgement = await runtime.call(
    SCHEMA_MIGRATION_RPC.acknowledgeEvent,
    { eventId: event.eventId, outcome },
    signal,
  );
  const failure = !acknowledgement.ok
    ? acknowledgement.failure
    : eventFinalizationFailure(acknowledgement.value);
  if (failure === null) return null;

  const resultDetails = {
    migrationPlanId,
    schemaVersionId,
    eventId: event.eventId,
    state,
    cursor,
    progress,
    reasonCode: failure.code,
  } satisfies Partial<MigrationWorkerResult>;
  if (failure.retryable) {
    await runtime.emit({
      operation: 'migration.consume',
      outcome: 'retry',
      migrationPlanId,
      schemaVersionId,
      eventId: event.eventId,
      correlationId,
      cursor,
      progress,
      attempt,
      retryable: true,
      reasonCode: failure.code,
      durationMs: Math.max(0, runtime.now() - startedAt),
    });
    return resultWith('retry', {
      ...resultDetails,
      retryAfterMs: retryAfter(attempt),
    });
  }

  await runtime.deadLetter(input, failure.code, signal);
  await runtime.emit({
    operation: 'migration.consume',
    outcome: 'dead_letter',
    migrationPlanId,
    schemaVersionId,
    eventId: event.eventId,
    correlationId,
    cursor,
    progress,
    attempt,
    retryable: false,
    reasonCode: failure.code,
    durationMs: Math.max(0, runtime.now() - startedAt),
  });
  return resultWith('dead_letter', resultDetails);
};

export const releaseBlockedClaim = async (
  runtime: MigrationWorkerRuntime,
  event: SchemaMigrationQueueEnvelope,
  plan: MigrationPlanRecord,
  signal: AbortSignal,
  attempt: number,
  startedAt: number,
): Promise<MigrationWorkerResult | null> => {
  const released = await runtime.releaseEventClaim(signal);
  const failure = released.ok
    ? eventReleaseFailure(released.value)
    : released.failure;
  if (failure === null) {
    runtime.markEventClaimReleased();
    return null;
  }
  await runtime.emit({
    operation: 'migration.recovery',
    outcome: 'retry',
    migrationPlanId: plan.id,
    schemaVersionId: plan.toVersionId,
    eventId: event.eventId,
    correlationId: event.correlationId,
    cursor: plan.cursor,
    progress: plan.progress,
    attempt,
    retryable: true,
    reasonCode: failure.code,
    durationMs: Math.max(0, runtime.now() - startedAt),
  });
  return resultWith('retry', {
    migrationPlanId: plan.id,
    schemaVersionId: plan.toVersionId,
    eventId: event.eventId,
    state: plan.state,
    cursor: plan.cursor,
    progress: plan.progress,
    retryAfterMs: retryAfter(attempt),
    reasonCode: failure.code,
  });
};
