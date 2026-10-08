import { describe, expect, it } from 'vitest';

import { FieldDefinitionInputSchema } from './models.ts';

/**
 * Phase 2 / slice 10 (P2-S10-AC-080 parity with the database): BE03a
 * "Field kind structure" says a `list` field carries `constraints.itemKind`,
 * which must be a scalar kind (short_text, long_text, boolean, integer,
 * decimal, date, datetime) or `enum`, and a nested list/object/relation/media/
 * rich_text item is refused at definition time. BE03a validateFieldDefinition
 * adds that `itemKind` is only valid for a list field. The database enforces
 * both in cms_valid_field_input, so the TypeScript contract must refuse the
 * same definitions with the same issue paths.
 */

const uuid = '123e4567-e89b-42d3-a456-426614174000';

const SCALAR_AND_ENUM_ITEM_KINDS = [
  'short_text',
  'long_text',
  'boolean',
  'integer',
  'decimal',
  'date',
  'datetime',
  'enum',
] as const;

const NESTED_ITEM_KINDS = [
  'list',
  'object',
  'relation',
  'media',
  'rich_text',
  'taxonomy',
] as const;

const NON_LIST_KINDS = [
  'short_text',
  'long_text',
  'rich_text',
  'boolean',
  'integer',
  'decimal',
  'date',
  'datetime',
  'enum',
  'taxonomy',
  'relation',
  'media',
] as const;

const field = (
  kind: string,
  constraints: Record<string, unknown>,
): Record<string, unknown> => ({
  stableFieldId: uuid,
  key: 'tags',
  kind,
  constraints,
  required: false,
  validatorKey: null,
  validatorVersion: null,
  defaultMode: 'none',
  localizationMode: 'none',
  editorConfig: { label: 'Tags', order: 0 },
  lifecycle: 'active',
});

const issueMessages = (input: unknown): string[] => {
  const parsed = FieldDefinitionInputSchema.safeParse(input);
  return parsed.success
    ? []
    : parsed.error.issues.map(
        (issue) => issue.path.join('.') + ':' + issue.message,
      );
};

describe('[P2-S10-AC-080] a list field requires a scalar or enum itemKind', () => {
  it('accepts a list for every scalar kind and for enum', () => {
    for (const itemKind of SCALAR_AND_ENUM_ITEM_KINDS)
      expect(
        FieldDefinitionInputSchema.safeParse(field('list', { itemKind }))
          .success,
        itemKind,
      ).toBe(true);
  });

  it('refuses a list whose itemKind is a nested or non-scalar kind', () => {
    for (const itemKind of NESTED_ITEM_KINDS)
      expect(issueMessages(field('list', { itemKind })), itemKind).toContain(
        'constraints.itemKind:list_item_kind_must_be_scalar_or_enum',
      );
  });

  it('refuses a list that declares no itemKind', () => {
    expect(issueMessages(field('list', {}))).toContain(
      'constraints.itemKind:list_item_kind_must_be_scalar_or_enum',
    );
    expect(
      issueMessages(field('list', { minLength: 1, maxLength: 4 })),
    ).toContain('constraints.itemKind:list_item_kind_must_be_scalar_or_enum');
  });

  it('refuses a list whose itemKind is not a field kind at all', () => {
    expect(
      FieldDefinitionInputSchema.safeParse(field('list', { itemKind: 'blob' }))
        .success,
    ).toBe(false);
  });
});

describe('[P2-S10-AC-080] itemKind is only valid for a list field', () => {
  it('refuses an itemKind on every non-list kind', () => {
    for (const kind of NON_LIST_KINDS)
      expect(
        issueMessages(field(kind, { itemKind: 'short_text' })),
        kind,
      ).toContain('constraints.itemKind:item_kind_only_for_list_field');
  });

  it('refuses an itemKind on an object field even when its structure is declared', () => {
    expect(
      issueMessages(
        field('object', {
          itemKind: 'short_text',
          objectStructure: { properties: [] },
        }),
      ),
    ).toContain('constraints.itemKind:item_kind_only_for_list_field');
  });

  it('keeps accepting a non-list field that declares no itemKind', () => {
    for (const kind of NON_LIST_KINDS)
      expect(
        FieldDefinitionInputSchema.safeParse(field(kind, {})).success,
        kind,
      ).toBe(true);
  });
});
