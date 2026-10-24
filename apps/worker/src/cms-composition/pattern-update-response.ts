import {
  ApiErrorSchema,
  cmsCompositionCatalogCode,
  cmsCompositionCatalogMessage,
} from '@wejammin/contracts';

import { checkOrigin } from '../cms-editorial/admission-headers';
import {
  failure,
  statusOf,
  type PatternUpdateError,
  type CmsPatternUpdateDependencies,
} from './pattern-update-ports';
import { noteRefusal } from './observability-facts';
import { observeRequest } from './observability-observation';
import { patternUpdateDetails } from './pattern-update-details';
import {
  PATTERN_UPDATE_OPERATIONS,
  type PatternUpdateOperation,
} from './pattern-update-operations';

/** Common response headers: never cached, the request id, and CORS only for an allowed human origin. */
export const patternUpdateHeaders = (
  request: Request,
  dependencies: CmsPatternUpdateDependencies,
  requestId: string,
): Headers => {
  const headers = new Headers({
    'cache-control': 'no-store',
    'x-request-id': requestId,
  });
  const origin = request.headers.get('origin');
  if (origin !== null && dependencies.humanOrigins.includes(origin)) {
    headers.set('access-control-allow-origin', origin);
    headers.set('access-control-allow-credentials', 'true');
    headers.set('vary', 'Origin');
  }
  return headers;
};

/** BE00 `retry-after` seconds when the refusal gave none: 429 waits a window, a dependency waits the first backoff. */
const retryAfterOf = (status: number, seconds: unknown): string =>
  typeof seconds === 'number' && Number.isSafeInteger(seconds) && seconds > 0
    ? String(seconds)
    : status === 429
      ? '60'
      : '15';

/**
 * The BE03c composition-catalog answer to a refusal: the catalog code of the status, the bound message and the
 * allowlisted details. A status the catalog does not list is an INTERNAL_ERROR 500.
 */
export const patternUpdateError = (
  request: Request,
  dependencies: CmsPatternUpdateDependencies,
  requestId: string,
  operation: PatternUpdateOperation,
  error: PatternUpdateError,
): Response => {
  const status = statusOf(error.status);
  const code = cmsCompositionCatalogCode(operation, status)!;
  const details = patternUpdateDetails(operation, status, error.details);
  const headers = patternUpdateHeaders(request, dependencies, requestId);
  headers.set('content-type', 'application/json; charset=UTF-8');
  // BE03c Observability: the published refusal, reduced to its catalog code and closed members.
  noteRefusal(request, status, details, code);
  if (status === 429 || status === 503 || status === 504)
    headers.set('retry-after', retryAfterOf(status, error.retryAfterSeconds));
  if (status === 429) {
    headers.set('ratelimit-remaining', '0');
    if (typeof details.limit === 'number')
      headers.set('ratelimit-limit', String(details.limit));
    if (typeof details.resetAt === 'string')
      headers.set('ratelimit-reset', details.resetAt);
  }
  return new Response(
    JSON.stringify(
      ApiErrorSchema.parse({
        code,
        message: cmsCompositionCatalogMessage('composition', code),
        requestId,
        details,
      }),
    ),
    { status, headers },
  );
};

/** A read whose page carries no version (DEC-206 lists a revision's rows): accepted, answered without an entity tag. */
export const NO_ETAG: unique symbol = Symbol('no-etag');

/** A 200 with the strong ETag (none for `NO_ETAG`); the body was already parsed with its frozen schema, so it is serialized as is. */
export const patternUpdateSuccess = (
  request: Request,
  dependencies: CmsPatternUpdateDependencies,
  requestId: string,
  value: unknown,
  etag: string | typeof NO_ETAG,
): Response => {
  const headers = patternUpdateHeaders(request, dependencies, requestId);
  headers.set('content-type', 'application/json; charset=UTF-8');
  if (etag !== NO_ETAG) headers.set('etag', etag);
  return new Response(JSON.stringify(value), { status: 200, headers });
};

/** The CORS preflight of one route: an allowed human origin only (403 otherwise). */
export const patternUpdatePreflight = (
  request: Request,
  dependencies: CmsPatternUpdateDependencies,
  requestId: string,
  operation: PatternUpdateOperation,
  allowedHeaders: string,
): Response => {
  if (
    request.headers.get('origin') === null ||
    checkOrigin(request, dependencies.humanOrigins) !== null
  )
    return patternUpdateError(
      request,
      dependencies,
      requestId,
      operation,
      failure(403),
    );
  const headers = patternUpdateHeaders(request, dependencies, requestId);
  headers.set(
    'access-control-allow-methods',
    PATTERN_UPDATE_OPERATIONS[operation].write
      ? 'POST, OPTIONS'
      : 'GET, OPTIONS',
  );
  headers.set('access-control-allow-headers', allowedHeaders);
  return new Response(null, { status: 204, headers });
};

/**
 * One route deadline covers every await, including a dependency that ignores abort. The caller's abort and the
 * registry deadline (reads 8,000 ms, the command 15,000 ms) answer 504; a thrown error answers 500; telemetry can never
 * change the decided response. Nothing here retries a command.
 */
export const runPatternUpdateRoute = async (
  request: Request,
  dependencies: CmsPatternUpdateDependencies,
  requestId: string,
  operation: PatternUpdateOperation,
  execute: (signal: AbortSignal) => Promise<Response>,
): Promise<Response> => {
  const startedAt = dependencies.now();
  const controller = new AbortController();
  let resolveAbort!: (response: Response) => void;
  const aborted = new Promise<Response>((resolve) => {
    resolveAbort = resolve;
  });
  const abort = (): void => {
    controller.abort();
    resolveAbort(
      patternUpdateError(
        request,
        dependencies,
        requestId,
        operation,
        failure(504, {}, 15),
      ),
    );
  };
  request.signal.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(
    abort,
    PATTERN_UPDATE_OPERATIONS[operation].deadlineMs,
  );
  let response: Response;
  try {
    if (request.signal.aborted) abort();
    response = await Promise.race([
      controller.signal.aborted ? aborted : execute(controller.signal),
      aborted,
    ]);
  } catch {
    response = patternUpdateError(
      request,
      dependencies,
      requestId,
      operation,
      failure(500),
    );
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener('abort', abort);
  }
  try {
    void Promise.resolve(
      dependencies.telemetry({
        operationId: operation,
        requestId,
        status: response.status,
        outcome:
          response.status < 400
            ? 'success'
            : response.status < 500
              ? 'rejected'
              : 'failure',
        actorClass: 'human',
        durationMs: Math.max(0, dependencies.now() - startedAt),
        observation: observeRequest(
          request,
          requestId,
          operation,
          response.status,
        ),
      }),
    ).catch(() => undefined);
  } catch {
    /* Telemetry cannot replace the decided response. */
  }
  return response;
};
