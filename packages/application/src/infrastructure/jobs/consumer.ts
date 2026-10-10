import { QueueEnvelopeSchema } from '@wejammin/contracts';

import {
  acquireJobLease,
  applyJobOutcomeCas,
  recordProcessedEventIdempotently,
} from './execution.ts';
import { decideJobDispatch } from './dispatch.ts';
import { canRunExternalEffect } from './restore.ts';
import type { JobConsumerDecision, JobConsumerInput } from './runtime-types.ts';

const manualReview = (): JobConsumerDecision => ({
  canonicalWrite: false,
  kind: 'manual_review',
  replayable: false,
});

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
      : { acknowledge: false, kind: 'retry', reason: 'lease_conflict' };
  }

  let effectResult;
  try {
    effectResult = await input.effect.execute({
      envelope: decision.envelope,
      job: canonical,
      leaseToken: lease.lease.leaseToken,
      claimedLease: lease.lease,
    });
  } catch {
    return manualReview();
  }
  if (effectResult.state === 'pending_manual_review') return manualReview();

  const version = `"${lease.lease.version}"`;
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
