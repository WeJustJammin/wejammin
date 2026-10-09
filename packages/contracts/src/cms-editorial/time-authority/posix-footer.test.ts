import { describe, expect, it } from 'vitest';

import { footerOffsetAt, footerTransitions, parseFooter } from './posix-footer';

const at = (iso: string): number => Date.parse(iso) / 1000;

describe('[P2-S11-AC-104] POSIX TZ footer parsing', () => {
  it('parses a fixed-offset zone: POSIX offsets are positive west of UTC', () => {
    expect(parseFooter('UTC0')).toEqual({ standardOffset: 0, daylight: null });
    expect(parseFooter('<+03>-3')).toEqual({
      standardOffset: 10_800,
      daylight: null,
    });
    expect(parseFooter('<-03>3')).toEqual({
      standardOffset: -10_800,
      daylight: null,
    });
    expect(parseFooter('<+0545>-5:45')).toEqual({
      standardOffset: 20_700,
      daylight: null,
    });
    expect(parseFooter('<-0330>3:30')?.standardOffset).toBe(-12_600);
  });

  it('parses a DST zone with default one-hour savings and 02:00 transitions', () => {
    expect(parseFooter('EST5EDT,M3.2.0,M11.1.0')).toEqual({
      standardOffset: -18_000,
      daylight: {
        offset: -14_400,
        start: { month: 3, week: 2, weekday: 0, time: 7_200 },
        end: { month: 11, week: 1, weekday: 0, time: 7_200 },
      },
    });
  });

  it('parses explicit DST offsets and unusual transition times', () => {
    expect(
      parseFooter('<+1030>-10:30<+11>-11,M10.1.0,M4.1.0')?.daylight,
    ).toEqual({
      offset: 39_600,
      start: { month: 10, week: 1, weekday: 0, time: 7_200 },
      end: { month: 4, week: 1, weekday: 0, time: 7_200 },
    });
    expect(
      parseFooter('<-02>2<-01>,M3.5.0/-1,M10.5.0/0')?.daylight,
    ).toMatchObject({
      offset: -3_600,
      start: { time: -3_600 },
      end: { time: 0 },
    });
    expect(
      parseFooter('EET-2EEST,M3.4.4/50,M10.4.4/50')?.daylight,
    ).toMatchObject({
      start: { time: 180_000 },
      end: { time: 180_000 },
    });
    expect(
      parseFooter('<+1245>-12:45<+1345>,M9.5.0/2:45,M4.1.0/3:45')?.daylight,
    ).toMatchObject({
      start: { time: 9_900 },
      end: { time: 13_500 },
    });
    expect(parseFooter('IST-1GMT0,M10.5.0,M3.5.0/1')).toMatchObject({
      standardOffset: 3_600,
      daylight: { offset: 0 },
    });
  });

  it('refuses the forms the pinned release never emits, instead of guessing', () => {
    for (const bad of [
      '',
      'EST5EDT',
      'EST5EDT,J60,J300',
      'EST5EDT,60,300',
      'EST5EDT,M13.1.0,M11.1.0',
      'EST5EDT,M3.6.0,M11.1.0',
      'EST5EDT,M3.2.7,M11.1.0',
      'abc',
      '<x>',
    ]) {
      expect(() => parseFooter(bad), bad).toThrow(/footer/u);
    }
  });
});

describe('[P2-S11-AC-104] footer evaluation', () => {
  const newYork = parseFooter('EST5EDT,M3.2.0,M11.1.0');
  const dublin = parseFooter('IST-1GMT0,M10.5.0,M3.5.0/1');
  const lordHowe = parseFooter('<+1030>-10:30<+11>-11,M10.1.0,M4.1.0');

  it('switches a northern zone at the second Sunday of March and the first of November', () => {
    expect(footerOffsetAt(newYork, at('2026-03-08T06:59:59Z'))).toBe(-18_000);
    expect(footerOffsetAt(newYork, at('2026-03-08T07:00:00Z'))).toBe(-14_400);
    expect(footerOffsetAt(newYork, at('2026-11-01T05:59:59Z'))).toBe(-14_400);
    expect(footerOffsetAt(newYork, at('2026-11-01T06:00:00Z'))).toBe(-18_000);
    expect(footerOffsetAt(newYork, at('2026-07-01T00:00:00Z'))).toBe(-14_400);
    expect(footerOffsetAt(newYork, at('2026-01-01T00:00:00Z'))).toBe(-18_000);
  });

  it('handles a southern zone whose summer spans the new year', () => {
    expect(footerOffsetAt(lordHowe, at('2026-12-25T00:00:00Z'))).toBe(39_600);
    expect(footerOffsetAt(lordHowe, at('2027-02-01T00:00:00Z'))).toBe(39_600);
    expect(footerOffsetAt(lordHowe, at('2027-07-01T00:00:00Z'))).toBe(37_800);
    // DST starts 02:00 standard (+10:30) on the first Sunday of October: 15:30Z the evening before.
    expect(footerOffsetAt(lordHowe, at('2026-10-03T15:29:59Z'))).toBe(37_800);
    expect(footerOffsetAt(lordHowe, at('2026-10-03T15:30:00Z'))).toBe(39_600);
    // DST ends 02:00 DST (+11) on the first Sunday of April: 15:00Z the evening before.
    expect(footerOffsetAt(lordHowe, at('2027-04-03T14:59:59Z'))).toBe(39_600);
    expect(footerOffsetAt(lordHowe, at('2027-04-03T15:00:00Z'))).toBe(37_800);
  });

  it('handles negative savings where the rule order wraps the year (Ireland)', () => {
    expect(footerOffsetAt(dublin, at('2026-07-01T00:00:00Z'))).toBe(3_600);
    expect(footerOffsetAt(dublin, at('2026-12-25T00:00:00Z'))).toBe(0);
    expect(footerOffsetAt(dublin, at('2027-01-15T00:00:00Z'))).toBe(0);
    expect(footerOffsetAt(dublin, at('2027-03-28T00:59:59Z'))).toBe(0);
    expect(footerOffsetAt(dublin, at('2027-03-28T01:00:00Z'))).toBe(3_600);
    expect(footerOffsetAt(dublin, at('2026-10-25T00:59:59Z'))).toBe(3_600);
    expect(footerOffsetAt(dublin, at('2026-10-25T01:00:00Z'))).toBe(0);
  });

  it('evaluates a fixed-offset footer at any instant', () => {
    const fixed = parseFooter('<+03>-3');
    expect(footerOffsetAt(fixed, 0)).toBe(10_800);
    expect(footerOffsetAt(fixed, at('2090-01-01T00:00:00Z'))).toBe(10_800);
  });

  it('lists the transitions of the years around a window with their offsets', () => {
    const transitions = footerTransitions(
      newYork,
      at('2026-01-01T00:00:00Z'),
      at('2026-12-31T00:00:00Z'),
    );
    expect(transitions).toEqual([
      { at: at('2026-03-08T07:00:00Z'), before: -18_000, after: -14_400 },
      { at: at('2026-11-01T06:00:00Z'), before: -14_400, after: -18_000 },
    ]);
    expect(footerTransitions(parseFooter('<+03>-3'), 0, 1_000_000_000)).toEqual(
      [],
    );
    expect(
      footerTransitions(
        newYork,
        at('2026-03-08T07:00:00Z'),
        at('2026-03-09T00:00:00Z'),
      ),
    ).toEqual([]);
    expect(
      footerTransitions(
        newYork,
        at('2026-03-08T06:59:59Z'),
        at('2026-03-09T00:00:00Z'),
      ),
    ).toHaveLength(1);
  });

  it('keeps the far future correct (2090) from the same two rules', () => {
    expect(footerOffsetAt(newYork, at('2090-03-12T06:59:59Z'))).toBe(-18_000);
    expect(footerOffsetAt(newYork, at('2090-03-12T07:00:00Z'))).toBe(-14_400);
  });
});
