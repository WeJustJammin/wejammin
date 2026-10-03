import {
  activeProfileRoutePolicies,
  type ProfileOperationId,
} from '@wejammin/contracts';

import type { WorkerContext } from '../index';
import {
  applyRateHeaders,
  authError,
  decodeJsonBodyText,
  jsonBodyPreflight,
  parseIdempotencyKey,
  parseIfMatch,
  readJsonBodyText,
  rejectUnexpectedQuery,
  responseForAuthError,
  verifyCsrfToken,
  verifySameOrigin,
  type JsonMutationTransport,
} from '../authentication/boundary';
import { isStepUpFresh } from '../authentication/route-support';
import { stepUpRequiredError } from '../authentication/step-up';
import type {
  AuthenticationDependencies,
  AuthenticationError,
  AuthenticationResult,
  AuthenticationSession,
  AuthRateLimitDecision,
} from '../authentication/types';

export const MAX_PROFILE_BODY_BYTES = 256 * 1024;

export const profilePolicy = (operationId: ProfileOperationId) => {
  const policy = activeProfileRoutePolicies.find(
    (candidate) => candidate.operationId === operationId,
  );
  if (policy === undefined)
    throw new Error(`Missing profile route policy ${operationId}`);
  return policy;
};

export const configureProfileRoute = (
  context: WorkerContext,
  operationId: ProfileOperationId,
): void => {
  context.set('operation', operationId);
};

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

const withProfileBoundaryDetails = (
  error: AuthenticationError,
): AuthenticationError => {
  if (error.code === 'UNSUPPORTED_MEDIA_TYPE')
    return { ...error, details: { allowedMediaTypes: ['application/json'] } };
  if (error.code === 'PAYLOAD_TOO_LARGE')
    return { ...error, details: { maxBytes: MAX_PROFILE_BODY_BYTES } };
  return error;
};

/**
 * BE00 step 2 for a profile command: for a session command the same-origin
 * check comes first and the session-bound CSRF token after the content type; a
 * public command (no session) has neither. The raw body is read here, and JSON
 * syntax plus strict Zod validation run later (step 6) through `decode`.
 */
export const admitProfileTransport = async (
  request: Request,
  authenticated: boolean,
): Promise<AuthenticationResult<JsonMutationTransport>> => {
  if (authenticated) {
    const origin = verifySameOrigin(request);
    if (origin !== null) return origin;
  }
  const preflight = jsonBodyPreflight(request);
  if (preflight !== null) return withProfileBoundaryDetails(preflight);
  // Only a cookie session is CSRF-exposed; a request carrying no session
  // cookie proceeds to authentication and is refused there (401).
  if (
    authenticated &&
    /(?:^|;\s*)wj_session_ref=/u.test(request.headers.get('cookie') ?? '')
  ) {
    const csrf = await verifyCsrfToken(request);
    if (csrf !== null) return csrf;
  }
  const text = await readJsonBodyText(request);
  if (!text.ok) return withProfileBoundaryDetails(text);
  return {
    ok: true,
    value: { decode: (schema) => decodeJsonBodyText(text.value, schema) },
  };
};

export const requireProfileStepUp = (
  session: AuthenticationSession,
): AuthenticationError | null =>
  isStepUpFresh(session, Date.now()) ? null : stepUpRequiredError();

export const parseProfileQuery = (
  request: Request,
): AuthenticationError | null => rejectUnexpectedQuery(request);

export const parseProfileCommandHeaders = (
  request: Request,
  ifMatchRequired: boolean,
): AuthenticationResult<
  Readonly<{ idempotencyKey: string; ifMatch?: string }>
> => {
  const idempotency = parseIdempotencyKey(request);
  if (!idempotency.ok) return idempotency;

  if (!ifMatchRequired && request.headers.has('if-match')) {
    return authError(400, 'INVALID_REQUEST', 'If-Match is not accepted here.');
  }
  if (!ifMatchRequired)
    return { ok: true, value: { idempotencyKey: idempotency.value } };

  const rawIfMatch = request.headers.get('if-match');
  if (!/^"[1-9][0-9]{0,18}"$/u.test(rawIfMatch ?? '')) {
    return authError(
      400,
      'INVALID_REQUEST',
      'A valid If-Match version is required.',
    );
  }
  const ifMatch = parseIfMatch(request);
  if (!ifMatch.ok) return ifMatch;
  return {
    ok: true,
    value: { idempotencyKey: idempotency.value, ifMatch: ifMatch.value },
  };
};

export const parseProfilePath = <T>(
  schema: SchemaLike<T>,
  value: unknown,
): AuthenticationResult<T> => {
  const parsed = schema.safeParse(value);
  if (parsed.success) return { ok: true, value: parsed.data };
  return authError(422, 'VALIDATION_FAILED', 'Check the highlighted fields.', {
    violations: parsed.error.issues.slice(0, 16).map((issue) => ({
      path: `/${issue.path.map(String).join('/')}`,
      code: issue.message,
      message: 'The value is invalid.',
    })),
  });
};

const hasSessionCredential = (request: Request): boolean => {
  const cookie = request.headers.get('cookie') ?? '';
  if (/(?:^|;\s*)wj_session_ref=[^;\s]+/u.test(cookie)) return true;
  return /^Bearer\s+\S+$/u.test(request.headers.get('authorization') ?? '');
};

export const requireProfileSession = async (
  context: WorkerContext,
  auth: AuthenticationDependencies | undefined,
): Promise<AuthenticationResult<AuthenticationSession>> => {
  if (!hasSessionCredential(context.req.raw)) {
    return authError(401, 'UNAUTHENTICATED', 'Sign in is required.', {
      recoveryAction: 'reauthenticate',
    });
  }
  if (auth === undefined) {
    return authError(
      503,
      'DEPENDENCY_UNAVAILABLE',
      'Authentication is temporarily unavailable.',
      { dependencyClass: 'authentication', retryable: true },
    );
  }
  let resolved: AuthenticationResult<AuthenticationSession>;
  try {
    resolved = await auth.resolveSession(
      context.req.raw,
      context.env,
      new AbortController().signal,
    );
  } catch {
    return authError(
      503,
      'DEPENDENCY_UNAVAILABLE',
      'Authentication is temporarily unavailable.',
      { dependencyClass: 'authentication', retryable: true },
    );
  }
  if (!resolved.ok) return resolved;
  if (
    resolved.value.personId === null ||
    resolved.value.actingPartyId === null
  ) {
    return authError(403, 'FORBIDDEN', 'An acting profile is required.', {
      reasonCode: 'acting_context_required',
      recoveryAction: 'select_context',
    });
  }
  return resolved;
};

export const enforceProfileRate = async (
  context: WorkerContext,
  auth: AuthenticationDependencies | undefined,
  operationId: ProfileOperationId,
  session: AuthenticationSession | null,
): Promise<Response | null> => {
  if (auth === undefined) {
    return responseForAuthError(
      context,
      authError(
        503,
        'DEPENDENCY_UNAVAILABLE',
        'Profile rate limiting is temporarily unavailable.',
        { dependencyClass: 'rate_limiter', retryable: true },
      ),
    );
  }
  const policy = profilePolicy(operationId);
  let result: AuthenticationResult<AuthRateLimitDecision>;
  try {
    result = await auth.rateLimit(
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
        'Profile rate limiting is temporarily unavailable.',
        { dependencyClass: 'rate_limiter', retryable: true },
      ),
    );
  }
  if (!result.ok) return responseForAuthError(context, result);
  applyRateHeaders(context, result.value);
  if (result.value.allowed) return null;
  const retryAfterSeconds = Math.max(
    1,
    result.value.resetAt - Math.floor(Date.now() / 1000),
  );
  return responseForAuthError(
    context,
    authError(429, 'RATE_LIMITED', 'Too many requests.', {
      retryAfterSeconds,
      limit: result.value.limit,
      resetAt: result.value.resetAt,
    }),
  );
};
