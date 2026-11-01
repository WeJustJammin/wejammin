/**
 * Fixture times for the PostgREST schedule suites. Every schedule a suite leaves
 * pending shares one database with the sweep suites, whose global claim must see
 * only their own rows, so a leftover must never come due inside the run (CI run
 * 41267061612: a +300 s precision fixture was claimed by the sweep-outcomes retry
 * ladder). Fixed calendar dates also leave the 60 s..366 d acceptance horizon.
 */
import { describe, expect, it } from 'vitest';
import { offsetMinutes as offsetMinutesAt } from '../../e2e/support/s11-dst-gap';
import {
  FIXTURE_LEAD_MS,
  SUITE_SAFE_LEAD_MS,
  farFutureWholeSecond,
  isSuiteSafe,
  nextFallBackFold,
  ordinaryZonedTime,
} from './phase-02-slice-11-fixture-time';

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const HORIZON_MS = 366 * DAY_MS;
const CI_RUN_NOW = new Date('2026-11-01T03:08:44Z');

/** The wall clock `zone` reads at `utc`, `YYYY-MM-DDTHH:mm:ss`. */
const wallAt = (zone: string, utc: string): string => {
  const ms = Date.parse(utc);
  return new Date(ms + offsetMinutesAt(zone, ms) * 60_000)
    .toISOString()
    .slice(0, 19);
};

const inSuiteWindow = (utc: string, now: Date): boolean => {
  const lead = Date.parse(utc) - now.getTime();
  return lead >= SUITE_SAFE_LEAD_MS && lead < HORIZON_MS - 60_000;
};

// Every six hours across fourteen months, including both 2026 folds and the
// days between a New York fold and the next Berlin fold.
const sweepOfNows = (): Date[] => {
  const nows: Date[] = [];
  for (
    let ms = Date.parse('2026-10-01T00:00:00Z');
    ms <= Date.parse('2027-12-01T00:00:00Z');
    ms += 6 * HOUR_MS
  )
    nows.push(new Date(ms));
  return nows;
};

describe('Slice 11 PostgREST schedule fixture times', () => {
  it('refuses the two leftovers that broke CI: +300 s and the fixed 2026-11-01 fold', () => {
    const plusFive = new Date(CI_RUN_NOW.getTime() + 300_000).toISOString();
    expect(isSuiteSafe(plusFive, CI_RUN_NOW)).toBe(false);
    expect(isSuiteSafe('2026-11-01T05:30:00Z', CI_RUN_NOW)).toBe(false);
    expect(
      isSuiteSafe('2026-11-01T05:30:00Z', new Date('2026-11-01T06:00:00Z')),
    ).toBe(false);
  });

  it('accepts only instants between the suite-safe lead and the acceptance horizon', () => {
    const now = CI_RUN_NOW.getTime();
    expect(
      isSuiteSafe(new Date(now + SUITE_SAFE_LEAD_MS).toISOString(), CI_RUN_NOW),
    ).toBe(true);
    expect(
      isSuiteSafe(
        new Date(now + SUITE_SAFE_LEAD_MS - 1).toISOString(),
        CI_RUN_NOW,
      ),
    ).toBe(false);
    expect(
      isSuiteSafe(new Date(now + HORIZON_MS).toISOString(), CI_RUN_NOW),
    ).toBe(false);
    expect(isSuiteSafe('not-an-instant', CI_RUN_NOW)).toBe(false);
  });

  it('far-future whole second is a suite-safe UTC wall second', () => {
    for (const now of sweepOfNows()) {
      const second = farFutureWholeSecond(now);
      expect(second).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/u);
      expect(Date.parse(`${second}Z`) - now.getTime()).toBeGreaterThan(
        FIXTURE_LEAD_MS - 1_000,
      );
      expect(isSuiteSafe(`${second}Z`, now)).toBe(true);
    }
  });

  it('next fall-back fold is a genuine fold with both instants inside the suite window', () => {
    for (const now of sweepOfNows()) {
      const fold = nextFallBackFold(now);
      const before = offsetMinutesAt(
        fold.zone,
        fold.transitionUtc.getTime() - 1,
      );
      const after = offsetMinutesAt(fold.zone, fold.transitionUtc.getTime());
      expect(before).toBeGreaterThan(after);
      expect(Date.parse(fold.earlierUtc)).toBeLessThan(
        Date.parse(fold.laterUtc),
      );
      expect(wallAt(fold.zone, fold.earlierUtc)).toBe(fold.ambiguousLocal);
      expect(wallAt(fold.zone, fold.laterUtc)).toBe(fold.ambiguousLocal);
      expect(inSuiteWindow(fold.earlierUtc, now)).toBe(true);
      expect(inSuiteWindow(fold.laterUtc, now)).toBe(true);
    }
  });

  it('at the CI run instant the New York fold is too close, so Berlin 2027 is chosen', () => {
    const fold = nextFallBackFold(CI_RUN_NOW);
    expect(fold.zone).toBe('Europe/Berlin');
    expect(fold.ambiguousLocal).toBe('2027-10-31T02:30:00');
    expect(fold.earlierUtc).toBe('2027-10-31T00:30:00Z');
    expect(fold.laterUtc).toBe('2027-10-31T01:30:00Z');
  });

  it('before the 2026 New York fold it is chosen with its fixed 05:30Z / 06:30Z pair', () => {
    const fold = nextFallBackFold(new Date('2026-10-30T00:00:00Z'));
    expect(fold.zone).toBe('America/New_York');
    expect(fold.ambiguousLocal).toBe('2026-11-01T01:30:00');
    expect(fold.earlierUtc).toBe('2026-11-01T05:30:00Z');
    expect(fold.laterUtc).toBe('2026-11-01T06:30:00Z');
  });

  it('throws instead of guessing when no searched zone folds in the window', () => {
    expect(() => nextFallBackFold(CI_RUN_NOW, ['UTC'])).toThrow(
      /no fall-back fold/u,
    );
  });

  it.each([
    'Europe/Berlin',
    'America/Argentina/Buenos_Aires',
    'Etc/GMT+12',
    'Pacific/Kiritimati',
  ])(
    'ordinary zoned time in %s is unambiguous, suite-safe and round-trips through the zone',
    (zone) => {
      for (const now of sweepOfNows()) {
        const ordinary = ordinaryZonedTime(now, zone, '09:00:00');
        expect(ordinary.localDateTime).toMatch(/T09:00:00$/u);
        expect(wallAt(zone, ordinary.resolvedUtc)).toBe(ordinary.localDateTime);
        const ms = Date.parse(ordinary.resolvedUtc);
        expect(offsetMinutesAt(zone, ms - 2 * HOUR_MS)).toBe(
          offsetMinutesAt(zone, ms + 2 * HOUR_MS),
        );
        expect(isSuiteSafe(ordinary.resolvedUtc, now)).toBe(true);
      }
    },
  );

  it('the fourteen- and twelve-hour edges keep their fixed offsets', () => {
    const kiritimati = ordinaryZonedTime(
      CI_RUN_NOW,
      'Pacific/Kiritimati',
      '09:00:00',
    );
    const gmtPlus12 = ordinaryZonedTime(CI_RUN_NOW, 'Etc/GMT+12', '09:00:00');
    expect(kiritimati).toEqual({
      localDateTime: '2026-12-01T09:00:00',
      resolvedUtc: '2026-11-30T19:00:00Z',
    });
    expect(gmtPlus12).toEqual({
      localDateTime: '2026-12-01T09:00:00',
      resolvedUtc: '2026-12-01T21:00:00Z',
    });
  });
});
