import {
  CmsEditorialRefusalDetailsSchema,
  CmsStaleVersionDetailsSchema,
  cmsSlice11ReasonStatus,
  type CmsEditorialRoutePolicy,
  type CmsSlice11ReasonCode,
} from '@wejammin/contracts';

import { isSafePointer, VIOLATION_CODE } from './error-vocabulary';
import { clampRetryAfterSeconds } from './route-error-details';
import type { CmsEditorialError } from './types';

/**
 * The detail members of a published Slice 11 refusal (BE03b "Contract and error
 * matrix"): bounded safe violations, the operation's registered typed reason,
 * the strict structured members of each reason and the safe versions of a stale
 * operand. Nothing here is copied from dependency output; every member is
 * rebuilt and validated against the contract's strict detail schemas.
 */

const VIOLATION_MESSAGE = 'The value is invalid.';
const MAX_VIOLATIONS = 50;
const DECIMAL_VERSION = /^[1-9]\d{0,18}$/u;
const RATE_RESET_AT = /^\d{1,12}$/u;
const MAX_RATE_LIMIT = 10_000;

/** Members a typed reason may carry beyond its token, by reason. */
const STRUCTURED_MEMBERS: Readonly<Record<string, readonly string[]>> = {
  preflight_failed: ['preflight'],
  dependency_changed: ['dependencyHash'],
  tzdb_version_mismatch: ['pinnedVersion'],
  resolved_utc_mismatch: ['expectedUtc'],
  schedule_out_of_horizon: ['minUtc', 'maxUtc'],
  nonexistent_local_time: ['alternatives'],
  ambiguous_local_time: ['alternatives'],
};

export type Source = Readonly<Record<string, unknown>>;

export const recordOf = (value: unknown): Source =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Source)
    : {};

/** Bounded, pointer-shaped, message-redacted violations (BE03b). */
const violationsOf = (
  source: Source,
): readonly Readonly<{ path: string; code: string; message: string }>[] => {
  const raw = Array.isArray(source.violations) ? source.violations : [];
  const projected: { path: string; code: string; message: string }[] = [];
  for (const entry of raw) {
    const candidate = recordOf(entry);
    if (
      isSafePointer(candidate.path) &&
      typeof candidate.code === 'string' &&
      VIOLATION_CODE.test(candidate.code)
    )
      projected.push({
        path: candidate.path,
        code: candidate.code,
        message: VIOLATION_MESSAGE,
      });
    if (projected.length === MAX_VIOLATIONS) break;
  }
  return projected;
};

export const withViolations = (
  details: Record<string, unknown>,
  source: Source,
): Record<string, unknown> => {
  const violations = violationsOf(source);
  return violations.length === 0 ? details : { ...details, violations };
};

/** The token, when this operation registers it with this status. */
const registeredReason = (
  source: Source,
  policy: CmsEditorialRoutePolicy,
  status: 403 | 409 | 422,
): CmsSlice11ReasonCode | null => {
  const token = source.reasonCode;
  const allowed = (policy.reasonCodes ?? []) as readonly string[];
  return typeof token === 'string' &&
    allowed.includes(token) &&
    cmsSlice11ReasonStatus(token as CmsSlice11ReasonCode) === status
    ? (token as CmsSlice11ReasonCode)
    : null;
};

const MAX_PREFLIGHT_ENTRIES = 17;

/** `details.preflight` carries category, outcome and reason only (no counts or text). */
const bareEntries = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.slice(0, MAX_PREFLIGHT_ENTRIES).map((entry) => {
        const { category, outcome, reasonCode } = recordOf(entry);
        return { category, outcome, reasonCode };
      })
    : value;

/** The typed-reason details, rebuilt and validated against the strict contract. */
const refusalDetails = (
  reason: CmsSlice11ReasonCode,
  source: Source,
): Record<string, unknown> | null => {
  const candidate: Record<string, unknown> = { reasonCode: reason };
  for (const member of STRUCTURED_MEMBERS[reason] ?? [])
    if (source[member] !== undefined)
      candidate[member] =
        member === 'preflight' ? bareEntries(source[member]) : source[member];
  const violations = violationsOf(source);
  if (violations.length > 0) candidate.violations = violations;
  const parsed = CmsEditorialRefusalDetailsSchema.safeParse(candidate);
  return parsed.success ? (parsed.data as Record<string, unknown>) : null;
};

const staleVersionDetails = (source: Source): Record<string, unknown> => {
  const candidate: Record<string, unknown> = {
    conflict: 'VERSION_MISMATCH',
    recoveryAction: source.recoveryAction === 'refresh' ? 'refresh' : 'reload',
  };
  for (const member of ['expectedVersion', 'currentVersion'] as const) {
    const value = source[member];
    if (typeof value === 'string' && DECIMAL_VERSION.test(value))
      candidate[member] = value;
  }
  return CmsStaleVersionDetailsSchema.parse(candidate) as Record<
    string,
    unknown
  >;
};

export const conflictDetails = (
  source: Source,
  policy: CmsEditorialRoutePolicy,
): Record<string, unknown> => {
  const reason = registeredReason(source, policy, 409);
  const typed = reason === null ? null : refusalDetails(reason, source);
  if (typed !== null) return typed;
  if (source.conflict === 'VERSION_MISMATCH')
    return staleVersionDetails(source);
  if (source.conflict === 'IDEMPOTENCY_MISMATCH')
    return {
      conflict: 'IDEMPOTENCY_MISMATCH',
      recoveryAction: 'use_new_idempotency_key',
    };
  return { conflict: 'INVALID_TRANSITION', recoveryAction: 'refresh' };
};

export const forbiddenDetails = (
  source: Source,
  policy: CmsEditorialRoutePolicy,
): Record<string, unknown> => {
  const reason = registeredReason(source, policy, 403);
  // An origin, CSRF or unclassified denial names no typed reason.
  return reason === null ? {} : { reasonCode: reason };
};

export const validationDetails = (
  source: Source,
  policy: CmsEditorialRoutePolicy,
): Record<string, unknown> => {
  const reason = registeredReason(source, policy, 422);
  const typed = reason === null ? null : refusalDetails(reason, source);
  return typed ?? withViolations({}, source);
};

export const rateDetails = (
  error: CmsEditorialError,
  source: Source,
): Record<string, unknown> => {
  const details: Record<string, unknown> = {};
  const limit = source.limit;
  if (
    typeof limit === 'number' &&
    Number.isSafeInteger(limit) &&
    limit >= 1 &&
    limit <= MAX_RATE_LIMIT
  )
    details.limit = limit;
  if (typeof source.resetAt === 'string' && RATE_RESET_AT.test(source.resetAt))
    details.resetAt = source.resetAt;
  details.retryAfterSeconds = clampRetryAfterSeconds(
    error.retryAfterSeconds ?? source.retryAfterSeconds,
  );
  return details;
};
