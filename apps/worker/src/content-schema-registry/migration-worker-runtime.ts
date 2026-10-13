import {
  DEFAULT_MAX_BATCHES_PER_INVOCATION,
  DEFAULT_MIGRATION_BATCH_ROWS,
  DEFAULT_MIGRATION_LEASE_MS,
  MAX_MIGRATION_BATCH_ROWS,
  SCHEMA_MIGRATION_RPC,
  type SchemaMigrationRpcName,
} from './migration-worker-constants';
import { DEFAULT_TRANSFORM_REGISTRY } from './migration-transform-registry';
import type { TransformRegistry } from './migration-transform-types';
import type { SchemaMigrationQueueEnvelope } from './migration-worker-input-schemas';
import type {
  MigrationWorkerTelemetryEvent,
  RpcCaller,
  RpcResult,
  SchemaMigrationWorkerDependencies,
} from './migration-worker-types';
import {
  deadLetterPersistenceError,
  errorCode,
  failureRetryable,
  isDurableDeadLetterAcknowledgement,
  safeEventIdentity,
} from './migration-worker-validation';
import { isRecord, isSafeToken, isUuid } from './migration-worker-schema-core';

/** Validated dependency context shared by each migration stage. */
export type MigrationWorkerRuntime = Readonly<{
  workerId: string;
  executionPurpose: 'dry_run' | 'activation';
  now: () => number;
  leaseDurationMs: number;
  maxBatchRows: number;
  maxBatches: number;
  transformRegistry: TransformRegistry;
  emit: (event: MigrationWorkerTelemetryEvent) => Promise<void>;
  call: RpcCaller;
  createEventClaimToken: () => string;
  eventClaimAcquired: () => boolean;
  eventClaimToken: string | null;
  markEventClaimAcquired: () => void;
  markEventClaimReleased: () => void;
  releaseEventClaim: (signal: AbortSignal) => Promise<RpcResult>;
  deadLetter: (
    input: unknown,
    reasonCode: string,
    signal: AbortSignal,
  ) => Promise<void>;
}>;

const eventIdentity = (
  event: SchemaMigrationQueueEnvelope,
): Readonly<Record<string, unknown>> => ({
  eventId: event.eventId,
  eventType: event.eventType,
  schemaVersion: event.schemaVersion,
  aggregateType: event.aggregateType,
  aggregateId: event.aggregateId,
  aggregateVersion: event.aggregateVersion,
  migrationPlanId: event.payload.migrationPlanId,
});

const persistDeadLetter = async (
  call: RpcCaller,
  createEventClaimToken: () => string,
  input: unknown,
  reasonCode: string,
  signal: AbortSignal,
  scopedClaimToken?: string,
): Promise<void> => {
  const identity = safeEventIdentity(input);
  const result = await call(
    SCHEMA_MIGRATION_RPC.deadLetter,
    {
      eventId: identity.eventId,
      eventType: identity.eventType,
      schemaVersion: identity.schemaVersion,
      aggregateType: identity.aggregateType,
      aggregateId: identity.aggregateId,
      aggregateVersion: identity.aggregateVersion,
      ...(Object.hasOwn(identity, 'migrationPlanId')
        ? { migrationPlanId: identity.migrationPlanId }
        : {}),
      claimToken: scopedClaimToken ?? createEventClaimToken(),
      reasonCode,
    },
    signal,
  );
  if (!result.ok) throw deadLetterPersistenceError(result.failure.code);
  if (!isDurableDeadLetterAcknowledgement(result.value)) {
    const code =
      isRecord(result.value) &&
      result.value.accepted === false &&
      result.value.code === 'EVENT_CLAIM_LOST' &&
      result.value.retryable === true
        ? 'EVENT_CLAIM_LOST'
        : 'DEPENDENCY_INVALID_RESPONSE';
    throw deadLetterPersistenceError(code);
  }
};

export const createMigrationWorkerRuntime = (
  dependencies: SchemaMigrationWorkerDependencies,
): MigrationWorkerRuntime => {
  const configuredPurpose = dependencies.executionPurpose;
  if (
    configuredPurpose !== undefined &&
    configuredPurpose !== 'dry_run' &&
    configuredPurpose !== 'activation'
  )
    throw new Error('executionPurpose is invalid');
  const executionPurpose = configuredPurpose ?? 'activation';
  const now = dependencies.now ?? Date.now;
  const leaseDurationMs =
    dependencies.leaseDurationMs ?? DEFAULT_MIGRATION_LEASE_MS;
  const maxBatchRows =
    dependencies.maxBatchRows ?? DEFAULT_MIGRATION_BATCH_ROWS;
  const maxBatches =
    dependencies.maxBatchesPerInvocation ?? DEFAULT_MAX_BATCHES_PER_INVOCATION;
  if (!isSafeToken(dependencies.workerId, 200))
    throw new Error('workerId must be a safe token');
  if (!Number.isSafeInteger(leaseDurationMs) || leaseDurationMs < 1)
    throw new Error('leaseDurationMs must be a positive integer');
  if (
    !Number.isSafeInteger(maxBatchRows) ||
    maxBatchRows < 1 ||
    maxBatchRows > MAX_MIGRATION_BATCH_ROWS
  )
    throw new Error('maxBatchRows exceeds the bounded worker limit');
  if (!Number.isSafeInteger(maxBatches) || maxBatches < 1 || maxBatches > 32)
    throw new Error('maxBatchesPerInvocation is invalid');

  const createEventClaimToken = (): string => {
    const webCrypto = (
      globalThis as unknown as {
        crypto?: Readonly<{ randomUUID?: () => string }>;
      }
    ).crypto;
    const token =
      dependencies.eventClaimTokenFactory?.() ?? webCrypto?.randomUUID?.();
    if (!isUuid(token))
      throw new Error('event claim token factory returned an invalid token');
    return token;
  };

  const emit = async (event: MigrationWorkerTelemetryEvent): Promise<void> => {
    try {
      await dependencies.telemetry?.(event);
    } catch {
      // Telemetry loss cannot roll back a committed migration state.
    }
  };

  const call = async (
    rpc: SchemaMigrationRpcName,
    request: unknown,
    signal: AbortSignal,
  ): Promise<RpcResult> => {
    if (signal.aborted)
      return {
        ok: false,
        failure: { code: 'DEPENDENCY_DEADLINE_EXCEEDED', retryable: true },
      };
    try {
      return {
        ok: true,
        value: await dependencies.port.call(rpc, request, signal),
      };
    } catch (error) {
      return {
        ok: false,
        failure: {
          code: errorCode(error, 'DEPENDENCY_UNAVAILABLE'),
          retryable: failureRetryable(error),
        },
      };
    }
  };

  const deadLetter = async (
    input: unknown,
    reasonCode: string,
    signal: AbortSignal,
  ): Promise<void> => {
    await persistDeadLetter(
      call,
      createEventClaimToken,
      input,
      reasonCode,
      signal,
    );
  };

  return {
    workerId: dependencies.workerId,
    executionPurpose,
    now,
    leaseDurationMs,
    maxBatchRows,
    maxBatches,
    transformRegistry:
      dependencies.transformRegistry ?? DEFAULT_TRANSFORM_REGISTRY,
    emit,
    call,
    createEventClaimToken,
    eventClaimAcquired: () => false,
    eventClaimToken: null,
    markEventClaimAcquired: () => undefined,
    markEventClaimReleased: () => undefined,
    releaseEventClaim: async () => ({
      ok: false,
      failure: { code: 'EVENT_CLAIM_NOT_SCOPED', retryable: false },
    }),
    deadLetter,
  };
};

export const scopeMigrationWorkerRuntime = (
  runtime: MigrationWorkerRuntime,
  event: SchemaMigrationQueueEnvelope,
  claimToken: string,
): MigrationWorkerRuntime => {
  let acquired = false;
  const identity = eventIdentity(event);
  const call: RpcCaller = (rpc, request, signal) => {
    if (
      rpc !== SCHEMA_MIGRATION_RPC.claimEvent &&
      rpc !== SCHEMA_MIGRATION_RPC.releaseEvent &&
      rpc !== SCHEMA_MIGRATION_RPC.acknowledgeEvent
    )
      return runtime.call(rpc, request, signal);
    if (!isRecord(request))
      return Promise.resolve({
        ok: false,
        failure: { code: 'DEPENDENCY_INVALID_REQUEST', retryable: false },
      });
    return runtime.call(rpc, { ...request, ...identity, claimToken }, signal);
  };

  return {
    ...runtime,
    call,
    deadLetter: (input, reasonCode, signal) =>
      persistDeadLetter(
        runtime.call,
        runtime.createEventClaimToken,
        input,
        reasonCode,
        signal,
        claimToken,
      ),
    eventClaimAcquired: () => acquired,
    eventClaimToken: claimToken,
    markEventClaimAcquired: () => {
      acquired = true;
    },
    markEventClaimReleased: () => {
      acquired = false;
    },
    releaseEventClaim: (signal) =>
      call(SCHEMA_MIGRATION_RPC.releaseEvent, {}, signal),
  };
};
