/** DEC-184 delivery budget arithmetic: delivery number, invocation deadline, retry pacing. */
import { describe, expect, it } from 'vitest';

import {
  INVOCATION_BUDGET_CAP_MS,
  MAX_JOB_DELIVERIES,
  SETTLEMENT_RESERVE_MS,
  deliveryAttemptOf,
  invocationBudgetMs,
  isFinalDelivery,
} from './async-runtime-job-context';

describe('[P2-S12-AC-050] preparation delivery number (DEC-184)', () => {
  it.each([
    [1, 1],
    [2, 2],
    [3, 3],
    [4, 4],
    [5, 5],
    [0, 1],
    [-3, 1],
    [Number.NaN, 1],
    [Number.POSITIVE_INFINITY, 1],
    [2.9, 2],
    ['3', 1],
    [undefined, 1],
    [null, 1],
  ])('message.attempts %j is delivery %j', (attempts, expected) => {
    expect(deliveryAttemptOf(attempts)).toBe(expected);
  });

  it('names the BE00 ceiling of four deliveries including the initial one', () => {
    expect(MAX_JOB_DELIVERIES).toBe(4);
    expect([1, 2, 3, 4, 5].map(isFinalDelivery)).toEqual([
      false,
      false,
      false,
      true,
      true,
    ]);
  });
});

describe('[P2-S12-AC-050] preparation invocation budget (DEC-184)', () => {
  const NOW = 1_000_000;
  it('caps a fresh 300 second lease at 240 seconds', () => {
    expect(INVOCATION_BUDGET_CAP_MS).toBe(240_000);
    expect(invocationBudgetMs(NOW + 300_000, NOW)).toBe(240_000);
  });
  it('keeps 60 seconds of the remaining lease for settlement and the outcome write', () => {
    expect(SETTLEMENT_RESERVE_MS).toBe(60_000);
    expect(invocationBudgetMs(NOW + 100_000, NOW)).toBe(40_000);
    expect(invocationBudgetMs(NOW + 840_000, NOW)).toBe(240_000);
  });
  it.each([[NOW + 60_000], [NOW + 59_999], [NOW], [NOW - 1], [Number.NaN]])(
    'a lease expiring at %j leaves no budget',
    (leaseUntilMs) => {
      expect(invocationBudgetMs(leaseUntilMs, NOW)).toBe(0);
    },
  );
  it('without a lease expiry uses the cap', () => {
    expect(invocationBudgetMs(undefined, NOW)).toBe(240_000);
    expect(invocationBudgetMs(null, NOW)).toBe(240_000);
  });
  it('a non-finite clock leaves no budget', () => {
    expect(invocationBudgetMs(NOW + 300_000, Number.NaN)).toBe(0);
  });
});
