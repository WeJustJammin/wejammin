/**
 * The next real spring-forward gap, for the Slice 11 schedule spec.
 *
 * A schedule must resolve between 60 s and 366 days from now (CMS-03B-07), so a
 * spec that types a fixed calendar date into the form goes stale. This module
 * reads the offsets of the host's own tz data (Intl) and returns the first gap
 * inside the window, as a nonexistent wall time to type and a valid wall time to
 * schedule. Two southern/northern zones are searched because a single zone's
 * annual gap can sit more than 366 days from a given day (the second Sunday of
 * March moves by 364 or 371 days).
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;

/** The gap must be this far ahead, so the valid time after it is still in the future. */
export const GAP_MIN_LEAD_MS = 36 * HOUR_MS;
/** Leaves room under the 366 day horizon for the hours between the gap and the valid time. */
export const GAP_MAX_LEAD_MS = 330 * DAY_MS;

export const DEFAULT_GAP_ZONES: readonly string[] = [
  'America/New_York',
  'Australia/Sydney',
];

export type SpringForwardGap = Readonly<{
  zone: string;
  /** The instant the clocks jump forward. */
  transitionUtc: Date;
  /** A wall time inside the skipped hour, `YYYY-MM-DDTHH:mm`. */
  nonexistentLocal: string;
  /**
   * A wall time that exists after the gap, the same day, `YYYY-MM-DDTHH:mm`: what the OLD clock reads eight hours
   * after the gap opens (10:00 for a gap at 02:00), which is seven hours into the new offset.
   */
  validLocal: string;
}>;

const offsetFormatters = new Map<string, Intl.DateTimeFormat>();

const formatterFor = (zone: string): Intl.DateTimeFormat => {
  const known = offsetFormatters.get(zone);
  if (known !== undefined) return known;
  const created = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    timeZoneName: 'longOffset',
  });
  offsetFormatters.set(zone, created);
  return created;
};

/** The zone's UTC offset in minutes at `instantMs`. */
const offsetMinutes = (zone: string, instantMs: number): number => {
  const name =
    formatterFor(zone)
      .formatToParts(new Date(instantMs))
      .find((part) => part.type === 'timeZoneName')?.value ?? '';
  if (name === 'GMT') return 0;
  const match = /^GMT([+-])(\d{2}):(\d{2})$/u.exec(name);
  if (match === null) throw new Error(`unreadable offset name "${name}"`);
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === '-' ? -minutes : minutes;
};

/** `YYYY-MM-DDTHH:mm` of the wall clock `instantMs + offsetMin` reads. */
const wallTime = (instantMs: number, offsetMin: number): string =>
  new Date(instantMs + offsetMin * 60_000).toISOString().slice(0, 16);

const gapIn = (
  zone: string,
  fromMs: number,
  toMs: number,
): SpringForwardGap | null => {
  // Weekly probes find the week whose offset grew (a zone changes offset about twice a
  // year, so a week holds at most one change); a binary search over its hours finds the
  // hour the clocks jump.
  let lo = fromMs;
  let previous = offsetMinutes(zone, lo);
  while (lo < toMs) {
    const hi = Math.min(lo + WEEK_MS, toMs);
    const current = offsetMinutes(zone, hi);
    if (current > previous) {
      let before = 0;
      let after = (hi - lo) / HOUR_MS;
      while (after - before > 1) {
        const middle = Math.floor((before + after) / 2);
        if (offsetMinutes(zone, lo + middle * HOUR_MS) > previous)
          after = middle;
        else before = middle;
      }
      const opensAt = lo + after * HOUR_MS;
      return {
        zone,
        transitionUtc: new Date(opensAt),
        nonexistentLocal: wallTime(opensAt + 30 * 60_000, previous),
        validLocal: wallTime(opensAt + 8 * HOUR_MS, previous),
      };
    }
    previous = current;
    lo = hi;
  }
  return null;
};

/**
 * The earliest spring-forward gap in `zones` that opens between 36 hours and 330
 * days after `now`. Throws when no zone has one: a spec must never guess a date.
 */
export const nextSpringForwardGap = (
  now: Date,
  zones: readonly string[] = DEFAULT_GAP_ZONES,
): SpringForwardGap => {
  // Both bounds sit on a whole UTC hour: every tz transition of the searched zones does too.
  const from = Math.ceil((now.getTime() + GAP_MIN_LEAD_MS) / HOUR_MS) * HOUR_MS;
  const to = Math.floor((now.getTime() + GAP_MAX_LEAD_MS) / HOUR_MS) * HOUR_MS;
  const gaps = zones
    .map((zone) => gapIn(zone, from, to))
    .filter((gap): gap is SpringForwardGap => gap !== null)
    .sort((a, b) => a.transitionUtc.getTime() - b.transitionUtc.getTime());
  const first = gaps[0];
  if (first === undefined)
    throw new Error(
      `no spring-forward gap in ${zones.join(', ')} between ${new Date(from).toISOString()} and ${new Date(to).toISOString()}`,
    );
  return first;
};
