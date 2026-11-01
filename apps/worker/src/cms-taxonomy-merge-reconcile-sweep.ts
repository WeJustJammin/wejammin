import { createCorrelationId, createRequestId } from '@wejammin/contracts';
import { createLogger } from '@wejammin/observability/logging';

import type { AsyncWorkerBindings } from './async-entrypoint';
import { createSupabaseRpc } from './async-runtime';
import { AsyncRpcTransportError } from './async-runtime-support';
import { recordManualReview, retrySweep } from './cms-schedule-sweep-support';

/**
 * The scheduled recovery sweep of a failed taxonomy merge convergence (owner decision DEC-194; BE03c "Merge
 * convergence recovery", BE00 571 domain recovery reference; job type `cms.taxonomy.merge_converge`).
 *
 * Every tick makes ONE protected `platform_api` call, `cms_reconcile_taxonomy_merge_converge`, which takes no
 * argument and answers exactly `{ requested }`: the number of fresh convergence jobs it accepted. The database owns
 * every rule: which acting party qualifies (a failed job, remaining merged-term work, no queued or running job), the
 * once-per-failed-job idempotency key, the 15-minute spacing and the stop after 3 consecutive failed generations.
 * The Worker adds nothing to it and never retries inside the tick: a replayed tick requests nothing twice, so a
 * failed tick is simply left to the platform retry and the next minute.
 *
 * It logs the count only (no job, party, term or actor identifier ever leaves the database). The alert for a
 * generation that keeps failing is the one of the job itself (`cms_taxonomy_merge_total{outcome="failed"}`, route
 * `platform.on_call`); after the third failed generation the sweep stops and that alert is all that remains.
 */

/** The platform_api RPC of the sweep (BE03c "Merge convergence recovery"); no argument. */
export const CMS_TAXONOMY_MERGE_RECONCILE_RPC =
  'cms_reconcile_taxonomy_merge_converge' as const;

const OPERATION = 'cms_taxonomy_merge_reconcile_sweep';
const RETRY_MESSAGE = 'CMS taxonomy merge reconcile sweep requested retry';
/** The answer is a PostgreSQL `integer` count. */
const SQL_INTEGER_MAX = 2_147_483_647;

/** The RPC answers exactly `{ requested: n }`, an integer `0 <= n <= 2147483647`; anything else is a contract fault. */
const parseRequested = (value: unknown): number | undefined => {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return undefined;
  const keys = Object.keys(value);
  const requested = (value as Record<string, unknown>)['requested'];
  if (
    keys.length !== 1 ||
    typeof requested !== 'number' ||
    !Number.isInteger(requested) ||
    requested < 0 ||
    requested > SQL_INTEGER_MAX
  )
    return undefined;
  return requested;
};

/**
 * One scheduled tick. A transport failure asks the platform to retry the tick (like the other CMS sweeps), except a
 * manual-review fault, which is recorded and rethrown as it is; a malformed answer is a contract fault, retried the
 * same way. No timer is created: the RPC client enforces the 15,000 ms protected-command deadline.
 */
export const runProductionCmsTaxonomyMergeReconcileSweep = async (
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

  let answer: unknown;
  try {
    answer = await createSupabaseRpc()(
      env,
      CMS_TAXONOMY_MERGE_RECONCILE_RPC,
      {},
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
      'DEPENDENCY_UNAVAILABLE',
    );
  }

  const requested = parseRequested(answer);
  if (requested === undefined)
    throw retrySweep(
      logger,
      OPERATION,
      RETRY_MESSAGE,
      correlationId,
      'DEPENDENCY_INVALID_RESPONSE',
    );

  logger.info({
    correlationId,
    eventName: `${OPERATION}.completed`,
    metrics: { cms_taxonomy_merge_reconcile_requested_total: requested },
    operation: OPERATION,
    outcome: 'success',
  });
};
