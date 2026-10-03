import { describe, expect, it } from 'vitest';

import {
  PROPS_CONSTRAINTS_MAX_ARRAY,
  PROPS_CONSTRAINTS_MAX_BYTES,
  PROPS_CONSTRAINTS_MAX_DEPTH,
  PROPS_CONSTRAINTS_MAX_KEYS,
  PropsSchemaFieldSchema,
} from '@wejammin/contracts';

const field = { name: 'headline', kind: 'short_text', required: true };
const accepts = (constraints: Record<string, unknown>): boolean =>
  PropsSchemaFieldSchema.safeParse({ ...field, constraints }).success;

const keys = (count: number): Record<string, number> =>
  Object.fromEntries(
    Array.from({ length: count }, (_, index) => [`k${String(index)}`, index]),
  );

const nested = (levels: number): Record<string, unknown> =>
  levels === 1 ? { leaf: 1 } : { child: nested(levels - 1) };

describe('[P2-S09-AC-108] props field constraints are bounded exactly as the database bounds them', () => {
  it('names the database bound constants', () => {
    expect(PROPS_CONSTRAINTS_MAX_BYTES).toBe(8192);
    expect(PROPS_CONSTRAINTS_MAX_DEPTH).toBe(4);
    expect(PROPS_CONSTRAINTS_MAX_KEYS).toBe(64);
    expect(PROPS_CONSTRAINTS_MAX_ARRAY).toBe(128);
  });

  it('accepts four container levels and refuses a fifth', () => {
    expect(accepts(nested(PROPS_CONSTRAINTS_MAX_DEPTH))).toBe(true);
    expect(accepts(nested(PROPS_CONSTRAINTS_MAX_DEPTH + 1))).toBe(false);
  });

  it('accepts 64 keys per object and refuses 65, at the top level and nested', () => {
    expect(accepts(keys(PROPS_CONSTRAINTS_MAX_KEYS))).toBe(true);
    expect(accepts(keys(PROPS_CONSTRAINTS_MAX_KEYS + 1))).toBe(false);
    expect(accepts({ inner: keys(PROPS_CONSTRAINTS_MAX_KEYS) })).toBe(true);
    expect(accepts({ inner: keys(PROPS_CONSTRAINTS_MAX_KEYS + 1) })).toBe(
      false,
    );
  });

  it('accepts 128 items per array and refuses 129', () => {
    const items = (count: number): number[] =>
      Array.from({ length: count }, (_, index) => index);
    expect(accepts({ values: items(PROPS_CONSTRAINTS_MAX_ARRAY) })).toBe(true);
    expect(accepts({ values: items(PROPS_CONSTRAINTS_MAX_ARRAY + 1) })).toBe(
      false,
    );
  });

  it('applies the object and array bounds inside array elements', () => {
    expect(
      accepts({ values: [keys(PROPS_CONSTRAINTS_MAX_KEYS), [1, 2]] }),
    ).toBe(true);
    expect(
      accepts({ values: [{ ok: 1 }, keys(PROPS_CONSTRAINTS_MAX_KEYS + 1)] }),
    ).toBe(false);
    expect(
      accepts({
        values: [
          Array.from({ length: PROPS_CONSTRAINTS_MAX_ARRAY + 1 }, () => 0),
        ],
      }),
    ).toBe(false);
  });

  it('refuses more than 8192 compact UTF-8 bytes and accepts exactly 8192', () => {
    const overhead = new TextEncoder().encode(
      JSON.stringify({ text: '' }),
    ).byteLength;
    const atLimit = {
      text: 'x'.repeat(PROPS_CONSTRAINTS_MAX_BYTES - overhead),
    };
    expect(new TextEncoder().encode(JSON.stringify(atLimit)).byteLength).toBe(
      PROPS_CONSTRAINTS_MAX_BYTES,
    );
    const result = PropsSchemaFieldSchema.safeParse({
      ...field,
      constraints: atLimit,
    });
    expect(result.success).toBe(true);
    expect(accepts({ text: `${atLimit.text}x` })).toBe(false);
    // Multi-byte characters count as bytes, not code units.
    expect(accepts({ text: 'é'.repeat(PROPS_CONSTRAINTS_MAX_BYTES / 2) })).toBe(
      false,
    );
  });
});
