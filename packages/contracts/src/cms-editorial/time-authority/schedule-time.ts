import type { CmsEditorialRefusalDetails } from '../refusals.ts';
import {
  formatLocalDateTime,
  formatUtcInstant,
  parseInstant,
  parseLocalDateTime,
} from './local-datetime.ts';
import { resolveLocal, type CompiledZone } from './tzdb-zone.ts';

/*
 * BE03b "Time authority (E8)": resolving a `PublicationScheduleRequest`'s local
 * time to ONE UTC instant over the pinned tz snapshot. The Worker and the
 * schedule form run this very function, and the Worker's answer is
 * authoritative. The steps, in order:
 *   1 the zone is a canonical or link name of the snapshot  (unknown_timezone)
 *   2 tzdbVersion equals the pin                            (tzdb_version_mismatch)
 *   3 the set U of instants for the local time is computed  (|U| is 0, 1 or 2)
 *   4 |U| = 0: a gap                                        (nonexistent_local_time)
 *   5 |U| = 1: disambiguation must be none                  (disambiguation_not_applicable)
 *   6 |U| = 2: none is ambiguous, earlier/later select      (ambiguous_local_time)
 *   7 resolvedUtc equals the selected instant               (resolved_utc_mismatch)
 *   8 resolvedUtc is 60 s to 366 d after acceptance         (schedule_out_of_horizon)
 */

/** `resolvedUtc` is at least this many seconds after the acceptance instant. */
export const CMS_SCHEDULE_MIN_LEAD_SECONDS = 60 as const;
/** `resolvedUtc` is at most this many days after the acceptance instant. */
export const CMS_SCHEDULE_MAX_HORIZON_DAYS = 366 as const;

/** The members of a schedule request the time rules read (already schema-validated). */
export type ScheduleTimeInput = Readonly<{
  localDateTime: string;
  timezone: string;
  resolvedUtc: string;
  tzdbVersion: string;
  disambiguation: 'none' | 'earlier' | 'later';
}>;

/** A zone of the pinned snapshot by name, or undefined for a name outside it. */
export type ZoneLookup = (name: string) => CompiledZone | undefined;

export type ScheduleTimeAccepted = Readonly<{
  ok: true;
  /** The selected instant as canonical `Z` text at the request's precision. */
  resolvedUtc: string;
  unixSeconds: number;
  nanos: number;
  /** The UT offset (seconds) in effect at the selected instant. */
  offsetSeconds: number;
  disambiguation: ScheduleTimeInput['disambiguation'];
}>;

export type ScheduleTimeRefusal = Readonly<{
  ok: false;
  status: 422;
  /** RFC 6901 pointer into the request body. */
  pointer:
    | '/timezone'
    | '/tzdbVersion'
    | '/localDateTime'
    | '/disambiguation'
    | '/resolvedUtc';
  details: CmsEditorialRefusalDetails;
}>;

export type ScheduleTimeResolution = ScheduleTimeAccepted | ScheduleTimeRefusal;

const refuse = (
  pointer: ScheduleTimeRefusal['pointer'],
  details: CmsEditorialRefusalDetails,
): ScheduleTimeRefusal => ({ ok: false, status: 422, pointer, details });

const MILLISECOND_NANOS = 1_000_000;

/** Formats a millisecond instant as `Z` text with millisecond precision. */
const formatMillis = (milliseconds: number): string =>
  formatUtcInstant(
    Math.floor(milliseconds / 1_000),
    (((milliseconds % 1_000) + 1_000) % 1_000) * MILLISECOND_NANOS,
    3,
  );

/**
 * Resolves a schedule's time over the pinned snapshot. `nowMs` is the
 * acceptance instant. The input must already satisfy the request schema: a
 * `localDateTime` it would have refused is a caller error (RangeError).
 */
export const resolveScheduleTime = (
  zoneOf: ZoneLookup,
  pinnedVersion: string,
  input: ScheduleTimeInput,
  nowMs: number,
): ScheduleTimeResolution => {
  const local = parseLocalDateTime(input.localDateTime);
  if (local === null)
    throw new RangeError('localDateTime must satisfy the request schema.');

  const zone = zoneOf(input.timezone);
  if (zone === undefined)
    return refuse('/timezone', { reasonCode: 'unknown_timezone' });

  if (input.tzdbVersion !== pinnedVersion)
    return refuse('/tzdbVersion', {
      reasonCode: 'tzdb_version_mismatch',
      pinnedVersion,
    });

  const resolution = resolveLocal(zone, local.naiveSeconds);
  const instantText = (seconds: number): string =>
    formatUtcInstant(seconds, local.nanos, local.fractionDigits);

  if (resolution.kind === 'gap') {
    const length = resolution.after - resolution.before;
    return refuse('/localDateTime', {
      reasonCode: 'nonexistent_local_time',
      alternatives: [
        {
          localDateTime: formatLocalDateTime(
            local.naiveSeconds - length,
            local,
          ),
          resolvedUtc: instantText(
            local.naiveSeconds - length - resolution.before,
          ),
        },
        {
          localDateTime: formatLocalDateTime(
            local.naiveSeconds + length,
            local,
          ),
          resolvedUtc: instantText(
            local.naiveSeconds + length - resolution.after,
          ),
        },
      ],
    });
  }

  let selected: { instant: number; offset: number };
  if (resolution.kind === 'unique') {
    if (input.disambiguation !== 'none')
      return refuse('/disambiguation', {
        reasonCode: 'disambiguation_not_applicable',
      });
    selected = resolution;
  } else if (input.disambiguation === 'none') {
    return refuse('/disambiguation', {
      reasonCode: 'ambiguous_local_time',
      alternatives: [
        {
          disambiguation: 'earlier',
          resolvedUtc: instantText(resolution.earlier.instant),
        },
        {
          disambiguation: 'later',
          resolvedUtc: instantText(resolution.later.instant),
        },
      ],
    });
  } else
    selected =
      input.disambiguation === 'earlier'
        ? resolution.earlier
        : resolution.later;

  const given = parseInstant(input.resolvedUtc);
  if (
    given === null ||
    given.seconds !== selected.instant ||
    given.nanos !== local.nanos
  )
    return refuse('/resolvedUtc', {
      reasonCode: 'resolved_utc_mismatch',
      expectedUtc: instantText(selected.instant),
    });

  const givenNanos =
    BigInt(given.seconds) * 1_000_000_000n + BigInt(given.nanos);
  const nowNanos = BigInt(Math.floor(nowMs)) * 1_000_000n;
  const minNanos =
    nowNanos + BigInt(CMS_SCHEDULE_MIN_LEAD_SECONDS) * 1_000_000_000n;
  const maxNanos =
    nowNanos + BigInt(CMS_SCHEDULE_MAX_HORIZON_DAYS) * 86_400n * 1_000_000_000n;
  if (givenNanos < minNanos || givenNanos > maxNanos)
    return refuse('/resolvedUtc', {
      reasonCode: 'schedule_out_of_horizon',
      minUtc: formatMillis(
        Math.floor(nowMs) + CMS_SCHEDULE_MIN_LEAD_SECONDS * 1_000,
      ),
      maxUtc: formatMillis(
        Math.floor(nowMs) + CMS_SCHEDULE_MAX_HORIZON_DAYS * 86_400 * 1_000,
      ),
    });

  return {
    ok: true,
    resolvedUtc: instantText(selected.instant),
    unixSeconds: selected.instant,
    nanos: local.nanos,
    offsetSeconds: selected.offset,
    disambiguation: input.disambiguation,
  };
};

const TWELVE_HOURS_NANOS = 12n * 3_600n * 1_000_000_000n;
const FOURTEEN_HOURS_NANOS = 14n * 3_600n * 1_000_000_000n;

/**
 * The RPC's own check, which needs no tz rules: `localDateTime` read as UTC minus
 * `resolvedUtc` lies within -12 hours and +14 hours (the range of real UT
 * offsets), else 422 `resolved_utc_mismatch`. Caller input is therefore never
 * stored as verified time authority.
 */
export const cmsScheduleOffsetPlausible = (
  localDateTime: string,
  resolvedUtc: string,
): boolean => {
  const local = parseLocalDateTime(localDateTime);
  const resolved = parseInstant(resolvedUtc);
  if (local === null || resolved === null) return false;
  const difference =
    (BigInt(local.naiveSeconds) - BigInt(resolved.seconds)) * 1_000_000_000n +
    BigInt(local.nanos - resolved.nanos);
  return (
    difference >= -TWELVE_HOURS_NANOS && difference <= FOURTEEN_HOURS_NANOS
  );
};
