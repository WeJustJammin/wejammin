import { describe, expect, it } from 'vitest';

import { localInputValue, parseAssignmentExpiry } from './cms-workflow-expiry';

const NOW = Date.parse('2026-10-08T12:00:00Z');
const DAY = 24 * 3_600_000;

const local = (ms: number): string => localInputValue(ms);

describe('parseAssignmentExpiry', () => {
  it('accepts a time after now and within seven days', () => {
    const result = parseAssignmentExpiry(local(NOW + 3 * DAY), NOW, null);
    expect(result).toEqual({
      ok: true,
      instant: new Date(
        Math.floor((NOW + 3 * DAY) / 60_000) * 60_000,
      ).toISOString(),
    });
  });

  it('accepts exactly the seven-day ceiling and refuses one minute beyond', () => {
    expect(parseAssignmentExpiry(local(NOW + 7 * DAY), NOW, null).ok).toBe(
      true,
    );
    const beyond = parseAssignmentExpiry(
      local(NOW + 7 * DAY + 60_000),
      NOW,
      null,
    );
    expect(beyond).toEqual({
      ok: false,
      message:
        'Choose a time within seven days that ends before the reviewer’s access ends.',
    });
  });

  it('is bounded by the end of the chosen reviewer’s access', () => {
    const ends = new Date(NOW + 2 * DAY).toISOString();
    expect(parseAssignmentExpiry(local(NOW + 2 * DAY), NOW, ends).ok).toBe(
      true,
    );
    expect(
      parseAssignmentExpiry(local(NOW + 2 * DAY + 60_000), NOW, ends).ok,
    ).toBe(false);
  });

  it('refuses an empty, invalid or past time with fixed copy', () => {
    expect(parseAssignmentExpiry('', NOW, null)).toEqual({
      ok: false,
      message: 'Choose when the assignment ends.',
    });
    expect(parseAssignmentExpiry('not a date', NOW, null)).toEqual({
      ok: false,
      message: 'Choose a valid date and time.',
    });
    expect(parseAssignmentExpiry(local(NOW - 60_000), NOW, null)).toEqual({
      ok: false,
      message: 'Choose a time in the future.',
    });
    expect(parseAssignmentExpiry(local(NOW), NOW, null).ok).toBe(false);
  });
});

describe('localInputValue', () => {
  it('formats a millisecond instant as a datetime-local value in the browser zone', () => {
    const value = localInputValue(NOW);
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/u);
    expect(new Date(value).getTime()).toBe(Math.floor(NOW / 60_000) * 60_000);
  });
});
