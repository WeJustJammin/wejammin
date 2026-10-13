import { describe, expect, it } from 'vitest';

import { parseInstant } from './local-datetime';

describe('parseInstant with an hours-only numeric offset', () => {
  it('reads +hh and -hh as whole hours with no minutes', () => {
    expect(parseInstant('2026-11-01T07:30:00+01')).toEqual({
      seconds: 1_793_514_600,
      nanos: 0,
    });
    expect(parseInstant('2026-11-01T01:30:00-05')).toEqual({
      seconds: 1_793_514_600,
      nanos: 0,
    });
  });

  it('reads a compact +hhmm offset as hours and minutes', () => {
    expect(parseInstant('2026-11-01T12:00:00+0530')).toEqual({
      seconds: 1_793_514_600,
      nanos: 0,
    });
  });

  it('refuses an hours-only offset past 23 hours', () => {
    expect(parseInstant('2026-11-01T06:30:00+24')).toBeNull();
    expect(parseInstant('2026-11-01T06:30:00-99')).toBeNull();
  });
});
