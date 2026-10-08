import { describe, expect, it } from 'vitest';

import {
  CMS_EDITORIAL_ENTRY_DRAFT_DETAIL_ROUTE,
  CMS_EDITORIAL_ENTRY_DRAFT_DETAIL_SCHEMA_VALIDATION_SEAMS,
  CmsEditorialEntryDraftDetailPathParamsSchema,
  CmsEditorialEntryDraftDetailQuerySchema,
  CmsEditorialEntryDraftDetailResourceSchema,
  CmsEditorialEntryDraftDetailSchemaValidationSchema,
  CmsEditorialEntryDraftFieldValueSchema,
  CmsEditorialEntryDraftRelationSchema,
  resolveCmsEditorialEntryDraftDetailPageState,
} from './cms-editorial-entry-draft-detail';

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
  unavailable: null,
} as const;

// AC081/AC203: the opaque fallback copies nothing of an unavailable target.
const placeholderRelation = {
  fieldId: uuid,
  fieldDefinitionId: uuid2,
  position: 0,
  onUnavailable: 'placeholder',
  unavailable: { status: 'unavailable', reason: 'unavailable' },
} as const;

const validDetailResource = {
  entry: { id: uuid, version: '1', createdAt: instant, updatedAt: instant },
  revision: { id: uuid2, version: '1', createdAt: instant, updatedAt: instant },
  revisionNumber: '1',
  lifecycle: 'active',
  state: 'draft',
  locale: 'en-US',
  contentHash: hash,
  schemaVersionId: uuid2,
  validationState: 'valid',
  openConflict: null,
  fields: [validFieldValue],
  relations: [validRelation],
} as const;

const registryEvidence = {
  contentTypeVersionId: uuid2,
  schemaVersionId: uuid2,
  artifactHash: hash,
  fieldDefinitionIds: [uuid2],
  recomputedContentHash: hash,
} as const;

describe('cms-editorial draft detail addressing (CMS-03B-11)', () => {
  it('binds exactly one UUID path parameter', () => {
    expect(
      CmsEditorialEntryDraftDetailPathParamsSchema.safeParse({ entryId: uuid })
        .success,
    ).toBe(true);
    expect(
      CmsEditorialEntryDraftDetailPathParamsSchema.safeParse({
        entryId: 'nope',
      }).success,
    ).toBe(false);
    expect(
      CmsEditorialEntryDraftDetailPathParamsSchema.safeParse({}).success,
    ).toBe(false);
    expect(
      CmsEditorialEntryDraftDetailPathParamsSchema.safeParse({
        entryId: uuid,
        extra: 1,
      }).success,
    ).toBe(false);
  });

  it('accepts an optional locale selection and rejects anything else', () => {
    expect(
      CmsEditorialEntryDraftDetailQuerySchema.safeParse({ entryId: uuid })
        .success,
    ).toBe(true);
    expect(
      CmsEditorialEntryDraftDetailQuerySchema.safeParse({
        entryId: uuid,
        locale: 'en-US',
      }).success,
    ).toBe(true);
    expect(
      CmsEditorialEntryDraftDetailQuerySchema.safeParse({
        entryId: uuid,
        locale: 'e',
      }).success,
    ).toBe(false);
    expect(CmsEditorialEntryDraftDetailQuerySchema.safeParse({}).success).toBe(
      false,
    );
    expect(
      CmsEditorialEntryDraftDetailQuerySchema.safeParse({
        entryId: uuid,
        limit: 25,
      }).success,
    ).toBe(false);
  });
});

describe('cms-editorial draft detail field values', () => {
  it('locks the closed provenance vocabulary', () => {
    expect(
      CmsEditorialEntryDraftFieldValueSchema.safeParse(validFieldValue).success,
    ).toBe(true);
    expect(validFieldValue.provenance).toBe('authored');
    expect(
      CmsEditorialEntryDraftFieldValueSchema.safeParse({
        ...validFieldValue,
        provenance: 'guessed',
      }).success,
    ).toBe(false);
    expect(
      CmsEditorialEntryDraftFieldValueSchema.safeParse({
        ...validFieldValue,
        provenance: 'explicit_null',
        value: null,
      }).success,
    ).toBe(true);
  });

  it('carries bounded JSON plus a nullable safe hash and nothing more', () => {
    expect(
      CmsEditorialEntryDraftFieldValueSchema.safeParse({
        ...validFieldValue,
        value: null,
        valueHash: null,
      }).success,
    ).toBe(true);
    expect(
      CmsEditorialEntryDraftFieldValueSchema.safeParse({
        ...validFieldValue,
        valueHash: 'short',
      }).success,
    ).toBe(false);
    expect(
      CmsEditorialEntryDraftFieldValueSchema.safeParse({
        ...validFieldValue,
        extra: 1,
      }).success,
    ).toBe(false);
    const withoutValue = Object.fromEntries(
      Object.entries(validFieldValue).filter(([key]) => key !== 'value'),
    );
    expect(
      CmsEditorialEntryDraftFieldValueSchema.safeParse(withoutValue).success,
    ).toBe(false);
    expect(
      CmsEditorialEntryDraftFieldValueSchema.safeParse({
        ...validFieldValue,
        value: 'x'.repeat(262_145),
      }).success,
    ).toBe(false);
  });
});

describe('cms-editorial draft detail relations', () => {
  it('binds target kind, position, and the unavailable policy', () => {
    expect(
      CmsEditorialEntryDraftRelationSchema.safeParse(validRelation).success,
    ).toBe(true);
    expect(
      CmsEditorialEntryDraftRelationSchema.safeParse({
        ...validRelation,
        unavailable: null,
        expectedTargetVersion: null,
      }).success,
    ).toBe(true);
    expect(
      CmsEditorialEntryDraftRelationSchema.safeParse({
        ...validRelation,
        position: 511,
      }).success,
    ).toBe(true);
    expect(
      CmsEditorialEntryDraftRelationSchema.safeParse({
        ...validRelation,
        position: 512,
      }).success,
    ).toBe(false);
    expect(
      CmsEditorialEntryDraftRelationSchema.safeParse({
        ...validRelation,
        position: -1,
      }).success,
    ).toBe(false);
    expect(
      CmsEditorialEntryDraftRelationSchema.safeParse({
        ...validRelation,
        onUnavailable: 'ignore',
      }).success,
    ).toBe(false);
    expect(
      CmsEditorialEntryDraftRelationSchema.safeParse({
        ...validRelation,
        targetKind: 'Block',
      }).success,
    ).toBe(false);
    expect(
      CmsEditorialEntryDraftRelationSchema.safeParse({
        ...validRelation,
        expectedTargetVersion: '0',
      }).success,
    ).toBe(false);
  });

  it('[P2-S09-AC-081] [P2-S09-AC-203] accepts the exact opaque placeholder with no target member', () => {
    expect(
      CmsEditorialEntryDraftRelationSchema.parse(placeholderRelation),
    ).toEqual(placeholderRelation);
    for (const member of [
      { targetId: uuid },
      { targetKind: 'block.hero' },
      { expectedTargetVersion: '4' },
      { title: 'Hidden' },
    ])
      expect(
        CmsEditorialEntryDraftRelationSchema.safeParse({
          ...placeholderRelation,
          ...member,
        }).success,
      ).toBe(false);
  });

  it('[P2-S09-AC-081] requires the exact unavailable marker', () => {
    for (const unavailable of [
      { status: 'unavailable' },
      { status: 'unavailable', reason: 'other' },
      { status: 'unavailable', reason: 'unavailable', id: uuid },
    ])
      expect(
        CmsEditorialEntryDraftRelationSchema.safeParse({
          ...placeholderRelation,
          unavailable,
        }).success,
      ).toBe(false);
    expect(
      CmsEditorialEntryDraftRelationSchema.safeParse({
        ...validRelation,
        unavailable: { status: 'unavailable', reason: 'unavailable' },
      }).success,
    ).toBe(false);
  });
});

describe('cms-editorial draft detail resource', () => {
  it('exposes the closed envelope with 128-field and 512-relation bounds', () => {
    expect(
      CmsEditorialEntryDraftDetailResourceSchema.safeParse(validDetailResource)
        .success,
    ).toBe(true);
    expect(
      Object.keys(
        CmsEditorialEntryDraftDetailResourceSchema.parse(validDetailResource),
      ).sort(),
    ).toEqual([
      'contentHash',
      'entry',
      'fields',
      'lifecycle',
      'locale',
      'openConflict',
      'relations',
      'revision',
      'revisionNumber',
      'schemaVersionId',
      'state',
      'validationState',
    ]);
    expect(
      CmsEditorialEntryDraftDetailResourceSchema.safeParse({
        ...validDetailResource,
        fields: Array.from({ length: 129 }, () => validFieldValue),
      }).success,
    ).toBe(false);
    expect(
      CmsEditorialEntryDraftDetailResourceSchema.safeParse({
        ...validDetailResource,
        relations: Array.from({ length: 513 }, () => validRelation),
      }).success,
    ).toBe(false);
    expect(
      CmsEditorialEntryDraftDetailResourceSchema.safeParse({
        ...validDetailResource,
        state: 'archived',
      }).success,
    ).toBe(false);
    expect(
      CmsEditorialEntryDraftDetailResourceSchema.safeParse({
        ...validDetailResource,
        unexpected: 1,
      }).success,
    ).toBe(false);
  });
});

describe('cms-editorial draft detail runtime schema-validation seam', () => {
  it('names every check that static Zod cannot prove', () => {
    expect([
      ...CMS_EDITORIAL_ENTRY_DRAFT_DETAIL_SCHEMA_VALIDATION_SEAMS,
    ]).toEqual([
      'active_schema_field_definition_resolution',
      'active_schema_field_value_validation',
      'locale_field_set_membership',
      'relation_on_unavailable_policy_application',
      'relation_target_active_schema_resolution',
      'relation_target_visibility_and_capability',
      'relation_expected_target_version_comparison',
      'content_hash_recomputation_over_returned_fields',
    ]);
    expect(
      CMS_EDITORIAL_ENTRY_DRAFT_DETAIL_SCHEMA_VALIDATION_SEAMS.length,
    ).toBe(8);
  });

  it('fails closed unless the registry hash matches the returned resource', () => {
    const seams = [...CMS_EDITORIAL_ENTRY_DRAFT_DETAIL_SCHEMA_VALIDATION_SEAMS];
    const complete = {
      resource: validDetailResource,
      registry: registryEvidence,
      seams,
    };
    expect(
      CmsEditorialEntryDraftDetailSchemaValidationSchema.safeParse(complete)
        .success,
    ).toBe(true);
    // Each row must fail. A bare checklist proves nothing, and evidence whose
    // recomputed hash disagrees with the resource must not be trusted even
    // when every seam name is present.
    const rejected = [
      { resource: validDetailResource, seams },
      {
        ...complete,
        registry: {
          ...registryEvidence,
          recomputedContentHash: 'b'.repeat(64),
        },
      },
      { ...complete, seams: seams.slice(0, -1) },
      { ...complete, seams: [...seams, 'made_up_seam'] },
      { ...complete, seams: [] },
    ];
    expect(
      rejected.map(
        (payload) =>
          CmsEditorialEntryDraftDetailSchemaValidationSchema.safeParse(payload)
            .success,
      ),
    ).toEqual([false, false, false, false, false]);
  });
});

describe('cms-editorial draft detail route and addressing', () => {
  it('describes the read-only CMS-03B-11 route with no mutation preconditions', () => {
    expect(CMS_EDITORIAL_ENTRY_DRAFT_DETAIL_ROUTE.operationId).toBe(
      'CMS-03B-11',
    );
    expect(CMS_EDITORIAL_ENTRY_DRAFT_DETAIL_ROUTE.ifMatchRequired).toBe(false);
    expect(CMS_EDITORIAL_ENTRY_DRAFT_DETAIL_ROUTE.idempotencyRequired).toBe(
      false,
    );
  });

  it('reports a non-UUID entry id as not-found without fabricating a draft', () => {
    expect(
      resolveCmsEditorialEntryDraftDetailPageState({ entryId: 'nope' }).kind,
    ).toBe('not-found');
  });

  it('hands a well-formed entry id to the protected read instead of pre-deciding', () => {
    const resolution = resolveCmsEditorialEntryDraftDetailPageState({
      entryId: uuid,
    });
    expect(resolution.kind).toBe('loadable');
  });
});
