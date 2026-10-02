import type { AuthOperationId } from '@wejammin/contracts';

import type { WorkerContext } from '../index';
import { authError, responseForAuthError } from './boundary';
import { policyFor } from './route-support';
import type { AuthenticationError, AuthenticationResult } from './types';

/** Global JSON ceiling for first-party requests (BE00, 256 KiB). */
const MAX_BODY_BYTES = 262_144;

const DEFAULT_RETRY_AFTER_SECONDS = 1;

const recordOf = (value: unknown): Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null
    ? (value as Readonly<Record<string, unknown>>)
    : {};

const conflict = (
  error: AuthenticationError,
  kind: 'IDEMPOTENCY_MISMATCH' | 'VERSION_MISMATCH',
  reasonCode: string,
): AuthenticationError => ({
  ...error,
  code: 'CONFLICT',
  details: { conflict: kind, reasonCode, recoveryAction: 'refetch' },
});

const rateLimited = (
  operationId: AuthOperationId,
  error: AuthenticationError,
  nowMs: number,
): AuthenticationError => {
  const details = recordOf(error.details);
  const retryAfterSeconds =
    typeof details.retryAfterSeconds === 'number'
      ? details.retryAfterSeconds
      : (error.retryAfterSeconds ?? DEFAULT_RETRY_AFTER_SECONDS);
  return {
    ...error,
    details: {
      retryAfterSeconds,
      limit:
        typeof details.limit === 'number'
          ? details.limit
          : policyFor(operationId).rateLimit,
      resetAt:
        typeof details.resetAt === 'string'
          ? details.resetAt
          : new Date(nowMs + retryAfterSeconds * 1000).toISOString(),
    },
  };
};

const dependency = (error: AuthenticationError): AuthenticationError => {
  const details = recordOf(error.details);
  return {
    ...error,
    code: 'DEPENDENCY_UNAVAILABLE',
    details: {
      dependencyClass:
        typeof details.dependencyClass === 'string'
          ? details.dependencyClass
          : 'identity_persistence',
      retryable: true,
      ...(error.status === 503 && error.retryAfterSeconds !== undefined
        ? { retryAfterSeconds: error.retryAfterSeconds }
        : {}),
    },
  };
};

/**
 * BE01a "Errors" matrix for AUTH-API-16..21: every status serializes exactly
 * its strict details row and 502/503/504 share the one BE00
 * `DEPENDENCY_UNAVAILABLE` code, whichever layer produced the failure.
 */
export const canonicalMfaError = (
  operationId: AuthOperationId,
  error: AuthenticationError,
  nowMs: number = Date.now(),
): AuthenticationError => {
  switch (error.status) {
    case 401:
      return error.code === 'UNAUTHENTICATED'
        ? { ...error, details: { recoveryAction: 'reauthenticate' } }
        : error;
    case 403:
      return typeof recordOf(error.details).reasonCode === 'string'
        ? error
        : {
            ...error,
            details: {
              ...recordOf(error.details),
              reasonCode: 'origin_csrf_required',
            },
          };
    case 409:
      return error.code === 'VERSION_MISMATCH'
        ? conflict(error, 'VERSION_MISMATCH', 'version_mismatch')
        : error.code === 'IDEMPOTENCY_MISMATCH'
          ? conflict(error, 'IDEMPOTENCY_MISMATCH', 'idempotency_mismatch')
          : error;
    case 413:
      return { ...error, details: { maxBytes: MAX_BODY_BYTES } };
    case 415:
      return { ...error, details: { allowedMediaTypes: ['application/json'] } };
    case 429:
      return rateLimited(operationId, error, nowMs);
    case 500:
      return { ...error, details: {} };
    case 502:
    case 503:
    case 504:
      return dependency(error);
    default:
      return error;
  }
};

export const responseForMfaError = (
  context: WorkerContext,
  operationId: AuthOperationId,
  error: AuthenticationError,
): Response =>
  responseForAuthError(context, canonicalMfaError(operationId, error));

/**
 * Registered route deadline (`timeoutMs` of the Route Registry row). The
 * signal aborts in-flight dependency calls; an exceeded deadline is a 504 and
 * never a success, because an ambiguous outcome is reconciled, not resent.
 */
export const withRouteDeadline = async <T>(
  operationId: AuthOperationId,
  run: (signal: AbortSignal) => Promise<AuthenticationResult<T>>,
): Promise<AuthenticationResult<T>> => {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<AuthenticationError>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(
        authError(
          504,
          'DEPENDENCY_UNAVAILABLE',
          'The request exceeded its deadline.',
          { dependencyClass: 'identity_persistence', retryable: true },
        ),
      );
    }, policyFor(operationId).timeoutMs);
  });
  try {
    return await Promise.race([run(controller.signal), deadline]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
};
