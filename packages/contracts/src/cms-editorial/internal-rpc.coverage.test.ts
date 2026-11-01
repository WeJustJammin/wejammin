import { describe, expect, it } from 'vitest';

import {
  CMS_SCHEDULE_MAX_RETRY_ATTEMPTS,
  CMS_SCHEDULE_RETRY_DELAYS_SECONDS,
  cmsScheduleRetryDelaySeconds,
} from './internal-rpc';

describe('the schedule retry ladder', () => {
  it('has one delay per permitted retry attempt', () => {
    expect(CMS_SCHEDULE_RETRY_DELAYS_SECONDS).toHaveLength(
      CMS_SCHEDULE_MAX_RETRY_ATTEMPTS,
    );
  });

  it('reads each rung by its failure number', () => {
    expect(
      [1, 2, 3].map((failureNumber) =>
        cmsScheduleRetryDelaySeconds(failureNumber),
      ),
    ).toEqual([15, 60, 300]);
  });

  it.each([
    ['zero', 0],
    ['a negative number', -1],
    ['the exhausting fourth failure', 4],
    ['a fraction below the first rung', 0.5],
    ['a fraction between rungs', 2.5],
    ['not a number', Number.NaN],
    ['positive infinity', Number.POSITIVE_INFINITY],
    ['negative infinity', Number.NEGATIVE_INFINITY],
  ])('has no delay for %s', (_label, failureNumber) => {
    expect(cmsScheduleRetryDelaySeconds(failureNumber)).toBeNull();
  });
});
