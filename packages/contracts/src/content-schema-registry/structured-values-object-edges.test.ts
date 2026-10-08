import { describe, expect, it } from 'vitest';

import {
  isObjectValueForStructure,
  type ObjectStructure,
} from './structured-values';

/*
 * DEC-133: an `object` value is a depth-1 record whose keys are a subset of the
 * declared properties, whose required properties are present, and whose scalar
 * properties hold JSON primitives only. These are the numeric and key-count
 * edges of that grammar.
 */

const structure: ObjectStructure = {
  properties: [
    { key: 'label', kind: 'scalar', required: true, constraints: {} },
    { key: 'weight', kind: 'scalar', required: false, constraints: {} },
  ],
};

describe('isObjectValueForStructure edges', () => {
  it('accepts every JSON primitive a scalar property may hold', () => {
    for (const weight of [0, -3.5, 12, 'heavy', true])
      expect(isObjectValueForStructure(structure, { label: 'a', weight })).toBe(
        true,
      );
  });

  it('refuses a JSON null for a scalar property (BE03a: scalar admits no authored null; required is the only presence control)', () => {
    expect(
      isObjectValueForStructure(structure, { label: 'a', weight: null }),
    ).toBe(false);
    expect(
      isObjectValueForStructure(structure, { label: null, weight: 1 }),
    ).toBe(false);
  });

  it('refuses a non-finite number, an array or a nested object as a scalar', () => {
    for (const weight of [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      [1],
      { nested: true },
    ])
      expect(isObjectValueForStructure(structure, { label: 'a', weight })).toBe(
        false,
      );
  });

  it('refuses more keys than the structure declares before looking at any of them', () => {
    expect(
      isObjectValueForStructure(structure, {
        label: 'a',
        weight: 1,
        extra: 'x',
      }),
    ).toBe(false);
  });

  it('refuses an undeclared key even when the key count fits', () => {
    expect(isObjectValueForStructure(structure, { label: 'a', other: 1 })).toBe(
      false,
    );
  });

  it('refuses a non-record value and a missing required property', () => {
    for (const value of [null, 'text', 4, ['label']])
      expect(isObjectValueForStructure(structure, value)).toBe(false);
    expect(isObjectValueForStructure(structure, { weight: 1 })).toBe(false);
  });
});
