import { MFA_METHOD_REGISTRY } from '../authentication/step-up';
import type { AuthenticationResult } from '../authentication/types';
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
 * BE03a OD-4: a 400/422 carries at most 50 `{ pointer, message }` JSON-pointer
 * violations. An entry needs both members in bounded printable ASCII or it is
 * dropped; unknown members are never copied.
 */
const safeViolations = (
  value: unknown,
): readonly Readonly<{ pointer: string; message: string }>[] => {
  if (!Array.isArray(value)) return [];
  const kept: Array<Readonly<{ pointer: string; message: string }>> = [];
  for (const entry of value as readonly unknown[]) {
    if (kept.length === MAX_DETAIL_VIOLATIONS) break;
    if (!isRecord(entry)) continue;
    const { pointer, message } = entry;
    if (
      printable(pointer, MAX_VIOLATION_POINTER_LENGTH) &&
      printable(message, MAX_VIOLATION_MESSAGE_LENGTH)
    )
      kept.push({ pointer, message });
  }
  return kept;
};

export const safeDetails = (
  value: unknown,
  status?: number,
): Readonly<Record<string, unknown>> => {
  if (!isRecord(value)) return {};
  const details = detailRecord(value);
  const primitives = Object.fromEntries(
    [
      'dependencyClass',
      'retryable',
      'recoveryAction',
      'reasonCode',
      'expectedVersion',
      'currentVersion',
      'limit',
      'resetAt',
      'retryAfterSeconds',
    ].flatMap((key) => {
      const candidate = details[key];
      return typeof candidate === 'string' ||
        typeof candidate === 'number' ||
        typeof candidate === 'boolean'
        ? [[key, candidate]]
        : [];
    }),
  );
  const violations =
    status === 400 || status === 422 ? safeViolations(details.violations) : [];
  return violations.length === 0 ? primitives : { ...primitives, violations };
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
    IDEMPOTENCY_MISMATCH: {
      status: 409,
      code: 'IDEMPOTENCY_CONFLICT',
      message: 'The idempotency key was used for another request.',
    },
    IDEMPOTENCY_CONFLICT: {
      status: 409,
      code: 'IDEMPOTENCY_CONFLICT',
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

export const mapRpcFailure = (
  status: number,
  payload: unknown,
): ContentSchemaRegistryError => {
  const code = codeFromRpcError(payload);
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
    safeDetails(result),
    result.retryAfterSeconds,
  ) as ContentSchemaRegistryError;
};
