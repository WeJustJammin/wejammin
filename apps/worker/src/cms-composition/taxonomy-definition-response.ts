import {
  ApiErrorSchema,
  CMS_03C_CATALOGS,
  CmsVersionSchema,
  createRequestId,
} from '@wejammin/contracts';
import { createDeadline } from '../cms-editorial-production-transport';
import { SERIALIZATION_TOKENS } from '../cms-editorial-production-error-tokens';
import { noteRefusal } from './observability-facts';
import { observeRequest } from './observability-observation';
import { carriesProductToken } from './provider-fault-guard';
import {
  mapCmsEditorialRpcFailure,
  isRecord,
} from '../cms-editorial-production-errors';
import {
  boundedBytes,
  failure,
  type CmsTaxonomyDefinitionDependencies,
  type CmsTaxonomyDefinitionError,
  type TaxonomyOperation,
} from './taxonomy-definition-shared';
import { termActionFailure } from './taxonomy-term-failure';

const safeDetails = (
  error: CmsTaxonomyDefinitionError,
): Record<string, unknown> => {
  const data = isRecord(error.details) ? error.details : {};
  if (error.status === 401) return { recoveryAction: 'reauthenticate' };
  if (error.status === 403)
    return data.reasonCode === 'capability_missing'
      ? { reasonCode: 'capability_missing' }
      : {};
  if (error.status === 415)
    return {
      allowedMediaTypes:
        Array.isArray(data.allowedMediaTypes) &&
        data.allowedMediaTypes.length === 0
          ? []
          : ['application/json'],
    };
  if (error.status === 409)
    return Object.fromEntries(
      ['expectedVersion', 'currentVersion'].flatMap((key) =>
        CmsVersionSchema.safeParse(data[key]).success ? [[key, data[key]]] : [],
      ),
    );
  if (error.status === 400 || error.status === 422) {
    const paths = new Set([
      '/',
      '/taxonomyKey',
      '/shape',
      '/allowedTypeKeys',
      '/allowedFieldKeys',
      '/canonicalOverlapDomains',
      '/expectedVersion',
      '/taxonomyId',
      // CMS-03C-03 (action, key, hierarchy, strings) and CMS-03C-17 (query) pointers
      '/action',
      '/termKey',
      '/parentId',
      '/survivorId',
      '/labels',
      '/aliases',
      '/typeKey',
      '/fieldKey',
      '/locale',
      '/limit',
    ]);
    const violations = Array.isArray(data.violations)
      ? data.violations.slice(0, 50).map((v) => ({
          path:
            isRecord(v) && typeof v.path === 'string' && paths.has(v.path)
              ? v.path
              : '/',
          code: 'invalid',
          message: 'The value is invalid.',
        }))
      : [];
    return violations.length ? { violations } : {};
  }
  if (error.status === 429)
    return Object.fromEntries(
      ['retryAfterSeconds', 'limit', 'resetAt'].flatMap((key) => {
        const value = data[key];
        return (
          key === 'resetAt'
            ? typeof value === 'string' && /^\d{1,16}$/u.test(value)
            : typeof value === 'number' &&
              Number.isSafeInteger(value) &&
              value >= 0
        )
          ? [[key, value]]
          : [];
      }),
    );
  // BE00 172: the DEPENDENCY_UNAVAILABLE member is `retryable: true` on 502, 503 and 504.
  if (error.status >= 502)
    return { dependencyClass: 'cms_composition', retryable: true };
  return {};
};

/** Only this operation's typed reason is licensed; SQL/prose never crosses HTTP. */
export const taxonomyRpcFailure = (
  status: number,
  payload: unknown,
  operation: TaxonomyOperation = 'CMS-03C-16',
): CmsTaxonomyDefinitionError => {
  // A provider fault cannot borrow a caller-refusal token. Only a genuine
  // serialization CAS and the explicit internal-error token precede this gate.
  if (
    isRecord(payload) &&
    payload.code === '40001' &&
    typeof payload.message === 'string' &&
    SERIALIZATION_TOKENS.has(payload.message)
  ) {
    const cas = mapCmsEditorialRpcFailure(status, payload);
    return failure(409, safeDetails(cas));
  }
  if (
    isRecord(payload) &&
    (payload.code === 'INTERNAL_ERROR' ||
      (payload.code === 'P0001' && payload.message === 'INTERNAL_ERROR'))
  )
    return failure(500);
  if (status >= 500) return failure(503, {}, 15);
  if (isRecord(payload)) {
    const token = payload.code === 'P0001' ? payload.message : payload.code;
    if (token === 'capability_missing')
      return failure(403, { reasonCode: 'capability_missing' });
    if (operation === 'CMS-03C-03' && payload.code === 'P0001') {
      const typed = termActionFailure(String(token), payload.details);
      if (typed !== null) return typed;
    }
    // `canonical_source_unavailable` is generated only by CMS-03C-03 (handled above, BE03c 1375); on every other
    // operation it is a reason its catalog does not generate: a scrubbed 500 below (BE03c 1298-1302, decision D-W4).
    for (const expected of [403, 404, 409, 422] as const) {
      if (token === CMS_03C_CATALOGS.taxonomy.codes[expected])
        return failure(
          expected,
          safeDetails(
            failure(expected, isRecord(payload.details) ? payload.details : {}),
          ),
        );
    }
  }
  // A 4xx that carries no product token is a provider fault, not a refusal (BE03c 1298-1302).
  if (!carriesProductToken(payload)) return failure(500);
  const mapped = mapCmsEditorialRpcFailure(status, payload);
  const reason = mapped.details?.reasonCode;
  // A reason of another editorial domain is not generated by this operation's catalog: BE03c 1298-1302, a scrubbed 500.
  if (reason !== undefined && reason !== 'capability_missing')
    return failure(500);
  return failure(mapped.status, safeDetails(mapped), mapped.retryAfterSeconds);
};
export const taxonomyHeaders = (
  request: Request,
  deps: CmsTaxonomyDefinitionDependencies,
  requestId: string,
): Headers => {
  const headers = new Headers({
    'cache-control': 'no-store',
    'x-request-id': requestId,
  });
  const origin = request.headers.get('origin');
  if (origin !== null && deps.humanOrigins.includes(origin)) {
    headers.set('access-control-allow-origin', origin);
    headers.set('access-control-allow-credentials', 'true');
    headers.set('vary', 'Origin');
  }
  return headers;
};
export const taxonomyError = (
  request: Request,
  deps: CmsTaxonomyDefinitionDependencies,
  requestId: string,
  input: CmsTaxonomyDefinitionError,
): Response => {
  const statuses = [400, 401, 403, 404, 409, 415, 422, 429, 500, 502, 503, 504];
  const error = statuses.includes(input.status)
    ? failure(input.status, safeDetails(input), input.retryAfterSeconds)
    : failure(502);
  const headers = taxonomyHeaders(request, deps, requestId);
  headers.set('content-type', 'application/json; charset=UTF-8');
  if (
    [429, 503, 504].includes(error.status) &&
    Number.isSafeInteger(error.retryAfterSeconds) &&
    error.retryAfterSeconds! > 0
  )
    headers.set('retry-after', String(error.retryAfterSeconds));
  if (error.status === 429) {
    headers.set('ratelimit-remaining', '0');
    if (typeof error.details?.limit === 'number')
      headers.set('ratelimit-limit', String(error.details.limit));
    if (typeof error.details?.resetAt === 'string')
      headers.set('ratelimit-reset', error.details.resetAt);
  }
  let body = JSON.stringify(
    ApiErrorSchema.parse({
      code: error.code,
      message: error.message,
      requestId,
      details: safeDetails(error),
    }),
  );
  if (
    new TextEncoder().encode(body).byteLength >
    boundedBytes(deps.maxResponseBytes)
  ) {
    const small = failure(502);
    body = JSON.stringify({
      code: small.code,
      message: small.message,
      requestId,
      details: {},
    });
    return new Response(body, { status: 502, headers });
  }
  // BE03c Observability: the published refusal, reduced to its catalog code and closed members.
  noteRefusal(request, error.status, error.details, error.code);
  return new Response(body, { status: error.status, headers });
};
export const taxonomySuccess = (
  request: Request,
  deps: CmsTaxonomyDefinitionDependencies,
  requestId: string,
  value: unknown,
  version: string,
  status: 200 | 201,
): Response => {
  const body = JSON.stringify(value);
  if (
    new TextEncoder().encode(body).byteLength >
    boundedBytes(deps.maxResponseBytes)
  )
    return taxonomyError(request, deps, requestId, failure(502));
  const headers = taxonomyHeaders(request, deps, requestId);
  headers.set('content-type', 'application/json; charset=UTF-8');
  headers.set('etag', `"${version}"`);
  return new Response(body, { status, headers });
};

/** One route deadline covers every await, including dependencies ignoring abort. */
export const taxonomyOperation = async (
  request: Request,
  deps: CmsTaxonomyDefinitionDependencies,
  operationId: TaxonomyOperation,
  execute: (signal: AbortSignal, requestId: string) => Promise<Response>,
): Promise<Response> => {
  const requestId = createRequestId(
    request.headers.get('x-request-id') ?? undefined,
  );
  const startedAt = deps.now();
  const deadline = createDeadline(
    request.signal,
    Math.min(
      deps.deadlineMs ?? 15000,
      operationId === 'CMS-03C-16' ? 15000 : 8000,
    ),
  );
  let remove!: () => void;
  const aborted = new Promise<Response>((resolve) => {
    const abort = () =>
      resolve(taxonomyError(request, deps, requestId, failure(504, {}, 5)));
    if (deadline.signal.aborted) abort();
    else deadline.signal.addEventListener('abort', abort, { once: true });
    remove = () => deadline.signal.removeEventListener('abort', abort);
  });
  let response: Response;
  try {
    response = deadline.signal.aborted
      ? await aborted
      : await Promise.race([execute(deadline.signal, requestId), aborted]);
  } catch {
    response = taxonomyError(request, deps, requestId, failure(503, {}, 5));
  } finally {
    remove();
    deadline.dispose();
    if (request.body !== null && !request.bodyUsed)
      void request.body.cancel().catch(() => undefined);
  }
  try {
    void Promise.resolve(
      deps.telemetry({
        operationId,
        requestId,
        status: response.status,
        outcome:
          response.status < 400
            ? 'success'
            : response.status < 500
              ? 'rejected'
              : 'failure',
        actorClass: 'human',
        durationMs: Math.max(0, deps.now() - startedAt),
        observation: observeRequest(
          request,
          requestId,
          operationId,
          response.status,
        ),
      }),
    ).catch(() => undefined);
  } catch {
    /* Observability cannot alter the response. */
  }
  return response;
};
