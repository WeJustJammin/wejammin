import {
  CMS_SCHEDULE_CLAIM_BATCH_DEFAULT,
  CMS_SCHEDULE_DEADLINE_MS,
  createCorrelationId,
  createRequestId,
  type ClaimedGovernedActivation,
} from '@wejammin/contracts';
import { createLogger, type Logger } from '@wejammin/observability/logging';

import type { AsyncWorkerBindings } from './async-entrypoint';
import { createSupabaseRpc } from './async-runtime';
import { AsyncRpcTransportError } from './async-runtime-support';
import {
  claimDueGovernedActivations,
  CmsGovernedActivationResponseError,
  executeClaimedGovernedActivation,
} from './cms-governed-activation-rpc';
import {
  recordManualReview,
  retrySweep,
  sha256Hex,
} from './cms-schedule-sweep-support';
import { metricKey } from './content-schema-registry/route-metric-key';

/**
 * CMS-03C-19, the scheduled governed activation sweep (BE03c row 188, job type
 * `cms.governed_activation.execute`; the claim, lease, retry ladder and idempotency are CMS-03B-20's).
 * Every minute it claims at most 25 due schedules and executes each with the schedule id, the
 * immutable REVIEW version the claim carries and the lease. The ladder (15/60/300 s, then
 * `retries_exhausted`), the lease recheck and the atomic switch are the database's; this module only
 * drives them and never writes activation state. It computes no evidence: the database rechecks the
 * review, the dependencies and the canonical sources itself, and a schedule it cannot activate is
 * `blocked` with a closed reason. An execution that failed has an unknown outcome and is never retried
 * here: the lease expires and the ladder decides.
 *
 * ONE tick is the job: the claim and every execute share a single 15,000 ms window (BE03b, Internal
 * service operations) that opens when the tick starts. No schedule is started once it has passed.
 *
 * It logs identifiers as hashes and counts only (metric labels come from closed sets: the action
 * `activate`, the outcome, the subject kind and the block reason).
 */

const OPERATION = 'cms_governed_activation_sweep';
const RETRY_MESSAGE = 'CMS governed activation sweep requested retry';
/** A due schedule is executed by performing the `activate` switch (BE03c Scheduled activation, OD-6). */
const ACTION = 'activate';

const scheduleFacts = async (claim: ClaimedGovernedActivation) => ({
  correlationId: claim.correlationId,
  entityType: 'cms_governed_activation_schedule',
  entityIdHash: `sha256:${await sha256Hex(claim.scheduleId)}`,
});

const activationTotal = (claim: ClaimedGovernedActivation, outcome: string) =>
  metricKey('cms_governed_activation_total', {
    action: ACTION,
    outcome,
    subject_kind: claim.subjectKind,
  });

/** Execute one claim; a failure here never stops the rest of the batch. */
const executeOne = async (
  rpc: ReturnType<typeof createSupabaseRpc>,
  env: AsyncWorkerBindings,
  claim: ClaimedGovernedActivation,
  logger: Logger,
  signal: AbortSignal,
): Promise<void> => {
  const startedAt = Date.now();
  const facts = await scheduleFacts(claim);
  try {
    const result = await executeClaimedGovernedActivation(
      rpc,
      env,
      claim,
      signal,
    );
    logger.info({
      ...facts,
      attributes: {
        outcome: result.outcome,
        ...(result.reasonCode === null ? {} : { reason: result.reasonCode }),
      },
      durationMs: Date.now() - startedAt,
      eventName: `${OPERATION}.executed`,
      metrics: {
        [activationTotal(claim, result.outcome)]: 1,
        ...(result.outcome !== 'blocked' || result.reasonCode === null
          ? {}
          : {
              [metricKey('cms_governed_schedule_blocked_total', {
                reason: result.reasonCode,
              })]: 1,
            }),
        ...(result.deviationSeconds === null
          ? {}
          : {
              cms_governed_activation_deviation_seconds: Math.abs(
                result.deviationSeconds,
              ),
            }),
      },
      operation: OPERATION,
      outcome: 'success',
    });
  } catch (error) {
    const manual =
      error instanceof AsyncRpcTransportError &&
      error.disposition === 'manual_review';
    const invalid = error instanceof CmsGovernedActivationResponseError;
    logger.error({
      ...facts,
      durationMs: Date.now() - startedAt,
      errorCode: manual
        ? 'MANUAL_REVIEW'
        : invalid
          ? 'DEPENDENCY_INVALID_RESPONSE'
          : 'DEPENDENCY_UNAVAILABLE',
      eventName: `${OPERATION}.execute_failed`,
      metrics: { [activationTotal(claim, 'error')]: 1 },
      operation: OPERATION,
      outcome: manual || invalid ? 'failure' : 'retry',
      retryable: !manual && !invalid,
    });
  }
};

/**
 * The claim of one tick. A failure asks the platform to retry the tick, except a manual-review
 * fault, which is recorded and rethrown as it is.
 */
const claimOrRetry = async (
  rpc: ReturnType<typeof createSupabaseRpc>,
  env: AsyncWorkerBindings,
  logger: Logger,
  correlationId: string,
  signal: AbortSignal,
): Promise<readonly ClaimedGovernedActivation[]> => {
  try {
    return await claimDueGovernedActivations(
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
      recordManualReview(logger, OPERATION, correlationId, error.reason);
      throw error;
    }
    throw retrySweep(
      logger,
      OPERATION,
      RETRY_MESSAGE,
      correlationId,
      error instanceof CmsGovernedActivationResponseError
        ? 'DEPENDENCY_INVALID_RESPONSE'
        : 'DEPENDENCY_UNAVAILABLE',
    );
  }
};

/**
 * One scheduled tick, under one 15,000 ms job deadline: the claim and every execute share it, an
 * execute gets only the time that is left, and no further schedule is started once it has passed
 * (the lease and the database retry ladder own those claims). A claim failure asks the platform to
 * retry the tick (like the other CMS sweeps); a failure to execute one schedule is logged and left
 * to the lease and the ladder. No timer outlives the tick.
 */
export const runProductionCmsGovernedActivationSweep = async (
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
      metrics: { cms_governed_activation_claim_batch_size: claims.length },
      operation: OPERATION,
      outcome: 'success',
    });
  } finally {
    clearTimeout(deadline);
  }
};
