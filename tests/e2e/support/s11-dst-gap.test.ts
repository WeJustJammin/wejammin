import { describe, expect, it } from 'vitest';

import { nextSpringForwardGap } from './s11-dst-gap';

/*
 * The Slice 11 schedule spec needs a local time that does not exist (the skipped
 * hour of a spring-forward day) inside the schedule horizon (60 s to 366 days
 * from now). A fixed calendar date goes stale, so the spec asks this module for
 * the next real gap and these cases pin it against known tz rules.
 */

describe('nextSpringForwardGap', () => {
  it('finds the New York gap of March 2027 from October 2026', () => {
    const gap = nextSpringForwardGap(new Date('2026-10-11T19:30:00.000Z'));
    expect(gap).toEqual({
      zone: 'America/New_York',
      transitionUtc: new Date('2027-03-14T07:00:00.000Z'),
      nonexistentLocal: '2027-03-14T02:30',
      validLocal: '2027-03-14T10:00',
    });
  });

  it('skips a gap closer than 36 hours so the later valid time stays in the future', () => {
    const gap = nextSpringForwardGap(new Date('2027-03-13T12:00:00.000Z'));
    expect(gap.zone).toBe('Australia/Sydney');
    expect(gap.nonexistentLocal).toBe('2027-10-03T02:30');
    expect(gap.validLocal).toBe('2027-10-03T10:00');
    expect(gap.transitionUtc).toEqual(new Date('2027-10-02T16:00:00.000Z'));
  });

  it('falls back to the Sydney gap when the next New York gap is beyond 330 days', () => {
    // 2031-03-09 to 2032-03-14 is 371 days: no New York gap fits the horizon.
    const gap = nextSpringForwardGap(new Date('2031-03-10T12:00:00.000Z'));
    expect(gap.zone).toBe('Australia/Sydney');
    expect(gap.nonexistentLocal).toBe('2031-10-05T02:30');
  });

  it('always yields a gap inside the schedule horizon, sampled weekly over six years', () => {
    const start = Date.parse('2026-10-01T00:00:00.000Z');
    for (let week = 0; week < 6 * 53; week += 1) {
      const now = new Date(start + week * 7 * 24 * 60 * 60 * 1000);
      const { transitionUtc } = nextSpringForwardGap(now);
      const leadMs = transitionUtc.getTime() - now.getTime();
      expect(leadMs).toBeGreaterThanOrEqual(36 * 60 * 60 * 1000);
      expect(leadMs).toBeLessThanOrEqual(330 * 24 * 60 * 60 * 1000);
    }
  });

  it('refuses a zone list that has no gap in the window instead of guessing', () => {
    expect(() =>
      nextSpringForwardGap(new Date('2026-10-11T19:30:00.000Z'), ['UTC']),
    ).toThrow('no spring-forward gap');
  });
});
