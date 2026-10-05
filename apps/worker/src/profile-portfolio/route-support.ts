import {
  activeProfilePortfolioRoutePolicies,
  type ProfilePortfolioOperationId,
} from '@wejammin/contracts';
import type { ApiError } from '@wejammin/contracts';

import type { WorkerContext } from '../index';
import {
  applyRateHeaders,
  authError,
  decodeJsonBodyText,
  jsonBodyPreflight,
  parseIdempotencyKey,
  parseIfMatch,
  readJsonBodyText,
  responseForAuthError,
  type JsonMutationTransport,
} from '../authentication/boundary';
import type {
  AuthenticationDependencies,
  AuthenticationError,
  AuthenticationResult,
  AuthenticationSession,
  AuthRateLimitDecision,
} from '../authentication/types';

import { checkProfilePortfolioCsrf, checkSameOrigin } from './route-admission';

export const MAX_PROFILE_PORTFOLIO_BODY_BYTES = 256 * 1024;

export type SchemaLike<T> = Readonly<{
  safeParse: (value: unknown) =>
    | Readonly<{ success: true; data: T }>
    | Readonly<{
        success: false;
        error: Readonly<{
          issues: readonly Readonly<{
            path: readonly PropertyKey[];
            message: string;
          }>[];
        }>;
      }>;
}>;

export const profilePortfolioPolicy = (
  operationId: ProfilePortfolioOperationId,
) => {
  const policy = activeProfilePortfolioRoutePolicies.find(
    (candidate) => candidate.operationId === operationId,
  );
  if (policy === undefined)
    throw new Error(`Missing profile portfolio policy ${operationId}`);
  return policy;
};

export const configureProfilePortfolioRoute = (
  context: WorkerContext,
  operationId: ProfilePortfolioOperationId,
): void => context.set('operation', operationId);

const violations = (
  issues: readonly Readonly<{
    path: readonly PropertyKey[];
    message: string;
  }>[],
): ApiError['details'] => ({
  violations: issues.slice(0, 16).map((issue) => ({
    path: `/${issue.path.map(String).join('/')}`,
    code: issue.message,
    message: 'The value is invalid.',
  })),
});

export const parseProfilePath = <T>(
  schema: SchemaLike<T>,
  value: unknown,
): AuthenticationResult<T> => {
  const parsed = schema.safeParse(value);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : authError(
        422,
        'VALIDATION_FAILED',
        'Check the highlighted fields.',
        violations(parsed.error.issues),
      );
};

export const parseProfileQuery = <T>(
  request: Request,
  schema: SchemaLike<T>,
  allowed: readonly string[],
  defaults: Readonly<Record<string, string>> = {},
): AuthenticationResult<T> => {
  const params = new URL(request.url).searchParams;
  const value: Record<string, string> = { ...defaults };
  for (const key of params.keys()) {
    if (!allowed.includes(key) || params.getAll(key).length !== 1)
      return authError(
        400,
        'INVALID_REQUEST',
        'The query parameters are invalid.',
      );
    value[key] = params.get(key) as string;
  }
  const parsed = schema.safeParse(value);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : authError(
        400,
        'INVALID_REQUEST',
        'The query parameters are invalid.',
        violations(parsed.error.issues),
      );
};

/**
 * BE00 step 2 for a profile portfolio command: the same-origin check, the body
 * ceiling, the content type and, for a request carrying a session cookie, the
 * session-bound CSRF token, then the raw body. JSON syntax and strict Zod
 * validation run later (step 6) through `decode`.
 */
export const admitProfileCommandTransport = async (
  context: WorkerContext,
): Promise<AuthenticationResult<JsonMutationTransport>> => {
  const origin = checkSameOrigin(context);
  if (!origin.ok) return origin;
  const preflight = jsonBodyPreflight(context.req.raw);
  if (preflight !== null) return boundaryDetails(preflight);
  if (/(?:^|;\s*)wj_session_ref=/u.test(context.req.header('cookie') ?? '')) {
    const csrf = await checkProfilePortfolioCsrf(context);
    if (!csrf.ok) return csrf;
  }
  const text = await readJsonBodyText(context.req.raw);
  if (!text.ok) return boundaryDetails(text);
  return {
    ok: true,
    value: { decode: (schema) => decodeJsonBodyText(text.value, schema) },
  };
};

const boundaryDetails = (error: AuthenticationError): AuthenticationError => {
  if (error.code === 'PAYLOAD_TOO_LARGE')
    return {
      ...error,
      details: { maxBytes: MAX_PROFILE_PORTFOLIO_BODY_BYTES },
    };
  if (error.code === 'UNSUPPORTED_MEDIA_TYPE')
    return { ...error, details: { allowedMediaTypes: ['application/json'] } };
  return error;
};

export const parseProfileCommandHeaders = (
  request: Request,
  ifMatchRequired: boolean,
): AuthenticationResult<
  Readonly<{ idempotencyKey: string; ifMatch?: string }>
> => {
  const idempotency = parseIdempotencyKey(request);
  if (!idempotency.ok) return idempotency;
  if (!ifMatchRequired && request.headers.has('if-match'))
    return authError(400, 'INVALID_REQUEST', 'If-Match is not accepted here.');
  if (!ifMatchRequired)
    return { ok: true, value: { idempotencyKey: idempotency.value } };
  if (!/^"[1-9][0-9]{0,18}"$/u.test(request.headers.get('if-match') ?? ''))
    return authError(
      400,
      'INVALID_REQUEST',
      'A valid If-Match version is required.',
    );
  const ifMatch = parseIfMatch(request);
  return ifMatch.ok
    ? {
        ok: true,
        value: { idempotencyKey: idempotency.value, ifMatch: ifMatch.value },
      }
    : ifMatch;
};

const hasSessionCredential = (request: Request): boolean => {
  const cookie = request.headers.get('cookie') ?? '';
  return (
    /(?:^|;\s*)wj_session_ref=[^;\s]+/u.test(cookie) ||
    /^Bearer\s+\S+$/u.test(request.headers.get('authorization') ?? '')
  );
};

export const requireProfilePortfolioSession = async (
  context: WorkerContext,
  auth: AuthenticationDependencies | undefined,
): Promise<AuthenticationResult<AuthenticationSession>> => {
  if (!hasSessionCredential(context.req.raw))
    return authError(401, 'UNAUTHENTICATED', 'Sign in is required.', {
      recoveryAction: 'reauthenticate',
    });
  if (auth === undefined)
    return authError(
      503,
      'DEPENDENCY_UNAVAILABLE',
      'Authentication is temporarily unavailable.',
      {
        dependencyClass: 'authentication',
        retryable: true,
      },
    );
  try {
    const result = await auth.resolveSession(
      context.req.raw,
      context.env,
      new AbortController().signal,
    );
    if (!result.ok) return result;
    if (result.value.personId === null || result.value.actingPartyId === null)
      return authError(403, 'FORBIDDEN', 'An acting profile is required.');
    return result;
  } catch {
    return authError(
      503,
      'DEPENDENCY_UNAVAILABLE',
      'Authentication is temporarily unavailable.',
      {
        dependencyClass: 'authentication',
        retryable: true,
      },
    );
  }
};

const localRateState = new Map<string, { count: number; resetAt: number }>();

export const enforceProfilePortfolioRate = async (
  context: WorkerContext,
  operationId: ProfilePortfolioOperationId,
  auth: AuthenticationDependencies | undefined,
  session: AuthenticationSession | null,
): Promise<Response | null> => {
  const policy = profilePortfolioPolicy(operationId);
  if (auth === undefined)
    return responseForAuthError(
      context,
      authError(
        503,
        'DEPENDENCY_UNAVAILABLE',
        'Rate limiting is temporarily unavailable.',
        {
          dependencyClass: 'rate_limiter',
          retryable: true,
        },
      ),
    );
  let decision: AuthenticationResult<AuthRateLimitDecision>;
  try {
    decision = await auth.rateLimit(
      {
        operationId,
        request: context.req.raw,
        authUserId: session?.authUserId ?? null,
        identifierDigest: null,
        limit: policy.rateLimit,
        windowSeconds: policy.rateWindowSeconds,
      },
      context.env,
      new AbortController().signal,
    );
  } catch {
    return responseForAuthError(
      context,
      authError(
        503,
        'DEPENDENCY_UNAVAILABLE',
        'Rate limiting is temporarily unavailable.',
        {
          dependencyClass: 'rate_limiter',
          retryable: true,
        },
      ),
    );
  }
  if (!decision.ok) return responseForAuthError(context, decision);
  const identity =
    session?.authUserId ??
    context.req.header('cf-connecting-ip') ??
    'anonymous';
  const now = Math.floor(Date.now() / 1000);
  const current = localRateState.get(`${operationId}|${identity}`);
  const bucket =
    current === undefined || current.resetAt <= now
      ? { count: 1, resetAt: now + policy.rateWindowSeconds }
      : { count: current.count + 1, resetAt: current.resetAt };
  localRateState.set(`${operationId}|${identity}`, bucket);
  const merged = {
    allowed: decision.value.allowed && bucket.count <= policy.rateLimit,
    limit: policy.rateLimit,
    remaining: Math.max(
      0,
      Math.min(decision.value.remaining, policy.rateLimit - bucket.count),
    ),
    resetAt: Math.max(decision.value.resetAt, bucket.resetAt),
  };
  applyRateHeaders(context, merged);
  if (merged.allowed) return null;
  return responseForAuthError(
    context,
    authError(429, 'RATE_LIMITED', 'Too many requests.', {
      retryAfterSeconds: Math.max(1, merged.resetAt - now),
      limit: merged.limit,
      resetAt: merged.resetAt,
    }),
  );
};

export {
  checkProfilePortfolioCsrf,
  checkSameOrigin,
  producerHeadersValid,
} from './route-admission';
