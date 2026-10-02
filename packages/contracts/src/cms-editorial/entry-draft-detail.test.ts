import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  ENTRY_DRAFT_DETAIL_SCHEMA_VALIDATION_SEAMS,
  EntryDraftDetailPathParamsSchema,
  EntryDraftDetailQuerySchema,
  EntryDraftDetailResourceSchema,
  EntryDraftDetailEtagSchema,
  entryDraftDetailEtagMatchesResource,
  EntryDraftDetailSchemaValidationSchema,
  EntryDraftFieldValueSchema,
  EntryDraftRelationSchema,
} from './index';

const uuid = '123e4567-e89b-42d3-a456-426614174000';
const uuid2 = '123e4567-e89b-42d3-a456-426614174001';
const hash = 'a'.repeat(64);
const instant = '2026-09-26T00:00:00Z';

const validFieldValue = {
  fieldId: uuid,
  fieldDefinitionId: uuid2,
  locale: 'en-US',
  value: { title: 'Hello' },
  provenance: 'authored',
  valueHash: hash,
} as const;

const validRelation = {
  fieldId: uuid,
  fieldDefinitionId: uuid2,
  targetKind: 'block.hero',
  targetId: uuid,
  expectedTargetVersion: '4',
  position: 0,
  onUnavailable: 'omit',
  unavailable: { status: 'unavailable', reason: 'unavailable' },
} as const;

const validDetailResource = {
  entry: { id: uuid, version: '1', createdAt: instant, updatedAt: instant },
  revision: { id: uuid2, version: '1', createdAt: instant, updatedAt: instant },
  lifecycle: 'active',
  state: 'draft',
  locale: 'en-US',
  contentHash: hash,
  validationState: 'valid',
  fields: [validFieldValue],
  relations: [validRelation],
} as const;
const validDetailEtag = `"${uuid}:1:${uuid2}:1:${hash}"`;

// The active-schema facts a trusted server-side read resolves; callers have none.
const registryEvidence = {
  contentTypeVersionId: uuid2,
  schemaVersionId: uuid2,
  artifactHash: hash,
  fieldDefinitionIds: [uuid2],
  recomputedContentHash: hash,
} as const;

describe('cms draft detail addressing (CMS-03B-11)', () => {
  it('binds the strong read validator to both resource identities and versions', () => {
    expect(EntryDraftDetailEtagSchema.safeParse(validDetailEtag).success).toBe(
      true,
    );
    expect(
      entryDraftDetailEtagMatchesResource(validDetailEtag, validDetailResource),
    ).toBe(true);
    for (const etag of [
      '"7"',
      `"${uuid}:2:${uuid2}:1:${hash}"`,
      `"${uuid}:1:${uuid2}:2:${hash}"`,
      `"${uuid2}:1:${uuid2}:1:${hash}"`,
      `"${uuid}:1:${uuid}:1:${hash}"`,
      `"${uuid}:1:${uuid2}:1:short"`,
      `W/${validDetailEtag}`,
    ]) {
      expect(
        entryDraftDetailEtagMatchesResource(etag, validDetailResource),
      ).toBe(false);
    }
  });

  it('binds exactly one UUID path parameter', () => {
    expect(
      EntryDraftDetailPathParamsSchema.safeParse({ entryId: uuid }).success,
    ).toBe(true);
    expect(
      EntryDraftDetailPathParamsSchema.safeParse({ entryId: 'nope' }).success,
    ).toBe(false);
    expect(EntryDraftDetailPathParamsSchema.safeParse({}).success).toBe(false);
    expect(
      EntryDraftDetailPathParamsSchema.safeParse({ entryId: uuid, extra: 1 })
        .success,
    ).toBe(false);
  });

  it('accepts an optional locale selection and rejects anything else', () => {
    expect(
      EntryDraftDetailQuerySchema.safeParse({ entryId: uuid }).success,
    ).toBe(true);
    expect(
      EntryDraftDetailQuerySchema.safeParse({ entryId: uuid, locale: 'en-US' })
        .success,
    ).toBe(true);
    expect(
      EntryDraftDetailQuerySchema.safeParse({ entryId: uuid, locale: 'e' })
        .success,
    ).toBe(false);
    expect(EntryDraftDetailQuerySchema.safeParse({}).success).toBe(false);
    expect(
      EntryDraftDetailQuerySchema.safeParse({ entryId: uuid, limit: 25 })
        .success,
    ).toBe(false);
  });
});

describe('cms draft detail field values', () => {
  it('locks the closed provenance vocabulary', () => {
    expect(EntryDraftFieldValueSchema.safeParse(validFieldValue).success).toBe(
      true,
    );
    expect(validFieldValue.provenance).toBe('authored');
    expect(
      EntryDraftFieldValueSchema.safeParse({
        ...validFieldValue,
        provenance: 'guessed',
      }).success,
    ).toBe(false);
    expect(
      EntryDraftFieldValueSchema.safeParse({
        ...validFieldValue,
        provenance: 'explicit_null',
        value: null,
      }).success,
    ).toBe(true);
  });

  it('carries bounded JSON plus a nullable safe hash and nothing more', () => {
    expect(
      EntryDraftFieldValueSchema.safeParse({
        ...validFieldValue,
        value: null,
        valueHash: null,
      }).success,
    ).toBe(true);
    expect(
      EntryDraftFieldValueSchema.safeParse({
        ...validFieldValue,
        valueHash: 'short',
      }).success,
    ).toBe(false);
    expect(
      EntryDraftFieldValueSchema.safeParse({ ...validFieldValue, extra: 1 })
        .success,
    ).toBe(false);
    const { value: _value, ...withoutValue } = validFieldValue;
    void _value;
    expect(EntryDraftFieldValueSchema.safeParse(withoutValue).success).toBe(
      false,
    );
    expect(
      EntryDraftFieldValueSchema.safeParse({
        ...validFieldValue,
        value: 'x'.repeat(262_145),
      }).success,
    ).toBe(false);
  });
});

describe('cms draft detail relations', () => {
  it('binds target kind, position, and the unavailable policy', () => {
    expect(EntryDraftRelationSchema.safeParse(validRelation).success).toBe(
      true,
    );
    expect(
      EntryDraftRelationSchema.safeParse({
        ...validRelation,
        unavailable: null,
        expectedTargetVersion: null,
      }).success,
    ).toBe(true);
    expect(
      EntryDraftRelationSchema.safeParse({ ...validRelation, position: 511 })
        .success,
    ).toBe(true);
    expect(
      EntryDraftRelationSchema.safeParse({ ...validRelation, position: 512 })
        .success,
    ).toBe(false);
    expect(
      EntryDraftRelationSchema.safeParse({ ...validRelation, position: -1 })
        .success,
    ).toBe(false);
    expect(
      EntryDraftRelationSchema.safeParse({
        ...validRelation,
        onUnavailable: 'ignore',
      }).success,
    ).toBe(false);
    expect(
      EntryDraftRelationSchema.safeParse({
        ...validRelation,
        targetKind: 'Block',
      }).success,
    ).toBe(false);
    expect(
      EntryDraftRelationSchema.safeParse({
        ...validRelation,
        expectedTargetVersion: '0',
      }).success,
    ).toBe(false);
  });

  it('requires the exact unavailable marker when a target is missing', () => {
    expect(
      EntryDraftRelationSchema.safeParse({
        ...validRelation,
        unavailable: { status: 'unavailable' },
      }).success,
    ).toBe(false);
    expect(
      EntryDraftRelationSchema.safeParse({
        ...validRelation,
        unavailable: { status: 'unavailable', reason: 'other' },
      }).success,
    ).toBe(false);
  });
});

describe('cms draft detail resource', () => {
  it('exposes the closed envelope with 128-field and 512-relation bounds', () => {
    expect(
      EntryDraftDetailResourceSchema.safeParse(validDetailResource).success,
    ).toBe(true);
    expect(
      Object.keys(
        EntryDraftDetailResourceSchema.parse(validDetailResource),
      ).sort(),
    ).toEqual([
      'contentHash',
      'entry',
      'fields',
      'lifecycle',
      'locale',
      'relations',
      'revision',
      'state',
      'validationState',
    ]);
    expect(
      EntryDraftDetailResourceSchema.safeParse({
        ...validDetailResource,
        fields: Array.from({ length: 129 }, () => validFieldValue),
      }).success,
    ).toBe(false);
    expect(
      EntryDraftDetailResourceSchema.safeParse({
        ...validDetailResource,
        relations: Array.from({ length: 513 }, () => validRelation),
      }).success,
    ).toBe(false);
    expect(
      EntryDraftDetailResourceSchema.safeParse({
        ...validDetailResource,
        state: 'archived',
      }).success,
    ).toBe(false);
    expect(
      EntryDraftDetailResourceSchema.safeParse({
        ...validDetailResource,
        unexpected: 1,
      }).success,
    ).toBe(false);
  });
});

describe('cms draft detail runtime schema-validation seam', () => {
  it('names every check that static Zod cannot prove', () => {
    expect([...ENTRY_DRAFT_DETAIL_SCHEMA_VALIDATION_SEAMS]).toEqual([
      'active_schema_field_definition_resolution',
      'active_schema_field_value_validation',
      'locale_field_set_membership',
      'relation_on_unavailable_policy_application',
      'relation_target_active_schema_resolution',
      'relation_target_visibility_and_capability',
      'relation_expected_target_version_comparison',
      'content_hash_recomputation_over_returned_fields',
    ]);
    expect(ENTRY_DRAFT_DETAIL_SCHEMA_VALIDATION_SEAMS.length).toBe(8);
  });

  it('accepts draft-detail attestation only from hash-bound registry evidence', () => {
    const complete = {
      resource: validDetailResource,
      registry: registryEvidence,
      seams: [...ENTRY_DRAFT_DETAIL_SCHEMA_VALIDATION_SEAMS],
    };
    expect(
      EntryDraftDetailSchemaValidationSchema.safeParse(complete).success,
    ).toBe(true);
    expect(
      EntryDraftDetailSchemaValidationSchema.safeParse({
        ...complete,
        seams: ENTRY_DRAFT_DETAIL_SCHEMA_VALIDATION_SEAMS.slice(0, -1),
      }).success,
    ).toBe(false);
    expect(
      EntryDraftDetailSchemaValidationSchema.safeParse({
        ...complete,
        seams: [...ENTRY_DRAFT_DETAIL_SCHEMA_VALIDATION_SEAMS, 'made_up_seam'],
      }).success,
    ).toBe(false);
  });

  it('never treats a caller-supplied seam-name list as validation authority', () => {
    // The pre-hardening contract accepted exactly this shape from any caller.
    expect(
      EntryDraftDetailSchemaValidationSchema.safeParse({
        resource: validDetailResource,
        seams: [...ENTRY_DRAFT_DETAIL_SCHEMA_VALIDATION_SEAMS],
      }).success,
    ).toBe(false);
    // A recomputed hash that disagrees with the returned resource is rejected.
    expect(
      EntryDraftDetailSchemaValidationSchema.safeParse({
        resource: validDetailResource,
        registry: {
          ...registryEvidence,
          recomputedContentHash: 'b'.repeat(64),
        },
        seams: [...ENTRY_DRAFT_DETAIL_SCHEMA_VALIDATION_SEAMS],
      }).success,
    ).toBe(false);
    // An empty registry proves nothing and is rejected.
    expect(
      EntryDraftDetailSchemaValidationSchema.safeParse({
        resource: validDetailResource,
        registry: {},
        seams: [...ENTRY_DRAFT_DETAIL_SCHEMA_VALIDATION_SEAMS],
      }).success,
    ).toBe(false);
  });

  it('never claims active-schema validation through a permissive unknown schema', () => {
    const directory = dirname(fileURLToPath(import.meta.url));
    const sources = readdirSync(directory)
      .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
      .map((name) => readFileSync(join(directory, name), 'utf8'));
    expect(sources.length).toBeGreaterThan(0);
    expect(
      sources.filter((source) => /\bz\.unknown\b/u.test(source)).length,
    ).toBe(0);
  });
});
