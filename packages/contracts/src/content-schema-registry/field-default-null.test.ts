import { describe, expect, it } from 'vitest';

import { FieldSchemaChangeRequestSchema } from './requests-human.ts';
import { FieldDefinitionInputSchema } from './models.ts';

/**
 * AC064 (BE03a Field definition: `defaultValue` is Json.nullable().optional() and a
 * default is present when the key is present). A literal default may be an explicit
 * JSON null; only a missing key, or a key under none/inherited, is refused. The
 * database, the Worker adapter and this contract are held to the same rule by
 * supabase/tests/phase_02_slice_09_p240_a02_field.sql,
 * production-field-rpc-shape.test.ts and tests/postgrest/cms-field-default-null.
 */
const base = {
  stableFieldId: '123e4567-e89b-42d3-a456-426614174000',
  key: 'display_name',
  kind: 'short_text' as const,
  constraints: {},
  required: false,
  validatorKey: null,
  validatorVersion: null,
  localizationMode: 'none' as const,
  editorConfig: { label: 'Display name', order: 0 },
  lifecycle: 'active' as const,
};

describe('field default missing/null distinction', () => {
  it('[P2-S09-AC-064] a literal default of explicit JSON null is accepted and the key survives parsing', () => {
    const parsed = FieldDefinitionInputSchema.parse({
      ...base,
      defaultMode: 'literal',
      defaultValue: null,
    });
    expect(Object.hasOwn(parsed, 'defaultValue')).toBe(true);
    expect(parsed.defaultValue).toBeNull();

    const change = FieldSchemaChangeRequestSchema.parse({
      ...base,
      defaultMode: 'literal',
      defaultValue: null,
      migrationPlanId: null,
    });
    expect(Object.hasOwn(change, 'defaultValue')).toBe(true);
    expect(change.defaultValue).toBeNull();
  });

  it('[P2-S09-AC-064] a literal default without the key is refused, and a present key under none or inherited is refused even when null', () => {
    expect(
      FieldDefinitionInputSchema.safeParse({ ...base, defaultMode: 'literal' })
        .success,
    ).toBe(false);
    for (const defaultMode of ['none', 'inherited'] as const)
      for (const defaultValue of [null, 0, 'x'])
        expect(
          FieldDefinitionInputSchema.safeParse({
            ...base,
            defaultMode,
            defaultValue,
          }).success,
        ).toBe(false);
    expect(
      FieldSchemaChangeRequestSchema.safeParse({
        ...base,
        defaultMode: 'literal',
        migrationPlanId: null,
      }).success,
    ).toBe(false);
    expect(
      FieldSchemaChangeRequestSchema.safeParse({
        ...base,
        defaultMode: 'none',
        defaultValue: null,
        migrationPlanId: null,
      }).success,
    ).toBe(false);
  });
});
