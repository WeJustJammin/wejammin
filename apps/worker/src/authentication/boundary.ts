import {
  ApiErrorSchema,
  AuthIdempotencyKeySchema,
  AuthStrongVersionSchema,
  type ApiError,
  type RequestId,
} from '@wejammin/contracts';
import type { Context, Env } from 'hono';
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

export const authError = (
  status: AuthenticationError['status'],
  code: string,
  message: string,
  details: ApiError['details'] = {},
): AuthenticationError => ({ ok: false, status, code, message, details });

const requestBodyTimeout = (): AuthenticationError =>
  authError(504, 'UPSTREAM_TIMEOUT', 'The request body timed out.');

const readRequestText = async (
  request: Request,
  signal?: AbortSignal,
): Promise<AuthenticationResult<string>> => {
  if (signal === undefined) {
    try {
      return { ok: true, value: await request.text() };
    } catch {
      return authError(
        400,
        'INVALID_REQUEST',
        'The request body could not be read.',
      );
    }
  }
  if (signal.aborted) return requestBodyTimeout();
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: AuthenticationResult<string>): void => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', onAbort);
      resolve(result);
    };
    const onAbort = (): void => finish(requestBodyTimeout());
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) {
      finish(requestBodyTimeout());
      return;
    }
    let bodyText: Promise<string>;
    try {
      bodyText = request.text();
    } catch {
      finish(
        authError(
          400,
          'INVALID_REQUEST',
          'The request body could not be read.',
        ),
      );
      return;
    }
    void bodyText.then(
      (value) =>
        finish(signal.aborted ? requestBodyTimeout() : { ok: true, value }),
      () =>
        finish(
          authError(
            400,
            'INVALID_REQUEST',
            'The request body could not be read.',
          ),
        ),
    );
  });
};

export const parseJsonBody = async <T>(
  request: Request,
  schema: SchemaLike<T>,
  signal?: AbortSignal,
): Promise<AuthenticationResult<T>> => {
  if (signal?.aborted) return requestBodyTimeout();
  const contentType = request.headers
    .get('content-type')
    ?.split(';')[0]
    ?.trim();
  if (contentType !== 'application/json') {
    return authError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Use application/json.');
  }
  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return authError(
      413,
      'PAYLOAD_TOO_LARGE',
      'The request body is too large.',
    );
  }
  const bodyTextResult = await readRequestText(request, signal);
  if (!bodyTextResult.ok) return bodyTextResult;
  if (signal?.aborted) return requestBodyTimeout();
  const bodyText = bodyTextResult.value;
  if (new TextEncoder().encode(bodyText).byteLength > MAX_BODY_BYTES) {
    return authError(
      413,
      'PAYLOAD_TOO_LARGE',
      'The request body is too large.',
    );
  }
  if (signal?.aborted) return requestBodyTimeout();
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

export const verifySameOriginCsrf = async (
  request: Request,
): Promise<AuthenticationError | null> => {
  const origin = request.headers.get('origin');
  if (origin !== new URL(request.url).origin) {
    return authError(403, 'FORBIDDEN', 'The request origin is not allowed.');
  }
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

export const responseForAuthError = <E extends AuthBoundaryEnvironment>(
  context: AuthBoundaryContext<E>,
  error: AuthenticationError,
): Response => {
  context.set('errorCode', error.code);
  context.header('cache-control', 'no-store');
  if (error.retryAfterSeconds !== undefined) {
    context.header('retry-after', String(error.retryAfterSeconds));
  }
  const payload = ApiErrorSchema.parse({
    code: error.code,
    message: error.message,
    requestId: context.get('requestId'),
    details: error.details ?? {},
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
