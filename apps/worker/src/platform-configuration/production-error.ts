import { asRecord } from '../authentication/production-configuration';
import { authError } from '../authentication/boundary';
import type { AuthenticationError } from '../authentication/types';

const errorCandidates = (value: unknown): readonly string[] => {
  const record = asRecord(value);
  const nested = record === null ? null : asRecord(record.error);
  return [
    record?.code,
    record?.errorCode,
    record?.message,
    nested?.code,
    nested?.errorCode,
    nested?.message,
  ].filter((candidate): candidate is string => typeof candidate === 'string');
};

const withRetry = (
  result: AuthenticationError,
  response: Response,
): AuthenticationError => {
  const raw = response.headers.get('retry-after');
  if (raw === null || !/^\d{1,5}$/u.test(raw)) return result;
  const retryAfterSeconds = Number(raw);
  return retryAfterSeconds <= 86_400
    ? { ...result, retryAfterSeconds }
    : result;
};

const messages: Readonly<Record<string, string>> = {
  IDEMPOTENCY_CONFLICT: 'The idempotency key was used for another request.',
  TASK_SOURCE_UNAVAILABLE: 'Task sources are temporarily unavailable.',
  SEARCH_FIELD_NOT_ALLOWED: 'The requested search field is not allowed.',
  COUNT_SUPPRESSED: 'The result count is suppressed for this request.',
  SEARCH_UNAVAILABLE: 'Search is temporarily unavailable.',
  TARGET_NOT_FOUND: 'The requested target was not found.',
  MFA_RESET_IN_PROGRESS: 'An authenticator reset is already in progress.',
  MFA_RESET_INVALID: 'The authenticator reset request is invalid.',
  IDENTITY_UNAVAILABLE: 'The identity service is temporarily unavailable.',
  MANIFEST_CONFLICT: 'The bulk manifest changed; reload and try again.',
  COMMAND_NOT_ALLOWED: 'The requested command is not allowed.',
  BULK_UNAVAILABLE: 'Bulk operations are temporarily unavailable.',
  GRANT_NOT_FOUND: 'The requested capability grant was not found.',
  GRANT_CONFLICT: 'The capability grant conflicts with the current state.',
  GRANT_VERSION_CONFLICT: 'The capability grant changed; reload and try again.',
  GRANT_INVALID: 'The capability grant is invalid.',
  AUDIT_TARGET_NOT_FOUND: 'The requested audit target was not found.',
  DIAGNOSTIC_VERSION_CONFLICT:
    'The diagnostic target changed; reload and try again.',
  DIAGNOSTIC_UNAVAILABLE: 'Diagnostics are temporarily unavailable.',
  UPSTREAM_TIMEOUT: 'The configuration dependency timed out.',
  DEPENDENCY_UNAVAILABLE:
    'The configuration dependency is temporarily unavailable.',
  INTERNAL_ERROR: 'The configuration operation could not be completed.',
  VERSION_CONFLICT: 'The configuration changed; reload and try again.',
  STALE_DEFINITION: 'The definition changed; reload and try again.',
  APPROVAL_INVALID: 'The approval requirements were not met.',
  SNAPSHOT_UNAVAILABLE: 'The runtime snapshot is not available.',
  VALUE_UNAVAILABLE: 'The effective value is temporarily unavailable.',
  DISALLOWED_CONTEXT: 'The request context is not allowed.',
  DEFINITION_NOT_FOUND: 'The requested definition was not found.',
  REVIEW_NOT_FOUND: 'The requested review was not found.',
  STEP_UP_REQUIRED: 'Recent verification is required.',
  UNAUTHENTICATED: 'The authentication session is invalid.',
  FORBIDDEN: 'The action is not allowed.',
  PROTECTED_SETTING: 'The setting is protected.',
  INVALID_DEFINITION: 'The setting definition is invalid.',
  VALUE_INVALID: 'The setting value is invalid.',
  INVALID_REQUEST: 'The configuration request is invalid.',
  RATE_LIMITED: 'Too many requests.',
};

const mapped: readonly (readonly [
  string,
  AuthenticationError['status'],
  string,
])[] = [
  ['AUDIT_TARGET_NOT_FOUND', 404, 'AUDIT_TARGET_NOT_FOUND'],
  ['DIAGNOSTIC_VERSION_CONFLICT', 409, 'DIAGNOSTIC_VERSION_CONFLICT'],
  ['DIAGNOSTIC_UNAVAILABLE', 503, 'DIAGNOSTIC_UNAVAILABLE'],
  ['GRANT_CONFLICT', 409, 'GRANT_CONFLICT'],
  ['GRANT_VERSION_CONFLICT', 409, 'GRANT_VERSION_CONFLICT'],
  ['GRANT_NOT_FOUND', 404, 'GRANT_NOT_FOUND'],
  ['GRANT_INVALID', 422, 'GRANT_INVALID'],
  ['TASK_SOURCE_UNAVAILABLE', 503, 'TASK_SOURCE_UNAVAILABLE'],
  ['SEARCH_FIELD_NOT_ALLOWED', 422, 'SEARCH_FIELD_NOT_ALLOWED'],
  ['COUNT_SUPPRESSED', 422, 'COUNT_SUPPRESSED'],
  ['SEARCH_UNAVAILABLE', 503, 'SEARCH_UNAVAILABLE'],
  ['MANIFEST_CONFLICT', 409, 'MANIFEST_CONFLICT'],
  ['COMMAND_NOT_ALLOWED', 422, 'COMMAND_NOT_ALLOWED'],
  ['BULK_UNAVAILABLE', 503, 'BULK_UNAVAILABLE'],
  ['IDEMPOTENCY_CONFLICT', 409, 'IDEMPOTENCY_CONFLICT'],
  ['UPSTREAM_TIMEOUT', 504, 'UPSTREAM_TIMEOUT'],
  ['DEPENDENCY_UNAVAILABLE', 503, 'DEPENDENCY_UNAVAILABLE'],
  ['INTERNAL_ERROR', 500, 'INTERNAL_ERROR'],
  ['IDEMPOTENCY_MISMATCH', 409, 'IDEMPOTENCY_CONFLICT'],
  ['VERSION_MISMATCH', 409, 'VERSION_CONFLICT'],
  ['STALE_DEFINITION', 409, 'STALE_DEFINITION'],
  ['APPROVAL_INVALID', 422, 'APPROVAL_INVALID'],
  ['SNAPSHOT_UNAVAILABLE', 503, 'SNAPSHOT_UNAVAILABLE'],
  ['VALUE_UNAVAILABLE', 503, 'VALUE_UNAVAILABLE'],
  ['DISALLOWED_CONTEXT', 422, 'DISALLOWED_CONTEXT'],
  ['DEFINITION_NOT_FOUND', 404, 'DEFINITION_NOT_FOUND'],
  ['REVIEW_NOT_FOUND', 404, 'REVIEW_NOT_FOUND'],
  ['STEP_UP_REQUIRED', 401, 'STEP_UP_REQUIRED'],
  ['UNAUTHENTICATED', 401, 'UNAUTHENTICATED'],
  ['FORBIDDEN', 403, 'FORBIDDEN'],
  ['PROTECTED_SETTING', 422, 'PROTECTED_SETTING'],
  ['INVALID_DEFINITION', 422, 'INVALID_DEFINITION'],
  ['VALUE_INVALID', 422, 'VALUE_INVALID'],
  ['TARGET_NOT_FOUND', 404, 'TARGET_NOT_FOUND'],
  ['MFA_RESET_IN_PROGRESS', 409, 'MFA_RESET_IN_PROGRESS'],
  ['MFA_RESET_INVALID', 422, 'MFA_RESET_INVALID'],
  ['IDENTITY_UNAVAILABLE', 503, 'IDENTITY_UNAVAILABLE'],
  ['INVALID_REQUEST', 400, 'INVALID_REQUEST'],
  ['RATE_LIMITED', 429, 'RATE_LIMITED'],
];

export const configurationRpcFailure = (
  value: unknown,
  status: number,
  response?: Response,
): AuthenticationError => {
  const candidates = errorCandidates(value).map((candidate) =>
    candidate.toUpperCase(),
  );
  const match = mapped.find(([needle]) =>
    candidates.some((candidate) => candidate.includes(needle)),
  );
  if (match !== undefined) {
    const [, errorStatus, code] = match;
    const result = authError(errorStatus, code, messages[code]!);
    return response === undefined ? result : withRetry(result, response);
  }
  const fallback =
    status === 401
      ? authError(
          401,
          'UNAUTHENTICATED',
          'The authentication session is invalid.',
        )
      : status === 403
        ? authError(403, 'FORBIDDEN', 'The action is not allowed.')
        : status === 404
          ? authError(
              404,
              'NOT_FOUND',
              'The requested configuration was not found.',
            )
          : status === 409
            ? authError(
                409,
                'VERSION_CONFLICT',
                'The configuration changed; reload and try again.',
              )
            : status === 429
              ? authError(429, 'RATE_LIMITED', 'Too many requests.')
              : status === 502
                ? authError(
                    502,
                    'UPSTREAM_FAILURE',
                    'The configuration dependency returned an invalid response.',
                  )
                : status === 504
                  ? authError(
                      504,
                      'UPSTREAM_TIMEOUT',
                      'The configuration dependency timed out.',
                    )
                  : authError(
                      503,
                      'VALUE_UNAVAILABLE',
                      'The configuration dependency is temporarily unavailable.',
                    );
  return response === undefined ? fallback : withRetry(fallback, response);
};
