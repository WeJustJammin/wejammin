import { describe, expect, it } from 'vitest';

import { CMS_TZDB_SNAPSHOT_JSON } from './tzdb-snapshot-data';
import { parseSnapshot } from './tzdb-snapshot';
import {
  compileZone,
  resolveLocal,
  zoneOffsetAt,
  zoneTransitions,
} from './tzdb-zone';
import { parseLocalDateTime } from './local-datetime';

const snapshot = parseSnapshot(CMS_TZDB_SNAPSHOT_JSON);
const zone = (name: string) => {
  const index = snapshot.names[name];
  const raw = index === undefined ? undefined : snapshot.zones[index];
  if (raw === undefined) throw new Error(`zone ${name} is absent`);
  return compileZone(raw);
};
const at = (iso: string): number => Date.parse(iso) / 1000;
const local = (text: string): number => {
  const parsed = parseLocalDateTime(text);
  if (parsed === null) throw new Error(text);
  return parsed.naiveSeconds;
};

describe('[P2-S11-AC-103] the pinned snapshot', () => {
  it('names canonical zones and link names of the release', () => {
    for (const name of [
      'UTC',
      'Etc/UTC',
      'America/New_York',
      'US/Eastern',
      'America/Argentina/Buenos_Aires',
      'America/Indiana/Indianapolis',
      'America/North_Dakota/Center',
      'Asia/Kolkata',
      'Europe/London',
      'Etc/GMT+5',
    ])
      expect(snapshot.names[name], name).toBeTypeOf('number');
    expect(snapshot.release).toBe('2026e');
    expect(Object.keys(snapshot.names).length).toBeGreaterThan(500);
    expect(snapshot.names['Factory']).toBeUndefined();
    expect(snapshot.names['america/new_york']).toBeUndefined();
  });
});

describe('[P2-S11-AC-104] zone offsets', () => {
  it('follows explicit transitions and then the footer rules', () => {
    const newYork = zone('America/New_York');
    expect(zoneOffsetAt(newYork, at('1969-12-31T00:00:00Z'))).toBe(-18_000);
    expect(zoneOffsetAt(newYork, at('2000-07-01T00:00:00Z'))).toBe(-14_400);
    expect(zoneOffsetAt(newYork, at('2026-03-08T06:59:59Z'))).toBe(-18_000);
    expect(zoneOffsetAt(newYork, at('2026-03-08T07:00:00Z'))).toBe(-14_400);
    expect(zoneOffsetAt(newYork, at('2060-03-14T06:59:59Z'))).toBe(-18_000);
    expect(zoneOffsetAt(newYork, at('2060-03-14T07:00:00Z'))).toBe(-14_400);
  });

  it('knows fixed zones, half-hour zones and a three-segment name', () => {
    expect(zoneOffsetAt(zone('UTC'), at('2026-10-08T00:00:00Z'))).toBe(0);
    expect(zoneOffsetAt(zone('Asia/Kolkata'), at('2026-10-08T00:00:00Z'))).toBe(
      19_800,
    );
    expect(
      zoneOffsetAt(zone('Asia/Kathmandu'), at('2026-10-08T00:00:00Z')),
    ).toBe(20_700);
    expect(
      zoneOffsetAt(
        zone('America/Argentina/Buenos_Aires'),
        at('2026-10-08T00:00:00Z'),
      ),
    ).toBe(-10_800);
    expect(zoneOffsetAt(zone('Etc/GMT+5'), at('2026-10-08T00:00:00Z'))).toBe(
      -18_000,
    );
  });

  it('reflects the 2026e Morocco change to permanent +00 on 2026-09-20', () => {
    const casablanca = zone('Africa/Casablanca');
    expect(zoneOffsetAt(casablanca, at('2026-09-19T00:00:00Z'))).toBe(3_600);
    expect(zoneOffsetAt(casablanca, at('2026-09-20T02:00:00Z'))).toBe(0);
    expect(zoneOffsetAt(casablanca, at('2027-03-01T00:00:00Z'))).toBe(0);
    expect(zoneOffsetAt(casablanca, at('2030-07-01T00:00:00Z'))).toBe(0);
  });

  it('lists explicit and footer transitions of a window in order', () => {
    const london = zone('Europe/London');
    expect(
      zoneTransitions(
        london,
        at('2026-01-01T00:00:00Z'),
        at('2026-12-31T00:00:00Z'),
      ),
    ).toEqual([
      { at: at('2026-03-29T01:00:00Z'), before: 0, after: 3_600 },
      { at: at('2026-10-25T01:00:00Z'), before: 3_600, after: 0 },
    ]);
    const early = zoneTransitions(
      zone('America/New_York'),
      at('2006-01-01T00:00:00Z'),
      at('2008-01-01T00:00:00Z'),
    );
    expect(
      early.map(({ at: instant }) =>
        new Date(instant * 1000).toISOString().slice(0, 10),
      ),
    ).toEqual(['2006-04-02', '2006-10-29', '2007-03-11', '2007-11-04']);
  });
});

describe('[P2-S11-AC-104] resolving a local time to the set of instants', () => {
  it('finds exactly one instant outside any change', () => {
    expect(
      resolveLocal(zone('America/New_York'), local('2026-07-04T12:00')),
    ).toEqual({
      kind: 'unique',
      instant: at('2026-07-04T16:00:00Z'),
      offset: -14_400,
    });
    expect(resolveLocal(zone('UTC'), local('2026-07-04T12:00'))).toEqual({
      kind: 'unique',
      instant: at('2026-07-04T12:00:00Z'),
      offset: 0,
    });
  });

  it('reports a spring-forward gap with the transition and both offsets', () => {
    expect(
      resolveLocal(zone('America/New_York'), local('2026-03-08T02:30')),
    ).toEqual({
      kind: 'gap',
      at: at('2026-03-08T07:00:00Z'),
      before: -18_000,
      after: -14_400,
    });
    // The gap is half open: 02:00 is inside it and 03:00 is the first valid local time after it.
    expect(
      resolveLocal(zone('America/New_York'), local('2026-03-08T02:00')).kind,
    ).toBe('gap');
    expect(
      resolveLocal(zone('America/New_York'), local('2026-03-08T01:59:59')).kind,
    ).toBe('unique');
    expect(
      resolveLocal(zone('America/New_York'), local('2026-03-08T03:00')).kind,
    ).toBe('unique');
  });

  it('reports a fall-back fold with the earlier and later instants', () => {
    expect(
      resolveLocal(zone('America/New_York'), local('2026-11-01T01:30')),
    ).toEqual({
      kind: 'ambiguous',
      earlier: { instant: at('2026-11-01T05:30:00Z'), offset: -14_400 },
      later: { instant: at('2026-11-01T06:30:00Z'), offset: -18_000 },
    });
    expect(
      resolveLocal(zone('America/New_York'), local('2026-11-01T00:59:59')).kind,
    ).toBe('unique');
    expect(
      resolveLocal(zone('America/New_York'), local('2026-11-01T01:00')).kind,
    ).toBe('ambiguous');
    expect(
      resolveLocal(zone('America/New_York'), local('2026-11-01T01:59:59')).kind,
    ).toBe('ambiguous');
    expect(
      resolveLocal(zone('America/New_York'), local('2026-11-01T02:00')).kind,
    ).toBe('unique');
  });

  it('handles a 30-minute change (Lord Howe), negative savings (Dublin) and the far future', () => {
    expect(
      resolveLocal(zone('Australia/Lord_Howe'), local('2026-10-04T02:15')),
    ).toEqual({
      kind: 'gap',
      at: at('2026-10-03T15:30:00Z'),
      before: 37_800,
      after: 39_600,
    });
    expect(
      resolveLocal(zone('Australia/Lord_Howe'), local('2027-04-04T01:45')),
    ).toMatchObject({
      kind: 'ambiguous',
      earlier: { instant: at('2027-04-03T14:45:00Z'), offset: 39_600 },
      later: { instant: at('2027-04-03T15:15:00Z'), offset: 37_800 },
    });
    expect(
      resolveLocal(zone('Europe/Dublin'), local('2027-03-28T01:30')),
    ).toMatchObject({ kind: 'gap', before: 0, after: 3_600 });
    expect(
      resolveLocal(zone('Europe/Dublin'), local('2026-10-25T01:30')),
    ).toMatchObject({
      kind: 'ambiguous',
      earlier: { instant: at('2026-10-25T00:30:00Z'), offset: 3_600 },
      later: { instant: at('2026-10-25T01:30:00Z'), offset: 0 },
    });
    expect(
      resolveLocal(zone('America/New_York'), local('2090-03-12T02:30')).kind,
    ).toBe('gap');
  });

  it('has no gaps or folds in a fixed zone', () => {
    for (const text of [
      '2026-03-08T02:30',
      '2026-11-01T01:30',
      '2026-12-31T23:59',
    ])
      expect(resolveLocal(zone('Asia/Kolkata'), local(text)).kind, text).toBe(
        'unique',
      );
  });
});
