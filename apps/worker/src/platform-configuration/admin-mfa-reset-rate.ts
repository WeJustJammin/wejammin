import type { WorkerContext } from '../index';
import {
  applyRateHeaders,
  authError,
  rateLimitedDetails,
  responseForAuthError,
} from '../authentication/boundary';
import type {
  AuthenticationDependencies,
  AuthenticationError,
  AuthenticationResult,
  AuthenticationSession,
  AuthRateLimitDecision,
} from '../authentication/types';

const OPERATION_ID = 'CFG-05B-06';
const WINDOW_SECONDS = 3600;

/** BE05b CFG-05B-06: 5 per hour per user and 10 per hour per party. */
const BUCKETS = [
  { scope: 'user', limit: 5 },
  { scope: 'party', limit: 10 },
] as const;

const unavailable = (): AuthenticationError =>
  authError(
    503,
    'DEPENDENCY_UNAVAILABLE',
    'Rate limiting is temporarily unavailable.',
    { dependencyClass: 'rate_limiter', retryable: true },
  );

/**
 * Charges the user bucket then the party bucket. The party bucket carries no
 * user id, so the limiter treats it as the quota of the whole party. Either
 * bucket refusing answers 429; a limiter failure fails closed.
 */
export const enforceMfaResetRate = async (
  context: WorkerContext,
  auth: AuthenticationDependencies,
  session: AuthenticationSession,
  signal: AbortSignal,
): Promise<Response | null> => {
  const decisions: AuthRateLimitDecision[] = [];
  for (const bucket of BUCKETS) {
    let decision: AuthenticationResult<AuthRateLimitDecision>;
    try {
      decision = await auth.rateLimit(
        {
          operationId: OPERATION_ID,
          request: context.req.raw,
          authUserId: bucket.scope === 'user' ? session.authUserId : null,
          actingPartyId: session.actingPartyId,
          identifierDigest: null,
          scope: bucket.scope,
          limit: bucket.limit,
          windowSeconds: WINDOW_SECONDS,
        },
        context.env,
        signal,
      );
    } catch {
      return responseForAuthError(context, unavailable());
    }
    if (!decision.ok) return responseForAuthError(context, decision);
    decisions.push(decision.value);
    if (!decision.value.allowed) {
      applyRateHeaders(context, decision.value);
      return responseForAuthError(
        context,
        authError(
          429,
          'RATE_LIMITED',
          'Too many requests.',
          rateLimitedDetails(decision.value),
        ),
      );
    }
  }
  // BUCKETS is non-empty, so there is always a decision; ties keep the first.
  applyRateHeaders(
    context,
    decisions.reduce((strictest, next) =>
      next.remaining < strictest.remaining ? next : strictest,
    ),
  );
  return null;
};
