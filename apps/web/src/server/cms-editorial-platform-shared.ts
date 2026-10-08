import { ApiErrorSchema, createRequestId } from '@wejammin/contracts';

import { cmsEditorialZodViolations } from './cms-editorial-platform-error-details';

/**
 * Shared primitives for the CMS editorial web boundary (CMS-03B-10 create and
 * CMS-03B-11 protected draft read).
 *
 * These helpers mirror the established first-party proxy pattern in
 * `content-schema-registry-platform-*`: allowlisted cookie forwarding, a
 * same-origin check, a CSRF cookie/header match, bounded printable tokens, and
 * a disclosure-safe local `ApiError`. They own transport hygiene only; the
 * API Worker still verifies the session and applies domain policy.
 */

export type CmsEditorialPlatformApiBinding = Readonly<{
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}>;

export const CMS_EDITORIAL_PLATFORM_API_ORIGIN =
  'https://platform-api.internal';

/** Session cookies the browser may present; nothing else is forwarded. */
export const CMS_EDITORIAL_SESSION_COOKIE_NAMES: ReadonlySet<string> = new Set([
  'wj_access',
  'wj_refresh',
  'wj_session_ref',
  'wj_csrf',
  'wj_auth_flow',
]);

export const isCmsEditorialPlatformBinding = (
  value: unknown,
): value is CmsEditorialPlatformApiBinding =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { fetch?: unknown }).fetch === 'function';

export const cmsEditorialPrintableToken = (
  value: string | null,
  maximum: number,
): boolean =>
  value !== null &&
  value.length > 0 &&
  value.length <= maximum &&
  /^[\x20-\x7e]+$/u.test(value);

export const cmsEditorialFilteredCookieHeader = (
  request: Request,
): string | null => {
  const raw = request.headers.get('cookie');
  if (raw === null) return null;
  const cookies = raw
    .split(';')
    .map((part) => part.trim())
    .filter((part) => {
      const separator = part.indexOf('=');
      return (
        separator > 0 &&
        CMS_EDITORIAL_SESSION_COOKIE_NAMES.has(part.slice(0, separator))
      );
    });
  return cookies.length > 0 ? cookies.join('; ') : null;
};

export const cmsEditorialCsrfCookie = (request: Request): string | null => {
  const cookie = request.headers.get('cookie');
  if (cookie === null) return null;
  for (const part of cookie.split(';')) {
    const separator = part.indexOf('=');
    if (separator <= 0 || part.slice(0, separator).trim() !== 'wj_csrf')
      continue;
    return part.slice(separator + 1).trim();
  }
  return null;
};

export const cmsEditorialSameOriginRequest = (request: Request): boolean => {
  let requestOrigin: string;
  try {
    requestOrigin = new URL(request.url).origin;
  } catch {
    return false;
  }
  const origin = request.headers.get('origin');
  if (origin !== null && origin !== requestOrigin) return false;
  const referer = request.headers.get('referer');
  if (origin === null && referer !== null) {
    try {
      if (new URL(referer).origin !== requestOrigin) return false;
    } catch {
      return false;
    }
  }
  return true;
};

export const cmsEditorialErrorMessage = (code: string): string => {
  switch (code) {
    case 'INVALID_REQUEST':
      return 'The entry request is invalid.';
    case 'UNAUTHENTICATED':
      return 'Sign in to continue editing.';
    case 'FORBIDDEN':
      return 'You do not have permission for this entry.';
    case 'NOT_FOUND':
      return 'The requested entry is not available.';
    case 'CONFLICT':
      return 'The entry changed. Review the current version before retrying.';
    case 'UNSUPPORTED_MEDIA_TYPE':
      return 'Use a JSON entry request.';
    case 'VALIDATION_FAILED':
      return 'Check the highlighted entry fields.';
    case 'RATE_LIMITED':
      return 'Too many entry changes. Try again shortly.';
    case 'BAD_GATEWAY':
      return 'The entry service returned invalid data.';
    case 'DEPENDENCY_UNAVAILABLE':
      return 'The entry service is temporarily unavailable.';
    case 'GATEWAY_TIMEOUT':
      return 'The entry service did not respond in time.';
    default:
      return 'The entry request could not be completed.';
  }
};

export const cmsEditorialErrorCodeForStatus = (status: number): string => {
  if (status === 401) return 'UNAUTHENTICATED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  if (status === 415) return 'UNSUPPORTED_MEDIA_TYPE';
  if (status === 422) return 'VALIDATION_FAILED';
  if (status === 429) return 'RATE_LIMITED';
  if (status === 502) return 'BAD_GATEWAY';
  if (status === 503) return 'DEPENDENCY_UNAVAILABLE';
  if (status === 504) return 'GATEWAY_TIMEOUT';
  if (status >= 500) return 'INTERNAL_ERROR';
  return 'INVALID_REQUEST';
};

export const cmsEditorialLocalError = (
  request: Request,
  status: number,
  code = cmsEditorialErrorCodeForStatus(status),
  message = cmsEditorialErrorMessage(code),
  details: Readonly<Record<string, unknown>> = {},
): Response => {
  const requestId = createRequestId(
    request.headers.get('x-request-id') ?? undefined,
  );
  const headers = new Headers({
    'cache-control': 'no-store',
    'x-request-id': requestId,
  });
  if (status === 429 || status === 503 || status === 504)
    headers.set('retry-after', '5');
  return Response.json(
    ApiErrorSchema.parse({ code, details, message, requestId }),
    { status, headers },
  );
};

/**
 * A local validation refusal in the Worker's exact shape: a bounded
 * `details.violations` list of `{ path, code, message }` over safe JSON
 * pointers, never an echoed value.
 */
export const cmsEditorialValidationError = (
  request: Request,
  status: 400 | 422,
  issues: Parameters<typeof cmsEditorialZodViolations>[0],
): Response =>
  cmsEditorialLocalError(request, status, undefined, undefined, {
    violations: cmsEditorialZodViolations(issues),
  });

/** The Worker's 422 for a path/body or header/body disagreement: `/member`. */
export const cmsEditorialMismatchError = (
  request: Request,
  member: string,
): Response =>
  cmsEditorialLocalError(request, 422, undefined, undefined, {
    violations: [
      {
        path: `/${member}`,
        code: 'mismatch',
        message: 'The value is invalid.',
      },
    ],
  });

/** A malformed path identifier: 400 INVALID_REQUEST naming the parameter. */
export const cmsEditorialPathError = (
  request: Request,
  parameter: string,
): Response =>
  cmsEditorialLocalError(request, 400, undefined, undefined, {
    violations: [
      {
        path: `/${parameter}`,
        code: 'invalid_uuid',
        message: 'The value is invalid.',
      },
    ],
  });

/**
 * Marks a write response whose effect on the server is not known: the command
 * may have committed even though the browser did not receive a verified
 * success. The browser keeps its Idempotency-Key and replays the identical
 * request; the same key returns the first outcome without a second effect
 * (BE03b:1427). A definite refusal never carries the marker.
 */
export const CMS_EDITORIAL_OUTCOME_HEADER = 'x-cms-editorial-outcome';

export const cmsEditorialOutcomeUnknown = (response: Response): Response => {
  response.headers.set(CMS_EDITORIAL_OUTCOME_HEADER, 'unknown');
  return response;
};

const FORWARD_REQUEST_HEADER_NAMES = [
  'x-correlation-id',
  'x-client-binding-id',
] as const;

/**
 * Build the allowlisted upstream header set: JSON accept, no-store, the
 * filtered session cookies, and the two correlation headers. The caller adds
 * the operation-specific headers (CSRF, idempotency, If-Match).
 */
export const cmsEditorialForwardHeaders = (request: Request): Headers => {
  const headers = new Headers({
    accept: 'application/json',
    'cache-control': 'no-store',
  });
  const cookie = cmsEditorialFilteredCookieHeader(request);
  if (cookie !== null) headers.set('cookie', cookie);
  for (const name of FORWARD_REQUEST_HEADER_NAMES) {
    const value = request.headers.get(name);
    if (cmsEditorialPrintableToken(value, 128))
      headers.set(name, value as string);
  }
  return headers;
};

const FORWARD_RESPONSE_HEADER_NAMES = new Set([
  'allow',
  'cache-control',
  'content-language',
  'content-type',
  'etag',
  'location',
  'ratelimit-limit',
  'ratelimit-remaining',
  'ratelimit-reset',
  'retry-after',
  'vary',
  'x-correlation-id',
  'x-request-id',
]);

export const cmsEditorialCopyResponseHeaders = (source: Response): Headers => {
  const headers = new Headers();
  source.headers.forEach((value, name) => {
    if (FORWARD_RESPONSE_HEADER_NAMES.has(name.toLowerCase()))
      headers.append(name, value);
  });
  headers.set('cache-control', 'no-store');
  return headers;
};
