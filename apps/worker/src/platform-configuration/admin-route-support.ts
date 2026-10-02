import type { WorkerContext } from '../index';
import { isFreshProof } from '../authentication/step-up';
import {
  applyRateHeaders,
  authError,
  rateLimitedDetails,
  responseForAuthError,
} from '../authentication/boundary';
import type {
  AuthenticationDependencies,
  AuthenticationResult,
  AuthenticationSession,
  AuthRateLimitDecision,
} from '../authentication/types';
import {
  checkProfilePortfolioCsrf,
  checkSameOrigin,
} from '../profile-portfolio/route-admission';
import {
  configurationRatePolicy,
  type ConfigurationPortName,
} from './runtime-helpers';
import type {
  ConfigurationServiceConsumer,
  PlatformConfigurationOperationId,
} from './types';

const hasSessionCredential = (request: Request): boolean => {
  const cookie = request.headers.get('cookie') ?? '';
  return (
    /(?:^|;\s*)wj_session_ref=[^;\s]+/u.test(cookie) ||
    /^Bearer\s+\S+$/u.test(request.headers.get('authorization') ?? '')
  );
};

const isCurrentSession = (session: AuthenticationSession): boolean => {
  const expiresAt = Date.parse(session.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
};

export const requireConfigurationSession = async (
  context: WorkerContext,
  auth: AuthenticationDependencies | undefined,
  actingPartyRequired: boolean,
  signal: AbortSignal = new AbortController().signal,
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
      { dependencyClass: 'authentication', retryable: true },
    );
  try {
    const result = await auth.resolveSession(
      context.req.raw,
      context.env,
      signal,
    );
    if (!result.ok) return result;
    if (!isCurrentSession(result.value))
      return authError(
        401,
        'UNAUTHENTICATED',
        'The authentication session is invalid.',
      );
    if (
      actingPartyRequired &&
      (result.value.personId === null || result.value.actingPartyId === null)
    )
      return authError(403, 'FORBIDDEN', 'An acting context is required.');
    return result;
  } catch {
    return authError(
      503,
      'DEPENDENCY_UNAVAILABLE',
      'Authentication is temporarily unavailable.',
      { dependencyClass: 'authentication', retryable: true },
    );
  }
};

/** DEC-111 window: `-30 s <= now - stepUpAt <= 600 s`, the one shared rule. */
export const isConfigurationStepUpFresh = (
  session: AuthenticationSession,
  nowMs = Date.now(),
): boolean => isFreshProof(session.stepUpAt, nowMs);

const localRateState = new Map<string, { count: number; resetAt: number }>();

export const enforceConfigurationRate = async (
  context: WorkerContext,
  operationId: PlatformConfigurationOperationId,
  auth: AuthenticationDependencies | undefined,
  session: AuthenticationSession | null,
  principal: ConfigurationServiceConsumer | null,
  signal: AbortSignal = new AbortController().signal,
): Promise<Response | null> => {
  const policy = configurationRatePolicy(operationId);
  let remote: AuthenticationResult<AuthRateLimitDecision> | null = null;
  if (auth !== undefined) {
    try {
      remote = await auth.rateLimit(
        {
          operationId,
          request: context.req.raw,
          authUserId: session?.authUserId ?? null,
          actingPartyId: session?.actingPartyId ?? null,
          identifierDigest: null,
          limit: policy.limit,
          windowSeconds: policy.window,
        },
        context.env,
        signal,
      );
    } catch {
      return responseForAuthError(
        context,
        authError(
          503,
          'DEPENDENCY_UNAVAILABLE',
          'Rate limiting is temporarily unavailable.',
          { dependencyClass: 'rate_limiter', retryable: true },
        ),
      );
    }
    if (!remote.ok) return responseForAuthError(context, remote);
  } else if (session !== null) {
    return responseForAuthError(
      context,
      authError(
        503,
        'DEPENDENCY_UNAVAILABLE',
        'Rate limiting is temporarily unavailable.',
        { dependencyClass: 'rate_limiter', retryable: true },
      ),
    );
  }

  const identity = [
    session?.authUserId ?? 'anonymous',
    session?.actingPartyId ?? 'no-party',
    principal?.principalId ??
      context.req.header('cf-connecting-ip') ??
      'anonymous',
  ].join('|');
  const now = Math.floor(Date.now() / 1000);
  const key = `${operationId}|${identity}`;
  const current = localRateState.get(key);
  const bucket =
    current === undefined || current.resetAt <= now
      ? { count: 1, resetAt: now + policy.window }
      : { count: current.count + 1, resetAt: current.resetAt };
  localRateState.set(key, bucket);
  const remoteValue = remote?.ok
    ? remote.value
    : {
        allowed: true,
        limit: policy.limit,
        remaining: Math.max(0, policy.limit - bucket.count),
        resetAt: bucket.resetAt,
      };
  const merged = {
    allowed: remoteValue.allowed && bucket.count <= policy.limit,
    limit: policy.limit,
    remaining: Math.max(
      0,
      Math.min(remoteValue.remaining, policy.limit - bucket.count),
    ),
    resetAt: Math.max(remoteValue.resetAt, bucket.resetAt),
  };
  applyRateHeaders(context, merged);
  if (merged.allowed) return null;
  return responseForAuthError(
    context,
    authError(
      429,
      'RATE_LIMITED',
      'Too many requests.',
      rateLimitedDetails(merged, now * 1000),
    ),
  );
};

export const csrfIfCookie = async (
  context: WorkerContext,
): Promise<AuthenticationResult<null>> => {
  const cookie = context.req.header('cookie') ?? '';
  return /(?:^|;\s*)wj_session_ref=/u.test(cookie)
    ? checkProfilePortfolioCsrf(context)
    : { ok: true, value: null };
};

export const checkConfigurationSameOrigin = checkSameOrigin;

export type ConfigurationRoutePortName = ConfigurationPortName;
