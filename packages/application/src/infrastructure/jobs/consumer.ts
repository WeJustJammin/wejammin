import { QueueEnvelopeSchema } from '@wejammin/contracts';

import {
  CMS_SCHEMA_DRY_RUN_JOB_TYPE,
  openCmsLeaseSession,
} from './cms-lease-control.ts';
import {
  acquireJobLease,
  applyJobOutcomeCas,
  recordProcessedEventIdempotently,
} from './execution.ts';
import { decideJobDispatch } from './dispatch.ts';
import { canRunExternalEffect } from './restore.ts';
import type {
  CmsLeaseControl,
  JobConsumerDecision,
  JobConsumerInput,
  JobEffectInput,
  JobEffectPort,
  JobEffectResult,
} from './runtime-types.ts';

const manualReview = (): JobConsumerDecision => ({
  canonicalWrite: false,
  kind: 'manual_review',
  replayable: false,
});

const leaseConflict = (): JobConsumerDecision => ({
  acknowledge: false,
  kind: 'retry',
  reason: 'lease_conflict',
});

/** Runs the effect; null means it threw. A bare call keeps the legacy arity. */
const runEffect = async (
  effect: JobEffectPort,
  request: JobEffectInput,
  control: CmsLeaseControl | undefined,
): Promise<JobEffectResult | null> => {
  try {
    return control === undefined
      ? await effect.execute(request)
      : await effect.execute(request, control);
  } catch {
    return null;
  }
};

export const executeJobDispatch = async (
  input: JobConsumerInput,
): Promise<JobConsumerDecision> => {
  const parsedEnvelope = QueueEnvelopeSchema.safeParse(input.envelope);
  if (!parsedEnvelope.success) {
    return decideJobDispatch({
      canonicalState: 'queued',
      canonicalVersion: '1',
      envelope: input.envelope,
      processedEventIds: input.processedEventIds,
      restoreFenceOpen: false,
    });
  }

  const canonical = await input.persistence.readCanonicalJob(
    parsedEnvelope.data.aggregateId,
  );
  if (canonical === null) {
    return {
      acknowledge: false,
      kind: 'retry',
      reason: 'canonical_unavailable',
    };
  }
  const restoreFenceOpen = canRunExternalEffect(
    await input.persistence.readRestoreFence(),
  );
  const decision = decideJobDispatch({
    canonicalJob: canonical,
    canonicalState: canonical.state,
    canonicalVersion: canonical.version,
    envelope: parsedEnvelope.data,
    processedEventIds: input.processedEventIds,
    restoreFenceOpen,
    ...(input.eventJobType === undefined
      ? {}
      : { eventJobType: input.eventJobType }),
    ...(input.verifiedImmutableJobOrigin === undefined
      ? {}
      : { verifiedImmutableJobOrigin: input.verifiedImmutableJobOrigin }),
    ...(input.eventPayload === undefined
      ? {}
      : { eventPayload: input.eventPayload }),
  });
  if (decision.kind !== 'execute') return decision;

  const lease = await acquireJobLease({
    persistence: input.persistence,
    request: {
      jobId: canonical.id,
      leaseToken: input.leaseToken,
      leaseSeconds: input.leaseSeconds,
      nowMs: input.nowMs,
      state: canonical.state,
      currentVersion: canonical.version,
      leaseUntilMs: canonical.leaseUntilMs,
    },
  });
  if (lease.kind !== 'claimed') {
    return lease.kind === 'reject'
      ? { acknowledge: true, kind: 'dead_letter', reason: 'INVALID_ENVELOPE' }
      : leaseConflict();
  }

  // Only a verified immutable CMS origin whose canonical job and event type are
  // both the CMS dry-run type gets lease control; every other path is unchanged.
  const session =
    input.verifiedImmutableJobOrigin === true &&
    canonical.type === CMS_SCHEMA_DRY_RUN_JOB_TYPE &&
    input.eventJobType === CMS_SCHEMA_DRY_RUN_JOB_TYPE
      ? openCmsLeaseSession({
          persistence: input.persistence,
          clock: input.leaseNow,
          leaseSeconds: input.leaseSeconds,
          leaseToken: input.leaseToken,
          canonical,
          receipt: lease.lease,
        })
      : undefined;
  if (session === null) return leaseConflict();

  const effectResult = await runEffect(
    input.effect,
    {
      envelope: decision.envelope,
      job: canonical,
      leaseToken: lease.lease.leaseToken,
      claimedLease: lease.lease,
    },
    session?.control,
  );
  let leaseVersion = lease.lease.version;
  if (session !== undefined) {
    // Drain every accepted checkpoint before any disposition, so a lost or
    // expired lease overrides success, manual review, and a thrown effect.
    const settled = await session.settle();
    if (settled.kind === 'lost') return leaseConflict();
    leaseVersion = settled.version;
  }
  if (effectResult === null || effectResult.state === 'pending_manual_review') {
    return manualReview();
  }

  const version = `"${leaseVersion}"`;
  const outcome = await applyJobOutcomeCas({
    persistence: input.persistence,
    request: {
      currentState: 'running',
      currentVersion: version,
      errorCode: effectResult.errorCode,
      expectedVersion: version,
      jobId: canonical.id,
      leaseToken: lease.lease.leaseToken,
      nextState: effectResult.state,
      resultRef: effectResult.resultRef,
      retryable: effectResult.state === 'queued',
    },
  });
  if (outcome.kind !== 'applied' && outcome.kind !== 'noop') {
    return { kind: 'completed', outcome, processed: null };
  }
  if (outcome.kind === 'applied' && outcome.nextState === 'queued') {
    return { kind: 'completed', outcome, processed: null };
  }
  const processed = await recordProcessedEventIdempotently({
    persistence: input.persistence,
    request: {
      aggregateId: decision.envelope.aggregateId,
      eventId: decision.envelope.eventId,
      eventType: decision.envelope.eventType,
      pendingManualReview: false,
      schemaVersion: decision.envelope.schemaVersion,
    },
  });
  return { kind: 'completed', outcome, processed };
};

export const runJobDispatch = executeJobDispatch;
