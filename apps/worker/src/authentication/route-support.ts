import { authRoutePolicies, type AuthOperationId } from '@wejammin/contracts';

import type { WorkerContext } from '../index';
import { applyRateHeaders, authError, responseForAuthError } from './boundary';
import { parseClientBindingIdHeader } from './client-binding-header';
import { isFreshProof, stepUpRequiredError } from './step-up';
import type {
  AuthenticationDependencies,
  AuthenticationError,
  AuthenticationResult,
  AuthenticationSession,
} from './types';

export const policyFor = (operationId: AuthOperationId) => {
  const policy = authRoutePolicies.find(
    (item) => item.operationId === operationId,
  );
  if (policy === undefined)
    throw new Error(`Missing auth policy ${operationId}`);
  return policy;
};

export const requireSession = async (
  context: WorkerContext,
  dependencies: AuthenticationDependencies,
): Promise<AuthenticationResult<AuthenticationSession>> => {
  const bindingId = parseClientBindingIdHeader(context.req.raw);
  if (!bindingId.ok) return bindingId;
  const controller = new AbortController();
  return dependencies.resolveSession(
    context.req.raw,
    context.env,
    controller.signal,
  );
};

export const enforceRate = async (
  context: WorkerContext,
  dependencies: AuthenticationDependencies,
  operationId: AuthOperationId,
  session: AuthenticationSession | null,
  identifierDigest: string | null = null,
  respond: (
    context: WorkerContext,
    error: AuthenticationError,
  ) => Response = responseForAuthError,
): Promise<Response | null> => {
  const policy = policyFor(operationId);
  const controller = new AbortController();
  const result = await dependencies.rateLimit(
    {
      operationId,
      request: context.req.raw,
      authUserId: session?.authUserId ?? null,
      identifierDigest,
      limit: policy.rateLimit,
      windowSeconds: policy.rateWindowSeconds,
    },
    context.env,
    controller.signal,
  );
  if (!result.ok) return respond(context, result);
  applyRateHeaders(context, result.value);
  return result.value.allowed
    ? null
    : respond(
        context,
        authError(429, 'RATE_LIMITED', 'Too many requests.', {
          retryAfterSeconds: Math.max(
            1,
            result.value.resetAt - Math.floor(Date.now() / 1000),
          ),
          limit: result.value.limit,
          resetAt: result.value.resetAt,
        }),
      );
};

export const isStepUpFresh = (
  session: AuthenticationSession,
  nowMs: number,
): boolean => isFreshProof(session.stepUpAt, nowMs);

/** 401 `STEP_UP_REQUIRED` response when the session proof is stale, else null. */
export const stepUpShortfall = (
  context: WorkerContext,
  session: AuthenticationSession,
): Response | null =>
  isStepUpFresh(session, Date.now())
    ? null
    : responseForAuthError(context, stepUpRequiredError());

export const jsonSuccess = (
  context: WorkerContext,
  value: unknown,
  status: 200 | 201 | 202,
  cacheControl: string,
): Response => {
  context.header('cache-control', cacheControl);
  return context.body(JSON.stringify(value), status, {
    'content-type': 'application/json',
  });
};
