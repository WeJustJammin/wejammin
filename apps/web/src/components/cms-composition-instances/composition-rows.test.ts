import { describe, expect, it } from 'vitest';

import {
  canDetach,
  canReviewUpdate,
  chunk,
  mergeRows,
  orderRows,
  pinLabel,
  stateLabel,
} from './composition-rows';
import { row } from './composition.test-support';

describe('orderRows: the stored position, DEC-185', () => {
  it('lists rows by position then path, so two placements in one slot stay apart', () => {
    const rows = [
      row(1, { path: '/main/b', position: 2 }),
      row(2, { path: '/main/a', position: 2 }),
      row(3, { path: '/main/z', position: 0 }),
    ];
    expect(orderRows(rows).map((entry) => entry.path)).toEqual([
      '/main/z',
      '/main/a',
      '/main/b',
    ]);
  });

  it('does not reorder its input', () => {
    const rows = [row(1, { position: 5 }), row(2, { position: 1 })];
    orderRows(rows);
    expect(rows.map((entry) => entry.position)).toEqual([5, 1]);
  });
});

describe('mergeRows: the listed order is the server order (DEC-206)', () => {
  it('keeps the rows already listed where they are, even when a later slot has lower positions', () => {
    const listed = [
      row(1, { path: '/main/a', position: 4 }),
      row(2, { path: '/side/b', position: 0 }),
    ];
    const merged = mergeRows(listed, [
      row(3, { path: '/main/c', position: 5 }),
    ]);
    expect(merged.map((entry) => entry.path)).toEqual([
      '/main/a',
      '/side/b',
      '/main/c',
    ]);
  });

  it('replaces an updated path in place and appends new paths by position then path', () => {
    const listed = [
      row(1, { path: '/main/a', position: 4, version: '1' }),
      row(2, { path: '/side/b', position: 0 }),
    ];
    const merged = mergeRows(listed, [
      row(4, { path: '/main/z', position: 7 }),
      row(3, { path: '/main/y', position: 6 }),
      row(1, {
        path: '/main/a',
        position: 4,
        version: '2',
        state: 'pending_diff',
      }),
    ]);
    expect(merged.map((entry) => [entry.path, entry.version])).toEqual([
      ['/main/a', '2'],
      ['/side/b', '3'],
      ['/main/y', '3'],
      ['/main/z', '3'],
    ]);
  });

  it('keeps the newest of a path that arrives twice in one batch', () => {
    const merged = mergeRows(
      [],
      [
        row(1, { version: '2' }),
        row(1, { version: '5' }),
        row(1, { version: '4' }),
      ],
    );
    expect(merged.map((entry) => entry.version)).toEqual(['5']);
  });
});

describe('mergeRows: the newest row of a path wins', () => {
  it('replaces a path with its newer version and keeps unrelated rows', () => {
    const merged = mergeRows(
      [row(1, { version: '3' }), row(2, { version: '1' })],
      [row(1, { version: '4', state: 'active' })],
    );
    expect(merged.map((entry) => [entry.path, entry.version])).toEqual([
      ['/main/row-1', '4'],
      ['/main/row-2', '1'],
    ]);
  });

  it('never lets an older answer replace a newer row (versions compare numerically)', () => {
    const merged = mergeRows(
      [row(1, { version: '10' })],
      [row(1, { version: '9' })],
    );
    expect(merged[0]?.version).toBe('10');
  });
});

describe('row actions and labels', () => {
  it('names pending_diff "Update available" and offers a review only for a linked pending_diff row', () => {
    const pending = row(1, { state: 'pending_diff' });
    expect(stateLabel(pending)).toBe('Update available');
    expect(canReviewUpdate(pending)).toBe(true);
    expect(canReviewUpdate(row(2, { state: 'active' }))).toBe(false);
    expect(
      canReviewUpdate(row(3, { state: 'pending_diff', linkMode: 'detached' })),
    ).toBe(false);
    expect(canReviewUpdate(row(4, { state: 'retired' }))).toBe(false);
  });

  it('offers detach on a linked row, also on the newest retired row, and never on a detached row', () => {
    expect(canDetach(row(1, { state: 'active' }))).toBe(true);
    expect(canDetach(row(2, { state: 'pending_diff' }))).toBe(true);
    expect(canDetach(row(3, { state: 'retired' }))).toBe(true);
    expect(canDetach(row(4, { linkMode: 'detached' }))).toBe(false);
    expect(canDetach(row(5, { state: 'superseded' }))).toBe(false);
  });

  it('names a local copy, a removal and the pinned version in words', () => {
    expect(stateLabel(row(1, { linkMode: 'detached' }))).toBe('Local copy');
    expect(stateLabel(row(2, { state: 'retired' }))).toBe(
      'Removed from the entry',
    );
    expect(stateLabel(row(3, { state: 'active' }))).toBe('Up to date');
    expect(pinLabel(row(4, { patternVersion: 3 }))).toBe(
      'Pinned to pattern version 3',
    );
    expect(pinLabel(row(5, { patternVersion: null }))).toBe(
      'No pattern version',
    );
  });
});

describe('chunk: successive requests of at most 32 (DEC-181)', () => {
  it('splits 70 into 32, 32 and 6, in order', () => {
    const items = Array.from({ length: 70 }, (_, index) => index);
    const parts = chunk(items, 32);
    expect(parts.map((part) => part.length)).toEqual([32, 32, 6]);
    expect(parts.flat()).toEqual(items);
  });

  it('returns no chunk for no items and one chunk for exactly 32', () => {
    expect(chunk([], 32)).toEqual([]);
    expect(
      chunk(
        Array.from({ length: 32 }, (_, i) => i),
        32,
      ),
    ).toHaveLength(1);
  });
});
