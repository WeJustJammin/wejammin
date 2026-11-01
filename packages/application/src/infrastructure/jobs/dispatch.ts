import {
  JobStateSchema,
  PositiveBigintDecimalSchema,
  QueueEnvelopeSchema,
} from '@wejammin/contracts';

import type {
  DispatchDecision,
  DispatchInput,
  JobLeaseDecision,
  JobLeaseInput,
} from './types.ts';

const UuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const terminalStates = new Set(['succeeded', 'failed', 'cancelled']);
const JobTypePattern = /^[a-z][a-z0-9_.-]{0,63}$/;

const validLeaseFacts = (input: JobLeaseInput): boolean => {
  const state = JobStateSchema.safeParse(input.state);
  const version = PositiveBigintDecimalSchema.safeParse(input.currentVersion);
  const jobId = UuidPattern.test(input.jobId);
  const nowValid = Number.isFinite(input.nowMs) && input.nowMs >= 0;
  const leaseValid =
    input.leaseUntilMs === null ||
    (Number.isFinite(input.leaseUntilMs) && input.leaseUntilMs >= 0);
  return state.success && version.success && jobId && nowValid && leaseValid;
};

export const decideJobLease = (input: JobLeaseInput): JobLeaseDecision => {
  if (!validLeaseFacts(input))
    return { kind: 'reject', reason: 'INVALID_LEASE' };
  if (terminalStates.has(input.state)) {
    return { kind: 'skip', reason: 'terminal' };
  }
  if (input.state === 'queued') {
    return {
      expectedVersion: input.currentVersion,
      jobId: input.jobId,
      kind: 'acquire',
      nextState: 'running',
      reason: 'queued',
    };
  }
  if (input.leaseUntilMs === null) {
    return { kind: 'reject', reason: 'INVALID_LEASE' };
  }
  if (input.leaseUntilMs > input.nowMs) {
    return { kind: 'skip', reason: 'active_lease' };
  }
  return {
    expectedVersion: input.currentVersion,
    jobId: input.jobId,
    kind: 'acquire',
    nextState: 'running',
    reason: 'expired',
  };
};

const hasUnknownSchemaVersion = (value: unknown): boolean => {
  if (typeof value !== 'object' || value === null) return false;
  const schemaVersion = (value as { schemaVersion?: unknown }).schemaVersion;
  return schemaVersion !== undefined && schemaVersion !== 1;
};

type JobFacts = Readonly<{ id: string; type: string }>;

const readJobFacts = (value: unknown): JobFacts | null | undefined => {
  if (value === undefined) return null;
  if (typeof value !== 'object' || value === null) return undefined;
  const candidate = value as { id?: unknown; type?: unknown };
  if (
    typeof candidate.id !== 'string' ||
    !UuidPattern.test(candidate.id) ||
    typeof candidate.type !== 'string' ||
    !JobTypePattern.test(candidate.type)
  ) {
    return undefined;
  }
  return { id: candidate.id, type: candidate.type };
};

const readEventFacts = (
  input: DispatchInput,
): {
  id: string | null;
  type: string | null;
  valid: boolean;
} => {
  if (input.eventPayload !== undefined) {
    if (typeof input.eventPayload !== 'object' || input.eventPayload === null) {
      return { id: null, type: null, valid: false };
    }
    const payload = input.eventPayload as {
      jobId?: unknown;
      jobType?: unknown;
    };
    if (
      (payload.jobId !== undefined &&
        (typeof payload.jobId !== 'string' ||
          !UuidPattern.test(payload.jobId))) ||
      (payload.jobType !== undefined &&
        (typeof payload.jobType !== 'string' ||
          !JobTypePattern.test(payload.jobType)))
    ) {
      return { id: null, type: null, valid: false };
    }
    return {
      id:
        input.eventJobId ??
        (typeof payload.jobId === 'string' ? payload.jobId : null),
      type:
        input.eventJobType ??
        (typeof payload.jobType === 'string' ? payload.jobType : null),
      valid: true,
    };
  }
  if (
    input.eventJobId !== undefined &&
    (!UuidPattern.test(input.eventJobId) ||
      typeof input.eventJobId !== 'string')
  ) {
    return { id: null, type: null, valid: false };
  }
  if (
    input.eventJobType !== undefined &&
    (typeof input.eventJobType !== 'string' ||
      !JobTypePattern.test(input.eventJobType))
  ) {
    return { id: null, type: null, valid: false };
  }
  return {
    id: input.eventJobId ?? null,
    type: input.eventJobType ?? null,
    valid: true,
  };
};

const verifyJobBinding = (
  input: DispatchInput,
  aggregateId: string,
): DispatchDecision | null => {
  const canonicalFacts = readJobFacts(input.canonicalJob);
  if (canonicalFacts === undefined) {
    return {
      acknowledge: true,
      kind: 'dead_letter',
      reason: 'INVALID_JOB_FACTS',
    };
  }
  const expectedId =
    input.expectedJobId ?? input.canonicalJobId ?? canonicalFacts?.id;
  const expectedType =
    input.expectedJobType ?? input.canonicalJobType ?? canonicalFacts?.type;
  if (
    (expectedId !== undefined && !UuidPattern.test(expectedId)) ||
    (expectedType !== undefined &&
      (typeof expectedType !== 'string' || !JobTypePattern.test(expectedType)))
  ) {
    return {
      acknowledge: true,
      kind: 'dead_letter',
      reason: 'INVALID_JOB_FACTS',
    };
  }
  const eventFacts = readEventFacts(input);
  if (!eventFacts.valid) {
    return {
      acknowledge: true,
      kind: 'dead_letter',
      reason: 'INVALID_JOB_FACTS',
    };
  }
  if (expectedId !== undefined && aggregateId !== expectedId) {
    return {
      acknowledge: true,
      kind: 'dead_letter',
      reason: 'JOB_AGGREGATE_MISMATCH',
    };
  }
  if (eventFacts.id !== null && eventFacts.id !== aggregateId) {
    return {
      acknowledge: true,
      kind: 'dead_letter',
      reason: 'JOB_AGGREGATE_MISMATCH',
    };
  }
  if (
    expectedType !== undefined &&
    eventFacts.type !== null &&
    eventFacts.type !== expectedType
  ) {
    return {
      acknowledge: true,
      kind: 'dead_letter',
      reason: 'JOB_TYPE_MISMATCH',
    };
  }
  return null;
};

export const decideJobDispatch = (input: DispatchInput): DispatchDecision => {
  const parsedEnvelope = QueueEnvelopeSchema.safeParse(input.envelope);
  if (!parsedEnvelope.success) {
    return {
      acknowledge: true,
      kind: 'dead_letter',
      reason: hasUnknownSchemaVersion(input.envelope)
        ? 'UNKNOWN_SCHEMA_VERSION'
        : 'INVALID_ENVELOPE',
    };
  }
  const canonicalVersion = PositiveBigintDecimalSchema.safeParse(
    input.canonicalVersion,
  );
  const canonicalState = JobStateSchema.safeParse(input.canonicalState);
  if (!canonicalVersion.success || !canonicalState.success) {
    return {
      acknowledge: true,
      kind: 'dead_letter',
      reason: 'INVALID_ENVELOPE',
    };
  }
  const envelope = parsedEnvelope.data;
  if (
    envelope.eventType !== 'job.requested' ||
    envelope.schemaVersion !== 1 ||
    envelope.aggregateType !== 'job'
  ) {
    return {
      acknowledge: true,
      kind: 'dead_letter',
      reason: 'UNSUPPORTED_EVENT',
    };
  }
  const binding = verifyJobBinding(input, envelope.aggregateId);
  if (binding !== null) return binding;
  if (input.processedEventIds.includes(envelope.eventId)) {
    return { acknowledge: true, kind: 'skip', reason: 'duplicate' };
  }
  if (terminalStates.has(canonicalState.data)) {
    return { acknowledge: true, kind: 'skip', reason: 'terminal' };
  }
  const canonicalFacts = readJobFacts(input.canonicalJob);
  const verifiedCmsOrigin =
    input.verifiedImmutableJobOrigin === true &&
    canonicalFacts?.id === envelope.aggregateId &&
    canonicalFacts?.type === 'cms.schema.dry_run' &&
    input.eventJobType === 'cms.schema.dry_run';
  if (!verifiedCmsOrigin) {
    const eventVersion = BigInt(envelope.aggregateVersion);
    const currentVersion = BigInt(canonicalVersion.data);
    if (eventVersion < currentVersion) {
      return { acknowledge: true, kind: 'skip', reason: 'stale' };
    }
    if (eventVersion > currentVersion) {
      return { acknowledge: false, kind: 'retry', reason: 'future_version' };
    }
  }
  if (!input.restoreFenceOpen) {
    return { acknowledge: false, kind: 'retry', reason: 'restore_fenced' };
  }
  return {
    acknowledge: false,
    effectKey: `${envelope.eventType}:${envelope.eventId}:${envelope.aggregateId}`,
    envelope,
    kind: 'execute',
  };
};
