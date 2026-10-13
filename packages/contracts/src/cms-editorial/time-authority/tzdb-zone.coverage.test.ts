import { describe, expect, it } from 'vitest';

import type { TzdbSnapshot } from './tzdb-snapshot';
import {
  compileZone,
  resolveLocal,
  zoneOffsetAt,
  zoneTransitions,
} from './tzdb-zone';

type RawZone = TzdbSnapshot['zones'][number];

// Offsets 0 / +1h; +1h from second 100, back to 0 from second 1_100; no footer.
const NO_FOOTER: RawZone = [[0, 3_600], 0, [100, 1_000], [1, 0], ''];

describe('a zone without a footer', () => {
  it('compiles its transitions to absolute seconds and leaves the footer null', () => {
    expect(compileZone(NO_FOOTER)).toEqual({
      initialOffset: 0,
      transitions: [
        { at: 100, offset: 3_600 },
        { at: 1_100, offset: 0 },
      ],
      footer: null,
    });
  });

  it('keeps the last explicit offset for every later instant', () => {
    const zone = compileZone(NO_FOOTER);
    expect(zoneOffsetAt(zone, 99)).toBe(0);
    expect(zoneOffsetAt(zone, 100)).toBe(3_600);
    expect(zoneOffsetAt(zone, 1_099)).toBe(3_600);
    expect(zoneOffsetAt(zone, 1_100)).toBe(0);
    expect(zoneOffsetAt(zone, 4_000_000_000)).toBe(0);
  });

  it('lists only the explicit transitions inside the half-open window', () => {
    const zone = compileZone(NO_FOOTER);
    expect(zoneTransitions(zone, 0, 5_000)).toEqual([
      { at: 100, before: 0, after: 3_600 },
      { at: 1_100, before: 3_600, after: 0 },
    ]);
    expect(zoneTransitions(zone, 100, 1_100)).toEqual([
      { at: 1_100, before: 3_600, after: 0 },
    ]);
    expect(zoneTransitions(zone, 1_100, 4_000_000_000)).toEqual([]);
  });
});

describe('compiling a zone whose offset indexes do not line up', () => {
  it('refuses an initial offset index outside the offset table', () => {
    expect(() => compileZone([[0, 3_600], 2, [], [], ''])).toThrow(
      'The tz zone offset index 2 is outside its table of 2 offsets.',
    );
  });

  it('refuses a transition offset index outside the offset table', () => {
    expect(() => compileZone([[0, 3_600], 0, [100, 50], [1, 7], ''])).toThrow(
      'The tz zone offset index 7 is outside its table of 2 offsets.',
    );
  });

  it('refuses fewer offset indexes than transition deltas', () => {
    expect(() => compileZone([[0, 3_600], 0, [100, 50], [1], ''])).toThrow(
      'The tz zone needs one offset index per transition delta.',
    );
  });

  it('refuses more offset indexes than transition deltas', () => {
    expect(() => compileZone([[0, 3_600], 0, [100], [1, 0], ''])).toThrow(
      'The tz zone needs one offset index per transition delta.',
    );
  });
});

describe('resolving a local time in a self-contradicting zone', () => {
  it('refuses to invent an instant when the last explicit offset contradicts the footer', () => {
    // From second 86_400 the explicit table says +2h but the fixed +1h footer governs.
    const zone = compileZone([[0, 3_600, 7_200], 0, [86_400], [2], '<+01>-1']);
    expect(zoneOffsetAt(zone, 86_399)).toBe(0);
    expect(zoneOffsetAt(zone, 86_400)).toBe(3_600);
    expect(() => resolveLocal(zone, 96_400)).toThrow(
      'The tz snapshot has no instant and no gap for a local time.',
    );
  });
});
