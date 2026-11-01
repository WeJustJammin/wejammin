import { describe, expect, it } from 'vitest';

import {
  MAX_EXCLUSIONS,
  MAX_PINS,
  addExclusion,
  addPin,
  movePin,
  removeExclusion,
  removePin,
  type RelatedLists,
} from './related-content-lists';

const id = (n: number): string =>
  `018f0c45-73fe-7dc2-9c09-${String(n).padStart(12, '0')}`;
const EMPTY: RelatedLists = { pins: [], exclusions: [] };

describe('pins', () => {
  it('appends in order and keeps the order the author built', () => {
    const one = addPin(EMPTY, id(1));
    const two = one.ok ? addPin(one.lists, id(2)) : one;
    expect(two.ok && two.lists.pins).toEqual([id(1), id(2)]);
  });

  it('refuses a duplicate pin', () => {
    const first = addPin(EMPTY, id(1));
    expect(first.ok && addPin(first.lists, id(1))).toEqual({
      ok: false,
      reason: 'already_pinned',
    });
  });

  it('refuses to pin an excluded entry: exclusions win', () => {
    expect(addPin({ pins: [], exclusions: [id(1)] }, id(1))).toEqual({
      ok: false,
      reason: 'excluded',
    });
  });

  it('stops at the 32-pin bound and accepts the 32nd', () => {
    const thirtyOne = Array.from({ length: MAX_PINS - 1 }, (_, n) => id(n));
    const last = addPin({ pins: thirtyOne, exclusions: [] }, id(900));
    expect(last.ok && last.lists.pins).toHaveLength(MAX_PINS);
    expect(
      addPin({ pins: last.ok ? last.lists.pins : [], exclusions: [] }, id(901)),
    ).toEqual({ ok: false, reason: 'pin_limit' });
  });

  it('removes a pin and closes the gap', () => {
    expect(
      removePin({ pins: [id(1), id(2), id(3)], exclusions: [] }, id(2)).pins,
    ).toEqual([id(1), id(3)]);
  });

  it('moves a pin up and down by one without losing or duplicating any', () => {
    const lists = { pins: [id(1), id(2), id(3)], exclusions: [] };
    expect(movePin(lists, 2, -1).pins).toEqual([id(1), id(3), id(2)]);
    expect(movePin(lists, 0, 1).pins).toEqual([id(2), id(1), id(3)]);
  });

  it('leaves the order unchanged for a move off either end or out of range', () => {
    const lists = { pins: [id(1), id(2)], exclusions: [] };
    expect(movePin(lists, 0, -1)).toBe(lists);
    expect(movePin(lists, 1, 1)).toBe(lists);
    expect(movePin(lists, 5, -1)).toBe(lists);
    expect(movePin(lists, -1, 1)).toBe(lists);
  });
});

describe('exclusions', () => {
  it('adds an exclusion', () => {
    const result = addExclusion(EMPTY, id(1));
    expect(result.ok && result.lists.exclusions).toEqual([id(1)]);
    expect(result.ok && result.displacedPin).toBe(false);
  });

  it('removes the pin of an entry that is excluded, and says so', () => {
    const result = addExclusion(
      { pins: [id(1), id(2)], exclusions: [] },
      id(1),
    );
    expect(result.ok && result.lists).toEqual({
      pins: [id(2)],
      exclusions: [id(1)],
    });
    expect(result.ok && result.displacedPin).toBe(true);
  });

  it('refuses a duplicate exclusion and the 65th', () => {
    expect(addExclusion({ pins: [], exclusions: [id(1)] }, id(1))).toEqual({
      ok: false,
      reason: 'already_excluded',
    });
    const full = Array.from({ length: MAX_EXCLUSIONS }, (_, n) => id(n));
    expect(addExclusion({ pins: [], exclusions: full }, id(999))).toEqual({
      ok: false,
      reason: 'exclusion_limit',
    });
  });

  it('removes an exclusion', () => {
    expect(
      removeExclusion({ pins: [], exclusions: [id(1), id(2)] }, id(1))
        .exclusions,
    ).toEqual([id(2)]);
  });

  it('compares ids case-insensitively so a pin and an exclusion never differ only by case', () => {
    const upper = id(1).toUpperCase();
    const pinned = addPin(EMPTY, id(1));
    expect(pinned.ok && addPin(pinned.lists, upper)).toEqual({
      ok: false,
      reason: 'already_pinned',
    });
    const displaced = pinned.ok ? addExclusion(pinned.lists, upper) : pinned;
    expect(displaced.ok && displaced.lists.pins).toEqual([]);
  });
});
