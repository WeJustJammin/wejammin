import { authError } from './boundary';
import { transitionConflict } from './mfa-service-support';
import { reauthenticateError, stepUpRequiredError } from './step-up';
import type { AuthenticationError } from './types';

/** Provider default retry delay when a 429 carries none (the 15 minute lock). */
export const DEFAULT_RETRY_AFTER_SECONDS = 900;

type ProviderBody = Readonly<Record<string, unknown>> | null;

const errorCodeOf = (body: ProviderBody): string =>
  typeof body?.error_code === 'string'
    ? body.error_code
    : typeof body?.code === 'string'
      ? body.code
      : '';

const retryAfterSeconds = (headers: Headers): number => {
  const parsed = Number(headers.get('retry-after'));
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= 86_400
    ? parsed
    : DEFAULT_RETRY_AFTER_SECONDS;
};

export const unavailableError = (): AuthenticationError =>
  authError(
    503,
    'DEPENDENCY_UNAVAILABLE',
    'Authentication is temporarily unavailable.',
    { dependencyClass: 'identity_provider', retryable: true },
  );

export const timeoutError = (): AuthenticationError =>
  authError(
    504,
    'DEPENDENCY_TIMEOUT',
    'The authentication provider timed out.',
    { dependencyClass: 'identity_provider', retryable: true },
  );

export const invalidProviderResponse = (): AuthenticationError =>
  authError(
    502,
    'PROVIDER_INVALID_RESPONSE',
    'The authentication provider returned an invalid response.',
    { dependencyClass: 'identity_provider', retryable: true },
  );

const wrongCode = (): AuthenticationError =>
  authError(422, 'VALIDATION_FAILED', 'Check the highlighted fields.', {
    violations: [
      {
        path: '/code',
        code: 'code_incorrect',
        message: 'The value is invalid.',
      },
    ],
  });

/**
 * Maps a non-2xx Supabase Auth response to the first-party error matrix. The
 * provider body is read only for its machine `error_code`; no provider text,
 * token or code is ever copied into the result.
 */
export const classifyProviderFailure = (
  status: number,
  body: ProviderBody,
  headers: Headers,
  nowMs: number,
): AuthenticationError => {
  const code = errorCodeOf(body);
  if (status === 429) {
    const delay = retryAfterSeconds(headers);
    return {
      ...authError(429, 'RATE_LIMITED', 'Too many requests.', {
        retryAfterSeconds: delay,
        resetAt: Math.floor(nowMs / 1000) + delay,
      }),
      retryAfterSeconds: delay,
    };
  }
  if (code === 'insufficient_aal') return stepUpRequiredError();
  if (
    code === 'mfa_verification_failed' ||
    code === 'mfa_verification_rejected'
  )
    return wrongCode();
  if (code === 'mfa_challenge_expired')
    return transitionConflict(
      'challenge_expired',
      'new_challenge',
      'The verification challenge expired; start a new one.',
    );
  if (code === 'mfa_factor_name_conflict')
    return transitionConflict(
      'factor_name_taken',
      'refetch',
      'An authenticator with that name already exists.',
    );
  if (code === 'too_many_enrolled_mfa_factors')
    return transitionConflict(
      'mfa_factor_limit',
      'refetch',
      'The account already has the maximum number of authenticator factors.',
    );
  if (status === 401 || status === 403) return reauthenticateError();
  if (status === 404)
    return authError(
      404,
      'NOT_FOUND',
      'The requested resource was not found.',
      {},
    );
  if (status >= 500) return unavailableError();
  return invalidProviderResponse();
};
