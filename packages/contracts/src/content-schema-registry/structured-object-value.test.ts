import { describe, expect, it } from 'vitest';

import { FieldDefinitionInputSchema } from './models.ts';
import { isObjectValueForStructure } from './structured-values.ts';

/**
 * Phase 2 / slice 10 (DEC-133, P2-S10-AC-078/080): the TypeScript value
 * contract for a depth-1 object structure must agree with the database
 * `cms_object_value_valid`. BE03b "object field structure": the value is a
 * strict object keyed by the declared property keys, depth is exactly 1 (a
 * property value is a scalar, an enum member, or a `rich_text.v1` AST, never a
 * nested object or array), and an unknown key, a missing required key, or a
 * kind mismatch is 422.
 *
 * A `scalar` property covers the scalar field kinds (short_text, long_text,
 * boolean, integer, decimal, date, datetime). None of those kinds admits an
 * authored JSON null as a value (an absent value is the missing state and an
 * explicit null is a field-level provenance state, never a value shape), and
 * `required` is the only presence control, so a JSON null can neither satisfy a
 * required scalar nor stand in for an optional one that is simply left out.
 */

const richDoc = {
  format: 'rich_text.v1',
  blocks: [{ type: 'paragraph', spans: [] }],
};

const structure = {
  properties: [
    { key: 'title', kind: 'scalar', required: true, constraints: {} },
    { key: 'count', kind: 'scalar', required: false, constraints: {} },
    {
      key: 'status',
      kind: 'enum',
      required: false,
      constraints: { enumValues: ['draft', 'live'] },
    },
    { key: 'body', kind: 'rich_text', required: false, constraints: {} },
  ],
} as const;

const accepts = (value: unknown): boolean =>
  isObjectValueForStructure(
    structure as unknown as Parameters<typeof isObjectValueForStructure>[0],
    value,
  );

describe('[P2-S10-AC-078] scalar property values', () => {
  it('accepts a string, a boolean and a finite number', () => {
    expect(accepts({ title: 'x' })).toBe(true);
    expect(accepts({ title: true })).toBe(true);
    expect(accepts({ title: 'x', count: 3 })).toBe(true);
    expect(accepts({ title: 'x', count: 1.5 })).toBe(true);
    expect(accepts({ title: 'x', count: 0 })).toBe(true);
  });

  it('refuses a JSON null for a required scalar property', () => {
    expect(accepts({ title: null })).toBe(false);
  });

  it('refuses a JSON null for an optional scalar property', () => {
    expect(accepts({ title: 'x', count: null })).toBe(false);
  });

  it('refuses an array or an object for a scalar property (depth is exactly 1)', () => {
    expect(accepts({ title: ['a'] })).toBe(false);
    expect(accepts({ title: { n: 1 } })).toBe(false);
    expect(accepts({ title: 'x', count: [] })).toBe(false);
    expect(accepts({ title: 'x', count: {} })).toBe(false);
  });

  it('refuses a non-finite number', () => {
    expect(accepts({ title: 'x', count: Number.POSITIVE_INFINITY })).toBe(
      false,
    );
    expect(accepts({ title: 'x', count: Number.NaN })).toBe(false);
  });
});

describe('[P2-S10-AC-078] strict keys, required keys and kind mismatches', () => {
  it('refuses a missing required key and an undeclared key', () => {
    expect(accepts({})).toBe(false);
    expect(accepts({ count: 1 })).toBe(false);
    expect(accepts({ title: 'x', unknown: 1 })).toBe(false);
  });

  it('refuses a value that is not a plain object', () => {
    for (const value of [null, undefined, 'x', 5, true, []])
      expect(accepts(value), JSON.stringify(value)).toBe(false);
  });

  it('holds an enum property to its declared choice set', () => {
    expect(accepts({ title: 'x', status: 'draft' })).toBe(true);
    expect(accepts({ title: 'x', status: 'retired' })).toBe(false);
    expect(accepts({ title: 'x', status: 5 })).toBe(false);
    expect(accepts({ title: 'x', status: null })).toBe(false);
  });

  it('holds a rich_text property to the rich_text.v1 grammar', () => {
    expect(accepts({ title: 'x', body: richDoc })).toBe(true);
    expect(accepts({ title: 'x', body: 'plain text' })).toBe(false);
    expect(accepts({ title: 'x', body: null })).toBe(false);
  });
});

describe('[P2-S10-AC-080] an object literal default follows the same value rules', () => {
  const objectField = (defaultValue: unknown): Record<string, unknown> => ({
    stableFieldId: '123e4567-e89b-42d3-a456-426614174000',
    key: 'hero',
    kind: 'object',
    constraints: { objectStructure: structure },
    required: false,
    validatorKey: null,
    validatorVersion: null,
    defaultMode: 'literal',
    defaultValue,
    localizationMode: 'none',
    editorConfig: { label: 'Hero', order: 0 },
    lifecycle: 'active',
  });

  it('accepts a default whose scalar properties hold primitives', () => {
    expect(
      FieldDefinitionInputSchema.safeParse(objectField({ title: 'Hello' }))
        .success,
    ).toBe(true);
  });

  it('refuses a default carrying a JSON null scalar property', () => {
    expect(
      FieldDefinitionInputSchema.safeParse(objectField({ title: null }))
        .success,
    ).toBe(false);
  });
});
