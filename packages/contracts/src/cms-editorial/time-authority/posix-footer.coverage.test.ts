import { describe, expect, it } from 'vitest';

import { footerOffsetAt, footerTransitions, parseFooter } from './posix-footer';

const at = (iso: string): number => Date.parse(iso) / 1000;

// Daylight time starts on the last Sunday of December (month 12 has 31 days) and
// ends on the last Sunday of January, 00:00 local time at each change.
const DECEMBER_FOOTER = 'UTC0DST,M12.5.0/0,M1.5.0/0';

describe('footer rules that start in December', () => {
  it('parses a December rule next to a January rule', () => {
    expect(parseFooter(DECEMBER_FOOTER)).toEqual({
      standardOffset: 0,
      daylight: {
        offset: 3_600,
        start: { month: 12, week: 5, weekday: 0, time: 0 },
        end: { month: 1, week: 5, weekday: 0, time: 0 },
      },
    });
  });

  it('places the last-Sunday rule on 27 December 2026 and 24 January 2026 (UTC)', () => {
    expect(
      footerTransitions(
        parseFooter(DECEMBER_FOOTER),
        at('2026-01-01T00:00:00Z'),
        at('2026-12-31T23:59:59Z'),
      ),
    ).toEqual([
      { at: at('2026-01-24T23:00:00Z'), before: 3_600, after: 0 },
      { at: at('2026-12-27T00:00:00Z'), before: 0, after: 3_600 },
    ]);
  });

  it('is in daylight time from the December change through the January change', () => {
    const footer = parseFooter(DECEMBER_FOOTER);
    expect(footerOffsetAt(footer, at('2026-12-26T23:59:59Z'))).toBe(0);
    expect(footerOffsetAt(footer, at('2026-12-27T00:00:00Z'))).toBe(3_600);
    expect(footerOffsetAt(footer, at('2026-01-24T22:59:59Z'))).toBe(3_600);
    expect(footerOffsetAt(footer, at('2026-01-24T23:00:00Z'))).toBe(0);
    expect(footerOffsetAt(footer, at('2026-06-01T00:00:00Z'))).toBe(0);
  });
});
