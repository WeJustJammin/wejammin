import {
  ApiErrorSchema,
  type CmsEditorialRoutePolicy,
} from '@wejammin/contracts';

import {
  REGISTERED_CONFLICT_KINDS,
  REGISTERED_REASON_CODES,
  REGISTERED_RECOVERY_ACTIONS,
} from './error-vocabulary';
import {
  clampRetryAfterSeconds,
  normalizedError,
  safeDetails,
} from './route-error-details';
import type { CmsEditorialDependencies, CmsEditorialError } from './types';

/**
 * Error envelopes for the CMS editorial routes: the safe-read boundary shared by
 * CMS-03B-12/13/14, the common no-store headers with the allowlisted human
 * origin, and the single `ApiError` response builder every route uses.
 */

const READ_ERROR_CODE_BY_STATUS: Readonly<Record<number, string>> = {
  400: 'INVALID_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'VALIDATION_FAILED',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
  502: 'BAD_GATEWAY',
  503: 'DEPENDENCY_UNAVAILABLE',
  504: 'GATEWAY_TIMEOUT',
};

const READ_REASON_CODES = new Set([
  'ASSIGNMENT_REQUIRED',
  'CAPABILITY_REQUIRED',
  'concealed',
  'cursor_context_mismatch',
  'entry_not_assigned',
]);

/**
 * Read-route canonical message per status. A private RPC message is never
 * published on a safe read, so a dependency error is re-worded from the route
 * while its already-allowlisted details survive. A 404 conceals to empty
 * details so a hidden and an absent target are indistinguishable.
 */
const READ_ERROR_MESSAGES: Readonly<Record<number, string>> = {
  400: 'The CMS editorial request is invalid.',
  401: 'Sign in again to edit this entry.',
  403: 'The CMS editorial action is not allowed.',
  404: 'The requested CMS editorial resource was not found.',
  409: 'The CMS editorial resource changed; reload and try again.',
  415: 'The route does not accept request media.',
  422: 'The CMS editorial request failed validation.',
  429: 'Too many CMS editorial requests.',
  500: 'An unexpected error occurred.',
  502: 'The CMS editorial dependency returned invalid data.',
  503: 'The CMS editorial dependency is temporarily unavailable.',
  504: 'The CMS editorial dependency exceeded its deadline.',
};

/**
 * Safe-read error boundary. A private port is untrusted at this boundary: its
 * code/status pair must be one of the operation's declared matrix cells, so a
 * status the route's row does not declare (for example a 409 on CMS-03B-12/14)
 * fails closed as a scrubbed 500 rather than being reworded into a caller error.
 * CMS-03B-13 declares 409 for a well-formed signed cursor that is expired,
 * tampered or foreign-bound (DEC-140), and it is published as such. Details are
 * projected per status, never copied wholesale from dependency output.
 */
const normalizedReadError = (
  error: CmsEditorialError,
  routePolicy: CmsEditorialRoutePolicy,
): CmsEditorialError => {
  const declaredStatuses = new Set(
    Object.values(routePolicy.errors) as readonly number[],
  );
  const status =
    declaredStatuses.has(error.status) &&
    READ_ERROR_CODE_BY_STATUS[error.status] !== undefined
      ? error.status
      : 500;
  const code = READ_ERROR_CODE_BY_STATUS[status] as string;
  const source = error.details ?? {};
  const details: Record<string, unknown> = {};
  if (status === 400 || status === 422) {
    const projected = safeDetails(error);
    if (Array.isArray(projected.violations))
      details.violations = projected.violations;
    if (
      status === 422 &&
      typeof source.reasonCode === 'string' &&
      REGISTERED_REASON_CODES.has(source.reasonCode)
    )
      details.reasonCode = source.reasonCode;
  } else if (status === 409) {
    if (
      typeof source.conflict === 'string' &&
      REGISTERED_CONFLICT_KINDS.has(source.conflict)
    )
      details.conflict = source.conflict;
    if (
      typeof source.recoveryAction === 'string' &&
      REGISTERED_RECOVERY_ACTIONS.has(source.recoveryAction)
    )
      details.recoveryAction = source.recoveryAction;
  } else if (status === 403) {
    const reasonCode = source.reasonCode;
    if (typeof reasonCode === 'string' && READ_REASON_CODES.has(reasonCode))
      details.reasonCode = reasonCode;
  } else if (status === 415) {
    // All three Slice 10 reads reject request media, so no media is allowed.
    details.allowedMediaTypes = [];
  } else if (status === 429) {
    const limit = source.limit;
    if (
      typeof limit === 'number' &&
      Number.isSafeInteger(limit) &&
      limit >= 1 &&
      limit <= 10_000
    )
      details.limit = limit;
    const resetAt = source.resetAt;
    if (typeof resetAt === 'string' && /^\d{1,12}$/u.test(resetAt))
      details.resetAt = resetAt;
    details.retryAfterSeconds = clampRetryAfterSeconds(
      error.retryAfterSeconds ?? source.retryAfterSeconds,
    );
  } else if (status === 401) {
    details.recoveryAction = 'reauthenticate';
  } else if (status === 502) {
    details.dependencyClass = 'cms_editorial';
    details.retryable = false;
  } else if (status === 503 || status === 504) {
    details.dependencyClass = 'cms_editorial';
    details.retryable = true;
  }
  return {
    ok: false,
    status: status as CmsEditorialError['status'],
    code,
    // Every status READ_ERROR_CODE_BY_STATUS can yield has a canonical message.
    message: READ_ERROR_MESSAGES[status] as string,
    details,
    ...(status === 503 || status === 504
      ? { retryAfterSeconds: 5 }
      : status === 429
        ? {
            retryAfterSeconds: clampRetryAfterSeconds(
              error.retryAfterSeconds ?? source.retryAfterSeconds,
            ),
          }
        : {}),
  };
};

/**
 * CMS-03B-12/13/14 share this read-error envelope: the canonical route message
 * replaces the dependency text and every status runs through the allowlist, so
 * a concealed 404 keeps empty details while a visible 403 keeps its bounded
 * reason code.
 */
export const sanitizeReadError = (
  error: CmsEditorialError,
  routePolicy?: CmsEditorialRoutePolicy,
): CmsEditorialError =>
  routePolicy
    ? normalizedReadError(error, routePolicy)
    : {
        ...error,
        message:
          READ_ERROR_MESSAGES[error.status] ??
          'The CMS editorial request could not be completed.',
        details: error.status === 404 ? {} : safeDetails(error),
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

/**
 * The error exactly as it is published: the single normalization every route
 * response and every telemetry event derives from, so an event can never carry
 * a code, status or detail the client did not see.
 */
export const publishedError = (
  failure: CmsEditorialError,
  routePolicy?: CmsEditorialRoutePolicy,
): CmsEditorialError =>
  routePolicy
    ? normalizedReadError(failure, routePolicy)
    : normalizedError(failure);

export const errorResponse = (
  request: Request,
  dependencies: CmsEditorialDependencies,
  requestId: string,
  failure: CmsEditorialError,
  additionalHeaders?: Headers,
  routePolicy?: CmsEditorialRoutePolicy,
): Response => {
  const error = publishedError(failure, routePolicy);
  const headers = commonHeaders(request, dependencies, requestId);
  headers.set('content-type', 'application/json; charset=UTF-8');
  if (error.status >= 500)
    headers.set(
      'x-cms-editorial-retryable',
      error.status === 502 || error.status === 500 ? 'false' : 'true',
    );
  if (error.retryAfterSeconds !== undefined)
    headers.set(
      'retry-after',
      String(clampRetryAfterSeconds(error.retryAfterSeconds)),
    );
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
