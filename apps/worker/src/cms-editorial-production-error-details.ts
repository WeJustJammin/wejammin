import {
  REGISTERED_REASON_CODES,
  REGISTERED_RECOVERY_ACTIONS,
  VIOLATION_CODE,
  isSafePointer,
} from './cms-editorial/error-vocabulary';

export const isRecord = (
  value: unknown,
): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

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

const MAX_DETAIL_TEXT_LENGTH = 16_384;
const VIOLATION_MESSAGE = 'The value is invalid.';

export type SafeViolation = Readonly<{
  path: string;
  code: string;
  message: string;
}>;

const violationFor = (path: string, code: string): SafeViolation => ({
  path,
  code,
  message: VIOLATION_MESSAGE,
});

const violationsFrom = (entries: readonly unknown[]): SafeViolation[] =>
  entries
    .flatMap((entry): SafeViolation[] => {
      if (isSafePointer(entry)) return [violationFor(entry, 'invalid')];
      if (!isRecord(entry) || !isSafePointer(entry.path)) return [];
      const code =
        typeof entry.code === 'string' && VIOLATION_CODE.test(entry.code)
          ? entry.code
          : 'invalid';
      return [violationFor(entry.path, code)];
    })
    .slice(0, MAX_DETAIL_VIOLATIONS);

/**
 * Bounded pointers a SQL command may attach as its PostgreSQL `DETAIL`: a JSON
 * array of RFC 6901 pointers (`/fields/{stableFieldId}[/...]`). Anything that
 * is not that array, and every entry outside the safe pointer grammar, is
 * dropped; prose never becomes a violation.
 */
export const violationsFromDetailText = (
  detail: unknown,
  reasonCode: string | undefined,
): SafeViolation[] => {
  if (typeof detail !== 'string' || detail.length > MAX_DETAIL_TEXT_LENGTH)
    return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(detail);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return violationsFrom(
    parsed.filter(isSafePointer).map((path) => ({
      path,
      code: reasonCode ?? 'invalid',
    })),
  );
};

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
  if (
    (status === 409 || status === 422) &&
    typeof details.reasonCode === 'string' &&
    !REGISTERED_REASON_CODES.has(details.reasonCode)
  )
    delete details.reasonCode;
  if (
    typeof details.recoveryAction === 'string' &&
    !REGISTERED_RECOVERY_ACTIONS.has(details.recoveryAction)
  )
    delete details.recoveryAction;
  const violations = source.violations;
  if (Array.isArray(violations))
    details.violations = violationsFrom(violations);
  return Object.fromEntries(Object.entries(details).slice(0, MAX_DETAIL_KEYS));
};

/**
 * Structured members of a Slice 11 typed refusal (BE03b): the preflight entries,
 * the dependency hash, the pinned release, the time-authority alternatives and
 * the safe versions. The database names them either in a JSON object `DETAIL`
 * of a raised refusal or in the `details` of a committed refusal disposition.
 * Only these keys are carried; the route boundary rebuilds each one against its
 * strict contract, so a value here is never published as received.
 */
const STRUCTURED_KEYS = [
  'preflight',
  'dependencyHash',
  'pinnedVersion',
  'expectedUtc',
  'minUtc',
  'maxUtc',
  'alternatives',
  'dependencyClass',
  'retryAfterSeconds',
  'expectedVersion',
  'currentVersion',
] as const;

export const structuredMembers = (
  source: unknown,
): Readonly<Record<string, unknown>> => {
  if (!isRecord(source)) return {};
  const members: Record<string, unknown> = {};
  for (const key of STRUCTURED_KEYS)
    if (source[key] !== undefined) members[key] = source[key];
  return members;
};

/** The members of a raised refusal whose machine DETAIL is a JSON object. */
export const structuredMembersFromDetailText = (
  detail: unknown,
): Readonly<Record<string, unknown>> => {
  if (typeof detail !== 'string' || detail.length > MAX_DETAIL_TEXT_LENGTH)
    return {};
  try {
    return structuredMembers(JSON.parse(detail) as unknown);
  } catch {
    return {};
  }
};
