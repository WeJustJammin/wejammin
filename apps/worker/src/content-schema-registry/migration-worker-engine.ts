import type {
  MigrationWorkerResult,
  NormalizedInput,
  SchemaMigrationWorker,
  SchemaMigrationWorkerDependencies,
} from './migration-worker-types';
import { processNormalized } from './migration-worker-execution';
import {
  createMigrationWorkerRuntime,
  scopeMigrationWorkerRuntime,
  type MigrationWorkerRuntime,
} from './migration-worker-runtime';
import {
  eventReleaseFailure,
  isEventEnvelopeCandidate,
  resultWith,
  retryAfter,
  safeEventIdentity,
  toNormalizedInput,
} from './migration-worker-validation';

export const createSchemaMigrationWorker = (
  dependencies: SchemaMigrationWorkerDependencies,
): SchemaMigrationWorker => {
  const baseRuntime = createMigrationWorkerRuntime(dependencies);
  const inFlight = new Map<string, Promise<MigrationWorkerResult>>();

  const releaseClaimForRetry = async (
    runtime: MigrationWorkerRuntime,
    event: NonNullable<NormalizedInput['event']>,
    result: MigrationWorkerResult,
    signal: AbortSignal,
    attempt: number,
  ): Promise<MigrationWorkerResult> => {
    if (
      !runtime.eventClaimAcquired() ||
      result.reasonCode === 'EVENT_CLAIM_LOST' ||
      !['progress', 'retry', 'failed_retryable', 'blocked'].includes(
        result.outcome,
      )
    )
      return result;

    const released = await runtime.releaseEventClaim(signal);
    const releaseFailure = released.ok
      ? eventReleaseFailure(released.value)
      : released.failure;
    if (releaseFailure === null) {
      runtime.markEventClaimReleased();
      return result;
    }

    await runtime.emit({
      operation: 'migration.recovery',
      outcome: 'retry',
      migrationPlanId: result.migrationPlanId,
      schemaVersionId: result.schemaVersionId,
      eventId: event.eventId,
      correlationId: event.correlationId,
      cursor: result.cursor,
      progress: result.progress,
      attempt,
      retryable: true,
      reasonCode: releaseFailure.code,
      durationMs: Math.max(0, runtime.now() - Date.parse(event.occurredAt)),
    });
    return resultWith('retry', {
      migrationPlanId: result.migrationPlanId,
      schemaVersionId: result.schemaVersionId,
      eventId: result.eventId,
      state: result.state,
      cursor: result.cursor,
      progress: result.progress,
      retryAfterMs: retryAfter(attempt),
      reasonCode: releaseFailure.code,
    });
  };

  const process = async (
    input: unknown,
    options: Readonly<{
      signal?: AbortSignal;
      attempt?: number;
      replay?: boolean;
    }> = {},
  ): Promise<MigrationWorkerResult> => {
    const signal = options.signal ?? new AbortController().signal;
    const attempt = options.attempt ?? 0;
    const replay = options.replay ?? false;
    const normalized = toNormalizedInput(input);
    if (normalized === null) {
      const reasonCode =
        isEventEnvelopeCandidate(input) &&
        typeof input === 'object' &&
        input !== null &&
        !Array.isArray(input) &&
        (input as { schemaVersion?: unknown }).schemaVersion !== 1
          ? 'UNKNOWN_EVENT_VERSION'
          : 'INVALID_QUEUE_PAYLOAD';
      await baseRuntime.deadLetter(input, reasonCode, signal);
      const identity = safeEventIdentity(input);
      await baseRuntime.emit({
        operation: 'migration.consume',
        outcome: 'dead_letter',
        migrationPlanId: null,
        schemaVersionId: null,
        eventId: identity.eventId,
        correlationId: null,
        cursor: null,
        progress: null,
        attempt,
        retryable: false,
        reasonCode,
        durationMs: 0,
      });
      return resultWith('dead_letter', {
        eventId: identity.eventId,
        reasonCode,
      });
    }
    if (baseRuntime.executionPurpose === 'dry_run' && normalized.event !== null)
      return resultWith('failed_terminal', {
        migrationPlanId: normalized.event.payload.migrationPlanId,
        schemaVersionId: normalized.event.payload.schemaVersionId,
        eventId: normalized.event.eventId,
        reasonCode: 'EXECUTION_PURPOSE_MISMATCH',
      });
    // Normalization validates one of these identifiers before returning.
    const identity = (normalized.event?.eventId ??
      normalized.job?.migrationPlanId) as string;
    const previous = inFlight.get(identity);
    if (previous !== undefined) return previous;
    const runtime =
      normalized.event === null
        ? baseRuntime
        : scopeMigrationWorkerRuntime(
            baseRuntime,
            normalized.event,
            baseRuntime.createEventClaimToken(),
          );
    const promise = processNormalized(
      runtime,
      normalized,
      signal,
      attempt,
      replay,
    ).then(async (result) => {
      // BE03a Observability `cms_migration_blocked_total`: a blocked plan is a
      // terminal-for-now state, so it is counted once here, before a claim
      // release can rewrite the queue outcome to a retry.
      if (result.outcome === 'blocked')
        await baseRuntime.emit({
          operation: 'migration.consume',
          outcome: 'blocked',
          migrationPlanId: result.migrationPlanId,
          schemaVersionId: result.schemaVersionId,
          eventId: result.eventId,
          correlationId: normalized.event?.correlationId ?? null,
          cursor: result.cursor,
          progress: result.progress,
          attempt,
          retryable: false,
          reasonCode: result.reasonCode,
          durationMs:
            normalized.event === null
              ? 0
              : Math.max(
                  0,
                  baseRuntime.now() - Date.parse(normalized.event.occurredAt),
                ),
        });
      return normalized.event === null
        ? result
        : releaseClaimForRetry(
            runtime,
            normalized.event,
            result,
            signal,
            attempt,
          );
    });
    inFlight.set(identity, promise);
    try {
      return await promise;
    } finally {
      inFlight.delete(identity);
    }
  };

  return {
    process,
    replayDlq: (input, options) => process(input, { ...options, replay: true }),
  };
};
