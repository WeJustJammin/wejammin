import { describe, expect, it } from 'vitest';

import {
  CmsEditorialRefusalDetailsSchema,
  cmsSlice11ReasonStatus,
} from '../refusals';
import {
  CMS_SCHEDULE_MAX_HORIZON_DAYS,
  CMS_SCHEDULE_MIN_LEAD_SECONDS,
  cmsScheduleOffsetPlausible,
  resolveScheduleTime,
  type ScheduleTimeInput,
} from './schedule-time';
import { CMS_TZDB_VERSION } from './tzdb-pin';
import { CMS_TZDB_SNAPSHOT_JSON } from './tzdb-snapshot-data';
import { parseSnapshot } from './tzdb-snapshot';
import { compileZone, type CompiledZone } from './tzdb-zone';

const snapshot = parseSnapshot(CMS_TZDB_SNAPSHOT_JSON);
const lookup = (name: string): CompiledZone | undefined => {
  const index = snapshot.names[name];
  const raw = index === undefined ? undefined : snapshot.zones[index];
  return raw === undefined ? undefined : compileZone(raw);
};
const NOW = Date.parse('2026-10-08T12:00:00Z');
const base: ScheduleTimeInput = {
  localDateTime: '2026-11-15T09:00',
  timezone: 'America/New_York',
  resolvedUtc: '2026-11-15T14:00:00Z',
  tzdbVersion: CMS_TZDB_VERSION,
  disambiguation: 'none',
};
const resolve = (input: Partial<ScheduleTimeInput>, now = NOW) =>
  resolveScheduleTime(lookup, CMS_TZDB_VERSION, { ...base, ...input }, now);
const refusal = (input: Partial<ScheduleTimeInput>, now = NOW) => {
  const result = resolve(input, now);
  if (result.ok) throw new Error('expected a refusal');
  return result;
};

describe('[P2-S11-AC-104] Time authority steps 1-2: zone name and pinned version', () => {
  it('accepts canonical, link, three-segment and fixed-offset zone names', () => {
    for (const [timezone, local, utc] of [
      ['America/New_York', '2026-11-15T09:00', '2026-11-15T14:00:00Z'],
      ['US/Eastern', '2026-11-15T09:00', '2026-11-15T14:00:00Z'],
      ['UTC', '2026-11-15T09:00', '2026-11-15T09:00:00Z'],
      ['Etc/GMT+5', '2026-11-15T09:00', '2026-11-15T14:00:00Z'],
      [
        'America/Argentina/Buenos_Aires',
        '2026-11-15T09:00',
        '2026-11-15T12:00:00Z',
      ],
      [
        'America/Indiana/Indianapolis',
        '2026-11-15T09:00',
        '2026-11-15T14:00:00Z',
      ],
      [
        'America/North_Dakota/Center',
        '2026-11-15T09:00',
        '2026-11-15T15:00:00Z',
      ],
      ['Asia/Kolkata', '2026-11-15T09:00', '2026-11-15T03:30:00Z'],
    ] as const)
      expect(
        resolve({ timezone, localDateTime: local, resolvedUtc: utc }).ok,
        timezone,
      ).toBe(true);
  });

  it('refuses a name outside the snapshot as unknown_timezone at /timezone', () => {
    for (const timezone of [
      'Mars/Olympus',
      'america/new_york',
      'America/New_York ',
      'Factory',
      'EST6EDT/X',
    ]) {
      const result = refusal({ timezone });
      expect(result.pointer, timezone).toBe('/timezone');
      expect(result.details).toEqual({ reasonCode: 'unknown_timezone' });
    }
  });

  it('refuses another tz release with the pinned one, after the zone check', () => {
    const result = refusal({ tzdbVersion: '2025b' });
    expect(result.pointer).toBe('/tzdbVersion');
    expect(result.details).toEqual({
      reasonCode: 'tzdb_version_mismatch',
      pinnedVersion: '2026e',
    });
    expect(
      refusal({ timezone: 'Mars/Olympus', tzdbVersion: '2025b' }).details
        .reasonCode,
    ).toBe('unknown_timezone');
  });
});

describe('[P2-S11-AC-104] Time authority steps 3-6: gaps, folds and disambiguation', () => {
  it('refuses a nonexistent local time with the earlier and later alternatives', () => {
    const result = refusal({
      localDateTime: '2027-03-14T02:30',
      resolvedUtc: '2027-03-14T07:30:00Z',
    });
    expect(result.pointer).toBe('/localDateTime');
    expect(result.details).toEqual({
      reasonCode: 'nonexistent_local_time',
      alternatives: [
        {
          localDateTime: '2027-03-14T01:30',
          resolvedUtc: '2027-03-14T06:30:00Z',
        },
        {
          localDateTime: '2027-03-14T03:30',
          resolvedUtc: '2027-03-14T07:30:00Z',
        },
      ],
    });
    // A disambiguation cannot resolve a gap.
    for (const disambiguation of ['earlier', 'later'] as const)
      expect(
        refusal({ localDateTime: '2027-03-14T02:30', disambiguation }).details
          .reasonCode,
      ).toBe('nonexistent_local_time');
  });

  it('measures the alternatives by the length of the gap (30 minutes at Lord Howe)', () => {
    const result = refusal({
      timezone: 'Australia/Lord_Howe',
      localDateTime: '2027-10-03T02:15:30',
      resolvedUtc: '2027-10-02T15:45:30Z',
    });
    expect(result.details).toEqual({
      reasonCode: 'nonexistent_local_time',
      alternatives: [
        {
          localDateTime: '2027-10-03T01:45:30',
          resolvedUtc: '2027-10-02T15:15:30Z',
        },
        {
          localDateTime: '2027-10-03T02:45:30',
          resolvedUtc: '2027-10-02T15:45:30Z',
        },
      ],
    });
  });

  it('keeps the requested precision (seconds and fractions) in the alternatives', () => {
    const result = refusal({
      localDateTime: '2027-03-14T02:30:15.25',
      resolvedUtc: '2027-03-14T07:30:15.25Z',
    });
    expect(result.details).toMatchObject({
      alternatives: [
        {
          localDateTime: '2027-03-14T01:30:15.25',
          resolvedUtc: '2027-03-14T06:30:15.25Z',
        },
        {
          localDateTime: '2027-03-14T03:30:15.25',
          resolvedUtc: '2027-03-14T07:30:15.25Z',
        },
      ],
    });
  });

  it('refuses a disambiguation other than none for a single instant', () => {
    for (const disambiguation of ['earlier', 'later'] as const) {
      const result = refusal({ disambiguation });
      expect(result.pointer).toBe('/disambiguation');
      expect(result.details).toEqual({
        reasonCode: 'disambiguation_not_applicable',
      });
    }
  });

  it('refuses an ambiguous local time without a disambiguation, listing both instants', () => {
    const result = refusal({
      localDateTime: '2026-11-01T01:30',
      resolvedUtc: '2026-11-01T05:30:00Z',
    });
    expect(result.pointer).toBe('/disambiguation');
    expect(result.details).toEqual({
      reasonCode: 'ambiguous_local_time',
      alternatives: [
        { disambiguation: 'earlier', resolvedUtc: '2026-11-01T05:30:00Z' },
        { disambiguation: 'later', resolvedUtc: '2026-11-01T06:30:00Z' },
      ],
    });
  });

  it('selects the smaller instant for earlier and the larger for later', () => {
    const earlier = resolve({
      localDateTime: '2026-11-01T01:30',
      resolvedUtc: '2026-11-01T05:30:00Z',
      disambiguation: 'earlier',
    });
    expect(earlier).toMatchObject({
      ok: true,
      resolvedUtc: '2026-11-01T05:30:00Z',
      offsetSeconds: -14_400,
      disambiguation: 'earlier',
    });
    const later = resolve({
      localDateTime: '2026-11-01T01:30',
      resolvedUtc: '2026-11-01T06:30:00Z',
      disambiguation: 'later',
    });
    expect(later).toMatchObject({
      ok: true,
      resolvedUtc: '2026-11-01T06:30:00Z',
      offsetSeconds: -18_000,
      disambiguation: 'later',
    });
  });
});

describe('[P2-S11-AC-105] Time authority steps 7-8: the resolved instant and the horizon', () => {
  it('requires resolvedUtc to equal the selected instant, with the expected value in the refusal', () => {
    const wrong = refusal({ resolvedUtc: '2026-11-15T13:00:00Z' });
    expect(wrong.pointer).toBe('/resolvedUtc');
    expect(wrong.details).toEqual({
      reasonCode: 'resolved_utc_mismatch',
      expectedUtc: '2026-11-15T14:00:00Z',
    });
    const crossed = refusal({
      localDateTime: '2026-11-01T01:30',
      resolvedUtc: '2026-11-01T06:30:00Z',
      disambiguation: 'earlier',
    });
    expect(crossed.details).toEqual({
      reasonCode: 'resolved_utc_mismatch',
      expectedUtc: '2026-11-01T05:30:00Z',
    });
    expect(
      refusal({ resolvedUtc: '2026-11-15T14:00:00' }).details.reasonCode,
    ).toBe('resolved_utc_mismatch');
    expect(refusal({ resolvedUtc: 'soon' }).details.reasonCode).toBe(
      'resolved_utc_mismatch',
    );
  });

  it('accepts the same instant written with any offset and compares fractions exactly', () => {
    expect(resolve({ resolvedUtc: '2026-11-15T09:00:00-05:00' }).ok).toBe(true);
    expect(resolve({ resolvedUtc: '2026-11-15T15:00:00+01:00' }).ok).toBe(true);
    expect(resolve({ resolvedUtc: '2026-11-15T14:00Z' }).ok).toBe(true);
    expect(
      resolve({
        localDateTime: '2026-11-15T09:00:00.5',
        resolvedUtc: '2026-11-15T14:00:00.500Z',
      }).ok,
    ).toBe(true);
    expect(
      refusal({
        localDateTime: '2026-11-15T09:00:00.5',
        resolvedUtc: '2026-11-15T14:00:00.6Z',
      }).details.reasonCode,
    ).toBe('resolved_utc_mismatch');
    expect(
      refusal({
        localDateTime: '2026-11-15T09:00:00.123456789',
        resolvedUtc: '2026-11-15T14:00:00.123456788Z',
      }).details.reasonCode,
    ).toBe('resolved_utc_mismatch');
  });

  it('requires at least 60 seconds and at most 366 days of lead, both bounds inclusive', () => {
    expect(CMS_SCHEDULE_MIN_LEAD_SECONDS).toBe(60);
    expect(CMS_SCHEDULE_MAX_HORIZON_DAYS).toBe(366);
    const utc = (local: string) => ({
      timezone: 'UTC',
      localDateTime: local,
      resolvedUtc: `${local}Z`,
    });
    expect(resolve(utc('2026-10-08T12:01:00')).ok).toBe(true);
    const early = refusal(utc('2026-10-08T12:00:59'));
    expect(early.pointer).toBe('/resolvedUtc');
    expect(early.details).toEqual({
      reasonCode: 'schedule_out_of_horizon',
      minUtc: '2026-10-08T12:01:00.000Z',
      maxUtc: '2027-10-09T12:00:00.000Z',
    });
    expect(resolve(utc('2027-10-09T12:00:00')).ok).toBe(true);
    expect(refusal(utc('2027-10-09T12:00:01')).details.reasonCode).toBe(
      'schedule_out_of_horizon',
    );
    expect(refusal(utc('2026-10-07T12:00:00')).details.reasonCode).toBe(
      'schedule_out_of_horizon',
    );
  });

  it('measures the bounds from the acceptance instant to the millisecond', () => {
    const now = NOW + 250;
    const utc = (local: string) => ({
      timezone: 'UTC',
      localDateTime: local,
      resolvedUtc: `${local}Z`,
    });
    expect(refusal(utc('2026-10-08T12:01:00'), now).details).toMatchObject({
      minUtc: '2026-10-08T12:01:00.250Z',
    });
    expect(resolve(utc('2026-10-08T12:01:00.25'), now).ok).toBe(true);
    expect(resolve(utc('2026-10-08T12:01:00.249'), now).ok).toBe(false);
  });

  it('checks the horizon last: a bad zone, gap or mismatch is reported before a past time', () => {
    expect(
      refusal({ timezone: 'Nope/Zone', localDateTime: '2020-01-01T00:00' })
        .details.reasonCode,
    ).toBe('unknown_timezone');
    expect(
      refusal({
        localDateTime: '2020-03-08T02:30',
        resolvedUtc: '2020-03-08T07:30:00Z',
      }).details.reasonCode,
    ).toBe('nonexistent_local_time');
    expect(
      refusal({
        localDateTime: '2020-01-01T00:00',
        resolvedUtc: '2020-01-01T05:00:00Z',
      }).details.reasonCode,
    ).toBe('schedule_out_of_horizon');
  });
});

describe('[P2-S11-AC-104][P2-S11-AC-105] results are contract-shaped', () => {
  it('returns refusal details that satisfy the Slice 11 refusal catalog at status 422', () => {
    const cases: readonly Partial<ScheduleTimeInput>[] = [
      { timezone: 'Mars/Olympus' },
      { tzdbVersion: '2025b' },
      { localDateTime: '2027-03-14T02:30' },
      { disambiguation: 'later' },
      {
        localDateTime: '2026-11-01T01:30',
        resolvedUtc: '2026-11-01T05:30:00Z',
      },
      { resolvedUtc: '2026-11-15T13:00:00Z' },
      {
        timezone: 'UTC',
        localDateTime: '2026-10-08T12:00:30',
        resolvedUtc: '2026-10-08T12:00:30Z',
      },
    ];
    for (const input of cases) {
      const result = refusal(input);
      expect(
        CmsEditorialRefusalDetailsSchema.safeParse(result.details).success,
        JSON.stringify(input),
      ).toBe(true);
      expect(cmsSlice11ReasonStatus(result.details.reasonCode)).toBe(422);
      expect(result.status).toBe(422);
    }
  });

  it('returns the accepted instant as canonical Z text with seconds, nanos and offset', () => {
    expect(resolve({})).toEqual({
      ok: true,
      resolvedUtc: '2026-11-15T14:00:00Z',
      unixSeconds: Date.parse('2026-11-15T14:00:00Z') / 1000,
      nanos: 0,
      offsetSeconds: -18_000,
      disambiguation: 'none',
    });
    expect(
      resolve({
        localDateTime: '2026-11-15T09:00:00.125',
        resolvedUtc: '2026-11-15T14:00:00.125Z',
      }),
    ).toMatchObject({
      resolvedUtc: '2026-11-15T14:00:00.125Z',
      nanos: 125_000_000,
    });
  });

  it('rejects a local datetime the request schema would already have refused', () => {
    expect(() => resolve({ localDateTime: '2026-02-30T09:00' })).toThrow(
      RangeError,
    );
  });
});

describe('[P2-S11-AC-105] the RPC offset sanity bound', () => {
  it('accepts local-as-UTC minus resolvedUtc within -12 hours and +14 hours inclusive', () => {
    expect(
      cmsScheduleOffsetPlausible('2026-11-15T09:00', '2026-11-15T14:00:00Z'),
    ).toBe(true);
    expect(
      cmsScheduleOffsetPlausible('2026-11-15T09:00', '2026-11-14T19:00:00Z'),
    ).toBe(true);
    expect(
      cmsScheduleOffsetPlausible('2026-11-15T09:00', '2026-11-14T18:59:59Z'),
    ).toBe(false);
    expect(
      cmsScheduleOffsetPlausible('2026-11-15T09:00', '2026-11-15T21:00:00Z'),
    ).toBe(true);
    expect(
      cmsScheduleOffsetPlausible('2026-11-15T09:00', '2026-11-15T21:00:01Z'),
    ).toBe(false);
    expect(
      cmsScheduleOffsetPlausible(
        '2026-11-15T09:00:00.5',
        '2026-11-14T19:00:00.4Z',
      ),
    ).toBe(false);
    expect(
      cmsScheduleOffsetPlausible('2026-11-15T09:00', 'not an instant'),
    ).toBe(false);
    expect(cmsScheduleOffsetPlausible('nonsense', '2026-11-15T09:00:00Z')).toBe(
      false,
    );
  });
});
