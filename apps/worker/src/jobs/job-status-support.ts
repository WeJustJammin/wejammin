import {
  CapabilitySchema,
  JobIdPathSchema,
  RequestIdSchema,
  type JsonValue,
} from '@wejammin/contracts';

import {
  type JobRateLimitDecision,
  type JobStatusPrincipal,
  type JobStatusRecord,
} from './job-status-types';

export const JOBS_PATH = '/api/v1/jobs';
export const JOBS_PATH_PREFIX = `${JOBS_PATH}/`;
export const NOT_FOUND_MESSAGE = 'The requested job was not found.';

export type JobErrorCode =
  | 'FORBIDDEN'
  | 'INVALID_REQUEST'
  | 'UNAUTHENTICATED'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'DEPENDENCY_UNAVAILABLE'
  | 'INTERNAL_ERROR';

export type JobError = Readonly<{
  code: JobErrorCode;
  details: Readonly<Record<string, JsonValue>>;
  message: string;
  status: 400 | 401 | 403 | 404 | 429 | 500 | 503;
  retryAfterSeconds?: number;
  rate?: JobRateLimitDecision;
}>;

export type JobReadResult =
  | Readonly<{ kind: 'success'; record: JobStatusRecord; notModified: boolean }>
  | Readonly<{ kind: 'error'; error: JobError }>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const hasOnlyKeys = (
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean => Object.keys(value).every((key) => keys.includes(key));

export const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && RequestIdSchema.safeParse(value).success;

const isCapabilities = (value: unknown): value is readonly string[] =>
  Array.isArray(value) &&
  value.length <= 64 &&
  new Set(value).size === value.length &&
  value.every((capability) => CapabilitySchema.safeParse(capability).success);

export const parsePrincipal = (
  value: unknown,
): JobStatusPrincipal | null | 'invalid' => {
  if (value === null || value === undefined) return null;
  if (!isRecord(value) || typeof value.kind !== 'string') return 'invalid';

  switch (value.kind) {
    case 'anonymous':
      return hasOnlyKeys(value, ['kind']) ? { kind: 'anonymous' } : 'invalid';
    case 'user':
      return hasOnlyKeys(value, ['kind', 'userId']) && isUuid(value.userId)
        ? { kind: 'user', userId: value.userId }
        : 'invalid';
    case 'acting_party':
      return hasOnlyKeys(value, [
        'kind',
        'userId',
        'actingPartyId',
        'capabilities',
      ]) &&
        isUuid(value.userId) &&
        isUuid(value.actingPartyId) &&
        isCapabilities(value.capabilities)
        ? {
            actingPartyId: value.actingPartyId,
            capabilities: value.capabilities,
            kind: 'acting_party',
            userId: value.userId,
          }
        : 'invalid';
    case 'operator':
      return hasOnlyKeys(value, [
        'kind',
        'userId',
        'actingPartyId',
        'capabilities',
        'stepUpVerified',
        'reason',
      ]) &&
        isUuid(value.userId) &&
        (value.actingPartyId === null || isUuid(value.actingPartyId)) &&
        isCapabilities(value.capabilities) &&
        typeof value.stepUpVerified === 'boolean' &&
        (value.reason === null ||
          (typeof value.reason === 'string' &&
            value.reason.trim().length >= 3 &&
            value.reason.length <= 240))
        ? {
            actingPartyId: value.actingPartyId,
            capabilities: value.capabilities,
            kind: 'operator',
            reason: value.reason,
            stepUpVerified: value.stepUpVerified,
            userId: value.userId,
          }
        : 'invalid';
    case 'queue':
    case 'webhook':
    case 'deployment':
    case 'service':
      return hasOnlyKeys(value, ['kind']) ? { kind: value.kind } : 'invalid';
    default:
      return 'invalid';
  }
};

export const parseRateDecision = (
  value: unknown,
): JobRateLimitDecision | null => {
  if (!isRecord(value)) return null;
  const { allowed, limit, remaining, resetAt, scope } = value;
  if (
    typeof allowed !== 'boolean' ||
    typeof limit !== 'number' ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    typeof remaining !== 'number' ||
    !Number.isSafeInteger(remaining) ||
    remaining < 0 ||
    remaining > limit ||
    typeof resetAt !== 'number' ||
    !Number.isSafeInteger(resetAt) ||
    resetAt < 0 ||
    (scope !== 'user' && scope !== 'party') ||
    rfc3339ResetAt(resetAt) === null
  )
    return null;
  return {
    allowed,
    limit,
    remaining,
    resetAt,
    scope,
  };
};

const rfc3339ResetAt = (resetAtSeconds: number): string | null => {
  const resetAtMs = resetAtSeconds * 1_000;
  if (!Number.isSafeInteger(resetAtMs)) return null;
  const date = new Date(resetAtMs);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

export const invalidPathError = (path = '/path/jobId'): JobError => ({
  code: 'INVALID_REQUEST',
  details: {
    violations: [
      {
        code: 'invalid_uuid',
        message: 'Expected exactly one canonical job identifier.',
        path,
      },
    ],
  },
  message: 'The request contains an invalid /path/jobId.',
  status: 400,
});

export const parseJobPath = (
  request: Request,
): Readonly<{ jobId: string }> | JobError => {
  const url = new URL(request.url);
  if (url.search.length > 0) return invalidPathError('/query');
  if (url.pathname === JOBS_PATH || !url.pathname.startsWith(JOBS_PATH_PREFIX))
    return invalidPathError();

  const rawJobId = url.pathname.slice(JOBS_PATH_PREFIX.length);
  if (
    rawJobId.length === 0 ||
    rawJobId.endsWith('/') ||
    rawJobId.includes('/') ||
    rawJobId.includes('%')
  )
    return invalidPathError();

  const parsed = JobIdPathSchema.safeParse({ jobId: rawJobId });
  return parsed.success ? parsed.data : invalidPathError();
};

export const dependencyError = (
  details: Readonly<Record<string, JsonValue>> = {},
): JobError => ({
  code: 'DEPENDENCY_UNAVAILABLE',
  details: {
    ...details,
    dependencyClass: 'job_status',
    retryAfterSeconds: 5,
    retryable: true,
  },
  message: 'Job status is temporarily unavailable.',
  retryAfterSeconds: 5,
  status: 503,
});

export const internalError = (): JobError => ({
  code: 'INTERNAL_ERROR',
  details: {},
  message: 'An unexpected error occurred.',
  status: 500,
});

export const notFoundError = (): JobError => ({
  code: 'NOT_FOUND',
  details: {},
  message: NOT_FOUND_MESSAGE,
  status: 404,
});

export const forbiddenOriginError = (): JobError => ({
  code: 'FORBIDDEN',
  details: {},
  message: 'The request origin is not allowed.',
  status: 403,
});

export const unauthenticatedError = (): JobError => ({
  code: 'UNAUTHENTICATED',
  details: { recoveryAction: 'reauthenticate' },
  message: 'Authentication is required.',
  status: 401,
});

export const rateLimitedError = (
  decision: JobRateLimitDecision,
  nowMs: number,
): JobError => {
  const resetAt = rfc3339ResetAt(decision.resetAt);
  if (resetAt === null) return internalError();
  const retryAfterSeconds = Math.max(
    1,
    decision.resetAt - Math.floor(nowMs / 1_000),
  );
  return {
    code: 'RATE_LIMITED',
    details: {
      limit: decision.limit,
      resetAt,
      retryAfterSeconds,
    },
    message: 'Too many job status reads. Retry after the supplied time.',
    rate: decision,
    retryAfterSeconds,
    status: 429,
  };
};
