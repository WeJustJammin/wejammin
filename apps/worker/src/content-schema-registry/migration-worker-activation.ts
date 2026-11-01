import { SCHEMA_MIGRATION_RPC } from './migration-worker-constants';
import type { MigrationExecutionInput } from './migration-worker-stage-types';
import type { MigrationWorkerResult } from './migration-worker-types';
import { completedResult, failAndRollback } from './migration-worker-results';
import { isRecord } from './migration-worker-schema-core';
import {
  eventFinalizationFailure,
  resultStatus,
  resultWith,
  retryAfter,
} from './migration-worker-validation';

type AcknowledgementRecoveryInput = Readonly<{
  runtime: MigrationExecutionInput['runtime'];
  plan: MigrationExecutionInput['plan'];
  event: NonNullable<MigrationExecutionInput['event']>;
  signal: AbortSignal;
  attempt: number;
  startedAt: number;
  outcome: 'success';
}>;

const acknowledgeEventOrRecover = async ({
  runtime,
  plan,
  event,
  signal,
  attempt,
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
    migrationPlanId: plan.id,
    schemaVersionId: plan.toVersionId,
    eventId: event.eventId,
    state: plan.state,
    cursor: plan.cursor,
    progress: plan.progress,
    reasonCode: failure.code,
  } satisfies Partial<MigrationWorkerResult>;
  if (failure.retryable) {
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
      ...resultDetails,
      retryAfterMs: retryAfter(attempt),
    });
  }

  await runtime.deadLetter(event, failure.code, signal);
  await runtime.emit({
    operation: 'migration.recovery',
    outcome: 'dead_letter',
    migrationPlanId: plan.id,
    schemaVersionId: plan.toVersionId,
    eventId: event.eventId,
    correlationId: event.correlationId,
    cursor: plan.cursor,
    progress: plan.progress,
    attempt,
    retryable: false,
    reasonCode: failure.code,
    durationMs: Math.max(0, runtime.now() - startedAt),
  });
  return resultWith('dead_letter', resultDetails);
};

export const runActivationStage = async (
  input: MigrationExecutionInput,
  startedAt: number,
): Promise<MigrationWorkerResult> => {
  const {
    runtime,
    plan: current,
    event,
    job,
    leaseToken,
    signal,
    attempt,
  } = input;
  const switched = await runtime.call(
    SCHEMA_MIGRATION_RPC.activate,
    {
      migrationPlanId: current.id,
      contentTypeId: current.contentTypeId,
      schemaVersionId: current.toVersionId,
      expectedVersion: current.version,
      expectedActiveVersionId: current.fromVersionId,
      transformKey: current.transformKey,
      transformVersion: current.transformVersion,
      compilerHash: current.compilerHash,
      sourceHash: current.sourceHash,
      targetHash: current.targetHash,
      idempotencyKey: `cms-migration:${current.id}`,
      switchOnlyOnce: true,
    },
    signal,
  );
  if (!switched.ok) {
    const reconciled = await runtime.call(
      SCHEMA_MIGRATION_RPC.reconcileActivation,
      {
        migrationPlanId: current.id,
        schemaVersionId: current.toVersionId,
        expectedActiveVersionId: current.fromVersionId,
        idempotencyKey: `cms-migration:${current.id}`,
      },
      signal,
    );
    if (
      reconciled.ok &&
      isRecord(reconciled.value) &&
      reconciled.value.activated === true
    ) {
      if (event !== null) {
        const acknowledgementRecovery = await acknowledgeEventOrRecover({
          runtime,
          plan: current,
          event,
          signal,
          attempt,
          startedAt,
          outcome: 'success',
        });
        if (acknowledgementRecovery !== null) return acknowledgementRecovery;
      }
      return completedResult(
        current,
        event,
        true,
        attempt,
        runtime.now,
        runtime.emit,
      );
    }
    return failAndRollback(
      current,
      event,
      job,
      leaseToken,
      switched.failure.code,
      switched.failure.retryable,
      attempt,
      signal,
      runtime.now,
      runtime.emit,
      runtime.call,
      { signal, call: runtime.call, deadLetter: runtime.deadLetter },
    );
  }
  const activationStatus = resultStatus(switched.value);
  const switchedAlready =
    activationStatus === 'already_active' || activationStatus === 'duplicate';
  if (
    isRecord(switched.value) &&
    switched.value.activated === false &&
    !switchedAlready
  )
    return failAndRollback(
      current,
      event,
      job,
      leaseToken,
      'ACTIVATION_NOT_COMMITTED',
      false,
      attempt,
      signal,
      runtime.now,
      runtime.emit,
      runtime.call,
      { signal, call: runtime.call, deadLetter: runtime.deadLetter },
    );
  if (event !== null) {
    const acknowledgementRecovery = await acknowledgeEventOrRecover({
      runtime,
      plan: current,
      event,
      signal,
      attempt,
      startedAt,
      outcome: 'success',
    });
    if (acknowledgementRecovery !== null) return acknowledgementRecovery;
  }
  return completedResult(
    current,
    event,
    !switchedAlready,
    attempt,
    runtime.now,
    runtime.emit,
  );
};
