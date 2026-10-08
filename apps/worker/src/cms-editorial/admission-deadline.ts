import type { CmsEditorialError, CmsEditorialResult } from './types';

/** The scrubbed dependency label carried on every transport failure. */
export const CMS_EDITORIAL_DEPENDENCY_CLASS = 'cms_editorial' as const;

const timedOut = (): CmsEditorialError => ({
  ok: false,
  status: 504,
  code: 'GATEWAY_TIMEOUT',
  message: 'The CMS editorial dependency exceeded its deadline.',
  details: {
    dependencyClass: CMS_EDITORIAL_DEPENDENCY_CLASS,
    retryable: true,
  },
  retryAfterSeconds: 5,
});

const unavailable = (): CmsEditorialError => ({
  ok: false,
  status: 503,
  code: 'DEPENDENCY_UNAVAILABLE',
  message: 'The CMS editorial dependency is temporarily unavailable.',
  details: {
    dependencyClass: CMS_EDITORIAL_DEPENDENCY_CLASS,
    retryable: true,
  },
  retryAfterSeconds: 5,
});

/**
 * Race a dependency call against the route deadline. A deadline breach is 504
 * `GATEWAY_TIMEOUT` and a transport throw is 503 `DEPENDENCY_UNAVAILABLE`; both
 * keep the scrubbed dependencyClass for the retry gate.
 */
export const dependencyDeadline = async <T>(
  invoke: (signal: AbortSignal) => Promise<CmsEditorialResult<T>>,
  deadlineMs: number,
  parentSignal?: AbortSignal,
): Promise<CmsEditorialResult<T>> => {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let removeParentListener: (() => void) | null = null;
  let resolveCancel: ((error: CmsEditorialError) => void) | null = null;
  const cancel =
    parentSignal === undefined
      ? null
      : new Promise<CmsEditorialError>((resolve) => {
          resolveCancel = resolve;
        });
  if (parentSignal !== undefined) {
    const abortFromParent = () => {
      controller.abort(parentSignal.reason);
      resolveCancel?.(timedOut());
    };
    if (parentSignal.aborted) abortFromParent();
    else {
      parentSignal.addEventListener('abort', abortFromParent, { once: true });
      removeParentListener = () =>
        parentSignal.removeEventListener('abort', abortFromParent);
    }
  }
  const timeout = new Promise<CmsEditorialError>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(timedOut());
    }, deadlineMs);
  });
  try {
    if (parentSignal?.aborted) return timedOut();
    const pending = [invoke(controller.signal), timeout] as const;
    return await Promise.race(
      cancel === null ? pending : [pending[0], pending[1], cancel],
    );
  } catch {
    return unavailable();
  } finally {
    clearTimeout(timer);
    removeParentListener?.();
  }
};

export const dependencyUnavailable = unavailable;
export const dependencyTimedOut = timedOut;

/**
 * One cumulative budget for a route: session, quota and port calls all draw
 * from the same clock, clamped to the operation's declared timeout (BE03b
 * registry: 8,000 ms reads, 15,000 ms commands) even when the composed
 * dependency carries a larger default, and every dependency call is cancelled
 * the moment the client disconnects (`request.signal`).
 */
export const createRouteDeadline = (
  request: Request,
  configuredMs: number | undefined,
  policyMs: number,
): Readonly<{
  deadlineAt: number;
  withinDeadline: <T>(
    invoke: (signal: AbortSignal) => Promise<CmsEditorialResult<T>>,
  ) => Promise<CmsEditorialResult<T>>;
}> => {
  const configured = configuredMs ?? policyMs;
  const budgetMs = Number.isFinite(configured)
    ? Math.min(policyMs, Math.max(0, configured))
    : policyMs;
  const deadlineAt = performance.now() + budgetMs;
  const withinDeadline = <T>(
    invoke: (signal: AbortSignal) => Promise<CmsEditorialResult<T>>,
  ): Promise<CmsEditorialResult<T>> => {
    const remainingMs = Math.ceil(deadlineAt - performance.now());
    return remainingMs <= 0
      ? Promise.resolve(timedOut())
      : dependencyDeadline(invoke, remainingMs, request.signal);
  };
  return { deadlineAt, withinDeadline };
};
