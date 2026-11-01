/**
 * Schedule fixture times for the PostgREST suites.
 *
 * `pnpm db:api-test` runs every suite against one committed database, and the
 * sweep suites assert the production sweep's global claim holds only their own
 * schedules. A schedule another suite leaves pending must therefore never come
 * due during the run, and it must still sit inside the 60 s..366 d acceptance
 * horizon (CMS-03B-07), so no fixture may use a fixed calendar date. Offsets come
 * from the host tz data, as in `tests/e2e/support/s11-dst-gap.ts`.
 */
import { offsetMinutes } from '../../e2e/support/s11-dst-gap';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;

/** A pending leftover resolves at least this far ahead: longer than any full API run. */
export const SUITE_SAFE_LEAD_MS = 6 * HOUR_MS;
/** How far ahead the precision and ordinary fixtures resolve. */
export const FIXTURE_LEAD_MS = 30 * DAY_MS;
/** Strictly inside the 366-day acceptance horizon, with a minute of clock margin. */
const HORIZON_LIMIT_MS = 366 * DAY_MS - MINUTE_MS;

/**
 * Two zones whose fall-back folds sit about a week apart, so one of them always
 * folds inside the window (a single zone's next fold can be 371 days away).
 */
export const DEFAULT_FOLD_ZONES: readonly string[] = [
  'America/New_York',
  'Europe/Berlin',
];

export type FallBackFold = Readonly<{
  zone: string;
  /** The instant the clocks fall back. */
  transitionUtc: Date;
  /** The wall time in the middle of the repeated hour, `YYYY-MM-DDTHH:mm:ss`. */
  ambiguousLocal: string;
  /** That wall time under the earlier (pre-transition) offset, `YYYY-MM-DDTHH:mm:ssZ`. */
  earlierUtc: string;
  /** That wall time under the later (post-transition) offset. */
  laterUtc: string;
}>;

const utcSecond = (ms: number): string =>
  `${new Date(ms).toISOString().slice(0, 19)}Z`;

const wallSecond = (ms: number, offsetMin: number): string =>
  new Date(ms + offsetMin * MINUTE_MS).toISOString().slice(0, 19);

/** True when `utc` can be left pending: suite-safe and inside the acceptance horizon. */
export const isSuiteSafe = (utc: string, now: Date): boolean => {
  const lead = Date.parse(utc) - now.getTime();
  return lead >= SUITE_SAFE_LEAD_MS && lead < HORIZON_LIMIT_MS;
};

/** A whole UTC wall second `FIXTURE_LEAD_MS` ahead, `YYYY-MM-DDTHH:mm:ss`. */
export const farFutureWholeSecond = (now: Date): string =>
  new Date(now.getTime() + FIXTURE_LEAD_MS).toISOString().slice(0, 19);

const foldIn = (
  zone: string,
  fromMs: number,
  toMs: number,
): FallBackFold | null => {
  // Weekly probes find the week whose offset shrank; a binary search over its
  // hours finds the hour the clocks fall back (the s11-dst-gap search, mirrored).
  let lo = fromMs;
  let previous = offsetMinutes(zone, lo);
  while (lo < toMs) {
    const hi = Math.min(lo + WEEK_MS, toMs);
    const current = offsetMinutes(zone, hi);
    if (current < previous) {
      let before = 0;
      let after = (hi - lo) / HOUR_MS;
      while (after - before > 1) {
        const middle = Math.floor((before + after) / 2);
        if (offsetMinutes(zone, lo + middle * HOUR_MS) < previous)
          after = middle;
        else before = middle;
      }
      const transition = lo + after * HOUR_MS;
      const halfFoldMs = ((previous - current) * MINUTE_MS) / 2;
      const earlier = transition - halfFoldMs;
      return {
        zone,
        transitionUtc: new Date(transition),
        ambiguousLocal: wallSecond(earlier, previous),
        earlierUtc: utcSecond(earlier),
        laterUtc: utcSecond(transition + halfFoldMs),
      };
    }
    previous = current;
    lo = hi;
  }
  return null;
};

/**
 * The earliest fall-back fold in `zones` whose two instants are both suite-safe.
 * Throws when no zone has one: a suite must never guess a date.
 */
export const nextFallBackFold = (
  now: Date,
  zones: readonly string[] = DEFAULT_FOLD_ZONES,
): FallBackFold => {
  // The earlier instant sits half an hour before the transition and the later
  // one half an hour after it; both bounds land on whole UTC hours, as do the
  // transitions of the searched zones.
  const from =
    Math.ceil((now.getTime() + SUITE_SAFE_LEAD_MS + HOUR_MS) / HOUR_MS) *
    HOUR_MS;
  const to =
    Math.floor((now.getTime() + HORIZON_LIMIT_MS - HOUR_MS) / HOUR_MS) *
    HOUR_MS;
  const folds = zones
    .map((zone) => foldIn(zone, from, to))
    .filter((fold): fold is FallBackFold => fold !== null)
    .sort((a, b) => a.transitionUtc.getTime() - b.transitionUtc.getTime());
  const first = folds[0];
  if (first === undefined)
    throw new Error(
      `no fall-back fold in ${zones.join(', ')} between ${new Date(from).toISOString()} and ${new Date(to).toISOString()}`,
    );
  return first;
};

/**
 * `localTime` in `zone` on the UTC date `FIXTURE_LEAD_MS` ahead, with its UTC
 * instant. Callers pass a wall time far from the zone's transition hours.
 */
export const ordinaryZonedTime = (
  now: Date,
  zone: string,
  localTime: string,
): Readonly<{ localDateTime: string; resolvedUtc: string }> => {
  const day = new Date(now.getTime() + FIXTURE_LEAD_MS)
    .toISOString()
    .slice(0, 10);
  const localDateTime = `${day}T${localTime}`;
  const wallAsUtc = Date.parse(`${localDateTime}Z`);
  const guess = wallAsUtc - offsetMinutes(zone, wallAsUtc) * MINUTE_MS;
  const resolved = wallAsUtc - offsetMinutes(zone, guess) * MINUTE_MS;
  return { localDateTime, resolvedUtc: utcSecond(resolved) };
};
