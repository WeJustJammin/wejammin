import type {
  CmsEditorialProductionError,
  CmsEditorialProductionResult,
  CmsEditorialProductionOperationId,
} from './cms-editorial-production-types';
import { CMS_EDITORIAL_RPC } from './cms-editorial-production-types';
import {
  SERIALIZATION_TOKENS,
  STRUCTURED_TOKENS,
  failureForToken,
  type FailureMapping,
} from './cms-editorial-production-error-tokens';
import {
  isRecord,
  safeDetails,
  violationsFromDetailText,
} from './cms-editorial-production-error-details';

export {
  isRecord,
  safeDetails,
  violationsFromDetailText,
  type SafeViolation,
} from './cms-editorial-production-error-details';

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

/** Stable RPC-to-ApiError mapping for the 03b editorial surface. */
export const knownEditorialFailure = (code: string): FailureMapping | null =>
  failureForToken(code);

/**
 * The SQLSTATEs PostgREST reports for `RAISE EXCEPTION '<token>' USING
 * ERRCODE=...`. `P0001` is the platform's plain raise; `40001` is a CAS
 * refusal (restore entry version, presence pointer) that PostgREST would
 * otherwise surface as an HTTP 500. Both are generic, so neither is trusted as
 * the failure token itself; each only licences reading the exact machine token
 * from `message`.
 */
const POSTGREST_RAISE_SQLSTATE = 'P0001';
const POSTGREST_SERIALIZATION_SQLSTATE = '40001';

const sqlstateOf = (value: unknown): string =>
  isRecord(value) && typeof value.code === 'string'
    ? value.code.trim().toUpperCase()
    : '';

/**
 * Extract the failure token from an RPC error payload.
 *
 * BE03b's RPCs return a machine token in the structured code field and prose in
 * message/detail. Only the exact structured token is trusted here: a substring
 * search across the prose would let a caller-influenced detail (for example a
 * 409 conflict whose detail merely mentions a missing record) remap the status
 * or un-conceal a 404. A token that is not an exact table value is treated as
 * absent, and the caller falls back to the status table, which is fail closed.
 *
 * The platform RPCs raise `EXCEPTION '<TOKEN>' USING ERRCODE='P0001'`, so
 * PostgREST surfaces the generic SQLSTATE in `code` and the machine token in
 * `message`. For that SQLSTATE the `message` is adopted only when it is, whole
 * and case-sensitively, a key of the closed token table (uppercase BE00 codes
 * and the lowercase BE03b reasons); for `40001` only the two CAS tokens. The
 * message is never searched, so prose or an injected detail cannot influence it.
 */
export const codeFromRpcError = (value: unknown): string => {
  if (!isRecord(value)) return '';
  const normalized = sqlstateOf(value);
  if (STRUCTURED_TOKENS.has(normalized)) return normalized;
  if (
    normalized !== POSTGREST_RAISE_SQLSTATE &&
    normalized !== POSTGREST_SERIALIZATION_SQLSTATE
  )
    return '';
  const message = value.message;
  if (typeof message !== 'string') return '';
  const messageToken = message.trim();
  if (normalized === POSTGREST_SERIALIZATION_SQLSTATE)
    return SERIALIZATION_TOKENS.has(messageToken) ? messageToken : '';
  return failureForToken(messageToken) === null ? '' : messageToken;
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

/**
 * Mapper-owned details are a closed lookup: they replace any payload-supplied
 * `conflict`, `recoveryAction` or `reasonCode`, so the database can name a
 * reason only through its token, never through free text.
 */
const mappedDetails = (
  mapped: FailureMapping,
  payload: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> => {
  const details: Record<string, unknown> = {
    ...safeDetails(mapped.status, payload),
    ...mapped.details,
  };
  if (mapped.status === 400 || mapped.status === 422) {
    const pointers = violationsFromDetailText(
      payload.details,
      mapped.details?.reasonCode,
    );
    if (pointers.length > 0) details.violations = pointers;
  }
  return details;
};

export const mapCmsEditorialRpcFailure = (
  status: number,
  payload: unknown,
): CmsEditorialProductionError => {
  const code = codeFromRpcError(payload);
  const mapped = code === '' ? null : knownEditorialFailure(code);
  if (mapped !== null) {
    // The database's own INTERNAL_ERROR is a server fault: scrubbed, never
    // reworded as a caller error.
    if (mapped.status === 500) return internalError();
    return errorResult(
      mapped.status,
      mapped.code,
      mapped.message,
      // `mapped` exists only when `codeFromRpcError` found a token, and it
      // finds one only in a record payload (it returns '' for anything else).
      mappedDetails(mapped, payload as Readonly<Record<string, unknown>>),
      mapped.status === 429 ? 60 : undefined,
    );
  }
  // A plain RAISE the platform did not register (PostgREST answers it 4xx) is
  // an inconsistency in the database contract, not something the caller did.
  if (sqlstateOf(payload) === POSTGREST_RAISE_SQLSTATE && status < 500)
    return internalError();
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
