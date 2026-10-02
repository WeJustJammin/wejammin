import {
  ApiErrorSchema,
  EntryRevisionRequestSchema,
  EntryRevisionResourceSchema,
  cmsEditorialRoutePolicies,
  createRequestId,
} from '@wejammin/contracts';
import { Hono, type Env } from 'hono';

import { invalid, rejectCommandQuery } from './admission-common';
import { parseJsonBody, parseRequestPathId } from './admission-body';
import {
  checkOrigin,
  csrfErrorIfCookie,
  parseEditorialHeaders,
} from './admission-headers';
import {
  requireEditorialCapability,
  validHumanSession,
} from './admission-identity';
import {
  dependencyDeadline,
  dependencyTimedOut,
  dependencyUnavailable,
} from './admission-deadline';
import { emitTelemetry, rateCheck } from './route-execution';
import {
  CMS_EDITORIAL_REVISION_OPERATION_ID,
  CMS_EDITORIAL_RUNBOOK,
  type CmsEditorialDependencies,
  type CmsEditorialError,
  type CmsEditorialPortInput,
  type CmsEditorialResult,
} from './types';

const PATH = '/api/v1/cms/entries/:entryId/revisions';
const policy = cmsEditorialRoutePolicies.find(
  (item) => item.operationId === CMS_EDITORIAL_REVISION_OPERATION_ID,
) as (typeof cmsEditorialRoutePolicies)[number];

const DETAIL_KEYS = [
  'reasonCode',
  'recoveryAction',
  'dependencyClass',
  'retryable',
  'retryAfterSeconds',
  'expectedVersion',
  'currentVersion',
  'limit',
  'resetAt',
] as const;

const safeDetails = (error: CmsEditorialError): Record<string, unknown> => {
  if (error.status === 404 || error.status === 500) return {};
  const source = error.details ?? {};
  const details: Record<string, unknown> = {};
  for (const key of DETAIL_KEYS) {
    const value = source[key];
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    )
      details[key] = value;
  }
  if (
    error.status === 409 &&
    (source.conflict === 'VERSION_MISMATCH' ||
      source.conflict === 'IDEMPOTENCY_MISMATCH' ||
      source.conflict === 'INVALID_TRANSITION')
  )
    details.conflict = source.conflict;
  if (Array.isArray(source.violations)) {
    const violations = source.violations
      .slice(0, 50)
      .filter(
        (value): value is Record<string, unknown> =>
          typeof value === 'object' && value !== null && !Array.isArray(value),
      )
      .map((value) => ({
        path: typeof value.path === 'string' ? value.path.slice(0, 256) : '/',
        code:
          typeof value.code === 'string' ? value.code.slice(0, 128) : 'invalid',
        message: 'The value is invalid.',
      }));
    details.violations = violations;
  }
  return ApiErrorSchema.safeParse({
    code: 'INVALID_REQUEST',
    details,
    message: 'Invalid.',
    requestId: '00000000-0000-4000-8000-000000000000',
  }).success
    ? details
    : {};
};

const normalizedError = (error: CmsEditorialError): CmsEditorialError => {
  if (error.status === 500)
    return {
      ok: false,
      status: 500,
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
      details: {},
    };
  if (error.status === 502)
    return {
      ok: false,
      status: 502,
      code: 'BAD_GATEWAY',
      message: 'The CMS editorial dependency returned invalid data.',
      details: { dependencyClass: 'cms_editorial', retryable: false },
    };
  if (error.status === 504)
    return {
      ok: false,
      status: 504,
      code: 'GATEWAY_TIMEOUT',
      message: 'The CMS editorial dependency exceeded its deadline.',
      details: { dependencyClass: 'cms_editorial', retryable: true },
      retryAfterSeconds: 5,
    };
  if (error.status === 503)
    return {
      ok: false,
      status: 503,
      code: 'DEPENDENCY_UNAVAILABLE',
      message: 'The CMS editorial dependency is temporarily unavailable.',
      details: { dependencyClass: 'cms_editorial', retryable: true },
      retryAfterSeconds: 5,
    };
  if (error.status === 401)
    return {
      ok: false,
      status: 401,
      code: 'UNAUTHENTICATED',
      message: 'Sign in again to edit this entry.',
      details: { recoveryAction: 'reauthenticate' },
    };
  if (error.status === 404)
    return {
      ok: false,
      status: 404,
      code: 'NOT_FOUND',
      message: 'The requested entry is not available.',
      details: {},
    };
  if (error.status === 403)
    return {
      ok: false,
      status: 403,
      code: 'FORBIDDEN',
      message: 'The CMS editorial action is not allowed.',
      details: safeDetails(error),
    };
  if (error.status === 429)
    return {
      ok: false,
      status: 429,
      code: 'RATE_LIMITED',
      message: 'Too many CMS editorial requests.',
      details: safeDetails(error),
      retryAfterSeconds: error.retryAfterSeconds ?? 1,
    };
  return { ...error, details: safeDetails(error) };
};

export const commonHeaders = (
  request: Request,
  dependencies: CmsEditorialDependencies,
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

export const errorResponse = (
  request: Request,
  dependencies: CmsEditorialDependencies,
  requestId: string,
  failure: CmsEditorialError,
  additionalHeaders?: Headers,
): Response => {
  const error = normalizedError(failure);
  const headers = commonHeaders(request, dependencies, requestId);
  headers.set('content-type', 'application/json; charset=UTF-8');
  if (error.status >= 500)
    headers.set(
      'x-cms-editorial-retryable',
      error.status === 502 || error.status === 500 ? 'false' : 'true',
    );
  if (error.retryAfterSeconds !== undefined)
    headers.set('retry-after', String(error.retryAfterSeconds));
  const publishedDetails = safeDetails(error);
  additionalHeaders?.forEach((value, name) => headers.set(name, value));
  if (error.status === 429) {
    if (typeof publishedDetails.limit === 'number')
      headers.set('ratelimit-limit', String(publishedDetails.limit));
    if (typeof publishedDetails.resetAt === 'string')
      headers.set('ratelimit-reset', publishedDetails.resetAt);
  }
  const payload = ApiErrorSchema.parse({
    code: error.code,
    message: error.message,
    details: publishedDetails,
    requestId,
  });
  return new Response(JSON.stringify(payload), {
    status: error.status,
    headers,
  });
};

export const registerCmsEditorialRoutes = <E extends Env>(
  app: Hono<E>,
  dependencies: CmsEditorialDependencies,
): void => {
  app.options(PATH, (context) => {
    const request = context.req.raw;
    const origin = request.headers.get('origin');
    const requestId = createRequestId(
      request.headers.get('x-request-id') ?? undefined,
    );
    if (origin === null || !dependencies.humanOrigins.includes(origin))
      return errorResponse(request, dependencies, requestId, {
        ok: false,
        status: 403,
        code: 'FORBIDDEN',
        message: 'The request origin is not allowed.',
      });
    const headers = commonHeaders(request, dependencies, requestId);
    headers.set('access-control-allow-methods', 'GET, POST, OPTIONS');
    headers.set(
      'access-control-allow-headers',
      'Content-Type, Idempotency-Key, If-Match, X-CSRF-Token, X-Request-Id',
    );
    return new Response(null, { status: 204, headers });
  });

  app.post(PATH, async (context) => {
    const request = context.req.raw;
    const requestId = createRequestId(
      request.headers.get('x-request-id') ?? undefined,
    );
    const deadlineAt =
      performance.now() + (dependencies.deadlineMs ?? policy.timeoutMs);
    const withinDeadline = <T>(
      invoke: (signal: AbortSignal) => Promise<CmsEditorialResult<T>>,
    ): Promise<CmsEditorialResult<T>> => {
      const remainingMs = Math.ceil(deadlineAt - performance.now());
      return remainingMs <= 0
        ? Promise.resolve(dependencyTimedOut())
        : dependencyDeadline(invoke, remainingMs);
    };
    const startedAt = dependencies.now?.() ?? Date.now();
    const finish = async (response: Response): Promise<Response> => {
      void emitTelemetry(dependencies, {
        operationId: CMS_EDITORIAL_REVISION_OPERATION_ID,
        requestId,
        outcome:
          response.status < 400
            ? 'success'
            : response.status < 500
              ? 'rejected'
              : 'failure',
        status: response.status,
        durationMs: Math.max(
          0,
          (dependencies.now?.() ?? Date.now()) - startedAt,
        ),
        actorClass: 'human',
        runbook: CMS_EDITORIAL_RUNBOOK,
      });
      return response;
    };
    const fail = (error: CmsEditorialError, headers?: Headers) =>
      finish(errorResponse(request, dependencies, requestId, error, headers));

    const originError = checkOrigin(request, dependencies.humanOrigins);
    if (originError !== null) return fail(originError);
    const queryError = rejectCommandQuery(request);
    if (queryError !== null) return fail(queryError);
    const path = parseRequestPathId(context.req.param('entryId'));
    if (!path.ok) return fail(path);
    const media = request.headers.get('content-type')?.split(';')[0]?.trim();
    if (media !== 'application/json')
      return fail(invalid('Use application/json.', {}, 415));
    const headers = parseEditorialHeaders(request);
    if (!headers.ok) return fail(headers);
    const csrfError = csrfErrorIfCookie(request);
    if (csrfError !== null) return fail(csrfError);
    const body = await withinDeadline((signal) =>
      parseJsonBody<ReturnType<typeof EntryRevisionRequestSchema.parse>>(
        request,
        EntryRevisionRequestSchema,
        signal,
      ),
    );
    if (!body.ok) return fail(body);
    if (body.value.entryId !== path.value)
      return fail(
        invalid(
          'The entry path and body do not match.',
          {
            violations: [
              {
                path: '/entryId',
                code: 'mismatch',
                message: 'The value is invalid.',
              },
            ],
          },
          422,
        ),
      );
    const identity = await withinDeadline((signal) =>
      dependencies.resolveSession(request, signal),
    );
    if (!identity.ok) return fail(identity);
    const invalidSession = validHumanSession(identity.value);
    if (invalidSession !== null) return fail(invalidSession);
    const capabilityError = requireEditorialCapability(
      identity.value,
      policy.capabilities,
      policy.capabilityMode,
    );
    if (capabilityError !== null) return fail(capabilityError);
    const rate = await rateCheck(
      request,
      dependencies,
      identity.value,
      policy,
      deadlineAt,
    );
    if (!rate.ok) {
      const rateHeaders = new Headers();
      if (rate.status === 429) {
        rateHeaders.set('ratelimit-limit', String(policy.rateLimit));
        rateHeaders.set('ratelimit-remaining', '0');
      }
      return fail(rate, rateHeaders);
    }
    if (typeof dependencies.ports.appendRevision !== 'function')
      return fail(dependencyUnavailable());
    const input: CmsEditorialPortInput = {
      operationId: CMS_EDITORIAL_REVISION_OPERATION_ID,
      requestId,
      request,
      session: identity.value,
      path: { entryId: path.value },
      body: body.value,
      idempotencyKey: headers.value.idempotencyKey,
      ifMatch: headers.value.ifMatch,
    };
    const result = await withinDeadline((signal) =>
      dependencies.ports.appendRevision(input, signal),
    );
    if (!result.ok) return fail(result);
    const parsed = EntryRevisionResourceSchema.safeParse(result.value);
    if (!parsed.success)
      return fail({
        ok: false,
        status: 502,
        code: 'BAD_GATEWAY',
        message: 'The CMS editorial dependency returned invalid data.',
      });
    const responseBody = JSON.stringify(parsed.data);
    const etag = `"${parsed.data.version}"`;
    const location = `/api/v1/cms/entries/${path.value}/revisions/${parsed.data.id}`;
    const responseHeaders = commonHeaders(request, dependencies, requestId);
    responseHeaders.set('content-type', 'application/json; charset=UTF-8');
    responseHeaders.set('etag', etag);
    responseHeaders.set('location', location);
    return finish(
      new Response(responseBody, { status: 201, headers: responseHeaders }),
    );
  });
};
