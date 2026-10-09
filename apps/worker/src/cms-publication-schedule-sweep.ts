import {
  CMS_SCHEDULE_CLAIM_BATCH_DEFAULT,
  createCorrelationId,
  createRequestId,
  type ClaimedSchedule,
  type PreflightEvidence,
} from '@wejammin/contracts';
import { createLogger, type Logger } from '@wejammin/observability/logging';

import type { AsyncWorkerBindings } from './async-entrypoint';
import { createSupabaseRpc } from './async-runtime';
import { AsyncRpcTransportError } from './async-runtime-support';
import {
  evaluateAccessibilityGate,
  toPreflightEvidence,
} from './cms-editorial/a11y-structural';
import {
  claimDueSchedules,
  CmsScheduleResponseError,
  executeClaimedSchedule,
} from './cms-publication-schedule-rpc';
import {
  loadQualityGateInput,
  logQualityGateRun,
} from './cms-editorial-production-quality-gate';
import { metricKey } from './content-schema-registry/route-metric-key';

/**
 * CMS-03B-20, the scheduled publication sweep (BE03b "Schedule execution",
 * DEC-156). Every minute it claims at most 25 due schedules, and for each one
 * runs the Worker-resident accessibility checker (D25) to produce
 * `PreflightEvidence` bound by the JCS hash of the claimed revision and frozen
 * dependency set, then executes the schedule with the expected version and
 * lease. The retry ladder (15/60/300 s, then `retries_exhausted`), the lease
 * recheck and the lineage append are the database's; this module only drives
 * them, never writes publication state and never retries an execution itself.
 *
 * It logs identifiers as hashes and counts only: no token, content, comment
 * or authority graph ever reaches telemetry.
 */

const OPERATION = 'cms_publication_schedule_sweep';
const GATE_OPERATION_ID = 'CMS-03B-20';
const GATE_RESPONSE_BYTES = 256 * 1024;

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

/**
 * The accessibility proof of one claimed schedule, or null when the checker
 * produced none. The loaded revision must be exactly the claimed one under the
 * claimed frozen dependency hash: a proof bound to anything else would be
 * refused by the database as mis-bound, so none is sent.
 */
const proofFor = async (
  env: AsyncWorkerBindings,
  claim: ClaimedSchedule,
  logger: Logger,
): Promise<PreflightEvidence | null> => {
  const configuration = {
    baseUrl: env.SUPABASE_URL.replace(/\/+$/u, ''),
    secret: env.SUPABASE_SECRET_KEY,
    fetchImpl: (url: string | URL | Request, init?: RequestInit) =>
      globalThis.fetch(url, init),
    maxResponseBytes: GATE_RESPONSE_BYTES,
    now: Date.now,
  };
  const identity = {
    operationId: GATE_OPERATION_ID,
    requestId: createRequestId(undefined),
    correlationId: claim.correlationId,
  };
  const run = await evaluateAccessibilityGate({
    load: (signal) =>
      loadQualityGateInput(
        configuration,
        {
          phase: 'execute',
          scheduleId: claim.scheduleId,
          revisionId: claim.revisionId,
          dependencyHash: claim.dependencyHash,
        },
        identity,
        signal,
      ),
  });
  logQualityGateRun(logger, identity, run);
  return run.state !== 'failed' &&
    run.input.revisionId === claim.revisionId &&
    run.input.dependencyHash === claim.dependencyHash
    ? toPreflightEvidence(run)
    : null;
};

const scheduleFacts = async (claim: ClaimedSchedule) => ({
  correlationId: claim.correlationId,
  entityType: 'cms_publication_schedule',
  entityIdHash: `sha256:${await sha256Hex(claim.scheduleId)}`,
});

/** Execute one claim; a failure here never stops the rest of the batch. */
const executeOne = async (
  rpc: ReturnType<typeof createSupabaseRpc>,
  env: AsyncWorkerBindings,
  claim: ClaimedSchedule,
  logger: Logger,
): Promise<void> => {
  const startedAt = Date.now();
  const facts = await scheduleFacts(claim);
  try {
    const result = await executeClaimedSchedule(
      rpc,
      env,
      claim,
      await proofFor(env, claim, logger),
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
    // retried here: the lease expires and the database ladder decides.
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
 * One scheduled tick. A claim failure asks the platform to retry the tick (like
 * the other CMS sweeps); a failure to execute one schedule is logged and left
 * to the lease and the database retry ladder.
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

  let claims: readonly ClaimedSchedule[];
  try {
    claims = await claimDueSchedules(
      rpc,
      env,
      CMS_SCHEDULE_CLAIM_BATCH_DEFAULT,
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

  for (const claim of claims) await executeOne(rpc, env, claim, logger);

  logger.info({
    attributes: { batch: CMS_SCHEDULE_CLAIM_BATCH_DEFAULT },
    correlationId,
    eventName: `${OPERATION}.completed`,
    metrics: { cms_schedule_claim_batch_size: claims.length },
    operation: OPERATION,
    outcome: 'success',
  });
};
