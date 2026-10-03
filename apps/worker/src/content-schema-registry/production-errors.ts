import { MFA_METHOD_REGISTRY } from '../authentication/step-up';
import type { AuthenticationResult } from '../authentication/types';
import {
  ACTIVE_GRANT_CONFLICT_CODE,
  boundedRateLimit,
  boundedRetryAfterSeconds,
  registeredDependencyClass,
  registeredReasonCode,
  withinDetailsCeiling,
} from './error-detail-values';
import type {
  ContentSchemaRegistryError,
  ContentSchemaRegistryResult,
} from './types';

export const errorResult = (
  status: ContentSchemaRegistryError['status'],
  code: string,
  message: string,
  details: Readonly<Record<string, unknown>> = {},
  retryAfterSeconds?: number,
): ContentSchemaRegistryError => ({
  ok: false,
  status,
  code,
  message,
  details,
  ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
});

export const unavailable = (dependencyClass = 'cms_registry') =>
  errorResult(
    503,
    'DEPENDENCY_UNAVAILABLE',
    'The CMS registry dependency is temporarily unavailable.',
    { dependencyClass, retryable: true },
    5,
  );

export const deadlineExceeded = (dependencyClass = 'cms_registry') =>
  errorResult(
    504,
    'DEPENDENCY_DEADLINE_EXCEEDED',
    'The CMS registry dependency exceeded its deadline.',
    { dependencyClass, retryable: true },
    5,
  );

export const invalidResponse = () =>
  errorResult(
    502,
    'DEPENDENCY_INVALID_RESPONSE',
    'The CMS registry dependency returned an invalid response.',
    { dependencyClass: 'cms_registry', retryable: false },
  );

export const badGateway = () =>
  errorResult(
    502,
    'DEPENDENCY_BAD_GATEWAY',
    'The CMS registry dependency rejected the request.',
    { dependencyClass: 'cms_registry', retryable: false },
  );

export const sessionUnavailable = () => unavailable('authentication');

export const contextUnavailable = () => unavailable('request_context');

export const isRecord = (
  value: unknown,
): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isAbortError = (value: unknown): boolean =>
  (value instanceof DOMException && value.name === 'AbortError') ||
  (isRecord(value) && value.name === 'AbortError');

const MAX_DETAIL_VIOLATIONS = 50;
const MAX_VIOLATION_POINTER_LENGTH = 256;
const MAX_VIOLATION_MESSAGE_LENGTH = 500;
const PRINTABLE_ASCII = /^[\x20-\x7e]+$/u;

const printable = (value: unknown, maxLength: number): value is string =>
  typeof value === 'string' &&
  value.length <= maxLength &&
  PRINTABLE_ASCII.test(value);

/**
 * PostgREST reports the raised exception's machine DETAIL as `details`: a
 * JSON text for the OD-4 shapes, or a plain token such as
 * `MIGRATION_SOURCE_DRIFT`. Only a JSON object is ever read; any other value
 * (plain text, array, scalar, malformed JSON) yields no detail.
 */
const detailRecord = (
  value: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> => {
  const raw = value.details;
  if (isRecord(raw)) return raw;
  if (typeof raw !== 'string') return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

/**
 * BE00 `FieldViolation`: a 400/422 carries at most 50 `{ path, message }`
 * violations, `path` being a JSON Pointer. The database DETAIL JSON still
 * names the member `pointer` (the OD-4 migrations predate the BE00 name), so
 * either spelling is read and only `path` is ever produced. An entry needs
 * both members in bounded printable ASCII or it is dropped; unknown members
 * are never copied.
 */
const safeViolations = (
  value: unknown,
): readonly Readonly<{ path: string; message: string }>[] => {
  if (!Array.isArray(value)) return [];
  const kept: Array<Readonly<{ path: string; message: string }>> = [];
  for (const entry of value as readonly unknown[]) {
    if (kept.length === MAX_DETAIL_VIOLATIONS) break;
    if (!isRecord(entry)) continue;
    const path = entry.path ?? entry.pointer;
    const { message } = entry;
    if (
      printable(path, MAX_VIOLATION_POINTER_LENGTH) &&
      printable(message, MAX_VIOLATION_MESSAGE_LENGTH)
    )
      kept.push({ path, message });
  }
  return kept;
};

/**
 * BE00 per-status details allowlist applied at the adapter. A key outside the
 * status's row is never copied, whatever the database or a port supplied.
 */
type DetailKey =
  | 'currentVersion'
  | 'dependencyClass'
  | 'expectedVersion'
  | 'limit'
  | 'reasonCode'
  | 'recoveryAction'
  | 'resetAt'
  | 'retryable'
  | 'retryAfterSeconds';

const DETAIL_KEYS_BY_STATUS: Readonly<Record<number, readonly DetailKey[]>> = {
  401: ['recoveryAction'],
  403: ['reasonCode', 'recoveryAction'],
  409: ['expectedVersion', 'currentVersion'],
  429: ['limit', 'resetAt', 'retryAfterSeconds'],
  502: ['dependencyClass', 'retryable', 'retryAfterSeconds'],
  503: ['dependencyClass', 'retryable', 'retryAfterSeconds'],
  504: ['dependencyClass', 'retryable', 'retryAfterSeconds'],
};

const VERSION_VALUE = /^[1-9][0-9]{0,18}$/u;
const RFC3339_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u;
const RECOVERY_ACTION = /^[a-z][a-z0-9_]{0,31}$/u;

/**
 * One value per allowlisted key: registered tokens, bounded integers, or a
 * canonical instant. Anything else (SQL text, provider names, oversized or
 * non-finite values) is dropped so it can never reach the wire.
 */
const registeredDetailValue = (
  key: DetailKey,
  value: unknown,
): string | number | boolean | null => {
  switch (key) {
    case 'reasonCode':
      return registeredReasonCode(value);
    case 'dependencyClass':
      return registeredDependencyClass(value);
    case 'retryAfterSeconds':
      return boundedRetryAfterSeconds(value);
    case 'limit':
      return boundedRateLimit(value);
    case 'retryable':
      return typeof value === 'boolean' ? value : null;
    case 'resetAt':
      return typeof value === 'string' && RFC3339_UTC.test(value)
        ? value
        : null;
    case 'expectedVersion':
    case 'currentVersion':
      return typeof value === 'string' && VERSION_VALUE.test(value)
        ? value
        : null;
    case 'recoveryAction':
      return typeof value === 'string' && RECOVERY_ACTION.test(value)
        ? value
        : null;
  }
};

export const safeDetails = (
  value: unknown,
  status?: number,
): Readonly<Record<string, unknown>> => {
  if (!isRecord(value) || status === undefined) return {};
  const details = detailRecord(value);
  const primitives = Object.fromEntries(
    (DETAIL_KEYS_BY_STATUS[status] ?? []).flatMap((key) => {
      const candidate = registeredDetailValue(key, details[key]);
      return candidate === null ? [] : [[key, candidate]];
    }),
  );
  const violations =
    status === 400 || status === 422 ? safeViolations(details.violations) : [];
  return withinDetailsCeiling(
    violations.length === 0 ? primitives : { ...primitives, violations },
  );
};

export const statusIsSupported = (
  value: number,
): value is ContentSchemaRegistryError['status'] =>
  [400, 401, 403, 404, 409, 413, 415, 422, 429, 500, 502, 503, 504].includes(
    value,
  );

/**
 * BE00 STEP_UP_REQUIRED recovery routing: `allowedMethods` is the one
 * configured, allowlisted step-up method registry (BE01a MFA method registry),
 * never an RPC-supplied list, a local default, or a CMS-owned copy.
 */
export const CMS_STEP_UP_ALLOWED_METHODS: readonly string[] = Object.freeze([
  ...MFA_METHOD_REGISTRY,
]);

export const knownFailure = (
  code: string,
): Readonly<{
  status: ContentSchemaRegistryError['status'];
  code: string;
  message: string;
  details?: Readonly<Record<string, unknown>>;
}> | null => {
  const failures: Readonly<
    Record<
      string,
      Readonly<{
        status: ContentSchemaRegistryError['status'];
        code: string;
        message: string;
        details?: Readonly<Record<string, unknown>>;
      }>
    >
  > = {
    INVALID_REQUEST: {
      status: 400,
      code: 'INVALID_REQUEST',
      message: 'The CMS registry request is invalid.',
    },
    UNSUPPORTED_MEDIA_TYPE: {
      status: 415,
      code: 'UNSUPPORTED_MEDIA_TYPE',
      message: 'The CMS registry request media type is unsupported.',
    },
    UNAUTHENTICATED: {
      status: 401,
      code: 'UNAUTHENTICATED',
      message: 'The authentication session is invalid.',
      details: { recoveryAction: 'reauthenticate' },
    },
    STEP_UP_REQUIRED: {
      status: 401,
      code: 'STEP_UP_REQUIRED',
      message: 'Recent verification is required.',
      details: {
        allowedMethods: CMS_STEP_UP_ALLOWED_METHODS,
        recoveryAction: 'step_up',
      },
    },
    FORBIDDEN: {
      status: 403,
      code: 'FORBIDDEN',
      message: 'The action is not allowed.',
    },
    NOT_FOUND: {
      status: 404,
      code: 'NOT_FOUND',
      message: 'The requested CMS registry resource was not found.',
    },
    // BE00: one 409 code (CONFLICT) on the wire; the internal code names the
    // conflict kind and the response mapping derives `details.conflict`.
    IDEMPOTENCY_MISMATCH: {
      status: 409,
      code: 'IDEMPOTENCY_MISMATCH',
      message: 'The idempotency key was used for another request.',
    },
    IDEMPOTENCY_CONFLICT: {
      status: 409,
      code: 'IDEMPOTENCY_MISMATCH',
      message: 'The idempotency key was used for another request.',
    },
    VERSION_MISMATCH: {
      status: 409,
      code: 'VERSION_MISMATCH',
      message: 'The CMS registry resource changed; reload and try again.',
    },
    CONFLICT: {
      status: 409,
      code: 'CONFLICT',
      message: 'The CMS registry operation conflicts with current state.',
    },
    // Internal only: the wire answer is the ordinary 409 CONFLICT. The code names
    // both the nonce and the conflict so the nonce-rejection and conflict-rate
    // counters each see it.
    [RELEASE_NONCE_REPLAY_CODE]: {
      status: 409,
      code: RELEASE_NONCE_REPLAY_CODE,
      message: 'The CMS registry operation conflicts with current state.',
    },
    // Internal only: CMS-03A-15 against an existing active aggregate. The wire answer is
    // the ordinary 409 CONFLICT whose recovery action is `renew` (AC527).
    [ACTIVE_GRANT_CONFLICT_CODE]: {
      status: 409,
      code: ACTIVE_GRANT_CONFLICT_CODE,
      message: 'The CMS registry operation conflicts with current state.',
    },
    VALIDATION_FAILED: {
      status: 422,
      code: 'VALIDATION_FAILED',
      message: 'The CMS registry request failed validation.',
    },
    RATE_LIMITED: {
      status: 429,
      code: 'RATE_LIMITED',
      message: 'Too many CMS registry requests.',
    },
  };
  return failures[code] ?? null;
};

const RPC_FAILURE_CODES = [
  'INVALID_REQUEST',
  'UNSUPPORTED_MEDIA_TYPE',
  'UNAUTHENTICATED',
  'STEP_UP_REQUIRED',
  'FORBIDDEN',
  'NOT_FOUND',
  'IDEMPOTENCY_MISMATCH',
  'IDEMPOTENCY_CONFLICT',
  'VERSION_MISMATCH',
  'CONFLICT',
  'VALIDATION_FAILED',
  'RATE_LIMITED',
] as const;

export const codeFromRpcError = (value: unknown): string => {
  if (!isRecord(value)) return '';
  const candidates = [value.code, value.message, value.error, value.detail];
  const text = candidates
    .filter((candidate): candidate is string => typeof candidate === 'string')
    .join(' ')
    .toUpperCase();
  return RPC_FAILURE_CODES.find((candidate) => text.includes(candidate)) ?? '';
};

/**
 * The database raises CONFLICT with DETAIL `RELEASE_NONCE_REPLAYED` for a (release
 * key, nonce) pair it already claimed. Only that exact detail on a CONFLICT is a
 * replay; the internal code lets the telemetry count it as a rejected nonce claim.
 */
export const RELEASE_NONCE_REPLAY_CODE = 'RELEASE_NONCE_REPLAY_CONFLICT';
const RELEASE_NONCE_REPLAYED_DETAIL = 'RELEASE_NONCE_REPLAYED';

const ACTIVE_GRANT_EXISTS_DETAIL = 'ACTIVE_GRANT_EXISTS';

/**
 * The two registered database signals that refine a bare CONFLICT: a replayed release
 * nonce and an existing active capability grant aggregate. Any other detail, and any
 * other message, keeps the ordinary code.
 */
const signalAwareCode = (payload: unknown): string => {
  const code = codeFromRpcError(payload);
  if (code !== 'CONFLICT' || !isRecord(payload)) return code;
  if (payload.details === RELEASE_NONCE_REPLAYED_DETAIL)
    return RELEASE_NONCE_REPLAY_CODE;
  if (payload.details === ACTIVE_GRANT_EXISTS_DETAIL)
    return ACTIVE_GRANT_CONFLICT_CODE;
  return code;
};

export const mapRpcFailure = (
  status: number,
  payload: unknown,
): ContentSchemaRegistryError => {
  const code = signalAwareCode(payload);
  const mapped = code === '' ? null : knownFailure(code);
  if (mapped !== null)
    return errorResult(
      mapped.status,
      mapped.code,
      mapped.message,
      mapped.details ?? safeDetails(payload, mapped.status),
    );
  if (status === 504) return deadlineExceeded();
  if (status === 502) return badGateway();
  if (status >= 500) return unavailable();
  if (statusIsSupported(status)) {
    return errorResult(
      status,
      status === 422
        ? 'VALIDATION_FAILED'
        : status === 429
          ? 'RATE_LIMITED'
          : status === 401
            ? 'UNAUTHENTICATED'
            : status === 403
              ? 'FORBIDDEN'
              : status === 404
                ? 'NOT_FOUND'
                : status === 409
                  ? 'CONFLICT'
                  : 'INVALID_REQUEST',
      'The CMS registry operation was rejected.',
      safeDetails(payload, status),
    );
  }
  return unavailable();
};

export const mapAuthResult = <T>(
  result: AuthenticationResult<T>,
): ContentSchemaRegistryResult<T> => {
  if (result.ok) return result;
  const status = statusIsSupported(result.status) ? result.status : 503;
  return errorResult(
    status,
    result.code,
    result.message,
    // BE00: an UNAUTHENTICATED 401 always carries the one allowlisted
    // recovery action, whichever layer (authentication or CMS) refused.
    status === 401 && result.code === 'UNAUTHENTICATED'
      ? { recoveryAction: 'reauthenticate' }
      : safeDetails(result, status),
    result.retryAfterSeconds,
  ) as ContentSchemaRegistryError;
};
