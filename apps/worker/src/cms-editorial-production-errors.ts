import type {
  CmsEditorialProductionError,
  CmsEditorialProductionResult,
  CmsEditorialProductionOperationId,
} from './cms-editorial-production-types';
import { CMS_EDITORIAL_RPC } from './cms-editorial-production-types';

export const isRecord = (
  value: unknown,
): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isAbortError = (value: unknown): boolean =>
  (typeof DOMException !== 'undefined' &&
    value instanceof DOMException &&
    value.name === 'AbortError') ||
  (isRecord(value) && value.name === 'AbortError');

export const errorResult = (
  status: CmsEditorialProductionError['status'],
  code: string,
  message: string,
  details: Readonly<Record<string, unknown>> = {},
  retryAfterSeconds?: number,
): CmsEditorialProductionError => ({
  ok: false,
  status,
  code,
  message,
  details,
  ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
});

/**
 * BE00 details allowlist. A 404 must stay indistinguishable from absence and a
 * 500 must stay scrubbed, so neither ever carries dependency detail.
 */
const DETAIL_KEYS = [
  'dependencyClass',
  'retryable',
  'recoveryAction',
  'reasonCode',
  'expectedVersion',
  'currentVersion',
  'limit',
  'resetAt',
  'retryAfterSeconds',
  'conflict',
  'expectedHash',
  'currentHash',
] as const;

const MAX_DETAIL_VIOLATIONS = 50;

const MAX_DETAIL_KEYS = 16;

export const safeDetails = (
  status: number,
  value: unknown,
): Readonly<Record<string, unknown>> => {
  if (status === 404 || status === 500) return {};
  if (!isRecord(value)) return {};
  const source = isRecord(value.details) ? value.details : value;
  const details: Record<string, unknown> = {};
  for (const key of DETAIL_KEYS) {
    const candidate = source[key];
    if (
      typeof candidate === 'string' ||
      typeof candidate === 'number' ||
      typeof candidate === 'boolean'
    )
      details[key] = candidate;
  }
  const violations = source.violations;
  if (Array.isArray(violations))
    details.violations = violations
      .filter((entry) => typeof entry === 'string')
      .slice(0, MAX_DETAIL_VIOLATIONS);
  return Object.fromEntries(Object.entries(details).slice(0, MAX_DETAIL_KEYS));
};

export const unavailable = (dependencyClass = 'cms_editorial') =>
  errorResult(
    503,
    'DEPENDENCY_UNAVAILABLE',
    'The CMS editorial dependency is temporarily unavailable.',
    { dependencyClass, retryable: true },
    5,
  );

export const deadlineExceeded = (dependencyClass = 'cms_editorial') =>
  errorResult(
    504,
    'GATEWAY_TIMEOUT',
    'The CMS editorial dependency exceeded its deadline.',
    { dependencyClass, retryable: true },
    5,
  );

export const invalidResponse = () =>
  errorResult(
    502,
    'BAD_GATEWAY',
    'The CMS editorial dependency returned an invalid response.',
    { dependencyClass: 'cms_editorial', retryable: false },
  );

export const sessionUnavailable = () => unavailable('authentication');

export const contextUnavailable = () => unavailable('request_context');

export const internalError = () =>
  errorResult(500, 'INTERNAL_ERROR', 'An unexpected error occurred.', {});

const SUPPORTED_STATUSES: readonly CmsEditorialProductionError['status'][] = [
  400, 401, 403, 404, 409, 415, 422, 429, 500, 502, 503, 504,
];

export const statusIsSupported = (
  value: number,
): value is CmsEditorialProductionError['status'] =>
  (SUPPORTED_STATUSES as readonly number[]).includes(value);

type FailureMapping = Readonly<{
  status: CmsEditorialProductionError['status'];
  code: string;
  message: string;
}>;

/** Stable RPC-to-ApiError mapping for the 03b editorial surface. */
export const knownEditorialFailure = (code: string): FailureMapping | null => {
  const failures: Readonly<Record<string, FailureMapping>> = {
    INVALID_REQUEST: {
      status: 400,
      code: 'INVALID_REQUEST',
      message: 'The CMS editorial request is invalid.',
    },
    UNSUPPORTED_MEDIA_TYPE: {
      status: 415,
      code: 'UNSUPPORTED_MEDIA_TYPE',
      message: 'The CMS editorial request media type is unsupported.',
    },
    UNAUTHENTICATED: {
      status: 401,
      code: 'UNAUTHENTICATED',
      message: 'The authentication session is invalid.',
    },
    FORBIDDEN: {
      status: 403,
      code: 'FORBIDDEN',
      message: 'The action is not allowed.',
    },
    NOT_FOUND: {
      status: 404,
      code: 'NOT_FOUND',
      message: 'The requested CMS editorial resource was not found.',
    },
    IDEMPOTENCY_MISMATCH: {
      status: 409,
      code: 'CONFLICT',
      message: 'The idempotency key was used for another request.',
    },
    IDEMPOTENCY_CONFLICT: {
      status: 409,
      code: 'CONFLICT',
      message: 'The idempotency key was used for another request.',
    },
    VERSION_MISMATCH: {
      status: 409,
      code: 'CONFLICT',
      message: 'The CMS editorial resource changed; reload and try again.',
    },
    CONFLICT: {
      status: 409,
      code: 'CONFLICT',
      message: 'The CMS editorial operation conflicts with current state.',
    },
    VALIDATION_FAILED: {
      status: 422,
      code: 'VALIDATION_FAILED',
      message: 'The CMS editorial request failed validation.',
    },
    RATE_LIMITED: {
      status: 429,
      code: 'RATE_LIMITED',
      message: 'Too many CMS editorial requests.',
    },
    DEPENDENCY_UNAVAILABLE: {
      status: 503,
      code: 'DEPENDENCY_UNAVAILABLE',
      message: 'The CMS editorial dependency is temporarily unavailable.',
    },
  };
  return failures[code] ?? null;
};

const RPC_FAILURE_CODES = [
  'INVALID_REQUEST',
  'UNSUPPORTED_MEDIA_TYPE',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'IDEMPOTENCY_MISMATCH',
  'IDEMPOTENCY_CONFLICT',
  'VERSION_MISMATCH',
  'CONFLICT',
  'VALIDATION_FAILED',
  'RATE_LIMITED',
  'DEPENDENCY_UNAVAILABLE',
] as const;

/**
 * The SQLSTATE PostgREST reports for a plain `RAISE EXCEPTION '<TOKEN>' USING
 * ERRCODE='P0001'`. It is generic, so it is never trusted as the failure token
 * itself; it only licences reading the exact machine token from `message`.
 */
const POSTGREST_RAISE_SQLSTATE = 'P0001';

/**
 * Extract the failure token from an RPC error payload.
 *
 * BE03b's RPCs return a machine token in the structured code field and prose in
 * message/detail. Only the exact structured token is trusted here: a substring
 * search across the prose would let a caller-influenced detail (for example a
 * 409 conflict whose detail merely mentions a missing record) remap the status
 * or un-conceal a 404. A token that is not an exact allowlisted value is treated
 * as absent, and the caller falls back to the status table, which is fail closed.
 *
 * The platform RPCs raise `EXCEPTION '<TOKEN>' USING ERRCODE='P0001'`, so
 * PostgREST surfaces the generic SQLSTATE in `code` and the machine token in
 * `message`. For that SQLSTATE alone an exact uppercase allowlisted `message`
 * token is adopted, because the alternative is silently collapsing a real
 * 404/409/422 onto the generic 400 fallback. The message is matched whole and
 * case-sensitively, never searched, so prose or an injected detail cannot
 * influence it.
 */
export const codeFromRpcError = (value: unknown): string => {
  if (!isRecord(value)) return '';
  const token = value.code;
  if (typeof token !== 'string') return '';
  const normalized = token.trim().toUpperCase();
  if ((RPC_FAILURE_CODES as readonly string[]).includes(normalized))
    return normalized;
  if (normalized !== POSTGREST_RAISE_SQLSTATE) return '';
  const message = value.message;
  if (typeof message !== 'string') return '';
  const messageToken = message.trim();
  return (RPC_FAILURE_CODES as readonly string[]).includes(messageToken)
    ? messageToken
    : '';
};

const statusFallback = (
  status: number,
): Readonly<{
  status: CmsEditorialProductionError['status'];
  code: string;
}> => {
  if (status === 401) return { status: 401, code: 'UNAUTHENTICATED' };
  if (status === 403) return { status: 403, code: 'FORBIDDEN' };
  if (status === 404) return { status: 404, code: 'NOT_FOUND' };
  if (status === 409) return { status: 409, code: 'CONFLICT' };
  if (status === 415) return { status: 415, code: 'UNSUPPORTED_MEDIA_TYPE' };
  if (status === 422) return { status: 422, code: 'VALIDATION_FAILED' };
  if (status === 429) return { status: 429, code: 'RATE_LIMITED' };
  if (status === 413) return { status: 400, code: 'INVALID_REQUEST' };
  if (status === 400) return { status: 400, code: 'INVALID_REQUEST' };
  return { status: 503, code: 'DEPENDENCY_UNAVAILABLE' };
};

export const mapCmsEditorialRpcFailure = (
  status: number,
  payload: unknown,
): CmsEditorialProductionError => {
  const code = codeFromRpcError(payload);
  const mapped = code === '' ? null : knownEditorialFailure(code);
  if (mapped !== null)
    return errorResult(
      mapped.status,
      mapped.code,
      mapped.message,
      safeDetails(mapped.status, payload),
      mapped.status === 429 ? 60 : undefined,
    );
  if (status === 504) return deadlineExceeded();
  if (status === 502) return invalidResponse();
  if (status >= 500) return unavailable();
  const fallback = statusFallback(status);
  return errorResult(
    fallback.status,
    fallback.code,
    'The CMS editorial operation was rejected.',
    safeDetails(fallback.status, payload),
    fallback.status === 429 ? 60 : undefined,
  );
};

export const mapAuthenticationFailure = <T>(result: {
  ok: false;
  status: number;
  code: string;
  message: string;
}): CmsEditorialProductionResult<T> => {
  const status = statusIsSupported(result.status) ? result.status : 503;
  return errorResult(
    status,
    result.code,
    result.message,
    safeDetails(status, result),
  ) as CmsEditorialProductionResult<T>;
};

export const rpcNameFor = (operationId: CmsEditorialProductionOperationId) =>
  CMS_EDITORIAL_RPC[operationId];
