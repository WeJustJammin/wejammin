import type { AsyncWorkerBindings } from './async-entrypoint';

/**
 * Worker-layer delivery context of one `platform-jobs` Job message (DEC-184, BE03a "Preparation delivery
 * budget"). It is handed to the CMS preparation effect only, as a third argument beside the verified
 * request and the private lease control. It never enters `JobEffectInput`, so no other effect can see the
 * Worker bindings (they carry the service credential).
 */
export type JobEffectDeliveryContext = Readonly<{
  env: AsyncWorkerBindings;
  /** Aborts when the invocation budget below is spent. */
  signal: AbortSignal;
  /** `max(1, message.attempts)`: the BE00 delivery number, 1-based, 4 being the last. */
  deliveryAttempt: number;
}>;

/** BE00 `platform.job.execute`: `max_retries = 3`, i.e. at most four deliveries including the initial one. */
export const MAX_JOB_DELIVERIES = 4;
/** One invocation never runs longer than this, whatever the Job lease allows. */
export const INVOCATION_BUDGET_CAP_MS = 240_000;
/** Kept free of the Job lease for the consumer settlement, the outcome CAS and the processed write. */
export const SETTLEMENT_RESERVE_MS = 60_000;

/** `max(1, attempts)` with an explicit finite-integer guard (`Math.max(1, NaN)` is `NaN`). */
export const deliveryAttemptOf = (attempts: unknown): number =>
  typeof attempts === 'number' && Number.isFinite(attempts)
    ? Math.max(1, Math.trunc(attempts))
    : 1;

export const isFinalDelivery = (deliveryAttempt: number): boolean =>
  deliveryAttempt >= MAX_JOB_DELIVERIES;

/**
 * The invocation deadline: `min(240000, lease remaining - 60000)` ms, never negative. A missing lease
 * expiry (no claim receipt) falls back to the cap; a non-finite clock or expiry leaves no budget.
 */
export const invocationBudgetMs = (
  leaseUntilMs: number | null | undefined,
  nowMs: number,
): number => {
  if (!Number.isFinite(nowMs)) return 0;
  if (leaseUntilMs === undefined || leaseUntilMs === null)
    return INVOCATION_BUDGET_CAP_MS;
  if (!Number.isFinite(leaseUntilMs)) return 0;
  return Math.max(
    0,
    Math.min(
      INVOCATION_BUDGET_CAP_MS,
      leaseUntilMs - nowMs - SETTLEMENT_RESERVE_MS,
    ),
  );
};
