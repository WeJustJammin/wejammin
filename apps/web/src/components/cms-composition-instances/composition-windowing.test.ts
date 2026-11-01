import { describe, expect, it } from 'vitest';

import {
  ROW_HEIGHT_PX,
  VIRTUALIZE_ABOVE,
  windowFor,
} from './composition-windowing';

/*
 * FE03 887 and Responsive Behavior: the list is one in-page collection that virtualizes above 100 rows with stable
 * row ids. `windowFor` is the pure part: which rows exist in the DOM for a scroll offset.
 */
describe('windowFor', () => {
  it('renders every row up to 100: no virtualization, no spacers', () => {
    expect(windowFor(VIRTUALIZE_ABOVE, 0)).toEqual({
      windowed: false,
      start: 0,
      end: 100,
      before: 0,
      after: 0,
    });
    expect(windowFor(0, 0)).toMatchObject({
      windowed: false,
      start: 0,
      end: 0,
    });
  });

  it('windows above 100 rows and keeps the DOM bounded', () => {
    const top = windowFor(512, 0);
    expect(top.windowed).toBe(true);
    expect(top.start).toBe(0);
    expect(top.end - top.start).toBeLessThanOrEqual(60);
    expect(top.after).toBe((512 - top.end) * ROW_HEIGHT_PX);
  });

  it('moves the window with the scroll offset and keeps total height constant', () => {
    const top = windowFor(300, 0);
    const middle = windowFor(300, 150 * ROW_HEIGHT_PX);
    expect(middle.start).toBeGreaterThan(100);
    expect(middle.start).toBeLessThanOrEqual(150);
    expect(middle.end).toBeGreaterThan(150);
    const height = (w: typeof top) =>
      w.before + (w.end - w.start) * ROW_HEIGHT_PX + w.after;
    expect(height(middle)).toBe(300 * ROW_HEIGHT_PX);
    expect(height(top)).toBe(300 * ROW_HEIGHT_PX);
  });

  it('clamps a scroll offset past the end and a negative one', () => {
    const end = windowFor(200, 10 ** 9);
    expect(end.end).toBe(200);
    expect(end.after).toBe(0);
    expect(windowFor(200, -50).start).toBe(0);
  });
});
