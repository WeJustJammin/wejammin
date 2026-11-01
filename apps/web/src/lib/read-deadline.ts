/**
 * The deadline of a protected browser read. A read that has not answered within it is aborted,
 * so the island leaves its loading state for its failed or degraded one instead of holding the
 * send with no way out (FE03 "Network and retry contract": every state is deterministic). The
 * 8,000 ms is the value the CMS related-content and locale reads already used; a caller with a
 * tighter budget passes its own.
 *
 * Pass `signal` to the fetch; call `clear` in a `finally` so a settled read leaves no timer and no
 * listener on the caller's signal. `expired` tells a timeout from a caller abort (an unmount or a
 * newer read), which is not a failure to show.
 */
export const BROWSER_READ_DEADLINE_MS = 8_000;

export type ReadDeadline = {
  readonly signal: AbortSignal;
  readonly expired: () => boolean;
  readonly clear: () => void;
};

export const startReadDeadline = (
  parent?: AbortSignal,
  deadlineMs: number = BROWSER_READ_DEADLINE_MS,
): ReadDeadline => {
  const controller = new AbortController();
  let timedOut = false;
  const follow = (): void => controller.abort();
  if (parent?.aborted === true) controller.abort();
  else parent?.addEventListener('abort', follow, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, deadlineMs);
  return {
    signal: controller.signal,
    expired: () => timedOut,
    clear: () => {
      clearTimeout(timer);
      parent?.removeEventListener('abort', follow);
    },
  };
};
