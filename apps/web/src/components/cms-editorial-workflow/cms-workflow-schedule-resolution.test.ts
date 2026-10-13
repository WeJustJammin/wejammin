import { loadPinnedTimeAuthority } from '@wejammin/contracts/time-authority';
import { describe, expect, it } from 'vitest';

import {
  offsetLabel,
  resolveScheduleInput,
  zoneSuggestions,
} from './cms-workflow-schedule-resolution';

/*
 * The schedule form resolves the person's local time over the very pinned tz
 * snapshot and resolver the Worker runs (E8), so the instant it shows and sends
 * is the instant the server accepts. These cases pin the four outcomes a person
 * can meet: one instant, a nonexistent time (a gap), an ambiguous time (a fold)
 * and a refusal.
 */
const NOW = Date.parse('2026-10-08T12:00:00Z');

const authority = await loadPinnedTimeAuthority();
const resolve = (
  localDateTime: string,
  timezone: string,
  disambiguation: 'none' | 'earlier' | 'later' = 'none',
  nowMs = NOW,
) =>
  resolveScheduleInput(
    authority,
    { localDateTime, timezone, disambiguation },
    nowMs,
  );

describe('resolveScheduleInput', () => {
  it('waits for a complete local time and a time zone', () => {
    expect(resolve('', 'America/New_York')).toEqual({ kind: 'empty' });
    expect(resolve('2026-11-02T09:30', '')).toEqual({ kind: 'empty' });
    expect(resolve('2026-13-45T99:99', 'UTC')).toEqual({ kind: 'empty' });
  });

  it('resolves an ordinary local time to one UTC instant with its offset', () => {
    // A time that happens once carries no earlier/later pair.
    expect(resolve('2026-11-02T09:30', 'America/New_York')).toEqual({
      kind: 'resolved',
      resolvedUtc: '2026-11-02T14:30:00Z',
      offsetSeconds: -18_000,
      disambiguation: 'none',
    });
    expect(resolve('2026-11-02T09:30', 'UTC')).toMatchObject({
      resolvedUtc: '2026-11-02T09:30:00Z',
      offsetSeconds: 0,
    });
  });

  it('keeps seconds when the control supplies them', () => {
    expect(resolve('2026-11-02T09:30:15', 'UTC')).toMatchObject({
      resolvedUtc: '2026-11-02T09:30:15Z',
    });
  });

  it('reports a nonexistent local time with the two alternatives the server states', () => {
    const result = resolve('2027-03-14T02:30', 'America/New_York');
    expect(result.kind).toBe('gap');
    if (result.kind !== 'gap') return;
    expect(result.alternatives.map((choice) => choice.localDateTime)).toEqual([
      '2027-03-14T01:30',
      '2027-03-14T03:30',
    ]);
  });

  it('reports an ambiguous local time as a fold and resolves once earlier or later is chosen', () => {
    const fold = resolve('2026-11-01T01:30', 'America/New_York');
    expect(fold).toEqual({
      kind: 'fold',
      alternatives: [
        { disambiguation: 'earlier', resolvedUtc: '2026-11-01T05:30:00Z' },
        { disambiguation: 'later', resolvedUtc: '2026-11-01T06:30:00Z' },
      ],
    });
    expect(
      resolve('2026-11-01T01:30', 'America/New_York', 'earlier'),
    ).toMatchObject({
      kind: 'resolved',
      resolvedUtc: '2026-11-01T05:30:00Z',
      disambiguation: 'earlier',
    });
    expect(
      resolve('2026-11-01T01:30', 'America/New_York', 'later'),
    ).toMatchObject({
      resolvedUtc: '2026-11-01T06:30:00Z',
      disambiguation: 'later',
    });
  });

  it('forgets a stale earlier/later choice for a time that happens once', () => {
    expect(
      resolve('2026-11-02T09:30', 'America/New_York', 'later'),
    ).toMatchObject({
      kind: 'resolved',
      disambiguation: 'none',
    });
  });

  it('refuses an unknown zone and a time outside the 60 second to 366 day window', () => {
    expect(resolve('2026-11-02T09:30', 'Mars/Olympus')).toEqual({
      kind: 'refused',
      reason: 'unknown_timezone',
    });
    expect(resolve('2026-10-08T12:00', 'UTC')).toMatchObject({
      kind: 'refused',
      reason: 'schedule_out_of_horizon',
      window: {
        minUtc: '2026-10-08T12:01:00.000Z',
        maxUtc: '2027-10-09T12:00:00.000Z',
      },
    });
    expect(resolve('2028-01-01T00:00', 'UTC')).toMatchObject({
      reason: 'schedule_out_of_horizon',
    });
  });
});

describe('three-segment IANA zones', () => {
  // BE03b:266 allows one to three `/`-separated segments; the pinned snapshot
  // carries three-segment names (America/Argentina/*, America/Indiana/*,
  // America/Kentucky/*, America/North_Dakota/*).
  it('[P2-S11-AC-106] resolves America/Argentina/Buenos_Aires to one UTC instant at UTC-03:00', () => {
    expect(
      resolve('2026-12-01T09:00', 'America/Argentina/Buenos_Aires'),
    ).toEqual({
      kind: 'resolved',
      resolvedUtc: '2026-12-01T12:00:00Z',
      offsetSeconds: -10_800,
      disambiguation: 'none',
    });
    expect(offsetLabel(-10_800)).toBe('UTC-03:00');
  });

  it('[P2-S11-AC-106] reproduces the spring-forward gap of a three-segment zone with its two alternatives', () => {
    const result = resolve('2027-03-14T02:30', 'America/Indiana/Knox');
    expect(result).toEqual({
      kind: 'gap',
      alternatives: [
        {
          localDateTime: '2027-03-14T01:30',
          resolvedUtc: '2027-03-14T07:30:00Z',
        },
        {
          localDateTime: '2027-03-14T03:30',
          resolvedUtc: '2027-03-14T08:30:00Z',
        },
      ],
    });
  });

  it('[P2-S11-AC-106] reproduces the fall-back fold of a three-segment zone and resolves once earlier or later is chosen', () => {
    expect(resolve('2026-11-01T01:30', 'America/Indiana/Knox')).toEqual({
      kind: 'fold',
      alternatives: [
        { disambiguation: 'earlier', resolvedUtc: '2026-11-01T06:30:00Z' },
        { disambiguation: 'later', resolvedUtc: '2026-11-01T07:30:00Z' },
      ],
    });
    expect(
      resolve('2026-11-01T01:30', 'America/Indiana/Knox', 'earlier'),
    ).toMatchObject({
      kind: 'resolved',
      resolvedUtc: '2026-11-01T06:30:00Z',
      offsetSeconds: -18_000,
      disambiguation: 'earlier',
    });
    expect(
      resolve('2026-11-01T01:30', 'America/Indiana/Knox', 'later'),
    ).toMatchObject({
      resolvedUtc: '2026-11-01T07:30:00Z',
      offsetSeconds: -21_600,
      disambiguation: 'later',
    });
  });

  it('[P2-S11-AC-106] offers three-segment names as suggestions and refuses a fourth segment', () => {
    const zones = zoneSuggestions(authority);
    expect(zones).toContain('America/Argentina/Buenos_Aires');
    expect(zones).toContain('America/Indiana/Knox');
    expect(
      resolve('2026-12-01T09:00', 'America/Argentina/Buenos_Aires/X'),
    ).toEqual({
      kind: 'refused',
      reason: 'unknown_timezone',
    });
  });
});

describe('offsetLabel', () => {
  it('formats a UT offset as UTC±hh:mm', () => {
    expect(offsetLabel(0)).toBe('UTC+00:00');
    expect(offsetLabel(-18_000)).toBe('UTC-05:00');
    expect(offsetLabel(19_800)).toBe('UTC+05:30');
  });
});

describe('zoneSuggestions', () => {
  it('lists the zones of the snapshot, bounded and sorted', () => {
    const zones = zoneSuggestions(authority);
    expect(zones).toContain('America/New_York');
    expect(zones).toContain('UTC');
    expect([...zones].sort()).toEqual([...zones]);
    expect(zones.length).toBeGreaterThan(300);
  });
});
