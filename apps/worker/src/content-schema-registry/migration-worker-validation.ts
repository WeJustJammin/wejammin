import { MIGRATION_RETRY_DELAYS_MS } from './migration-worker-constants';
import {
  SchemaMigrationJobPayloadSchema,
  SchemaMigrationQueueEnvelopeSchema,
} from './migration-worker-input-schemas';
import {
  MigrationPlanRecordSchema,
  SchemaMigrationBatchResultSchema,
  type MigrationPlanRecord,
  type SchemaMigrationBatchResult,
} from './migration-worker-plan-schemas';
import {
  hasExactKeys,
  isMigrationLeaseToken,
  isRecord,
  isSafeToken,
  isUuid,
  isVersion,
} from './migration-worker-schema-core';
import type {
  MigrationWorkerResult,
  MigrationWorkerRpcFailure,
  NormalizedInput,
} from './migration-worker-types';

export const errorCode = (value: unknown, fallback: string): string => {
  if (!isRecord(value) || typeof value.code !== 'string') return fallback;
  return /^[A-Z][A-Z0-9_]{0,63}$/u.test(value.code) ? value.code : fallback;
};

export const failureRetryable = (value: unknown): boolean => {
  if (!isRecord(value)) return true;
  if (typeof value.retryable === 'boolean') return value.retryable;
  if (typeof value.status === 'number') return value.status >= 500;
  return true;
};

export const isDurableDeadLetterAcknowledgement = (
  value: unknown,
): value is Readonly<{ accepted: true }> =>
  isRecord(value) &&
  hasExactKeys(value, ['accepted']) &&
  value.accepted === true;

export const deadLetterPersistenceError = (code: string): Error => {
  const error = new Error(`Durable dead-letter persistence failed: ${code}`);
  Object.assign(error, { code, retryable: true });
  return error;
};

export const eventFinalizationFailure = (
  value: unknown,
): MigrationWorkerRpcFailure | null => {
  if (isRecord(value) && value.accepted === true) return null;
  if (
    isRecord(value) &&
    value.accepted === false &&
    value.code === 'EVENT_CLAIM_LOST' &&
    value.retryable === true
  )
    return { code: 'EVENT_CLAIM_LOST', retryable: true };
  return { code: 'DEPENDENCY_INVALID_RESPONSE', retryable: false };
};

export const eventReleaseFailure = (
  value: unknown,
): MigrationWorkerRpcFailure | null => {
  if (
    isRecord(value) &&
    hasExactKeys(value, ['released']) &&
    value.released === true
  )
    return null;
  if (
    isRecord(value) &&
    value.released === false &&
    value.code === 'EVENT_CLAIM_LOST' &&
    value.retryable === true
  )
    return { code: 'EVENT_CLAIM_LOST', retryable: true };
  return { code: 'DEPENDENCY_INVALID_RESPONSE', retryable: true };
};

export const resultPlan = (value: unknown): unknown => {
  if (isRecord(value) && 'plan' in value) return value.plan;
  return value;
};

export const resultStatus = (value: unknown): string | null => {
  if (!isRecord(value) || typeof value.status !== 'string') return null;
  return value.status;
};

export const parsePlanResult = (value: unknown): MigrationPlanRecord => {
  const parsed = MigrationPlanRecordSchema.safeParse(resultPlan(value));
  if (!parsed.success)
    throw { code: 'DEPENDENCY_INVALID_RESPONSE', retryable: false } as const;
  return parsed.data;
};

export const parseBatchResult = (
  value: unknown,
): SchemaMigrationBatchResult => {
  const parsed = SchemaMigrationBatchResultSchema.safeParse(resultPlan(value));
  if (!parsed.success)
    throw { code: 'DEPENDENCY_INVALID_RESPONSE', retryable: false } as const;
  return parsed.data;
};

export const readAcquired = (
  value: unknown,
):
  | Readonly<{
      acquired: false;
      leaseToken: null;
      plan: null;
      reasonCode: string;
    }>
  | Readonly<{
      acquired: true;
      leaseToken: string;
      plan: MigrationPlanRecord | null;
      reasonCode: null;
    }> => {
  if (!isRecord(value) || typeof value.acquired !== 'boolean')
    throw { code: 'DEPENDENCY_INVALID_RESPONSE', retryable: false } as const;
  if (!value.acquired)
    return {
      acquired: false,
      leaseToken: null,
      plan: null,
      reasonCode: isSafeToken(value.reasonCode, 64)
        ? value.reasonCode
        : 'LEASE_UNAVAILABLE',
    };
  if (!isMigrationLeaseToken(value.leaseToken))
    throw { code: 'DEPENDENCY_INVALID_RESPONSE', retryable: false } as const;
  return {
    acquired: true,
    leaseToken: value.leaseToken,
    plan: value.plan === undefined ? null : parsePlanResult(value.plan),
    reasonCode: null,
  };
};

export const eventClaimStatus = (
  value: unknown,
): 'new' | 'replayable' | 'duplicate' | 'stale' | 'in_progress' => {
  if (!isRecord(value) || typeof value.status !== 'string')
    throw { code: 'DEPENDENCY_INVALID_RESPONSE', retryable: false } as const;
  if (
    !['new', 'replayable', 'duplicate', 'stale', 'in_progress'].includes(
      value.status,
    )
  )
    throw { code: 'DEPENDENCY_INVALID_RESPONSE', retryable: false } as const;
  return value.status as
    'new' | 'replayable' | 'duplicate' | 'stale' | 'in_progress';
};

export const resultWith = (
  outcome: MigrationWorkerResult['outcome'],
  input: Partial<MigrationWorkerResult> = {},
): MigrationWorkerResult => ({
  outcome,
  migrationPlanId: null,
  schemaVersionId: null,
  eventId: null,
  state: null,
  cursor: null,
  progress: null,
  retryAfterMs: null,
  reasonCode: null,
  activationSwitched: false,
  ...input,
});

export const retryAfter = (attempt: number): number =>
  MIGRATION_RETRY_DELAYS_MS[
    Math.min(Math.max(attempt, 0), MIGRATION_RETRY_DELAYS_MS.length - 1)
  ]!;

export const safeEventIdentity = (
  input: unknown,
): Readonly<{
  eventId: string | null;
  eventType: string | null;
  schemaVersion: number | null;
  aggregateType: string | null;
  aggregateId: string | null;
  aggregateVersion: string | null;
  migrationPlanId?: string | null;
}> => {
  const identity: {
    eventId: string | null;
    eventType: string | null;
    schemaVersion: number | null;
    aggregateType: string | null;
    aggregateId: string | null;
    aggregateVersion: string | null;
    migrationPlanId?: string | null;
  } = {
    eventId: null as string | null,
    eventType: null as string | null,
    schemaVersion: null as number | null,
    aggregateType: null as string | null,
    aggregateId: null as string | null,
    aggregateVersion: null as string | null,
  };
  if (!isRecord(input)) return identity;

  identity.eventId = isUuid(input.eventId) ? input.eventId : null;
  identity.eventType = isSafeToken(input.eventType, 160)
    ? input.eventType
    : null;
  identity.schemaVersion =
    typeof input.schemaVersion === 'number' &&
    Number.isSafeInteger(input.schemaVersion)
      ? input.schemaVersion
      : null;
  identity.aggregateType = isSafeToken(input.aggregateType, 128)
    ? input.aggregateType
    : null;
  identity.aggregateId = isUuid(input.aggregateId) ? input.aggregateId : null;
  identity.aggregateVersion = isVersion(input.aggregateVersion)
    ? input.aggregateVersion
    : null;

  if (isRecord(input.payload) && 'migrationPlanId' in input.payload) {
    if (input.payload.migrationPlanId === null) {
      identity.migrationPlanId = null;
    } else if (isUuid(input.payload.migrationPlanId)) {
      identity.migrationPlanId = input.payload.migrationPlanId;
    }
  }
  return identity;
};

export const isEventEnvelopeCandidate = (input: unknown): boolean =>
  isRecord(input) &&
  ('eventId' in input ||
    'eventType' in input ||
    'schemaVersion' in input ||
    'payload' in input);

export const toNormalizedInput = (input: unknown): NormalizedInput | null => {
  const direct = SchemaMigrationJobPayloadSchema.safeParse(input);
  if (direct.success) return { job: direct.data, event: null };
  const envelope = SchemaMigrationQueueEnvelopeSchema.safeParse(input);
  if (!envelope.success) return null;
  const { migrationPlanId } = envelope.data.payload;
  if (migrationPlanId === null) return { job: null, event: envelope.data };
  return {
    job: {
      schemaVersionId: envelope.data.payload.schemaVersionId,
      migrationPlanId,
      expectedVersion: envelope.data.aggregateVersion,
      correlationId: envelope.data.correlationId,
      causationId: envelope.data.causationId,
    },
    event: envelope.data,
  };
};

export const planWithBatch = (
  plan: MigrationPlanRecord,
  batch: SchemaMigrationBatchResult,
): MigrationPlanRecord => ({
  ...plan,
  cursor: batch.cursor,
  progress: batch.progress,
  sourceCount: batch.sourceCount,
  targetCount: batch.targetCount,
  rowErrorCount: batch.rowErrorCount,
  migratedCount: batch.migratedCount,
  failedCount: batch.failedCount,
});

export const decimalAtLeast = (
  candidate: string,
  baseline: string,
): boolean => {
  try {
    return BigInt(candidate) >= BigInt(baseline);
  } catch {
    return false;
  }
};
