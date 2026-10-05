import { describe, expect, it } from 'vitest';

import {
  FieldConstraintsSchema,
  FieldDefinitionInputSchema,
} from './models.ts';
import * as structuredValues from './structured-values.ts';
import { ObjectStructureSchema } from './structured-values.ts';

/**
 * Phase 2 / slice 10 integration (BE03a/BE03b DEC-133 + DEC-112). The
 * structured-value grammar is wired into the field-definition contract: an
 * object field must declare an objectStructure, a non-object field must not,
 * a rich_text literal default must be a rich_text.v1 document, and an object
 * literal default must satisfy the declared structure. These tests pin the
 * integration; the implementation follows the test.
 */

const uuid = '123e4567-e89b-42d3-a456-426614174000';

const heroStructure = {
  properties: [
    { key: 'title', kind: 'scalar', required: true, constraints: {} },
    { key: 'subtitle', kind: 'scalar', required: false, constraints: {} },
    {
      key: 'status',
      kind: 'enum',
      required: true,
      constraints: { enumValues: ['draft', 'live'] },
    },
    { key: 'body', kind: 'rich_text', required: false, constraints: {} },
  ],
};

const richDoc = {
  format: 'rich_text.v1',
  blocks: [{ type: 'paragraph', spans: [] }],
};

const baseField = (
  over: Record<string, unknown> = {},
): Record<string, unknown> => ({
  stableFieldId: uuid,
  key: 'display_name',
  kind: 'short_text',
  constraints: {},
  required: false,
  validatorKey: null,
  validatorVersion: null,
  defaultMode: 'none',
  localizationMode: 'none',
  editorConfig: { label: 'Display name', order: 0 },
  lifecycle: 'active',
  ...over,
});

const literal = (over: Record<string, unknown> = {}): Record<string, unknown> =>
  baseField({ defaultMode: 'literal', ...over });

const objectField = (
  over: Record<string, unknown> = {},
): Record<string, unknown> =>
  baseField({ key: 'hero', kind: 'object', constraints: { objectStructure: heroStructure }, ...over });

type StructureGuard = (structure: unknown, value: unknown) => boolean;
const structureGuard = (
  structuredValues as { isObjectValueForStructure?: StructureGuard }
).isObjectValueForStructure;
const acceptsObjectValue = (structure: unknown, value: unknown): boolean =>
  typeof structureGuard === 'function' ? structureGuard(structure, value) : false;

describe('[P2-S10-1a] FieldConstraintsSchema carries the optional objectStructure', () => {
  it('accepts an objectStructure and leaves it optional for legacy constraints', () => {
    expect(
      FieldConstraintsSchema.safeParse({ objectStructure: heroStructure }).success,
    ).toBe(true);
    expect(
      FieldConstraintsSchema.safeParse({
        minLength: 1,
        maxLength: 8,
        objectStructure: heroStructure,
      }).success,
    ).toBe(true);
    for (const legacy of [{}, { minLength: 1 }, { enumValues: ['a'] }, { itemKind: 'short_text' }])
      expect(FieldConstraintsSchema.safeParse(legacy).success).toBe(true);
  });

  it('enforces the structure grammar inside constraints', () => {
    expect(
      FieldConstraintsSchema.safeParse({
        objectStructure: { properties: [], extra: true },
      }).success,
    ).toBe(false);
    expect(
      FieldConstraintsSchema.safeParse({
        objectStructure: {
          properties: [
            { key: 'title', kind: 'scalar', required: true, constraints: {} },
            { key: 'title', kind: 'scalar', required: true, constraints: {} },
          ],
        },
      }).success,
    ).toBe(false);
    expect(
      FieldConstraintsSchema.safeParse({
        objectStructure: {
          properties: [{ key: 'status', kind: 'enum', required: true, constraints: {} }],
        },
      }).success,
    ).toBe(false);
    expect(
      FieldConstraintsSchema.safeParse({
        objectStructure: {
          properties: Array.from({ length: 33 }, (_unused, index) => ({
            key: 'key_' + index,
            kind: 'scalar',
            required: false,
            constraints: {},
          })),
        },
      }).success,
    ).toBe(false);
  });
});

describe('[P2-S10-1a] FieldDefinitionInputSchema kind/structure agreement', () => {
  it('requires an objectStructure on the object kind', () => {
    expect(FieldDefinitionInputSchema.safeParse(objectField()).success).toBe(true);
    expect(
      FieldDefinitionInputSchema.safeParse(
        baseField({ key: 'hero', kind: 'object', constraints: {} }),
      ).success,
    ).toBe(false);
  });

  it('forbids an objectStructure on every non-object kind', () => {
    for (const kind of ['short_text', 'long_text', 'rich_text', 'boolean', 'integer', 'decimal', 'date', 'datetime', 'enum', 'taxonomy', 'relation', 'media', 'list']) {
      expect(
        FieldDefinitionInputSchema.safeParse(
          baseField({ kind, constraints: { objectStructure: heroStructure } }),
        ).success,
        kind,
      ).toBe(false);
    }
  });
});

describe('[P2-S10-1a] rich_text literal defaults must be a rich_text.v1 document', () => {
  it('accepts a valid document and refuses invalid ones', () => {
    expect(
      FieldDefinitionInputSchema.safeParse(
        literal({ key: 'body', kind: 'rich_text', defaultValue: richDoc }),
      ).success,
    ).toBe(true);
    for (const defaultValue of [
      'plain text',
      { format: 'rich_text.v2', blocks: [{ type: 'paragraph', spans: [] }] },
      { format: 'rich_text.v1', blocks: [] },
      { blocks: [{ type: 'paragraph', spans: [] }] },
      [],
      null,
    ])
      expect(
        FieldDefinitionInputSchema.safeParse(
          literal({ key: 'body', kind: 'rich_text', defaultValue }),
        ).success,
        JSON.stringify(defaultValue),
      ).toBe(false);
  });

  it('keeps the legacy literal-without-default refusal', () => {
    expect(
      FieldDefinitionInputSchema.safeParse(
        baseField({ key: 'body', kind: 'rich_text', defaultMode: 'literal' }),
      ).success,
    ).toBe(false);
  });
});

describe('[P2-S10-1a] object literal defaults must satisfy the declared structure', () => {
  it('accepts minimal and fully-populated values', () => {
    expect(
      FieldDefinitionInputSchema.safeParse(
        objectField({ defaultMode: 'literal', defaultValue: { title: 'Hello', status: 'draft' } }),
      ).success,
    ).toBe(true);
    expect(
      FieldDefinitionInputSchema.safeParse(
        objectField({
          defaultMode: 'literal',
          defaultValue: { title: 'Hello', subtitle: 'world', status: 'live', body: richDoc },
        }),
      ).success,
    ).toBe(true);
  });

  it('allows optional properties to be missing but not invalid when present', () => {
    expect(
      FieldDefinitionInputSchema.safeParse(
        objectField({ defaultMode: 'literal', defaultValue: { title: 'Hello', status: 'draft' } }),
      ).success,
    ).toBe(true);
    expect(
      FieldDefinitionInputSchema.safeParse(
        objectField({
          defaultMode: 'literal',
          defaultValue: { title: 'Hello', status: 'draft', subtitle: [] },
        }),
      ).success,
    ).toBe(false);
  });

  it('refuses unknown keys and missing required keys', () => {
    expect(
      FieldDefinitionInputSchema.safeParse(
        objectField({
          defaultMode: 'literal',
          defaultValue: { title: 'Hello', status: 'draft', extra: 1 },
        }),
      ).success,
    ).toBe(false);
    expect(
      FieldDefinitionInputSchema.safeParse(
        objectField({ defaultMode: 'literal', defaultValue: { status: 'draft' } }),
      ).success,
    ).toBe(false);
  });

  it('refuses nested arrays and objects on a scalar property', () => {
    for (const title of [['a'], { nested: true }, [{}]])
      expect(
        FieldDefinitionInputSchema.safeParse(
          objectField({
            defaultMode: 'literal',
            defaultValue: { title, status: 'draft' },
          }),
        ).success,
        JSON.stringify(title),
      ).toBe(false);
  });

  it('bounds enum values to the declared set of strings', () => {
    expect(
      FieldDefinitionInputSchema.safeParse(
        objectField({ defaultMode: 'literal', defaultValue: { title: 'Hello', status: 'archived' } }),
      ).success,
    ).toBe(false);
    expect(
      FieldDefinitionInputSchema.safeParse(
        objectField({ defaultMode: 'literal', defaultValue: { title: 'Hello', status: 1 } }),
      ).success,
    ).toBe(false);
  });

  it('requires a rich_text property value to be a document', () => {
    expect(
      FieldDefinitionInputSchema.safeParse(
        objectField({
          defaultMode: 'literal',
          defaultValue: { title: 'Hello', status: 'draft', body: 'not a document' },
        }),
      ).success,
    ).toBe(false);
    expect(
      FieldDefinitionInputSchema.safeParse(
        objectField({
          defaultMode: 'literal',
          defaultValue: { title: 'Hello', status: 'draft', body: richDoc },
        }),
      ).success,
    ).toBe(true);
  });

  it('refuses non-object defaults for an object field', () => {
    for (const defaultValue of ['text', 7, true, null, [], [1]])
      expect(
        FieldDefinitionInputSchema.safeParse(
          objectField({ defaultMode: 'literal', defaultValue }),
        ).success,
        JSON.stringify(defaultValue),
      ).toBe(false);
  });

  it('still requires a literal default when the mode is literal', () => {
    expect(
      FieldDefinitionInputSchema.safeParse(objectField({ defaultMode: 'literal' }))
        .success,
    ).toBe(false);
  });
});

describe('[P2-S10-1a] legacy nonstructured fields still parse', () => {
  it('accepts unstructured defaults on the scalar, enum and numeric kinds', () => {
    expect(
      FieldDefinitionInputSchema.safeParse(
        literal({ kind: 'short_text', defaultValue: 'Display name' }),
      ).success,
    ).toBe(true);
    expect(
      FieldDefinitionInputSchema.safeParse(
        literal({ kind: 'integer', defaultValue: 5 }),
      ).success,
    ).toBe(true);
    expect(
      FieldDefinitionInputSchema.safeParse(
        literal({ kind: 'boolean', defaultValue: false }),
      ).success,
    ).toBe(true);
    expect(
      FieldDefinitionInputSchema.safeParse(
        literal({ kind: 'enum', constraints: { enumValues: ['a', 'b'] }, defaultValue: 'a' }),
      ).success,
    ).toBe(true);
  });

  it('keeps none/inherited fields and the validator pair rule unchanged', () => {
    expect(FieldDefinitionInputSchema.safeParse(baseField()).success).toBe(true);
    expect(
      FieldDefinitionInputSchema.safeParse(
        baseField({ defaultMode: 'inherited', defaultValue: 'x' }),
      ).success,
    ).toBe(false);
    expect(
      FieldDefinitionInputSchema.safeParse(
        baseField({ validatorKey: 'cms.slug', validatorVersion: null }),
      ).success,
    ).toBe(false);
  });
});

describe('[P2-S10-1a] isObjectValueForStructure implements the exact rules', () => {
  it('accepts values that match the declared structure', () => {
    expect(acceptsObjectValue(heroStructure, { title: 'Hello', status: 'draft' })).toBe(true);
    expect(
      acceptsObjectValue(heroStructure, {
        title: 'Hello',
        subtitle: 'world',
        status: 'live',
        body: richDoc,
      }),
    ).toBe(true);
    expect(acceptsObjectValue({ properties: heroStructure.properties.slice(1, 2) }, {})).toBe(true);
  });

  it('refuses unknown, missing, nested and out-of-set values', () => {
    const cases: unknown[] = [
      null,
      [],
      'text',
      7,
      { title: 'Hello', status: 'draft', extra: 1 },
      { status: 'draft' },
      { title: ['a'], status: 'draft' },
      { title: { nested: true }, status: 'draft' },
      { title: 'Hello', status: 'archived' },
      { title: 'Hello', status: 1 },
      { title: 'Hello', status: 'draft', body: 'nope' },
      { title: 'Hello', status: 'draft', subtitle: [] },
    ];
    for (const value of cases)
      expect(acceptsObjectValue(heroStructure, value), JSON.stringify(value)).toBe(false);
  });

  it('agrees with the schema over a corpus', () => {
    const corpus: unknown[] = [
      { title: 'Hello', status: 'draft' },
      { title: 'Hello', status: 'live', body: richDoc },
      { title: 'Hello', status: 'draft', extra: 1 },
      { status: 'live' },
      { title: [], status: 'live' },
      { title: 'Hello', status: 'nope' },
      null,
    ];
    for (const value of corpus) {
      const viaSchema =
        FieldDefinitionInputSchema.safeParse(
          objectField({ defaultMode: 'literal', defaultValue: value }),
        ).success;
      expect(acceptsObjectValue(heroStructure, value), JSON.stringify(value)).toBe(
        viaSchema,
      );
    }
    expect(ObjectStructureSchema.safeParse(heroStructure).success).toBe(true);
  });
});
