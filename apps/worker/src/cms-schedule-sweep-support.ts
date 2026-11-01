import type { Logger } from '@wejammin/observability/logging';

import type { AsyncRpcTransportError } from './async-runtime-support';

/**
 * The logging facts every CMS schedule sweep shares (CMS-03B-20, CMS-03C-19): identifiers leave the
 * Worker as hashes, a claim failure asks the platform to retry the tick, and a manual-review
 * transport fault is recorded as it is. `operation` is the sweep's own closed name.
 */

export const sha256Hex = async (text: string): Promise<string> =>
  [
    ...new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)),
    ),
  ]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

/** Log the failed claim and return the error the tick throws to request the platform retry. */
export const retrySweep = (
  logger: Logger,
  operation: string,
  message: string,
  correlationId: string,
  errorCode: 'DEPENDENCY_INVALID_RESPONSE' | 'DEPENDENCY_UNAVAILABLE',
): Error => {
  logger.error({
    correlationId,
    errorCode,
    eventName: `${operation}.failed`,
    operation,
    outcome: 'retry',
    retryable: true,
  });
  return new Error(message);
};

export const recordManualReview = (
  logger: Logger,
  operation: string,
  correlationId: string,
  reason: AsyncRpcTransportError['reason'],
): void => {
  logger.error({
    attributes: { reason },
    correlationId,
    errorCode: 'MANUAL_REVIEW',
    eventName: `${operation}.manual_review_required`,
    operation,
    outcome: 'failure',
    retryable: false,
  });
};
