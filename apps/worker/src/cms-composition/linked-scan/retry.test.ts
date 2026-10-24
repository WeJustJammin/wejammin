import { describe, expect, it } from 'vitest';

import { LINKED_SCAN_RETRY_JITTER_FRACTION, linkedScanRetry } from './retry';

const UPPER_EDGE = 1 - Number.EPSILON;

/*
 * BE00 550: queue consumers retry at 15, 60 and 300 seconds "with bounded jitter". BE00 states no number, so the bound
 * is an implementation decision shared with the taxonomy merge convergence: +0 to +10 % of the base delay, never
 * earlier than the schedule.
 */
describe('[P2-S12-AC-213] the retry ladder of the linked-update scan', () => {
  it('states the bound: 10 % of the base delay', () => {
    expect(LINKED_SCAN_RETRY_JITTER_FRACTION).toBe(0.1);
  });

  it.each([
    [1, 15],
    [2, 60],
    [3, 300],
  ])(
    'adds nothing at the lower edge of the sample: attempt %i waits exactly %i seconds',
    (attempt, base) => {
      expect(linkedScanRetry(attempt, () => 0)).toEqual({
        outcome: 'retry',
        delaySeconds: base,
      });
    },
  );

  it.each([
    [1, 15],
    [2, 60],
    [3, 300],
  ])(
    'adds just under 10 % at the upper edge, never more: attempt %i',
    (attempt, base) => {
      const outcome = linkedScanRetry(attempt, () => UPPER_EDGE);
      expect(outcome.outcome).toBe('retry');
      const delay = (outcome as { delaySeconds: number }).delaySeconds;
      expect(delay).toBeGreaterThan(base);
      expect(delay).toBeLessThanOrEqual(base * 1.1);
      expect(Number.isInteger(delay)).toBe(true);
    },
  );

  it('scales the added time linearly with the sample', () => {
    expect(linkedScanRetry(2, () => 0.5)).toEqual({
      outcome: 'retry',
      delaySeconds: 63,
    });
    expect(linkedScanRetry(3, () => 0.25)).toEqual({
      outcome: 'retry',
      delaySeconds: 307,
    });
  });

  it.each([-0.1, 1, 2, Number.NaN, Number.POSITIVE_INFINITY])(
    'adds nothing for a sample outside [0, 1) (%s): the delay is never shorter than the schedule nor longer than 110 %%',
    (sample) => {
      expect(linkedScanRetry(1, () => sample)).toEqual({
        outcome: 'retry',
        delaySeconds: 15,
      });
    },
  );

  it.each([0, 1.7, Number.NaN, Number.POSITIVE_INFINITY])(
    'treats an attempt count that is not a positive integer (%s) as the first attempt',
    (attempt) => {
      expect(linkedScanRetry(attempt, () => 0)).toEqual({
        outcome: 'retry',
        delaySeconds: 15,
      });
    },
  );

  it.each([4, 9])(
    'lets the platform queue decide (no delay; max_retries moves the message to the DLQ) beyond the ladder: attempt %i',
    (attempt) => {
      expect(linkedScanRetry(attempt, () => 0.9)).toEqual({ outcome: 'retry' });
    },
  );
});
