import {
  ConsumerQueueEnvelopeSchema,
  CONSUMER_EVENT_TYPE,
  PositiveBigintDecimalSchema,
  QueueEnvelopeSchema,
  type ConsumerQueueEnvelope,
  type QueueEnvelope,
} from '@wejammin/contracts';
import {
  type CanonicalJob,
  type JobLeaseClaimRequest,
  type JobLeaseClaimResult,
  type JobPersistencePort,
} from '@wejammin/application';
import type { AsyncWorkerBindings } from './async-entrypoint';
import { parseRestoreFence } from './async-runtime-fence';
import type { AsyncRpcClient } from './async-runtime-rpc-types';

export type ClaimedOutbox = Readonly<{
  outboxId: string;
  leaseToken: string;
  envelope: QueueEnvelope | ConsumerQueueEnvelope;
}>;

/** The outbox event types the relay places on the queue, with their aggregate. */
const RELAYED_AGGREGATE: Readonly<Record<string, string>> = {
  'job.requested': 'job',
  [CONSUMER_EVENT_TYPE.mfaFactorChanged]: 'mfa_factor',
  [CONSUMER_EVENT_TYPE.securityNotificationRequested]: 'security_event',
  [CONSUMER_EVENT_TYPE.capabilityGrantChanged]: 'cms_capability_grant',
};

const UuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const JobTypePattern = /^[a-z][a-z0-9_.-]{0,63}$/;
const VersionPattern = /^[1-9]\d{0,18}$/;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
const firstRow = (value: unknown): unknown =>
  Array.isArray(value) ? (value.length === 1 ? value[0] : null) : value;
const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && UuidPattern.test(value);

export const toVersion = (value: unknown): string | null => {
  if (typeof value === 'string') {
    if (!VersionPattern.test(value)) return null;
    return PositiveBigintDecimalSchema.safeParse(value).success ? value : null;
  }
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) {
    return String(value);
  }
  return null;
};

export const toTimeMs = (value: unknown): number | null => {
  if (value === null) return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }
  return null;
};

export const parseCanonicalJob = (value: unknown): CanonicalJob | null => {
  const row = firstRow(value);
  if (!isRecord(row)) return null;
  const id = row.id ?? row.job_id;
  const type = row.type ?? row.job_type;
  const version = toVersion(row.version);
  const leaseValue = row.leaseUntilMs ?? row.lease_until ?? null;
  if (
    !isUuid(id) ||
    typeof type !== 'string' ||
    !JobTypePattern.test(type) ||
    version === null ||
    !(
      row.state === 'queued' ||
      row.state === 'running' ||
      row.state === 'succeeded' ||
      row.state === 'failed' ||
      row.state === 'cancelled'
    )
  ) {
    return null;
  }
  const leaseUntilMs = toTimeMs(leaseValue);
  if (leaseValue !== null && leaseUntilMs === null) return null;
  return { id, type, state: row.state, version, leaseUntilMs };
};

export const parseLease = (
  value: unknown,
  request: JobLeaseClaimRequest,
): JobLeaseClaimResult => {
  const row = firstRow(value);
  if (!isRecord(row)) throw new Error('Invalid job lease');
  const hasOwn = (key: string): boolean =>
    Object.prototype.hasOwnProperty.call(row, key);
  if (
    ['jobId', 'job_id'].some(
      (key) => hasOwn(key) && row[key] !== request.jobId,
    ) ||
    ['leaseToken', 'lease_token'].some(
      (key) => hasOwn(key) && row[key] !== request.leaseToken,
    ) ||
    ['expectedVersion', 'expected_version'].some(
      (key) => hasOwn(key) && toVersion(row[key]) !== request.expectedVersion,
    )
  ) {
    throw new Error('Invalid job lease');
  }
  const jobId = row.jobId ?? row.job_id;
  const leaseToken = row.leaseToken ?? row.lease_token ?? request.leaseToken;
  const expectedVersion =
    row.expectedVersion ?? row.expected_version ?? request.expectedVersion;
  const version = toVersion(row.version);
  const leaseUntilMs = toTimeMs(row.leaseUntilMs ?? row.lease_until);
  const expected = toVersion(expectedVersion);
  if (
    !isUuid(jobId) ||
    !isUuid(leaseToken) ||
    expected === null ||
    version === null ||
    leaseUntilMs === null
  ) {
    throw new Error('Invalid job lease');
  }
  return {
    jobId,
    leaseToken,
    expectedVersion: expected,
    version,
    leaseUntilMs,
  };
};

export const parseOutboxClaim = (value: unknown): ClaimedOutbox | null => {
  if (!isRecord(value)) return null;
  const outboxId = value.outboxId ?? value.event_id;
  const eventId = value.eventId ?? value.event_id;
  const leaseToken = value.leaseToken ?? value.lease_token;
  const eventType = value.eventType ?? value.event_type;
  const schemaVersion = value.schemaVersion ?? value.schema_version;
  const aggregateType = value.aggregateType ?? value.aggregate_type;
  const aggregateId = value.aggregateId ?? value.aggregate_id;
  const aggregateVersion = value.aggregateVersion ?? value.aggregate_version;
  const correlationId = value.correlationId ?? value.correlation_id;
  const causationId = value.causationId ?? value.causation_id ?? null;
  const occurredAt = value.occurredAt ?? value.occurred_at;
  const producer = value.producer;
  const version = toVersion(aggregateVersion);
  if (
    !isUuid(outboxId) ||
    !isUuid(eventId) ||
    !isUuid(leaseToken) ||
    typeof eventType !== 'string' ||
    RELAYED_AGGREGATE[eventType] !== aggregateType ||
    schemaVersion !== 1 ||
    !isUuid(aggregateId) ||
    version === null ||
    !isUuid(correlationId) ||
    (causationId !== null && !isUuid(causationId))
  ) {
    return null;
  }
  const fields = {
    aggregateId,
    aggregateType,
    aggregateVersion: version,
    causationId,
    correlationId,
    eventId,
    eventType,
    schemaVersion,
  };
  if (eventType === 'job.requested') {
    return {
      envelope: QueueEnvelopeSchema.parse(fields),
      leaseToken,
      outboxId,
    };
  }
  // BE00 envelope members that the outbox row does not store: the instant is the
  // row's own occurred_at and the producer is the registered owner of the
  // event-type prefix, both resolved by the claim. The consumer schema pins the
  // producer per event type, so a claim naming another producer is refused.
  const consumerEnvelope = ConsumerQueueEnvelopeSchema.safeParse({
    ...fields,
    occurredAt,
    producer,
  });
  if (!consumerEnvelope.success) return null;
  return { envelope: consumerEnvelope.data, leaseToken, outboxId };
};

export const parseBoolean = (value: unknown, message: string): boolean => {
  if (typeof value !== 'boolean') throw new Error(message);
  return value;
};

const normalizeRpcVersion = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const unquoted =
    value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value;
  return toVersion(unquoted);
};

const createPersistence = (
  env: AsyncWorkerBindings,
  rpc: AsyncRpcClient,
): Pick<
  JobPersistencePort,
  | 'readCanonicalJob'
  | 'readRestoreFence'
  | 'claimJobLease'
  | 'heartbeatJobLease'
  | 'applyJobOutcome'
  | 'recordProcessedEvent'
> => ({
  readCanonicalJob: async (jobId) =>
    parseCanonicalJob(
      await rpc(env, 'read_canonical_job', { p_job_id: jobId }),
    ),
  readRestoreFence: async () =>
    parseRestoreFence(await rpc(env, 'read_restore_fence', {})),
  claimJobLease: async (input) => {
    const value = await rpc<unknown>(env, 'claim_job', {
      p_job_id: input.jobId,
      p_expected_version: input.expectedVersion,
      p_lease_token: input.leaseToken,
      p_lease_seconds: input.leaseSeconds,
    });
    if (value === null || (Array.isArray(value) && value.length === 0)) {
      return null;
    }
    return parseLease(value, input);
  },
  heartbeatJobLease: async (input) =>
    parseBoolean(
      await rpc(env, 'heartbeat_job_lease', {
        p_job_id: input.jobId,
        p_expected_version: input.expectedVersion,
        p_lease_token: input.leaseToken,
        p_lease_seconds: input.leaseSeconds,
      }),
      'Invalid heartbeat result',
    ),
  applyJobOutcome: async (input) => {
    if (input.nextState === 'pending_manual_review') return false;
    const expectedVersion = normalizeRpcVersion(input.expectedVersion);
    if (expectedVersion === null) return false;
    return parseBoolean(
      await rpc(env, 'apply_job_outcome', {
        p_job_id: input.jobId,
        p_expected_version: expectedVersion,
        p_lease_token: input.leaseToken,
        p_next_state: input.nextState,
        p_result_ref: input.resultRef,
        p_error_code: input.errorCode,
        p_retryable: input.retryable,
      }),
      'Invalid outcome result',
    );
  },
  recordProcessedEvent: async (input) => {
    const value = await rpc<unknown>(env, 'record_processed_event', {
      p_event_id: input.eventId,
      p_event_type: input.eventType,
      p_schema_version: input.schemaVersion,
      p_aggregate_id: input.aggregateId,
      p_pending_manual_review: input.pendingManualReview,
    });
    const result = firstRow(value);
    if (result !== 'recorded' && result !== 'duplicate') {
      throw new Error('Invalid processed-event result');
    }
    return result;
  },
});

export const createJobPersistence = createPersistence;
