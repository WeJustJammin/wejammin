import { createCorrelationId, createRequestId } from '@wejammin/contracts';
import { createLogger } from '@wejammin/observability/logging';

import type { AsyncWorkerBindings } from './async-entrypoint';
import { createSupabaseRpc } from './async-runtime';
import { AsyncRpcTransportError } from './async-runtime-support';

/** `platform_api.cms_sweep_expired_review_authority` accepts 1..5000. */
export const CMS_REVIEW_AUTHORITY_SWEEP_LIMIT = 64;

const OPERATION = 'cms_review_authority_sweep';

const retrySweep = (
  logger: ReturnType<typeof createLogger>,
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
  return new Error('CMS review authority sweep requested retry');
};

const recordManualReview = (
  logger: ReturnType<typeof createLogger>,
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

/** The RPC answers exactly `{ invalidatedReviews: n }` with 0 <= n <= limit. */
const parseInvalidatedReviews = (value: unknown): number | undefined => {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return undefined;
  const keys = Object.keys(value);
  const count = (value as Record<string, unknown>)['invalidatedReviews'];
  if (
    keys.length !== 1 ||
    typeof count !== 'number' ||
    !Number.isInteger(count) ||
    count < 0 ||
    count > CMS_REVIEW_AUTHORITY_SWEEP_LIMIT
  )
    return undefined;
  return count;
};

/**
 * AC1135: expiry of a specialist capability or reviewer assignment is not an
 * event, so each scheduled tick runs one bounded sweep that invalidates the
 * open or approved CMS schema reviews whose counted decision relied on an
 * authority that has since lapsed. A full batch leaves the remainder for the
 * next tick. The activation-time recheck is unchanged.
 */
export const runProductionCmsReviewAuthoritySweep = async (
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

  let result: unknown;
  try {
    result = await createSupabaseRpc()(
      env,
      'cms_sweep_expired_review_authority',
      { p_batch: CMS_REVIEW_AUTHORITY_SWEEP_LIMIT },
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
    throw retrySweep(logger, correlationId, 'DEPENDENCY_UNAVAILABLE');
  }

  const invalidatedReviews = parseInvalidatedReviews(result);
  if (invalidatedReviews === undefined)
    throw retrySweep(logger, correlationId, 'DEPENDENCY_INVALID_RESPONSE');

  logger.info({
    attributes: { limit: CMS_REVIEW_AUTHORITY_SWEEP_LIMIT },
    correlationId,
    eventName: `${OPERATION}.completed`,
    metrics: { invalidatedReviews },
    operation: OPERATION,
    outcome: 'success',
  });
};
