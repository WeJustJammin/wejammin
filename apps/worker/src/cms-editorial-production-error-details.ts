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
