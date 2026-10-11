import {
  CMS_SCHEDULE_CLAIM_BATCH_DEFAULT,
  CMS_SCHEDULE_DEADLINE_MS,
  createCorrelationId,
  createRequestId,
  type ClaimedSchedule,
} from '@wejammin/contracts';
import { createLogger, type Logger } from '@wejammin/observability/logging';

import type { AsyncWorkerBindings } from './async-entrypoint';
import { createSupabaseRpc } from './async-runtime';
import { AsyncRpcTransportError } from './async-runtime-support';
import {
  claimDueSchedules,
  CmsScheduleResponseError,
  executeClaimedSchedule,
} from './cms-publication-schedule-rpc';
import {
  EVIDENCE_STALE_REFUSAL,
  executeWithFreshEvidence,
  isStaleEvidenceRefusal,
  proofFor,
} from './cms-publication-schedule-sweep-evidence';
import { metricKey } from './content-schema-registry/route-metric-key';

/**
 * CMS-03B-20, the scheduled publication sweep (BE03b "Schedule execution",
 * DEC-156). Every minute it claims at most 25 due schedules, and for each one
 * runs the Worker-resident accessibility checker (D25) to produce
 * `PreflightEvidence` bound by the JCS hash of the claimed revision and frozen
 * dependency set, then executes the schedule with the expected version and
 * lease. The retry ladder (15/60/300 s, then `retries_exhausted`), the lease
 * recheck and the lineage append are the database's; this module only drives
 * them and never writes publication state. The one execution it repeats is
 * the one the database REFUSED as `preflight_evidence_stale`: that refusal
 * rolls back and consumes nothing, so the proof is recomputed and the same
 * claim executed again under the same lease (bounded, never past the job
 * deadline). Any other failed execution has an unknown outcome and is never
 * retried here.
 *
 * ONE tick is the job: the claim and every execute share a single 15,000 ms
 * window (BE03b, Internal service operations) that opens when the tick starts.
 * No schedule is started once it has passed; the lease and the database ladder
 * own the claims that were left.
 *
 * It logs identifiers as hashes and counts only: no token, content, comment
 * or authority graph ever reaches telemetry.
 */

const OPERATION = 'cms_publication_schedule_sweep';

const sha256Hex = async (text: string): Promise<string> =>
  [
    ...new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)),
    ),
  ]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

const retrySweep = (
  logger: Logger,
  correlationId: string,
  errorCode: 'DEPENDENCY_INVALID_RESPONSE' | 'DEPENDENCY_UNAVAILABLE',
): Error => {
  logger.error({
    correlationId,
    errorCode,
    eventName: `${OPERATION}.failed`,
    operation: OPERATION,
    outcome: 'retry',
    retryable: true,
  });
  return new Error('CMS publication schedule sweep requested retry');
};

const recordManualReview = (
  logger: Logger,
  correlationId: string,
  reason: AsyncRpcTransportError['reason'],
): void => {
  logger.error({
    attributes: { reason },
    correlationId,
    errorCode: 'MANUAL_REVIEW',
    eventName: `${OPERATION}.manual_review_required`,
    operation: OPERATION,
    outcome: 'failure',
    retryable: false,
  });
};

const scheduleFacts = async (claim: ClaimedSchedule) => ({
  correlationId: claim.correlationId,
  entityType: 'cms_publication_schedule',
  entityIdHash: `sha256:${await sha256Hex(claim.scheduleId)}`,
});

/**
 * Execute one claim; a failure here never stops the rest of the batch. The proof
 * is computed fresh for each execution (see `executeWithFreshEvidence`), all of
 * them under the tick's one job deadline signal.
 */
const executeOne = async (
  rpc: ReturnType<typeof createSupabaseRpc>,
  env: AsyncWorkerBindings,
  claim: ClaimedSchedule,
  logger: Logger,
  signal: AbortSignal,
): Promise<void> => {
  const startedAt = Date.now();
  const facts = await scheduleFacts(claim);
  try {
    const result = await executeWithFreshEvidence({
      signal,
      prove: () => proofFor(env, claim, logger, signal),
      execute: (evidence) =>
        executeClaimedSchedule(rpc, env, claim, evidence, signal),
      onStale: (reexecution) =>
        logger.warn({
          ...facts,
          attempt: reexecution,
          errorCode: EVIDENCE_STALE_REFUSAL,
          eventName: `${OPERATION}.evidence_stale`,
          operation: OPERATION,
          outcome: 'retry',
          retryable: true,
        }),
    });
    logger.info({
      ...facts,
      attributes: {
        outcome: result.outcome,
        ...(result.reasonCode === null ? {} : { reason: result.reasonCode }),
      },
      durationMs: Date.now() - startedAt,
      eventName: `${OPERATION}.executed`,
      metrics: {
        [metricKey('cms_schedule_attempt_total', { outcome: result.outcome })]:
          1,
        ...(result.reasonCode === null
          ? {}
          : {
              [metricKey('cms_schedule_blocked_total', {
                reason: result.reasonCode,
              })]: 1,
            }),
        ...(result.deviationSeconds === null
          ? {}
          : {
              cms_schedule_deviation_seconds: Math.abs(result.deviationSeconds),
            }),
      },
      operation: OPERATION,
      outcome: 'success',
    });
  } catch (error) {
    // The outcome of an execution that failed is unknown, so it is never
    // retried here: the lease expires and the database ladder decides. The one
    // known outcome, a stale proof refused again after the bounded
    // recomputations, rolled back and is left to the lease the same way.
    const manual =
      error instanceof AsyncRpcTransportError &&
      error.disposition === 'manual_review';
    const invalid = error instanceof CmsScheduleResponseError;
    logger.error({
      ...facts,
      durationMs: Date.now() - startedAt,
      errorCode: manual
        ? 'MANUAL_REVIEW'
        : invalid
          ? 'DEPENDENCY_INVALID_RESPONSE'
          : isStaleEvidenceRefusal(error)
            ? EVIDENCE_STALE_REFUSAL
            : 'DEPENDENCY_UNAVAILABLE',
      eventName: `${OPERATION}.execute_failed`,
      metrics: {
        [metricKey('cms_schedule_attempt_total', { outcome: 'error' })]: 1,
      },
      operation: OPERATION,
      outcome: manual || invalid ? 'failure' : 'retry',
      retryable: !manual && !invalid,
    });
  }
};

/**
 * The claim of one tick. A failure asks the platform to retry the tick, except
 * a manual-review fault, which is recorded and rethrown as it is.
 */
const claimOrRetry = async (
  rpc: ReturnType<typeof createSupabaseRpc>,
  env: AsyncWorkerBindings,
  logger: Logger,
  correlationId: string,
  signal: AbortSignal,
): Promise<readonly ClaimedSchedule[]> => {
  try {
    return await claimDueSchedules(
      rpc,
      env,
      CMS_SCHEDULE_CLAIM_BATCH_DEFAULT,
      signal,
    );
  } catch (error) {
    if (
      error instanceof AsyncRpcTransportError &&
      error.disposition === 'manual_review' &&
      error.retryable === false
    ) {
      recordManualReview(logger, correlationId, error.reason);
      throw error;
    }
    throw retrySweep(
      logger,
      correlationId,
      error instanceof CmsScheduleResponseError
        ? 'DEPENDENCY_INVALID_RESPONSE'
        : 'DEPENDENCY_UNAVAILABLE',
    );
  }
};

/**
 * One scheduled tick, under one 15,000 ms job deadline (BE03b, Internal service
 * operations): the claim and every execute share it, an execute gets only the
 * time that is left, and no further schedule is started once it has passed (the
 * lease and the database retry ladder own those claims). A claim failure asks
 * the platform to retry the tick (like the other CMS sweeps); a failure to
 * execute one schedule is logged and left to the lease and the ladder. No timer
 * outlives the tick.
 */
export const runProductionCmsPublicationScheduleSweep = async (
  env: AsyncWorkerBindings,
): Promise<void> => {
  const correlationId = createCorrelationId(
    undefined,
    createRequestId(undefined),
  );
  const logger = createLogger({
    environment: env.APP_ENVIRONMENT,
    release: env.APP_RELEASE,
    service: 'wejammin-worker',
  });
  const rpc = createSupabaseRpc();
  const job = new AbortController();
  const deadline = setTimeout(() => job.abort(), CMS_SCHEDULE_DEADLINE_MS);

  try {
    const claims = await claimOrRetry(
      rpc,
      env,
      logger,
      correlationId,
      job.signal,
    );
    let started = 0;
    for (const claim of claims) {
      if (job.signal.aborted) break;
      started += 1;
      await executeOne(rpc, env, claim, logger, job.signal);
    }
    if (started < claims.length)
      logger.error({
        attributes: { unstarted: claims.length - started },
        correlationId,
        errorCode: 'JOB_DEADLINE_EXCEEDED',
        eventName: `${OPERATION}.deadline_exceeded`,
        operation: OPERATION,
        outcome: 'retry',
        retryable: true,
      });

    logger.info({
      attributes: { batch: CMS_SCHEDULE_CLAIM_BATCH_DEFAULT },
      correlationId,
      eventName: `${OPERATION}.completed`,
      metrics: { cms_schedule_claim_batch_size: claims.length },
      operation: OPERATION,
      outcome: 'success',
    });
  } finally {
    clearTimeout(deadline);
  }
};
