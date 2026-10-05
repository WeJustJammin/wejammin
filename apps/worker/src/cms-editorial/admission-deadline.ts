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
): Promise<CmsEditorialResult<T>> => {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<CmsEditorialError>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(timedOut());
    }, deadlineMs);
  });
  try {
    return await Promise.race([invoke(controller.signal), timeout]);
  } catch {
    return unavailable();
  } finally {
    clearTimeout(timer);
  }
};

export const dependencyUnavailable = unavailable;
export const dependencyTimedOut = timedOut;
