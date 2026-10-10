import type {
  JobState,
  JobStatus,
  PlatformEvent,
  QueueEnvelope,
} from '@wejammin/contracts';

import type {
  ExistingIdempotency,
  JobAcceptanceDecision,
  JobAcceptanceInput,
  JobTransitionDecision,
  RestoreFenceInput,
  DispatchDecision,
} from './types.ts';

export type Awaitable<T> = T | Promise<T>;

export type CanonicalJob = Readonly<{
  id: string;
  type: string;
  state: JobState;
  version: string;
  leaseUntilMs: number | null;
}>;

export type OutboxEventRecord = Readonly<{
  id: string;
  eventType: string;
  schemaVersion: number;
  aggregateType: string;
  aggregateId: string;
  aggregateVersion: string;
}>;

export type AtomicAcceptanceWrite = Readonly<{
  job: JobStatus;
  event: PlatformEvent;
  operation: string;
  requestHash: string;
}>;

export type OutboxClaimRequest = Readonly<{
  outboxId: string;
  leaseToken: string;
  leaseSeconds: number;
  nowMs: number;
}>;

export type OutboxCompleteRequest = Readonly<{
  outboxId: string;
  leaseToken: string;
}>;

export type JobLeaseClaimRequest = Readonly<{
  jobId: string;
  leaseToken: string;
  expectedVersion: string;
  leaseSeconds: number;
  nowMs: number;
}>;

export type JobLeaseClaimResult = Readonly<{
  jobId: string;
  leaseToken: string;
  expectedVersion: string;
  version: string;
  leaseUntilMs: number;
}>;

export type JobHeartbeatRequest = Readonly<{
  jobId: string;
  leaseToken: string;
  expectedVersion: string;
  leaseUntilMs: number;
  nowMs: number;
  leaseSeconds: number;
}>;

export type JobOutcomeRequest = Readonly<{
  jobId: string;
  leaseToken: string;
  currentState: JobState;
  nextState: JobState | 'pending_manual_review';
  expectedVersion: string;
  currentVersion: string;
  retryable: boolean;
  resultRef: unknown | null;
  errorCode: string | null;
}>;

export type ProcessedEventRequest = Readonly<{
  eventId: string;
  eventType: string;
  schemaVersion: number;
  aggregateId: string;
  pendingManualReview: boolean;
}>;

export type JobTransactionPort = Readonly<{
  acceptJobWithOutbox(input: AtomicAcceptanceWrite): Awaitable<void>;
}>;

export type JobPersistencePort = Readonly<{
  transaction<T>(run: (tx: JobTransactionPort) => Awaitable<T>): Promise<T>;
  readCanonicalJob(jobId: string): Promise<CanonicalJob | null>;
  claimOutboxEvent(
    input: OutboxClaimRequest,
  ): Promise<OutboxEventRecord | null>;
  completeOutboxEvent(input: OutboxCompleteRequest): Promise<boolean>;
  claimJobLease(
    input: JobLeaseClaimRequest,
  ): Promise<JobLeaseClaimResult | null>;
  heartbeatJobLease(input: JobHeartbeatRequest): Promise<boolean>;
  applyJobOutcome(
    input: JobOutcomeRequest & Readonly<{ nextVersion: string }>,
  ): Promise<boolean>;
  recordProcessedEvent(
    input: ProcessedEventRequest,
  ): Promise<'recorded' | 'duplicate'>;
  readRestoreFence(): Promise<RestoreFenceInput>;
}>;

export type JobEffectInput = Readonly<{
  job: CanonicalJob;
  envelope: QueueEnvelope;
  leaseToken: string;
  /** Actual internal claim receipt, not wire metadata or enduring authorization. */
  claimedLease?: JobLeaseClaimResult;
}>;

export type JobEffectResult = Readonly<{
  state:
    | Exclude<JobOutcomeRequest['nextState'], 'pending_manual_review'>
    | 'pending_manual_review';
  resultRef: unknown | null;
  errorCode: string | null;
}>;

export type JobEffectPort = Readonly<{
  execute(input: JobEffectInput): Promise<JobEffectResult>;
}>;

export type JobAcceptanceRuntimeInput = JobAcceptanceInput &
  Readonly<{ persistence: Pick<JobPersistencePort, 'transaction'> }>;

export type JobAcceptanceRuntimeDecision = JobAcceptanceDecision;

export type JobOutcomeRuntimeDecision =
  | Readonly<{
      kind: 'applied';
      jobId: string;
      nextState: JobState;
      nextVersion: string;
    }>
  | Readonly<{
      kind: 'conflict';
      reason: 'VERSION_MISMATCH';
      canonicalWrite: false;
    }>
  | Readonly<{
      kind: 'manual_review';
      canonicalWrite: false;
      replayable: false;
    }>
  | Readonly<{ kind: 'noop'; reason: 'ALREADY_TERMINAL' }>
  | Readonly<{
      kind: 'reject';
      reason: 'INVALID_OUTCOME';
      partialEffects: false;
    }>
  | JobTransitionDecision;

export type ProcessedEventRuntimeDecision =
  | Readonly<{ kind: 'recorded'; canonicalWrite: true; replayable: true }>
  | Readonly<{ kind: 'duplicate'; canonicalWrite: false; replayable: false }>
  | Readonly<{
      kind: 'manual_review';
      canonicalWrite: false;
      replayable: false;
    }>
  | Readonly<{ kind: 'reject'; reason: 'INVALID_PROCESSED_EVENT' }>;

export type JobConsumerInput = Readonly<{
  persistence: Pick<
    JobPersistencePort,
    | 'readCanonicalJob'
    | 'readRestoreFence'
    | 'claimJobLease'
    | 'applyJobOutcome'
    | 'recordProcessedEvent'
  >;
  effect: JobEffectPort;
  envelope: unknown;
  leaseToken: string;
  leaseSeconds: number;
  nowMs: number;
  processedEventIds: readonly string[];
  eventJobType?: string;
  /** Private verified CMS origin identity, not current execution authority. */
  verifiedImmutableJobOrigin?: boolean;
  eventPayload?: unknown;
}>;

export type JobConsumerDecision =
  | DispatchDecision
  | Readonly<{
      kind: 'retry';
      reason: 'canonical_unavailable' | 'lease_conflict';
      acknowledge: false;
    }>
  | Readonly<{
      kind: 'manual_review';
      canonicalWrite: false;
      replayable: false;
    }>
  | Readonly<{
      kind: 'completed';
      outcome: JobOutcomeRuntimeDecision;
      processed: ProcessedEventRuntimeDecision | null;
    }>;

export type ExistingIdempotencyRecord = ExistingIdempotency;
