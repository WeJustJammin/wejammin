import type {
  CmsEditorialProductionConfiguration,
  CmsEditorialProductionResult,
} from './cms-editorial-production-types';
import {
  deadlineExceeded,
  invalidResponse,
  isAbortError,
  unavailable,
} from './cms-editorial-production-errors';

/**
 * A single total-operation deadline. BE03b bounds the whole editorial RPC --
 * headers and body -- by one clock, so the abort signal created here is
 * threaded through both the request and the bounded body read. Calling
 * dispose releases the timer and the caller listener once the response has
 * been fully consumed.
 */
export type DeadlineHandle = Readonly<{
  signal: AbortSignal;
  expired: () => boolean;
  dispose: () => void;
}>;

/**
 * Create the total deadline. The returned signal aborts when either the caller
 * signal aborts or the deadline elapses, so passing it to fetch and to the body
 * read enforces one budget across the whole exchange. expired() reports only the
 * timer firing, never a caller abort, so a transport that observes the abort can
 * still be distinguished from a genuine deadline.
 */
export const createDeadline = (
  signal: AbortSignal,
  deadlineMs: number,
): DeadlineHandle => {
  const controller = new AbortController();
  let expired = false;
  let disposed = false;
  const abortFromCaller = (): void => {
    controller.abort();
  };
  if (signal.aborted) controller.abort();
  else signal.addEventListener('abort', abortFromCaller, { once: true });
  const timer = setTimeout(() => {
    expired = true;
    controller.abort();
  }, deadlineMs);
  return {
    signal: controller.signal,
    expired: () => expired,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', abortFromCaller);
    },
  };
};

/**
 * Issue the RPC under the shared deadline. The deadline signal is passed to
 * fetch so the runtime aborts the request, and it is also raced directly so a
 * transport that ignores the signal cannot wedge the request past its budget.
 */
export const fetchWithDeadline = async (
  configuration: CmsEditorialProductionConfiguration,
  url: string,
  init: RequestInit,
  deadline: DeadlineHandle,
): Promise<CmsEditorialProductionResult<Response>> => {
  if (deadline.signal.aborted) return deadlineExceeded();
  let removeAbortListener: (() => void) | undefined;
  const abortRace = new Promise<'aborted'>((resolve) => {
    const onAbort = (): void => resolve('aborted');
    deadline.signal.addEventListener('abort', onAbort, { once: true });
    removeAbortListener = (): void =>
      deadline.signal.removeEventListener('abort', onAbort);
  });
  try {
    const outcome = await Promise.race([
      configuration
        .fetchImpl(url, { ...init, signal: deadline.signal })
        .then((response) => ({ kind: 'response' as const, response }))
        .catch((error: unknown) => ({ kind: 'error' as const, error })),
      abortRace.then(() => ({ kind: 'deadline' as const })),
    ]);
    if (outcome.kind === 'response')
      return { ok: true, value: outcome.response };
    if (outcome.kind === 'deadline') return deadlineExceeded();
    if (isAbortError(outcome.error)) return deadlineExceeded();
    return unavailable();
  } finally {
    removeAbortListener?.();
  }
};

/**
 * Read a response body under a byte budget and the shared deadline. A pending
 * read is cancelled the moment the signal aborts, so a stalled body terminates
 * promptly instead of outliving the total deadline.
 */
export const readBoundedResponse = async (
  response: Response,
  maxResponseBytes: number,
  signal?: AbortSignal,
): Promise<Uint8Array | null> => {
  if (response.body === null) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let aborted = signal?.aborted === true;
  const onAbort = (): void => {
    aborted = true;
    void reader.cancel().catch(() => undefined);
  };
  if (signal !== undefined && !aborted)
    signal.addEventListener('abort', onAbort, { once: true });
  try {
    while (true) {
      if (aborted) return null;
      const next = await reader.read();
      if (aborted) return null;
      if (next.done) break;
      total += next.value.byteLength;
      if (total > maxResponseBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(next.value);
    }
  } catch {
    try {
      await reader.cancel();
    } catch {
      // A secondary stream cancellation failure must not mask the bound error.
    }
    return null;
  } finally {
    signal?.removeEventListener('abort', onAbort);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
};

export const parseJsonResponse = async (
  response: Response,
  maxResponseBytes: number,
  signal?: AbortSignal,
): Promise<CmsEditorialProductionResult<unknown>> => {
  const contentType = response.headers
    .get('content-type')
    ?.split(';')[0]
    ?.trim()
    .toLowerCase();
  if (contentType !== 'application/json') return invalidResponse();
  const declaredLength = response.headers.get('content-length');
  if (declaredLength !== null) {
    const parsedLength = Number(declaredLength);
    if (
      !Number.isSafeInteger(parsedLength) ||
      parsedLength < 0 ||
      parsedLength > maxResponseBytes
    )
      return invalidResponse();
  }
  const bytes = await readBoundedResponse(response, maxResponseBytes, signal);
  if (bytes === null) return invalidResponse();
  try {
    const decoded = new TextDecoder('utf-8', {
      fatal: true,
      ignoreBOM: false,
    }).decode(bytes);
    return { ok: true, value: JSON.parse(decoded) as unknown };
  } catch {
    return invalidResponse();
  }
};

export const readRpcError = async (
  response: Response,
  maxResponseBytes: number,
  signal?: AbortSignal,
): Promise<unknown> => {
  const parsed = await parseJsonResponse(response, maxResponseBytes, signal);
  return parsed.ok ? parsed.value : null;
};
