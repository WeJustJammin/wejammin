import { describe, expect, it } from 'vitest';

import {
  CONSUMER_RETRY_DELAYS_SECONDS,
  retryAfterAttempt,
} from './retry-schedule';

describe('consumer retry schedule', () => {
  it('[P2-S09-AC-916] retries at 15, 60 and 300 seconds, then leaves exhaustion to the platform DLQ', () => {
    expect(CONSUMER_RETRY_DELAYS_SECONDS).toEqual([15, 60, 300]);
    expect(retryAfterAttempt(1)).toEqual({
      outcome: 'retry',
      delaySeconds: 15,
    });
    expect(retryAfterAttempt(2)).toEqual({
      outcome: 'retry',
      delaySeconds: 60,
    });
    expect(retryAfterAttempt(3)).toEqual({
      outcome: 'retry',
      delaySeconds: 300,
    });
    expect(retryAfterAttempt(4)).toEqual({ outcome: 'retry' });
    expect(retryAfterAttempt(40)).toEqual({ outcome: 'retry' });
  });

  it('treats a missing or non-positive attempt as the first delivery', () => {
    expect(retryAfterAttempt(0)).toEqual({
      outcome: 'retry',
      delaySeconds: 15,
    });
    expect(retryAfterAttempt(Number.NaN)).toEqual({
      outcome: 'retry',
      delaySeconds: 15,
    });
  });
});
