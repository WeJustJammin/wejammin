import { describe, expect, it } from 'vitest';

import {
  BlockDefinitionRegistryRecordSchema,
  BlockLifecycleAdvanceRequestSchema,
  BlockRegistrationRequestSchema,
  CmsArtifactRefSchema,
  CmsEd25519SignatureSchema,
  CmsInstantSchema,
  CmsReleaseKeyIdSchema,
  CmsStrongEtagSchema,
  ContentSchemaRegistryDetailSchema,
  ContentSchemaRegistryListQuerySchema,
  ContentTypeVersionResourceSchema,
  FieldSchemaChangeRequestSchema,
  OpaqueRelationPlaceholderSchema,
  RelationBindingRequestSchema,
  ReleaseEnvelopeHeadersSchema,
  SchemaActivationRequestSchema,
} from './index';

const uuid = '123e4567-e89b-42d3-a456-426614174000';
const uuid2 = '123e4567-e89b-42d3-a456-426614174001';
const hash = 'a'.repeat(64);

const fieldChange = {
  stableFieldId: uuid,
  key: 'display_name',
  kind: 'short_text',
  constraints: { minLength: 2, maxLength: 120 },
  required: true,
  validatorKey: null,
  validatorVersion: null,
  defaultMode: 'none',
  localizationMode: 'localized',
  editorConfig: { label: 'Display name', order: 10 },
  lifecycle: 'active',
  migrationPlanId: null,
} as const;

describe('content schema registry contracts', () => {
  it('hardens artifact references and opaque unavailable relations', () => {
    expect(CmsArtifactRefSchema.parse('schemas/content/type-v1.json')).toBe(
      'schemas/content/type-v1.json',
    );
    expect(CmsArtifactRefSchema.safeParse('schemas/../secret').success).toBe(
      false,
    );
    expect(CmsArtifactRefSchema.safeParse('schemas//secret').success).toBe(
      false,
    );
    expect(
      OpaqueRelationPlaceholderSchema.parse({
        status: 'unavailable',
        reason: 'unavailable',
      }),
    ).toEqual({ status: 'unavailable', reason: 'unavailable' });
    expect(
      OpaqueRelationPlaceholderSchema.safeParse({
        status: 'unavailable',
        reason: 'unavailable',
        targetId: uuid,
      }).success,
    ).toBe(false);
  });

  it('accepts offset datetimes and bounds strong ETags to PostgreSQL bigint', () => {
    expect(CmsInstantSchema.parse('2026-09-02T17:00:00Z')).toBe(
      '2026-09-02T17:00:00Z',
    );
    expect(CmsInstantSchema.parse('2026-09-02T17:00:00.123456+05:30')).toBe(
      '2026-09-02T17:00:00.123456+05:30',
    );
    expect(CmsStrongEtagSchema.parse('"9223372036854775807"')).toBe(
      '"9223372036854775807"',
    );
    expect(CmsStrongEtagSchema.safeParse('"9223372036854775808"').success).toBe(
      false,
    );
    expect(CmsStrongEtagSchema.safeParse('W/"1"').success).toBe(false);
  });

  it('requires finite relation bounds and enforces one-cardinality', () => {
    const base = {
      fieldId: uuid,
      targetKind: 'content',
      targetType: 'article',
      projectionKey: 'cms.article.card',
      cardinality: 'one',
      min: 0,
      max: 1,
      ordered: false,
      onUnavailable: 'placeholder',
    } as const;
    expect(RelationBindingRequestSchema.parse(base)).toEqual(base);
    expect(
      RelationBindingRequestSchema.safeParse({ ...base, max: 2 }).success,
    ).toBe(false);
    expect(
      RelationBindingRequestSchema.safeParse({
        ...base,
        cardinality: 'many',
        min: 3,
        max: 2,
      }).success,
    ).toBe(false);
    expect(
      RelationBindingRequestSchema.safeParse({ ...base, max: Infinity })
        .success,
    ).toBe(false);
  });

  it('keeps migrationPlanId required and nullable on field changes', () => {
    expect(FieldSchemaChangeRequestSchema.parse(fieldChange)).toEqual(
      fieldChange,
    );
    const withoutMigrationPlan = Object.fromEntries(
      Object.entries(fieldChange).filter(([key]) => key !== 'migrationPlanId'),
    );
    expect(
      FieldSchemaChangeRequestSchema.safeParse(withoutMigrationPlan).success,
    ).toBe(false);
    expect(
      FieldSchemaChangeRequestSchema.safeParse({
        ...fieldChange,
        migrationPlanId: uuid2,
        surprise: true,
      }).success,
    ).toBe(false);
  });

  it('allows a draft registry version before a dry run exists', () => {
    expect(
      ContentTypeVersionResourceSchema.parse({
        resourceKind: 'content_type_version',
        id: uuid,
        version: '1',
        contentHash: hash,
        createdAt: '2026-09-02T17:00:00.000Z',
        updatedAt: '2026-09-02T17:00:00.000Z',
        state: 'draft',
        contentTypeId: uuid2,
        typeKey: 'release_notes',
        label: 'Release notes',
        ownerCapability: 'cms.schema_designer',
        sourceLocale: 'en-US',
        defaultLocale: 'en-US',
        supportedLocales: ['en-US'],
        fallbackChains: {},
        localeConfigHash: hash,
        workflowKey: 'cms.standard',
        workflowVersion: '1',
        defaultTemplateVersionId: null,
        schemaArtifactId: uuid,
        fieldCount: 0,
        relationCount: 0,
        capabilityBindingCount: 0,
        compatibility: 'unknown',
        dryRunId: null,
        activationEvidence: null,
      }).dryRunId,
    ).toBeNull();
  });

  it('locks activation evidence expectations and distinct approvals', () => {
    const activation = {
      expectedVersion: '7',
      dryRunId: uuid,
      approvalIds: [uuid, uuid2],
      migrationPlanId: null,
      expectedActivationEvidenceHash: hash,
    } as const;
    expect(SchemaActivationRequestSchema.parse(activation)).toEqual(activation);
    expect(
      SchemaActivationRequestSchema.safeParse({
        ...activation,
        approvalIds: [uuid, uuid],
      }).success,
    ).toBe(false);
    expect(
      SchemaActivationRequestSchema.safeParse({
        ...activation,
        migrationPlanId: undefined,
      }).success,
    ).toBe(false);
  });

  it('validates signed release registration and lifecycle transitions', () => {
    const block = {
      blockKey: 'cms.hero',
      blockVersion: 3,
      propsSchemaRef: 'schemas/blocks/hero-v3.json',
      propsSchemaHash: hash,
      propsSchemaSnapshot: {
        schemaVersion: '1',
        fields: [
          {
            name: 'headline',
            kind: 'short_text',
            required: true,
          },
        ],
        additionalProperties: false,
      },
      propsSnapshotHash: hash,
      propsSnapshotAttestation: {
        algorithm: 'Ed25519',
        keyId: 'release-key-v1',
        signature: `${'A'.repeat(86)}==`,
      },
      rendererRef: 'renderers/cms.hero.v3',
      allowedChildren: [],
      slotRules: { maxDepth: 4, maxNodes: 64 },
      dataSourcePermissions: ['cms.public_content.read'],
      accessibility: {
        nameRequired: true,
        keyboard: true,
        focusOrder: 'document',
        statusAnnouncement: false,
      },
      compatibility: { minSchemaCompiler: '1.0', maxSchemaCompiler: '1.9' },
      lifecycle: 'supported',
      releaseDigest: hash,
    } as const;
    expect(BlockRegistrationRequestSchema.parse(block)).toEqual(block);
    expect(
      BlockRegistrationRequestSchema.safeParse({
        ...block,
        lifecycle: 'deprecated',
      }).success,
    ).toBe(false);
    expect(
      BlockLifecycleAdvanceRequestSchema.parse({
        fromLifecycle: 'supported',
        toLifecycle: 'deprecated',
        expectedVersion: '1',
        releaseDigest: hash,
      }).toLifecycle,
    ).toBe('deprecated');
    expect(
      BlockLifecycleAdvanceRequestSchema.safeParse({
        fromLifecycle: 'supported',
        toLifecycle: 'withdrawn',
        expectedVersion: '1',
        releaseDigest: hash,
      }).success,
    ).toBe(false);
  });

  it('validates the exact release envelope and list filter compatibility', () => {
    const canonicalSignature = `${'A'.repeat(86)}==`;
    const nonCanonicalSignature = `${'A'.repeat(85)}B==`;
    expect(
      CmsEd25519SignatureSchema.safeParse(canonicalSignature).success,
    ).toBe(true);
    expect(
      CmsEd25519SignatureSchema.safeParse(nonCanonicalSignature).success,
    ).toBe(false);
    expect(
      ReleaseEnvelopeHeadersSchema.parse({
        keyId: 'release-key-v1',
        issuedAt: '2026-09-02T17:00:00.000Z',
        nonce: uuid2,
        signature: canonicalSignature,
      }),
    ).toBeDefined();
    expect(
      ReleaseEnvelopeHeadersSchema.safeParse({
        keyId: 'release-key-v1',
        issuedAt: '2026-09-02T17:00:00.000Z',
        nonce: uuid2,
        signature: nonCanonicalSignature,
      }).success,
    ).toBe(false);
    expect(
      ContentSchemaRegistryListQuerySchema.safeParse({
        resourceKind: 'content_type_version',
        lifecycle: 'active',
      }).success,
    ).toBe(false);
    expect(
      ContentSchemaRegistryListQuerySchema.parse({
        resourceKind: 'block_definition_registry_record',
        lifecycle: 'withdrawn',
      }),
    ).toMatchObject({ limit: 25, sort: 'key', direction: 'asc' });
  });

  it('uses the database release-key grammar at the Worker boundary', () => {
    expect(CmsReleaseKeyIdSchema.safeParse('release-key-v1').success).toBe(
      true,
    );
    expect(CmsReleaseKeyIdSchema.safeParse(`a${'b'.repeat(95)}`).success).toBe(
      true,
    );
    for (const value of [
      'Release-key-v1',
      'release-key:v1',
      `a${'b'.repeat(96)}`,
      'a',
    ])
      expect(CmsReleaseKeyIdSchema.safeParse(value).success).toBe(false);
  });

  it('keeps browser block projections safe and detail aggregates strict', () => {
    const safeBlock = {
      resourceKind: 'block_definition_registry_record',
      id: uuid,
      version: '1',
      blockKey: 'cms.hero',
      blockVersion: 3,
      propsSchemaRef: 'schemas/blocks/hero-v3.json',
      propsSchemaHash: hash,
      rendererRef: 'renderers/cms.hero.v3',
      releaseDigest: hash,
      lifecycle: 'supported',
    } as const;
    expect(BlockDefinitionRegistryRecordSchema.parse(safeBlock)).toEqual(
      safeBlock,
    );
    expect(
      BlockDefinitionRegistryRecordSchema.safeParse({
        ...safeBlock,
        ownerId: uuid2,
        releaseNonceHash: hash,
      }).success,
    ).toBe(false);
    expect(ContentSchemaRegistryDetailSchema.safeParse({}).success).toBe(false);
  });
});
