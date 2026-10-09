/*
 * The wall-clock budget of one gate call (BE05c: timeoutMs covers input load
 * and evaluation) and the default retry sleep. Both are abort-aware: the gate
 * hands the budget's signal to the idempotent load and to the sleep, so a
 * timeout or a parent abort releases whatever they were waiting on.
 */

export type GateSleep = (ms: number, signal: AbortSignal) => Promise<void>;

export const defaultGateSleep: GateSleep = (ms, signal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });

export type GateBudget = Readonly<{
  /** Aborted when the budget elapses or the parent signal aborts. */
  signal: AbortSignal;
  /** Resolves once the signal aborts, so a gate can race a load that ignores it. */
  expired: Promise<'expired'>;
  /** Clears the timer and the parent listener; always call it when the gate returns. */
  close: () => void;
}>;

export const openGateBudget = (
  timeoutMs: number,
  parent: AbortSignal | undefined,
): GateBudget => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onParentAbort = (): void => controller.abort();
  if (parent?.aborted === true) controller.abort();
  else parent?.addEventListener('abort', onParentAbort, { once: true });
  const expired = new Promise<'expired'>((resolve) => {
    if (controller.signal.aborted) resolve('expired');
    else
      controller.signal.addEventListener('abort', () => resolve('expired'), {
        once: true,
      });
  });
  return {
    signal: controller.signal,
    expired,
    close: () => {
      clearTimeout(timer);
      parent?.removeEventListener('abort', onParentAbort);
    },
  };
};
