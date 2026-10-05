export class CanonicalStateError extends Error {}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const requireString = (
  value: Record<string, unknown>,
  key: string,
): string => {
  const entry = value[key];
  if (typeof entry !== 'string' || entry.length === 0)
    throw new CanonicalStateError(key);
  return entry;
};

export const optionalString = (
  value: Record<string, unknown>,
  key: string,
): string | undefined => {
  const entry = value[key];
  if (entry === undefined) return undefined;
  if (typeof entry !== 'string') throw new CanonicalStateError(key);
  return entry;
};

export const rejectUnknownKeys = (
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
): void => {
  for (const key of Object.keys(value))
    if (!allowed.has(key)) throw new CanonicalStateError('unknown');
};

const ERROR_CODES = new Set([
  'INVALID_REQUEST',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'VALIDATION_FAILED',
  'RATE_LIMITED',
  'DEPENDENCY_INVALID_RESPONSE',
  'DEPENDENCY_UNAVAILABLE',
  'DEPENDENCY_DEADLINE_EXCEEDED',
  'INTERNAL_ERROR',
]);

const ERROR_DETAIL_KEYS = new Set(['code', 'message', 'requestId']);

const REQUEST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

/**
 * The BE00 `ApiError.requestId` of a failed read is the one diagnostic
 * identifier the island may carry (FE03: typed ApiError with request ID). It
 * is optional and must be a UUID; any other shape fails closed.
 */
export const validateRequestId = (value: Record<string, unknown>): void => {
  const requestId = value.requestId;
  if (requestId === undefined) return;
  if (typeof requestId !== 'string' || !REQUEST_ID_PATTERN.test(requestId))
    throw new CanonicalStateError('requestId');
};

export const validateError = (value: unknown): void => {
  if (!isRecord(value)) throw new CanonicalStateError('error');
  rejectUnknownKeys(value, ERROR_DETAIL_KEYS);
  if (!ERROR_CODES.has(requireString(value, 'code')))
    throw new CanonicalStateError('error code');
  requireString(value, 'message');
  validateRequestId(value);
};

export const validateRouteMeta = (value: Record<string, unknown>): void => {
  if (value.httpStatus !== undefined && !Number.isInteger(value.httpStatus))
    throw new CanonicalStateError('httpStatus');
  if (
    value.retryAfterSeconds !== undefined &&
    value.retryAfterSeconds !== null &&
    !Number.isInteger(value.retryAfterSeconds)
  )
    throw new CanonicalStateError('retryAfterSeconds');
};
