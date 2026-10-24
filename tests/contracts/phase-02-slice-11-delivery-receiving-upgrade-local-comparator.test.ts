import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { expectValueEqual } from './phase-02-slice-11-delivery-receiving-upgrade-plan-assertions';

type Staged = {
  name: string;
  regular: boolean;
  bytes: Buffer;
  sha256: string;
};

function staged(): Staged[] {
  return ['20261001000000_alpha.sql', '20261001000100_beta.sql'].map(
    (name, index) => {
      const bytes = Buffer.from([0x11 + index, 0x22, 0x33, 0x44 + index]);
      return {
        name,
        regular: true,
        bytes,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      };
    },
  );
}

const copy = (entries: Staged[]): Staged[] =>
  entries.map((entry) => ({ ...entry, bytes: Buffer.from(entry.bytes) }));

describe('DEC-197 lossless staged-array comparator controls', () => {
  it('DR-UL-C01 independent copied arrays compare every staged field and byte', () => {
    const expected = staged();
    const actual = copy(expected);
    expect(actual).not.toBe(expected);
    for (let index = 0; index < expected.length; index += 1) {
      expect(actual[index]).not.toBe(expected[index]);
      expect(actual[index]!.bytes).not.toBe(expected[index]!.bytes);
    }
    expect(() => expectValueEqual(actual, expected, 'staged')).not.toThrow();
  });

  for (const position of ['first', 'last'] as const) {
    it(`DR-UL-C02 ${position} byte corruption fails despite unchanged stored hash`, () => {
      const expected = staged();
      const actual = copy(expected);
      const entry = actual[position === 'first' ? 0 : actual.length - 1]!;
      const offset = position === 'first' ? 0 : entry.bytes.length - 1;
      entry.bytes[offset] = entry.bytes[offset]! ^ 0xff;
      expect(actual.map(({ sha256 }) => sha256)).toEqual(
        expected.map(({ sha256 }) => sha256),
      );
      expect(() => expectValueEqual(actual, expected, 'staged')).toThrow(
        /every byte/,
      );
    });
  }

  for (const field of ['name', 'regular', 'sha256'] as const) {
    it(`DR-UL-C03 changed ${field} metadata is not ignored`, () => {
      const expected = staged();
      const actual = copy(expected);
      if (field === 'regular') actual[0]!.regular = false;
      else
        actual[0]![field] = field === 'name' ? 'renamed.sql' : '0'.repeat(64);
      expect(actual[0]!.bytes.equals(expected[0]!.bytes)).toBe(true);
      expect(() => expectValueEqual(actual, expected, 'staged')).toThrow();
    });
  }

  for (const kind of ['enumerable', 'nonenumerable', 'symbol'] as const) {
    it(`DR-UL-C04 extra ${kind} own key refuses`, () => {
      const expected = staged();
      const actual = copy(expected);
      Object.defineProperty(
        actual[0],
        kind === 'symbol' ? Symbol('extra') : 'extra',
        {
          value: true,
          enumerable: kind === 'enumerable',
        },
      );
      expect(() => expectValueEqual(actual, expected, 'staged')).toThrow(
        /exact own keys/,
      );
    });
  }

  it('DR-UL-C05 missing own metadata key cannot compare as an inherited value', () => {
    const expected = staged();
    const actual = copy(expected);
    Reflect.deleteProperty(actual[0]!, 'regular');
    Object.setPrototypeOf(actual[0], { regular: true });
    expect(actual[0]!.regular).toBe(true);
    expect(() => expectValueEqual(actual, expected, 'staged')).toThrow(
      /exact own keys/,
    );
  });

  it('DR-UL-C06 own accessor cannot impersonate a staged data field', () => {
    const expected = staged();
    const actual = copy(expected);
    let getterCalled = false;
    Object.defineProperty(actual[0], 'bytes', {
      get() {
        getterCalled = true;
        return expected[0]!.bytes;
      },
      enumerable: true,
    });
    expect(() => expectValueEqual(actual, expected, 'staged')).toThrow(
      /own data field/,
    );
    expect(getterCalled).toBe(false);
  });

  it('DR-UL-C07 staged file order remains part of the exact assertion', () => {
    const expected = staged();
    const actual = copy(expected).reverse();
    expect(() => expectValueEqual(actual, expected, 'staged')).toThrow();
  });

  it('DR-UL-C08 a sparse missing array element refuses despite unchanged length', () => {
    const expected = staged();
    const actual = copy(expected);
    Reflect.deleteProperty(actual, '0');
    expect(actual.length).toBe(expected.length);
    expect(() => expectValueEqual(actual, expected, 'staged')).toThrow(
      /exact own keys/,
    );
  });

  it('DR-UL-C09 replacing a key refuses even when own-key count is unchanged', () => {
    const expected = staged();
    const actual = copy(expected);
    Reflect.deleteProperty(actual[0]!, 'regular');
    Object.defineProperty(actual[0], 'unrelated', { value: true });
    expect(Reflect.ownKeys(actual[0]!)).toHaveLength(
      Reflect.ownKeys(expected[0]!).length,
    );
    expect(() => expectValueEqual(actual, expected, 'staged')).toThrow(
      /own data field/,
    );
  });
});
