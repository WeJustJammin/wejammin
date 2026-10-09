import { SCHEMA_MIGRATION_RPC } from './migration-worker-constants';
import { runActivationStage } from './migration-worker-activation';
import type { MigrationExecutionInput } from './migration-worker-stage-types';
import type { MigrationWorkerResult } from './migration-worker-types';
import {
  completedResult,
  failAndRollback,
  failureResult,
  verificationRequest,
} from './migration-worker-results';
import { isRecord, isSafeToken } from './migration-worker-schema-core';
import {
  errorCode,
  parsePlanResult,
  resultWith,
  retryAfter,
} from './migration-worker-validation';

export async function runVerificationStage(
  input: MigrationExecutionInput,
): Promise<MigrationWorkerResult> {
  const { runtime, plan, event, job, leaseToken, signal, attempt } = input;
  const startedAt = runtime.now();
  let current = plan;
  if (current.state === 'verifying') {
    const verified = await runtime.call(
      SCHEMA_MIGRATION_RPC.verify,
      verificationRequest(current, job, leaseToken),
      signal,
    );
    if (!verified.ok)
      return failureResult(
        current,
        event,
        verified.failure,
        attempt,
        runtime.now,
        runtime.emit,
        { signal, call: runtime.call, deadLetter: runtime.deadLetter },
      );
    if (!isRecord(verified.value) || typeof verified.value.valid !== 'boolean')
      return failureResult(
        current,
        event,
        { code: 'DEPENDENCY_INVALID_RESPONSE', retryable: false },
        attempt,
        runtime.now,
        runtime.emit,
        { signal, call: runtime.call, deadLetter: runtime.deadLetter },
      );
    if (!verified.value.valid)
      return failAndRollback(
        current,
        event,
        job,
        leaseToken,
        isSafeToken(verified.value.reasonCode, 64)
          ? verified.value.reasonCode
          : 'VERIFICATION_FAILED',
        false,
        attempt,
        signal,
        runtime.now,
        runtime.emit,
        runtime.call,
        { signal, call: runtime.call, deadLetter: runtime.deadLetter },
      );
    const completed = await runtime.call(
      SCHEMA_MIGRATION_RPC.complete,
      {
        migrationPlanId: current.id,
        expectedVersion: current.version,
        leaseToken,
      },
      signal,
    );
    if (!completed.ok)
      return failureResult(
        current,
        event,
        completed.failure,
        attempt,
        runtime.now,
        runtime.emit,
        { signal, call: runtime.call, deadLetter: runtime.deadLetter },
      );
    try {
      current = parsePlanResult(completed.value);
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
    if (runtime.executionPurpose === 'dry_run') {
      if (current.state !== 'completed')
        return failureResult(
          current,
          event,
          { code: 'DEPENDENCY_INVALID_RESPONSE', retryable: false },
          attempt,
          runtime.now,
          runtime.emit,
          { signal, call: runtime.call, deadLetter: runtime.deadLetter },
        );
      return completedResult(
        current,
        event,
        false,
        attempt,
        runtime.now,
        runtime.emit,
      );
    }
    return runActivationStage({ ...input, plan: current }, startedAt);
  }

  return resultWith('retry', {
    migrationPlanId: current.id,
    schemaVersionId: current.toVersionId,
    eventId: event?.eventId ?? null,
    state: current.state,
    cursor: current.cursor,
    progress: current.progress,
    retryAfterMs: retryAfter(attempt),
    reasonCode: 'UNEXPECTED_MIGRATION_STATE',
  });
}
