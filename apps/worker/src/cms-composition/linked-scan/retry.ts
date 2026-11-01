import { retryAfterAttempt } from '../../event-consumers/retry-schedule';
import type { EventConsumerOutcome } from '../../event-consumers/types';

/**
 * BE00 550: queue consumers retry at 15, 60 and 300 seconds "with bounded jitter". BE00 states no
 * number, so the bound is the implementation decision the taxonomy merge convergence already
 * records: each delay gains 0 to 10 % of its base, never less than the schedule, so a held lock
 * keeps its full time to clear while redelivered scans stop running in lockstep.
 */
export const LINKED_SCAN_RETRY_JITTER_FRACTION = 0.1;

/**
 * The retry outcome of attempt number `attempt`: the shared ladder plus its bounded jitter,
 * `base + floor(base * 0.1 * sample)` with `sample` in `[0, 1)`. A sample outside that range (a
 * broken seam: NaN, negative, 1 or more, infinite) adds nothing. Beyond the ladder the outcome has
 * no delay and the platform queue's `max_retries` moves the message to its dead-letter queue.
 */
export const linkedScanRetry = (
  attempt: number,
  random: () => number,
): EventConsumerOutcome => {
  const scheduled = retryAfterAttempt(attempt);
  if (scheduled.outcome !== 'retry' || scheduled.delaySeconds === undefined)
    return scheduled;
  const sample = random();
  const jitter =
    sample >= 0 && sample < 1
      ? Math.floor(
          scheduled.delaySeconds * LINKED_SCAN_RETRY_JITTER_FRACTION * sample,
        )
      : 0;
  return { outcome: 'retry', delaySeconds: scheduled.delaySeconds + jitter };
};
