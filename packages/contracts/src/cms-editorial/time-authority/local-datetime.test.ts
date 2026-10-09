import { describe, expect, it } from 'vitest';

import {
  daysFromCivil,
  formatLocalDateTime,
  formatUtcInstant,
  parseInstant,
  parseLocalDateTime,
} from './local-datetime';

describe('[P2-S11-AC-104] civil date arithmetic', () => {
  it('counts days from the Unix epoch across leap years and centuries', () => {
    expect(daysFromCivil(1970, 1, 1)).toBe(0);
    expect(daysFromCivil(1970, 1, 2)).toBe(1);
    expect(daysFromCivil(1969, 12, 31)).toBe(-1);
    expect(daysFromCivil(2000, 2, 29)).toBe(11016);
    expect(daysFromCivil(2000, 3, 1)).toBe(11017);
    expect(daysFromCivil(2026, 11, 1)).toBe(20758);
    expect(daysFromCivil(2100, 3, 1) - daysFromCivil(2100, 2, 28)).toBe(1);
    expect(daysFromCivil(2400, 3, 1) - daysFromCivil(2400, 2, 28)).toBe(2);
    expect(daysFromCivil(2038, 1, 19)).toBe(24855);
  });
});

describe('[P2-S11-AC-104] parseLocalDateTime', () => {
  it('reads an offset-free ISO local datetime into naive seconds and nanoseconds', () => {
    expect(parseLocalDateTime('2026-11-01T01:30')).toEqual({
      naiveSeconds: 20758 * 86_400 + 5_400,
      nanos: 0,
      hasSeconds: false,
      fractionDigits: 0,
    });
    expect(parseLocalDateTime('2026-11-01T01:30:15')).toMatchObject({
      naiveSeconds: 20758 * 86_400 + 5_415,
      hasSeconds: true,
      fractionDigits: 0,
    });
    expect(parseLocalDateTime('2026-11-01T01:30:15.250')).toMatchObject({
      nanos: 250_000_000,
      fractionDigits: 3,
    });
    expect(parseLocalDateTime('2026-11-01T01:30:15.123456789')?.nanos).toBe(
      123_456_789,
    );
    expect(parseLocalDateTime('1969-12-31T23:59:59')?.naiveSeconds).toBe(-1);
  });

  it('refuses an offset, an impossible date or time and any other shape', () => {
    for (const bad of [
      '2026-11-01T01:30Z',
      '2026-11-01T01:30+02:00',
      '2026-02-30T01:30',
      '2026-13-01T01:30',
      '2026-11-01T24:00',
      '2026-11-01T01:60',
      '2026-11-01T01:30:60',
      '2026-11-01 01:30',
      '2026-11-01T01:30:15.1234567891',
      '26-11-01T01:30',
      '',
    ])
      expect(parseLocalDateTime(bad), bad).toBeNull();
  });
});

describe('[P2-S11-AC-104] formatting', () => {
  it('formats naive seconds as a local datetime keeping the requested precision', () => {
    const base = parseLocalDateTime('2026-03-08T02:30');
    if (base === null) throw new Error('fixture');
    expect(formatLocalDateTime(base.naiveSeconds - 3_600, base)).toBe(
      '2026-03-08T01:30',
    );
    const withSeconds = parseLocalDateTime('2026-03-08T02:30:15.5');
    if (withSeconds === null) throw new Error('fixture');
    expect(
      formatLocalDateTime(withSeconds.naiveSeconds + 3_600, withSeconds),
    ).toBe('2026-03-08T03:30:15.5');
  });

  it('formats a UTC instant as an ISO Z string with the requested fraction digits', () => {
    expect(formatUtcInstant(0, 0, 0)).toBe('1970-01-01T00:00:00Z');
    expect(formatUtcInstant(1_793_505_600, 0, 0)).toBe('2026-11-01T04:00:00Z');
    expect(formatUtcInstant(1_793_505_600, 500_000_000, 3)).toBe(
      '2026-11-01T04:00:00.500Z',
    );
    expect(formatUtcInstant(-1, 0, 0)).toBe('1969-12-31T23:59:59Z');
  });
});

describe('[P2-S11-AC-105] parseInstant', () => {
  it('reads Z and numeric-offset instants to exact seconds and nanoseconds', () => {
    expect(parseInstant('2026-11-01T06:30:00Z')).toEqual({
      seconds: 1_793_514_600,
      nanos: 0,
    });
    expect(parseInstant('2026-11-01T01:30:00-05:00')).toEqual({
      seconds: 1_793_514_600,
      nanos: 0,
    });
    expect(parseInstant('2026-11-01T07:30:00+01:00')).toEqual({
      seconds: 1_793_514_600,
      nanos: 0,
    });
    expect(parseInstant('2026-11-01T06:30:00.123456789Z')).toEqual({
      seconds: 1_793_514_600,
      nanos: 123_456_789,
    });
    expect(parseInstant('2026-11-01T06:30:00.5Z')).toEqual({
      seconds: 1_793_514_600,
      nanos: 500_000_000,
    });
    expect(parseInstant('2026-11-01T06:30Z')).toEqual({
      seconds: 1_793_514_600,
      nanos: 0,
    });
  });

  it('refuses a local datetime without an offset and any malformed instant', () => {
    for (const bad of [
      '2026-11-01T06:30:00',
      '2026-11-01',
      'tomorrow',
      '2026-11-01T06:30:00+25:00',
      '2026-02-30T06:30:00Z',
      '',
    ])
      expect(parseInstant(bad), bad).toBeNull();
  });
});
