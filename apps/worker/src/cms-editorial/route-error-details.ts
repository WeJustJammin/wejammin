import { ApiErrorSchema } from '@wejammin/contracts';

import {
  REGISTERED_CONFLICT_KINDS,
  REGISTERED_RECOVERY_ACTIONS,
} from './error-vocabulary';
import type { CmsEditorialError } from './types';

/**
 * Error projection for the revision-write routes: the allowlisted detail keys a
 * dependency error may carry, the bounded `Retry-After`, and the per-status
 * canonical envelope. A private port is untrusted here, so a message or detail
 * outside the allowlist is never copied through.
 */

const DETAIL_KEYS = [
  'reasonCode',
  'recoveryAction',
  'dependencyClass',
  'retryable',
  'retryAfterSeconds',
  'expectedVersion',
  'currentVersion',
  'limit',
  'resetAt',
] as const;

export const clampRetryAfterSeconds = (
  value: unknown,
  fallback = 1,
): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(3_600, Math.max(1, Math.ceil(value)));
};

export const safeDetails = (
  error: CmsEditorialError,
): Record<string, unknown> => {
  if (error.status === 404 || error.status === 500) return {};
  const source = error.details ?? {};
  const details: Record<string, unknown> = {};
  for (const key of DETAIL_KEYS) {
    const value = source[key];
    if (key === 'retryAfterSeconds') {
      if (value !== undefined) details[key] = clampRetryAfterSeconds(value);
      continue;
    }
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    )
      details[key] = value;
  }
  // `recoveryAction` is a closed vocabulary: a port can name an action only by
  // one of its registered values, never by free text.
  if (
    typeof details.recoveryAction === 'string' &&
    !REGISTERED_RECOVERY_ACTIONS.has(details.recoveryAction)
  )
    delete details.recoveryAction;
  if (
    error.status === 409 &&
    typeof source.conflict === 'string' &&
    REGISTERED_CONFLICT_KINDS.has(source.conflict)
  )
    details.conflict = source.conflict;
  // BE00: a 415 carries exactly the route allowlist. A route that accepts no
  // request media states an empty one; a port that names none gets JSON.
  if (error.status === 415)
    details.allowedMediaTypes =
      Array.isArray(source.allowedMediaTypes) &&
      source.allowedMediaTypes.every(
        (value): value is string => typeof value === 'string',
      )
        ? source.allowedMediaTypes.slice(0, 8)
        : ['application/json'];
  if (Array.isArray(source.violations)) {
    const violations = source.violations
      .slice(0, 50)
      .filter(
        (value): value is Record<string, unknown> =>
          typeof value === 'object' && value !== null && !Array.isArray(value),
      )
      .map((value) => ({
        path: typeof value.path === 'string' ? value.path.slice(0, 256) : '/',
        code:
          typeof value.code === 'string' ? value.code.slice(0, 128) : 'invalid',
        message: 'The value is invalid.',
      }));
    details.violations = violations;
  }
  return ApiErrorSchema.safeParse({
    code: 'INVALID_REQUEST',
    details,
    message: 'Invalid.',
    requestId: '00000000-0000-4000-8000-000000000000',
  }).success
    ? details
    : {};
};

export const normalizedError = (
  error: CmsEditorialError,
): CmsEditorialError => {
  if (error.status === 500)
    return {
      ok: false,
      status: 500,
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
      details: {},
    };
  if (error.status === 502)
    return {
      ok: false,
      status: 502,
      code: 'BAD_GATEWAY',
      message: 'The CMS editorial dependency returned invalid data.',
      details: { dependencyClass: 'cms_editorial', retryable: false },
    };
  if (error.status === 504)
    return {
      ok: false,
      status: 504,
      code: 'GATEWAY_TIMEOUT',
      message: 'The CMS editorial dependency exceeded its deadline.',
      details: { dependencyClass: 'cms_editorial', retryable: true },
      retryAfterSeconds: 5,
    };
  if (error.status === 503)
    return {
      ok: false,
      status: 503,
      code: 'DEPENDENCY_UNAVAILABLE',
      message: 'The CMS editorial dependency is temporarily unavailable.',
      details: { dependencyClass: 'cms_editorial', retryable: true },
      retryAfterSeconds: 5,
    };
  if (error.status === 401)
    return {
      ok: false,
      status: 401,
      code: 'UNAUTHENTICATED',
      message: 'Sign in again to edit this entry.',
      details: { recoveryAction: 'reauthenticate' },
    };
  if (error.status === 404)
    return {
      ok: false,
      status: 404,
      code: 'NOT_FOUND',
      message: 'The requested entry is not available.',
      details: {},
    };
  if (error.status === 403)
    return {
      ok: false,
      status: 403,
      code: 'FORBIDDEN',
      message: 'The CMS editorial action is not allowed.',
      details: safeDetails(error),
    };
  if (error.status === 429)
    return {
      ok: false,
      status: 429,
      code: 'RATE_LIMITED',
      message: 'Too many CMS editorial requests.',
      details: safeDetails(error),
      retryAfterSeconds: clampRetryAfterSeconds(error.retryAfterSeconds),
    };
  return { ...error, details: safeDetails(error) };
};
