import {
  CMS_SLICE_12_TIME_REASONS,
  CmsGovernedTimeRefusalDetailsSchema,
} from '@wejammin/contracts';

/**
 * The `details` of a time-authority refusal of a scheduled activation (BE03b E8, BE03c 1326 step 6),
 * rebuilt member by member and validated against the strict contract schema. The members each
 * token carries come from the 03b time authority (Worker side) or from the database's machine
 * DETAIL (`tzdb_version_mismatch`, `schedule_out_of_horizon`); nothing else a provider says is kept.
 */

const MEMBERS: Readonly<Record<string, readonly string[]>> = {
  tzdb_version_mismatch: ['pinnedVersion'],
  resolved_utc_mismatch: ['expectedUtc'],
  schedule_out_of_horizon: ['minUtc', 'maxUtc'],
  nonexistent_local_time: ['alternatives'],
  ambiguous_local_time: ['alternatives'],
};
const VIOLATION_MESSAGE = 'The value is invalid.';

export const isGovernedTimeReason = (reason: unknown): reason is string =>
  typeof reason === 'string' &&
  (CMS_SLICE_12_TIME_REASONS as readonly string[]).includes(reason);

const recordOf = (value: unknown): Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : {};

/** `null`: the source lacks a member the token requires, so it is not a valid refusal. */
export const governedTimeDetails = (
  reason: string,
  source: Readonly<Record<string, unknown>>,
  pointers: ReadonlySet<string>,
): Record<string, unknown> | null => {
  const candidate: Record<string, unknown> = { reasonCode: reason };
  for (const member of MEMBERS[reason] ?? [])
    if (source[member] !== undefined) candidate[member] = source[member];
  const violations = (Array.isArray(source.violations) ? source.violations : [])
    .map((entry) => recordOf(entry).path)
    .filter(
      (path): path is string => typeof path === 'string' && pointers.has(path),
    )
    .slice(0, 50)
    .map((path) => ({ path, code: reason, message: VIOLATION_MESSAGE }));
  if (violations.length > 0) candidate.violations = violations;
  const parsed = CmsGovernedTimeRefusalDetailsSchema.safeParse(candidate);
  return parsed.success ? (parsed.data as Record<string, unknown>) : null;
};
