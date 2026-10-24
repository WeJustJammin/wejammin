import {
  ApiErrorSchema,
  CMS_BLOCK_RULES_REASON,
  cmsBlockRulesDetails,
  CMS_SLICE_12_OPERATION_REASONS,
  CmsSlice12ReasonCodeSchema,
  cmsSlice12ReasonStatus,
  cmsCompositionCatalogCode,
  cmsCompositionCatalogMessage,
} from '@wejammin/contracts';
import { noteRefusal } from './observability-facts';
import { observeRequest } from './observability-observation';
import { mediaTypeDetails } from './media-type-details';
import {
  failure,
  PATTERN_DEADLINE_MS,
  patternResponseLimit,
  serializedBytesWithin,
  type CmsPatternDefinitionDependencies,
  type PatternError,
  type PatternOperation,
} from './pattern-definition-ports';

export const patternHeaders = (
  request: Request,
  dependencies: CmsPatternDefinitionDependencies,
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

const projectedDetails = (
  operation: PatternOperation,
  error: PatternError,
): Record<string, unknown> => {
  const { status } = error;
  if (status === 401) return { recoveryAction: 'reauthenticate' };
  if (status === 415) return mediaTypeDetails(error.details);
  if (status >= 502)
    // BE00 172: the DEPENDENCY_UNAVAILABLE member is `retryable: true` on 502, 503 and 504.
    return { dependencyClass: 'cms_composition', retryable: true };
  const details = error.details;
  if (details === undefined || details === null || typeof details !== 'object')
    return {};
  const reserved =
    status === 422 &&
    Array.isArray(details.violations) &&
    details.violations.some(
      (item: unknown) =>
        typeof item === 'object' &&
        item !== null &&
        'code' in item &&
        item.code === 'key_reserved' &&
        'path' in item &&
        item.path === '/patternKey',
    );
  const reason = CmsSlice12ReasonCodeSchema.safeParse(
    reserved ? 'key_reserved' : details.reasonCode,
  );
  if (
    reason.success &&
    cmsSlice12ReasonStatus(reason.data) === status &&
    (CMS_SLICE_12_OPERATION_REASONS[operation] as readonly string[]).includes(
      reason.data,
    )
  )
    return reason.data === CMS_BLOCK_RULES_REASON
      ? cmsBlockRulesDetails(details, 'CMS-03C-12')
      : {
          reasonCode: reason.data,
          ...(reason.data === 'key_reserved'
            ? {
                violations: [
                  {
                    path: '/patternKey',
                    code: 'key_reserved',
                    message: 'The value is invalid.',
                  },
                ],
              }
            : {}),
        };
  const output: Record<string, unknown> = {};
  if (status === 409)
    for (const key of ['expectedVersion', 'currentVersion'] as const)
      if (
        typeof details[key] === 'string' &&
        /^[1-9]\d{0,18}$/u.test(details[key])
      )
        output[key] = details[key];
  if (status === 429)
    for (const key of ['retryAfterSeconds', 'limit', 'resetAt'] as const) {
      const value = details[key];
      if (
        key === 'resetAt'
          ? typeof value === 'string' && /^\d{1,19}$/u.test(value)
          : typeof value === 'number' &&
            Number.isSafeInteger(value) &&
            value >= 0
      )
        output[key] = value;
    }
  if (status === 400 || status === 422) {
    const violations = Array.isArray(details.violations)
      ? details.violations.slice(0, 50)
      : [];
    output.violations = violations.map(() => ({
      path: '/',
      code: 'invalid',
      message: 'The value is invalid.',
    }));
  }
  return output;
};

export const patternErrorResponse = (
  request: Request,
  dependencies: CmsPatternDefinitionDependencies,
  requestId: string,
  operation: PatternOperation,
  error: PatternError,
): Response => {
  let status =
    cmsCompositionCatalogCode(operation, error.status) === null
      ? 500
      : error.status;
  const code = cmsCompositionCatalogCode(operation, status)!;
  let details = projectedDetails(operation, { ...error, status });
  let payload = ApiErrorSchema.parse({
    code,
    message: cmsCompositionCatalogMessage('composition', code),
    requestId,
    details,
  });
  const limit = patternResponseLimit(dependencies.maxResponseBytes);
  if (!serializedBytesWithin(payload, limit)) {
    status = 500;
    details = {};
    payload = ApiErrorSchema.parse({
      code: 'INTERNAL_ERROR',
      message: cmsCompositionCatalogMessage('composition', 'INTERNAL_ERROR'),
      requestId,
      details,
    });
  }
  const headers = patternHeaders(request, dependencies, requestId);
  const retry = error.retryAfterSeconds;
  if ([429, 503, 504].includes(status))
    headers.set(
      'retry-after',
      String(
        status === 429 &&
          typeof retry === 'number' &&
          Number.isSafeInteger(retry) &&
          retry > 0
          ? retry
          : status === 429
            ? 60
            : 15,
      ),
    );
  if (status === 429) {
    headers.set('ratelimit-remaining', '0');
    if (typeof details.limit === 'number')
      headers.set('ratelimit-limit', String(details.limit));
    if (typeof details.resetAt === 'string')
      headers.set('ratelimit-reset', details.resetAt);
  }
  headers.set('content-type', 'application/json; charset=UTF-8');
  // BE03c Observability: the published refusal, reduced to its catalog code and closed members.
  noteRefusal(request, status, details, payload.code);
  return new Response(JSON.stringify(payload), { status, headers });
};

export const patternSuccess = (
  request: Request,
  dependencies: CmsPatternDefinitionDependencies,
  requestId: string,
  operation: PatternOperation,
  value: { version: string },
): Response => {
  const limit = patternResponseLimit(dependencies.maxResponseBytes);
  if (!serializedBytesWithin(value, limit))
    return patternErrorResponse(
      request,
      dependencies,
      requestId,
      operation,
      failure(502),
    );
  const headers = patternHeaders(request, dependencies, requestId);
  headers.set('content-type', 'application/json; charset=UTF-8');
  headers.set('etag', `"${value.version}"`);
  return new Response(JSON.stringify(value), {
    status: operation === 'CMS-03C-12' ? 201 : 200,
    headers,
  });
};

/** Total route deadline, caller abort and telemetry never retry a mutation. */
export const runPatternRoute = async (
  request: Request,
  dependencies: CmsPatternDefinitionDependencies,
  requestId: string,
  operation: PatternOperation,
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
      patternErrorResponse(
        request,
        dependencies,
        requestId,
        operation,
        failure(504, {}, 15),
      ),
    );
  };
  request.signal.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, PATTERN_DEADLINE_MS);
  let response: Response;
  try {
    if (request.signal.aborted) abort();
    response = await Promise.race([
      controller.signal.aborted ? aborted : execute(controller.signal),
      aborted,
    ]);
  } catch {
    response = patternErrorResponse(
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
