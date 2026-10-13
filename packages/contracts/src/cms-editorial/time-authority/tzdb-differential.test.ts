import { describe, expect, it } from 'vitest';

import { CMS_TZDB_SNAPSHOT_JSON } from './tzdb-snapshot-data';
import { parseSnapshot } from './tzdb-snapshot';
import { compileZone, zoneOffsetAt, zoneTransitions } from './tzdb-zone';

/*
 * Independent oracle: the host's ICU (`Intl`) knows the same rules from a
 * different source. The pinned release is 2026e and the host may carry an older
 * release, so the zones below are ones whose 2000-2040 rules do not differ
 * between recent releases (the 2026b-e Canadian changes are deliberately absent).
 */
const snapshot = parseSnapshot(CMS_TZDB_SNAPSHOT_JSON);

const ZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'America/Phoenix',
  'America/Mexico_City',
  'America/Sao_Paulo',
  'America/Argentina/Buenos_Aires',
  'America/Santiago',
  'America/Bogota',
  'America/Havana',
  'Europe/London',
  'Europe/Dublin',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Moscow',
  'Europe/Istanbul',
  'Africa/Cairo',
  'Africa/Casablanca',
  'Africa/Johannesburg',
  'Africa/Lagos',
  'Asia/Tokyo',
  'Asia/Kolkata',
  'Asia/Kathmandu',
  'Asia/Tehran',
  'Asia/Dubai',
  'Asia/Gaza',
  'Asia/Jerusalem',
  'Australia/Sydney',
  'Australia/Adelaide',
  'Australia/Lord_Howe',
  'Pacific/Auckland',
  'Pacific/Chatham',
  'Pacific/Apia',
  'Atlantic/Azores',
  'Antarctica/Troll',
  'UTC',
  'Etc/GMT-14',
] as const;

const formatterFor = (timeZone: string) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  });

const intlOffset = (
  formatter: Intl.DateTimeFormat,
  unixSeconds: number,
): number => {
  const parts = Object.fromEntries(
    formatter
      .formatToParts(new Date(unixSeconds * 1000))
      .map(({ type, value }) => [type, Number(value)]),
  ) as Record<string, number>;
  return (
    Date.UTC(
      parts.year ?? 0,
      (parts.month ?? 1) - 1,
      parts.day ?? 1,
      parts.hour ?? 0,
      parts.minute ?? 0,
      parts.second ?? 0,
    ) /
      1000 -
    unixSeconds
  );
};

const FROM = Date.UTC(2000, 0, 1) / 1000;
const TO = Date.UTC(2040, 0, 1) / 1000;
const WEEK = 7 * 86_400;

/**
 * Releases after the host's ICU changed these zones (2026e NEWS: Morocco moves to
 * permanent +00 on 2026-09-20), so the comparison stops before the change; the
 * pinned behavior after it is asserted by golden values in tzdb-zone.test.ts.
 */
const COMPARE_UNTIL: Readonly<Record<string, number>> = {
  'Africa/Casablanca': Date.UTC(2026, 8, 19) / 1000,
};

describe('[P2-S11-AC-104] the snapshot agrees with an independent tz implementation (2000-2040)', () => {
  for (const name of ZONES)
    it(`${name}: every offset change and a weekly sample match Intl`, () => {
      const index = snapshot.names[name];
      const raw = index === undefined ? undefined : snapshot.zones[index];
      if (raw === undefined) throw new Error(`zone ${name} is absent`);
      const zone = compileZone(raw);
      const formatter = formatterFor(name);
      const mismatches: string[] = [];
      const check = (instant: number): void => {
        const mine = zoneOffsetAt(zone, instant);
        const theirs = intlOffset(formatter, instant);
        if (mine !== theirs)
          mismatches.push(
            `${new Date(instant * 1000).toISOString()} mine=${mine} intl=${theirs}`,
          );
      };
      const until = COMPARE_UNTIL[name] ?? TO;
      for (const transition of zoneTransitions(zone, FROM, until)) {
        check(transition.at - 1);
        check(transition.at);
        check(transition.at + 1);
      }
      for (let instant = FROM; instant < until; instant += WEEK) check(instant);
      expect(mismatches.slice(0, 5), name).toEqual([]);
    });
});
