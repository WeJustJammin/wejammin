import {
  ApiErrorSchema,
  AuthIdempotencyKeySchema,
  AuthStrongVersionSchema,
  type ApiError,
  type RequestId,
} from '@wejammin/contracts';
import type { Context, Env } from 'hono';
import {
  decodeBoundedText,
  readBoundedRequestBytes,
} from '../http/bounded-body';
import type {
  AuthenticationError,
  AuthenticationResult,
  AuthRateLimitDecision,
} from './types';

const MAX_BODY_BYTES = 256 * 1024;

type AuthBoundaryEnvironment = Env & {
  Variables: {
    errorCode?: string;
    requestId: RequestId;
  };
};
type AuthBoundaryContext<E extends AuthBoundaryEnvironment> = Pick<
  Context<E>,
  'header' | 'set' | 'get' | 'json'
>;

type IssueLike = Readonly<{ message: string; path: readonly PropertyKey[] }>;
type SchemaLike<T> = Readonly<{
  safeParse: (value: unknown) =>
    | Readonly<{ success: true; data: T }>
    | Readonly<{
        success: false;
        error: Readonly<{ issues: readonly IssueLike[] }>;
      }>;
}>;

const issueDetails = (issues: readonly IssueLike[]): ApiError['details'] => ({
  violations: issues.slice(0, 16).map((issue) => ({
    path: `/${issue.path.map(String).join('/')}`,
    code: issue.message,
    message: 'The value is invalid.',
  })),
});

/**
 * BE00: an `UNAUTHENTICATED` 401 always carries the one allowlisted details
 * row `{ recoveryAction: 'reauthenticate' }` and nothing else, whatever layer
 * (session verifier, provider, persistence) produced it.
 */
const REAUTHENTICATE: ApiError['details'] = Object.freeze({
  recoveryAction: 'reauthenticate',
});

export const authError = (
  status: AuthenticationError['status'],
  code: string,
  message: string,
  details: ApiError['details'] = {},
): AuthenticationError => ({
  ok: false,
  status,
  code,
  message,
  details:
    status === 401 && code === 'UNAUTHENTICATED' ? REAUTHENTICATE : details,
});

const requestBodyTimeout = (): AuthenticationError =>
  authError(504, 'UPSTREAM_TIMEOUT', 'The request body timed out.');

export const ALLOWED_MEDIA_TYPES: readonly string[] = ['application/json'];

/**
 * BE00 step 2 (security/transport) for a JSON body, decided from headers
 * alone: the declared size ceiling, then the content type.
 * `UNSUPPORTED_MEDIA_TYPE` carries the route allowlist (BE00 error table).
 */
export const jsonBodyPreflight = (
  request: Request,
): AuthenticationError | null => {
  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return authError(
      413,
      'PAYLOAD_TOO_LARGE',
      'The request body is too large.',
    );
  }
  const contentType = request.headers
    .get('content-type')
    ?.split(';')[0]
    ?.trim();
  return contentType === 'application/json'
    ? null
    : authError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Use application/json.', {
        allowedMediaTypes: [...ALLOWED_MEDIA_TYPES],
      });
};

/**
 * Raw body text, bounded while it streams: the read stops and the stream is
 * cancelled at `MAX_BODY_BYTES + 1`, so a chunked body cannot force allocation
 * beyond the ceiling before the 413. A declared length is only an early
 * rejection; a malformed one is refused unread.
 */
export const readJsonBodyText = async (
  request: Request,
  signal?: AbortSignal,
): Promise<AuthenticationResult<string>> => {
  const outcome = await readBoundedRequestBytes(request, {
    maxBytes: MAX_BODY_BYTES,
    signal,
  });
  switch (outcome.kind) {
    case 'aborted':
      return requestBodyTimeout();
    case 'too-large':
      return authError(
        413,
        'PAYLOAD_TOO_LARGE',
        'The request body is too large.',
      );
    case 'malformed-length':
      return authError(
        400,
        'INVALID_REQUEST',
        'The Content-Length header is invalid.',
      );
    case 'unreadable':
      return authError(
        400,
        'INVALID_REQUEST',
        'The request body could not be read.',
      );
    case 'ok':
      return signal?.aborted
        ? requestBodyTimeout()
        : { ok: true, value: decodeBoundedText(outcome.bytes) };
  }
};

/** BE00 step 6: JSON syntax and strict Zod on text read at step 2. */
export const decodeJsonBodyText = <T>(
  bodyText: string,
  schema: SchemaLike<T>,
): AuthenticationResult<T> => {
  let body: unknown;
  try {
    body = bodyText === '' ? {} : (JSON.parse(bodyText) as unknown);
  } catch {
    return authError(
      400,
      'INVALID_REQUEST',
      'The request body is not valid JSON.',
    );
  }
  const parsed = schema.safeParse(body);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : authError(
        422,
        'VALIDATION_FAILED',
        'Check the highlighted fields.',
        issueDetails(parsed.error.issues),
      );
};

export const parseJsonBody = async <T>(
  request: Request,
  schema: SchemaLike<T>,
  signal?: AbortSignal,
): Promise<AuthenticationResult<T>> => {
  if (signal?.aborted) return requestBodyTimeout();
  const preflight = jsonBodyPreflight(request);
  if (preflight !== null) return preflight;
  const bodyText = await readJsonBodyText(request, signal);
  return bodyText.ok ? decodeJsonBodyText(bodyText.value, schema) : bodyText;
};

/**
 * BE00 step 2 for a cookie-authenticated JSON mutation: the same-origin CORS
 * check, the body ceiling, the content type and the session-bound CSRF token,
 * then the raw body. JSON syntax and strict Zod validation are BE00 step 6 and
 * run later through `decode`, after the session is verified.
 */
export type JsonMutationTransport = Readonly<{
  decode: <T>(schema: SchemaLike<T>) => AuthenticationResult<T>;
}>;

export const admitJsonMutationTransport = async (
  request: Request,
  signal?: AbortSignal,
): Promise<AuthenticationResult<JsonMutationTransport>> => {
  const origin = verifySameOrigin(request);
  if (origin !== null) return origin;
  const preflight = jsonBodyPreflight(request);
  if (preflight !== null) return preflight;
  const csrf = await verifyCsrfToken(request);
  if (csrf !== null) return csrf;
  const bodyText = await readJsonBodyText(request, signal);
  if (!bodyText.ok) return bodyText;
  return {
    ok: true,
    value: { decode: (schema) => decodeJsonBodyText(bodyText.value, schema) },
  };
};

export const rejectUnexpectedQuery = (
  request: Request,
): AuthenticationError | null =>
  new URL(request.url).searchParams.size === 0
    ? null
    : authError(400, 'INVALID_REQUEST', 'Query parameters are not accepted.');

export const parseIdempotencyKey = (
  request: Request,
): AuthenticationResult<string> => {
  const parsed = AuthIdempotencyKeySchema.safeParse(
    request.headers.get('idempotency-key'),
  );
  return parsed.success
    ? { ok: true, value: parsed.data }
    : authError(400, 'INVALID_REQUEST', 'A valid Idempotency-Key is required.');
};

/** Parse one strong quoted decimal version for mutation CAS. */
export const parseIfMatch = (
  request: Request,
): AuthenticationResult<string> => {
  const parsed = AuthStrongVersionSchema.safeParse(
    request.headers.get('if-match'),
  );
  return parsed.success
    ? { ok: true, value: parsed.data }
    : authError(
        400,
        'INVALID_REQUEST',
        'A valid If-Match version is required.',
      );
};

export const quotedVersion = (version: string): string =>
  version.startsWith('"') ? version : `"${version}"`;

const csrfDigest = async (value: string): Promise<string> =>
  [
    ...new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
    ),
  ]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

const constantTimeEqual = (left: string, right: string): boolean => {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1)
    difference |=
      (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  return difference === 0;
};

export const verifySameOrigin = (
  request: Request,
): AuthenticationError | null =>
  request.headers.get('origin') === new URL(request.url).origin
    ? null
    : authError(403, 'FORBIDDEN', 'The request origin is not allowed.');

/**
 * BE00 step 2 for a cookie-session READ: a read has no body, content type or
 * CSRF token, and a same-origin navigation may omit `Origin`, so an absent
 * header is accepted and a present one must be this origin.
 */
export const verifyReadOrigin = (
  request: Request,
): AuthenticationError | null => {
  const origin = request.headers.get('origin');
  return origin === null || origin === new URL(request.url).origin
    ? null
    : authError(403, 'FORBIDDEN', 'The request origin is not allowed.');
};

export const verifyCsrfToken = async (
  request: Request,
): Promise<AuthenticationError | null> => {
  const cookieToken = request.headers
    .get('cookie')
    ?.split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith('wj_csrf='))
    ?.slice('wj_csrf='.length);
  const headerToken = request.headers.get('x-csrf-token');
  const sessionReference = request.headers
    .get('cookie')
    ?.split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith('wj_session_ref='))
    ?.slice('wj_session_ref='.length);
  const random = cookieToken?.split('.')[0];
  if (
    cookieToken === undefined ||
    headerToken === null ||
    sessionReference === undefined ||
    random === undefined ||
    cookieToken !==
      `${random}.${await csrfDigest(`${sessionReference}\u0000${random}`)}` ||
    !constantTimeEqual(cookieToken, headerToken)
  ) {
    return authError(403, 'FORBIDDEN', 'The CSRF token is invalid.');
  }
  return null;
};

export const verifySameOriginCsrf = async (
  request: Request,
): Promise<AuthenticationError | null> =>
  verifySameOrigin(request) ?? (await verifyCsrfToken(request));

export const applyRateHeaders = <E extends AuthBoundaryEnvironment>(
  context: AuthBoundaryContext<E>,
  decision: AuthRateLimitDecision,
): void => {
  context.header('ratelimit-limit', String(decision.limit));
  context.header('ratelimit-remaining', String(decision.remaining));
  context.header('ratelimit-reset', String(decision.resetAt));
  if (!decision.allowed) {
    const seconds = Math.max(
      1,
      decision.resetAt - Math.floor(Date.now() / 1000),
    );
    context.header('retry-after', String(seconds));
  }
};

/**
 * BE00 `RATE_LIMITED` details row: `retryAfterSeconds` and `limit` as numbers
 * and `resetAt` as an ISO 8601 UTC string, all derived from the same limiter
 * decision that sets `Retry-After` and `RateLimit-*`.
 */
export const rateLimitedDetails = (
  decision: Readonly<{ limit: number; resetAt: number }>,
  nowMs: number = Date.now(),
): Readonly<{ retryAfterSeconds: number; limit: number; resetAt: string }> => ({
  retryAfterSeconds: Math.max(1, decision.resetAt - Math.floor(nowMs / 1000)),
  limit: decision.limit,
  resetAt: new Date(decision.resetAt * 1000).toISOString(),
});

/**
 * BE00 single-decision contract for a 429: the `RateLimit-*` headers,
 * `Retry-After` and the body details are all written from the one decision the
 * error carries (`limit`, `resetAt`, `retryAfterSeconds`), overwriting whatever
 * an earlier, allowing local limiter already set. An error that carries no
 * complete decision came from the limiter that already wrote its own headers
 * for this response, so those headers are left as that decision set them.
 */
const applyCanonical429Headers = <E extends AuthBoundaryEnvironment>(
  context: AuthBoundaryContext<E>,
  error: AuthenticationError,
): void => {
  const details =
    typeof error.details === 'object' && error.details !== null
      ? (error.details as Readonly<Record<string, unknown>>)
      : {};
  const limit = details.limit;
  const resetMs =
    typeof details.resetAt === 'string' ? Date.parse(details.resetAt) : NaN;
  if (
    typeof limit === 'number' &&
    Number.isSafeInteger(limit) &&
    limit >= 1 &&
    Number.isFinite(resetMs)
  ) {
    context.header('ratelimit-limit', String(limit));
    context.header('ratelimit-remaining', '0');
    context.header('ratelimit-reset', String(Math.ceil(resetMs / 1000)));
  }
  const retryAfter =
    typeof details.retryAfterSeconds === 'number'
      ? details.retryAfterSeconds
      : error.retryAfterSeconds;
  if (retryAfter !== undefined)
    context.header('retry-after', String(retryAfter));
};

export const responseForAuthError = <E extends AuthBoundaryEnvironment>(
  context: AuthBoundaryContext<E>,
  error: AuthenticationError,
): Response => {
  context.set('errorCode', error.code);
  context.header('cache-control', 'no-store');
  if (error.status === 429) applyCanonical429Headers(context, error);
  else if (error.retryAfterSeconds !== undefined) {
    context.header('retry-after', String(error.retryAfterSeconds));
  }
  const payload = ApiErrorSchema.parse({
    code: error.code,
    message: error.message,
    requestId: context.get('requestId'),
    details:
      error.status === 401 && error.code === 'UNAUTHENTICATED'
        ? REAUTHENTICATE
        : (error.details ?? {}),
  });
  return context.json(payload, error.status);
};

export const appendCookies = (
  response: Response,
  cookies: readonly string[],
): void => {
  for (const cookie of cookies) response.headers.append('set-cookie', cookie);
};

export const safeIdentifierDigest = async (value: string): Promise<string> => {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};
