import { describe, expect, it } from 'vitest';

import { TzdbSnapshotSchema, parseSnapshot } from './tzdb-snapshot';

type RawZone = [number[], number, number[], number[], string];

const snapshotWith = (zone: RawZone) => ({
  format: 'cms.tzdb.v1',
  release: '2026e',
  names: { 'Test/Zone': 0 },
  zones: [zone],
});

const issues = (zone: RawZone): { message: string; path: PropertyKey[] }[] => {
  const result = TzdbSnapshotSchema.safeParse(snapshotWith(zone));
  return result.success
    ? []
    : result.error.issues.map(({ message, path }) => ({ message, path }));
};

describe('snapshot zone transition validation', () => {
  it('accepts ascending transitions whose first delta precedes 1970', () => {
    expect(issues([[0, 3_600], 0, [-100, 50, 50], [1, 0, 1], ''])).toEqual([]);
  });

  it('refuses a delta of zero after the first transition', () => {
    expect(issues([[0, 3_600], 0, [100, 0], [1, 0], ''])).toEqual([
      { message: 'transitions ascend strictly', path: ['zones', 0] },
    ]);
  });

  it('refuses a negative delta after the first transition', () => {
    expect(issues([[0, 3_600], 0, [100, 50, -5], [1, 0, 1], ''])).toEqual([
      { message: 'transitions ascend strictly', path: ['zones', 0] },
    ]);
  });

  it('refuses a transition that points past the offset table', () => {
    expect(issues([[0, 3_600], 0, [100, 50], [1, 2], ''])).toEqual([
      {
        message: 'transition offset index is out of range',
        path: ['zones', 0],
      },
    ]);
  });

  it('reports a malformed zone as a malformed snapshot', () => {
    const text = JSON.stringify(
      snapshotWith([[0, 3_600], 0, [100, 0], [1, 0], '']),
    );
    expect(() => parseSnapshot(text)).toThrow('The tz snapshot is malformed.');
  });
});
