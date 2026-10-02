import { describe, expect, it } from 'vitest';

import {
  BlockLifecycleEventResourceSchema,
  ContentTypeVersionResourceSchema,
  FieldDefinitionVersionResourceSchema,
  RelationDefinitionResourceSchema,
} from './resources.ts';

const uuid = '123e4567-e89b-42d3-a456-426614174000';
const uuid2 = '123e4567-e89b-42d3-a456-426614174001';
const hash = 'a'.repeat(64);
const instant = '2026-09-02T17:00:00.000Z';

const evidence = {
  key: 'cms.activation',
  version: '1',
  policyHash: hash,
  riskClass: 'ordinary' as const,
  requiredDecisionCount: 1,
  requiredCapabilities: [],
  approvalEvidenceHash: hash,
};

describe('content schema registry resource defensive refinements', () => {
  it('requires activation evidence for terminal version states', () => {
    const base = {
      resourceKind: 'content_type_version' as const,
      id: uuid,
      version: '1',
      contentHash: hash,
      createdAt: instant,
      updatedAt: instant,
      state: 'active' as const,
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
      compatibility: 'additive' as const,
      dryRunId: null,
      activationEvidence: null,
    };
    expect(ContentTypeVersionResourceSchema.safeParse(base).success).toBe(
      false,
    );
    expect(
      ContentTypeVersionResourceSchema.parse({
        ...base,
        activationEvidence: evidence,
      }).activationEvidence,
    ).toEqual(evidence);
  });

  it('requires validator key and version as a pair', () => {
    const base = {
      resourceKind: 'field_definition_version' as const,
      id: uuid,
      version: '1',
      contentHash: hash,
      createdAt: instant,
      updatedAt: instant,
      contentTypeVersionId: uuid2,
      stableFieldId: uuid,
      key: 'display_name',
      kind: 'short_text' as const,
      required: true,
      validatorKey: 'cms.slug',
      validatorVersion: null,
      defaultMode: 'none' as const,
      localizationMode: 'none' as const,
      lifecycle: 'active' as const,
      migrationPlanId: null,
    };
    expect(FieldDefinitionVersionResourceSchema.safeParse(base).success).toBe(
      false,
    );
    expect(
      FieldDefinitionVersionResourceSchema.safeParse({
        ...base,
        validatorKey: null,
        validatorVersion: '1',
      }).success,
    ).toBe(false);
  });

  it('enforces relation bounds and one-cardinality', () => {
    const base = {
      resourceKind: 'relation_definition' as const,
      id: uuid,
      version: '1',
      contentHash: hash,
      createdAt: instant,
      updatedAt: instant,
      state: 'active' as const,
      contentTypeVersionId: uuid2,
      fieldId: uuid,
      targetKind: 'content' as const,
      targetType: 'article',
      projectionKey: 'cms.article.card',
      cardinality: 'one' as const,
      min: 0,
      max: 1,
      ordered: false,
      onUnavailable: 'omit' as const,
    };
    expect(
      RelationDefinitionResourceSchema.safeParse({ ...base, min: 2, max: 1 })
        .success,
    ).toBe(false);
    expect(
      RelationDefinitionResourceSchema.safeParse({ ...base, max: 2 }).success,
    ).toBe(false);
    expect(
      RelationDefinitionResourceSchema.safeParse({ ...base, min: 2 }).success,
    ).toBe(false);
  });

  it('rejects lifecycle event state mismatches', () => {
    const event = {
      resourceKind: 'block_definition_lifecycle_event' as const,
      id: uuid,
      version: '1',
      blockDefinitionVersionId: uuid2,
      blockKey: 'cms.hero',
      blockVersion: 1,
      fromLifecycle: 'supported' as const,
      toLifecycle: 'deprecated' as const,
      lifecycle: 'withdrawn' as const,
      releaseDigest: hash,
      releaseKeyId: 'release-key-v1',
      releaseNonceHash: hash,
      releaseVerifiedAt: instant,
      eventType: 'cms.block.lifecycle.changed.v1' as const,
      createdAt: instant,
    };
    expect(BlockLifecycleEventResourceSchema.safeParse(event).success).toBe(
      false,
    );
    expect(
      BlockLifecycleEventResourceSchema.parse({
        ...event,
        lifecycle: 'deprecated',
      }).lifecycle,
    ).toBe('deprecated');
  });
});
