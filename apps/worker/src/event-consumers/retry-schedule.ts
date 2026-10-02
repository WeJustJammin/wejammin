import type { EventConsumerOutcome } from './types';

/**
 * BE01a security-notification seam: three queue retries at 15, 60 and 300
 * seconds under one notification id. The same schedule paces the
 * auth-state-reconciler's provider-status polling. After the third retry the
 * platform queue's `max_retries` moves the message to its DLQ.
 */
export const CONSUMER_RETRY_DELAYS_SECONDS = [15, 60, 300] as const;

export const retryAfterAttempt = (attempt: number): EventConsumerOutcome => {
  const index = Number.isFinite(attempt)
    ? Math.max(1, Math.trunc(attempt)) - 1
    : 0;
  const delaySeconds = CONSUMER_RETRY_DELAYS_SECONDS[index];
  return delaySeconds === undefined
    ? { outcome: 'retry' }
    : { outcome: 'retry', delaySeconds };
};
