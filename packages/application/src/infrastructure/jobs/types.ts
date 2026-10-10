import type {
  JobState,
  JobStatus,
  OfflineIntent,
  PlatformEvent,
  QueueEnvelope,
} from '@wejammin/contracts';

export type JobReadTarget = Readonly<{
  job: unknown;
  actorId: string;
  actingPartyId: string;
}>;

export type JobReadPrincipal =
  | Readonly<{ kind: 'anonymous' }>
  | Readonly<{
      kind: 'authenticated';
      userId: string;
      actingPartyId: string | null;
      capabilities: readonly string[];
    }>
  | Readonly<{
      kind: 'operator';
      userId: string;
      actingPartyId: string | null;
      capabilities: readonly string[];
      stepUpVerified: boolean;
      auditReasonPresent: boolean;
    }>
  | Readonly<{
      kind: 'queue';
      consumerId: string;
    }>
  | Readonly<{ kind: 'schedule'; scheduleId: string }>
  | Readonly<{ kind: 'provider_webhook'; providerId: string }>
  | Readonly<{ kind: 'deployment'; deploymentId: string }>
  | Readonly<{ kind: 'service_maintenance'; serviceId: string }>;

export type JobReadInput = Readonly<{
  target: JobReadTarget | null;
  principal: JobReadPrincipal;
}>;

export type JobReadDecision =
  | Readonly<{
      kind: 'allow';
      authority: 'owner' | 'acting_party' | 'operator';
      cachePolicy: 'no-store';
      disclosure: 'full';
      auditRequired?: true;
    }>
  | Readonly<{
      kind: 'unauthenticated' | 'not_found';
      cachePolicy: 'no-store';
      disclosureSafe: true;
    }>
  | Readonly<{
      kind: 'forbidden';
      reason: 'STEP_UP_REQUIRED' | 'AUDIT_REASON_REQUIRED';
      cachePolicy: 'no-store';
      disclosureSafe: true;
    }>;

export type JobTransitionInput = Readonly<{
  currentState: JobState;
  nextState: JobState;
  expectedVersion: string;
  currentVersion: string;
  retryable?: boolean;
}>;

export type JobTransitionDecision =
  | Readonly<{
      kind: 'apply';
      nextState: JobState;
      nextVersion: string;
    }>
  | Readonly<{ kind: 'noop'; reason: 'ALREADY_TERMINAL' }>
  | Readonly<{
      kind: 'reject';
      reason:
        | 'INVALID_VERSION'
        | 'VERSION_MISMATCH'
        | 'INVALID_TRANSITION'
        | 'RETRY_NOT_ALLOWED'
        | 'TERMINAL_CLOSED';
      partialEffects: false;
    }>;

export type ExistingIdempotency = Readonly<{
  operation: string;
  requestHash: string;
  state: 'reserved' | 'completed' | 'failed_retryable';
}>;

export type JobAcceptanceInput = Readonly<{
  job: unknown;
  event: unknown;
  operation: string;
  requestHash: string;
  existingIdempotency: ExistingIdempotency | null;
}>;

export type JobAcceptanceDecision =
  | Readonly<{
      kind: 'commit';
      atomicWrites: readonly ['job', 'outbox', 'idempotency'];
      job: JobStatus;
      event: PlatformEvent;
    }>
  | Readonly<{
      kind: 'replay';
      replayed: true;
      job: JobStatus;
      event: PlatformEvent;
    }>
  | Readonly<{
      kind: 'conflict';
      reason: 'IDEMPOTENCY_MISMATCH';
      partialEffects: false;
    }>
  | Readonly<{
      kind: 'reject';
      reason:
        | 'INVALID_JOB'
        | 'INVALID_EVENT'
        | 'JOB_NOT_QUEUED'
        | 'EVENT_JOB_MISMATCH'
        | 'EVENT_NOT_JOB_REQUEST'
        | 'REQUEST_INVALID';
      partialEffects: false;
    }>;

export type JobLeaseInput = Readonly<{
  jobId: string;
  state: JobState;
  currentVersion: string;
  leaseUntilMs: number | null;
  nowMs: number;
}>;

export type JobLeaseDecision =
  | Readonly<{
      kind: 'acquire';
      reason: 'queued' | 'expired';
      jobId: string;
      expectedVersion: string;
      nextState: 'running';
    }>
  | Readonly<{
      kind: 'skip';
      reason: 'active_lease' | 'terminal' | 'not_queued';
    }>
  | Readonly<{ kind: 'reject'; reason: 'INVALID_LEASE' }>;

export type DispatchInput = Readonly<{
  envelope: unknown;
  canonicalVersion: string;
  canonicalState: JobState;
  processedEventIds: readonly string[];
  restoreFenceOpen: boolean;
  /** Optional canonical identity facts used by the queue consumer binding. */
  canonicalJobId?: string;
  canonicalJobType?: string;
  expectedJobId?: string;
  expectedJobType?: string;
  eventJobId?: string;
  eventJobType?: string;
  /** Private verified CMS origin identity, not current execution authority. */
  verifiedImmutableJobOrigin?: boolean;
  canonicalJob?: unknown;
  eventPayload?: unknown;
}>;

export type DispatchDecision =
  | Readonly<{
      kind: 'execute';
      effectKey: string;
      acknowledge: false;
      envelope: QueueEnvelope;
    }>
  | Readonly<{
      kind: 'skip';
      reason: 'duplicate' | 'stale' | 'terminal';
      acknowledge: true;
    }>
  | Readonly<{
      kind: 'retry';
      reason: 'future_version' | 'restore_fenced';
      acknowledge: false;
    }>
  | Readonly<{
      kind: 'dead_letter';
      reason:
        | 'INVALID_ENVELOPE'
        | 'UNKNOWN_SCHEMA_VERSION'
        | 'UNSUPPORTED_EVENT'
        | 'JOB_AGGREGATE_MISMATCH'
        | 'JOB_TYPE_MISMATCH'
        | 'INVALID_JOB_FACTS';
      acknowledge: true;
    }>;

export type OfflineReconciliationInput = Readonly<{
  intent: unknown;
  identity: 'authenticated' | 'expired' | 'revoked' | 'anonymous';
  authorized: boolean;
  targetExists: boolean;
  payloadHashMatches: boolean;
  currentVersion: string | null;
  operationId: string | null;
}>;

export type OfflineReconciliationDecision =
  | Readonly<{
      kind: 'accept';
      operationId: string;
      intent: OfflineIntent;
      canonicalWrite: true;
    }>
  | Readonly<{
      kind: 'reauthenticate';
      preserveIntent: true;
      retryable: true;
    }>
  | Readonly<{
      kind: 'refuse';
      reason:
        | 'INVALID_INTENT'
        | 'UNAUTHENTICATED'
        | 'TARGET_NOT_FOUND'
        | 'FORBIDDEN'
        | 'VERSION_MISMATCH'
        | 'CONTENT_MISMATCH';
      preserveIntent: true;
      retryable: true;
      canonicalWrite: false;
    }>
  | Readonly<{
      kind: 'noop';
      reason: 'ALREADY_ACCEPTED' | 'ALREADY_REFUSED';
      preserveIntent: true;
    }>
  | Readonly<{
      kind: 'noop';
      reason: 'PENDING_MANUAL_REVIEW';
      preserveIntent: true;
      canonicalWrite: false;
      replayable: false;
    }>;

export type RealtimeRefetchDecision =
  | Readonly<{
      kind: 'refetch';
      entityId: string;
      entityType: 'job' | 'infrastructure_record';
      reason: 'realtime-hint';
      preserveFocus: true;
    }>
  | Readonly<{
      kind: 'ignore';
      reason: 'INVALID_HINT' | 'UNAUTHORIZED';
      disclosureSafe: true;
    }>;

export type RestoreFenceInput = Readonly<{
  expectedEpoch: string;
  consumerEpoch: string | null;
  integrityVerified: boolean;
  reconciliationComplete: boolean;
}>;

export type RestoreFenceDecision =
  | Readonly<{ kind: 'open'; epoch: string; externalEffects: true }>
  | Readonly<{
      kind: 'fenced';
      reason:
        | 'MISSING_EPOCH'
        | 'EPOCH_MISMATCH'
        | 'INTEGRITY_UNVERIFIED'
        | 'RECONCILIATION_INCOMPLETE';
      externalEffects: false;
    }>;
