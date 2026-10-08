import { describe, expect, it } from 'vitest';

import { FieldDefinitionInputSchema } from './models-fields.ts';
import {
  CMS_PROTECTED_VALIDATORS,
  CMS_PROTECTED_VALIDATOR_KEYS,
  ProtectedValidatorEvidenceSchema,
  isProtectedValidatorPairing,
  isProtectedValidatorRef,
} from './protected-validators.ts';

/**
 * P2-S10-AC-085 / DEC-146 (TypeScript side): the code-owned protected validator
 * registry. `rich_text.v1` version 1 is the only member and may be paired only
 * with a `rich_text` field, exactly as `platform_private.cms_protected_validator_ref`
 * and `cms_valid_field_input` enforce it in PostgreSQL.
 */

const baseField = {
  stableFieldId: '123e4567-e89b-42d3-a456-426614174000',
  key: 'body',
  kind: 'rich_text',
  constraints: {},
  required: false,
  validatorKey: null,
  validatorVersion: null,
  defaultMode: 'none',
  localizationMode: 'none',
  editorConfig: { label: 'Body', order: 0 },
  lifecycle: 'active',
} as const;

const fieldWith = (patch: Record<string, unknown>) => ({
  ...baseField,
  ...patch,
});

describe('[P2-S10-AC-085] protected validator registry', () => {
  it('has rich_text.v1 version 1 as its only member, paired with rich_text only', () => {
    expect(CMS_PROTECTED_VALIDATOR_KEYS).toEqual(['rich_text.v1']);
    expect(CMS_PROTECTED_VALIDATORS['rich_text.v1']).toEqual({
      version: 1,
      kinds: ['rich_text'],
    });
  });

  it('resolves only a registered key at its registered version', () => {
    expect(isProtectedValidatorRef('rich_text.v1', '1')).toBe(true);
    expect(isProtectedValidatorRef('rich_text.v1', 1)).toBe(true);
    for (const [key, version] of [
      ['rich_text.v1', '2'],
      ['rich_text.v1', '0'],
      ['rich_text.v1', null],
      ['rich_text.v2', '1'],
      ['cms.slug', '1'],
      ['constructor', '1'],
      ['__proto__', '1'],
      [null, '1'],
    ] as const)
      expect(isProtectedValidatorRef(key, version), String(key)).toBe(false);
  });

  it('allows no pair, or the registered pair on a rich_text field only', () => {
    expect(isProtectedValidatorPairing('short_text', null, null)).toBe(true);
    expect(isProtectedValidatorPairing('rich_text', null, null)).toBe(true);
    expect(isProtectedValidatorPairing('rich_text', 'rich_text.v1', '1')).toBe(
      true,
    );
    for (const kind of [
      'short_text',
      'long_text',
      'object',
      'list',
      'enum',
      'taxonomy',
      'relation',
      'media',
    ])
      expect(isProtectedValidatorPairing(kind, 'rich_text.v1', '1'), kind).toBe(
        false,
      );
    expect(isProtectedValidatorPairing('rich_text', 'rich_text.v1', null)).toBe(
      false,
    );
    expect(isProtectedValidatorPairing('rich_text', null, '1')).toBe(false);
    expect(isProtectedValidatorPairing('rich_text', 'slug.safe', '1')).toBe(
      false,
    );
  });

  it('accepts a protected validator evidence entry and refuses everything else', () => {
    expect(
      ProtectedValidatorEvidenceSchema.safeParse({
        key: 'rich_text.v1',
        version: '1',
      }).success,
    ).toBe(true);
    for (const value of [
      { key: 'rich_text.v1', version: '2' },
      { key: 'pii.safety', version: '1' },
      { key: 'rich_text.v1' },
      { key: 'rich_text.v1', version: '1', extra: true },
    ])
      expect(
        ProtectedValidatorEvidenceSchema.safeParse(value).success,
        JSON.stringify(value),
      ).toBe(false);
  });
});

describe('[P2-S10-AC-085] the field definition input pairs only the registered validator', () => {
  it('accepts a rich_text field with no pair or the registered pair', () => {
    expect(FieldDefinitionInputSchema.safeParse(fieldWith({})).success).toBe(
      true,
    );
    expect(
      FieldDefinitionInputSchema.safeParse(
        fieldWith({ validatorKey: 'rich_text.v1', validatorVersion: '1' }),
      ).success,
    ).toBe(true);
  });

  it('refuses an unregistered key or version on any field', () => {
    for (const patch of [
      { validatorKey: 'slug.safe', validatorVersion: '1' },
      { validatorKey: 'rich_text.v1', validatorVersion: '2' },
      { validatorKey: 'rich_text.v2', validatorVersion: '1' },
    ])
      expect(
        FieldDefinitionInputSchema.safeParse(fieldWith(patch)).success,
        JSON.stringify(patch),
      ).toBe(false);
  });

  it('refuses the rich_text.v1 pair on a field that is not rich_text', () => {
    expect(
      FieldDefinitionInputSchema.safeParse(
        fieldWith({
          kind: 'short_text',
          validatorKey: 'rich_text.v1',
          validatorVersion: '1',
        }),
      ).success,
    ).toBe(false);
  });

  it('refuses a half pair', () => {
    expect(
      FieldDefinitionInputSchema.safeParse(
        fieldWith({ validatorKey: 'rich_text.v1', validatorVersion: null }),
      ).success,
    ).toBe(false);
    expect(
      FieldDefinitionInputSchema.safeParse(
        fieldWith({ validatorKey: null, validatorVersion: '1' }),
      ).success,
    ).toBe(false);
  });
});

describe('[P2-S10-AC-080] a rich_text literal default honours the 03a total-text bounds', () => {
  const document = (text: string) => ({
    format: 'rich_text.v1',
    blocks: [{ type: 'paragraph', spans: [{ text, marks: [] }] }],
  });
  const withDefault = (text: string, constraints: Record<string, unknown>) =>
    fieldWith({
      constraints,
      defaultMode: 'literal',
      defaultValue: document(text),
    });

  it('accepts a default whose total text is inside minLength/maxLength', () => {
    expect(
      FieldDefinitionInputSchema.safeParse(
        withDefault('Hello', { minLength: 5, maxLength: 5 }),
      ).success,
    ).toBe(true);
  });

  it('refuses a default below minLength or above maxLength, as PostgreSQL does', () => {
    expect(
      FieldDefinitionInputSchema.safeParse(
        withDefault('Hi', { minLength: 3, maxLength: 10 }),
      ).success,
    ).toBe(false);
    expect(
      FieldDefinitionInputSchema.safeParse(
        withDefault('Hello!', { maxLength: 5 }),
      ).success,
    ).toBe(false);
  });

  it('counts Unicode characters across every span of every block', () => {
    const twoBlocks = {
      format: 'rich_text.v1',
      blocks: [
        { type: 'paragraph', spans: [{ text: 'Hel', marks: [] }] },
        { type: 'paragraph', spans: [{ text: 'lo!', marks: [] }] },
      ],
    };
    expect(
      FieldDefinitionInputSchema.safeParse(
        fieldWith({
          constraints: { maxLength: 5 },
          defaultMode: 'literal',
          defaultValue: twoBlocks,
        }),
      ).success,
    ).toBe(false);
    expect(
      FieldDefinitionInputSchema.safeParse(
        withDefault('\u{1F600}\u{1F600}', { minLength: 2, maxLength: 2 }),
      ).success,
    ).toBe(true);
  });
});
