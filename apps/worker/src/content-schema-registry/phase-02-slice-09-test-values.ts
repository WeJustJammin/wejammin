import type {
  ContentSchemaRegistryResult,
  ContentSchemaRegistrySession,
} from './index';

export const API_ORIGIN = 'https://api.example.test';
export const CMS_ORIGIN = 'https://cms-console.example.test';
export const RELEASE_ORIGIN = 'https://release-worker.example.test';
export const USER_ID = '10000000-0000-4000-8000-000000000001';
export const PARTY_ID = '20000000-0000-4000-8000-000000000002';
export const TYPE_ID = '30000000-0000-4000-8000-000000000003';
export const VERSION_ID = '40000000-0000-4000-8000-000000000004';
export const FIELD_ID = '50000000-0000-4000-8000-000000000005';
export const ARTIFACT_ID = '60000000-0000-4000-8000-000000000006';
export const BLOCK_ID = '70000000-0000-4000-8000-000000000007';
export const EVENT_ID = '80000000-0000-4000-8000-000000000008';
export const DRY_RUN_ID = '90000000-0000-4000-8000-000000000009';
export const REQUEST_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const NONCE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
export const HASH = 'a'.repeat(64);
export const SIGNATURE = 'A'.repeat(86) + '==';
export const session: ContentSchemaRegistrySession = {
  userId: USER_ID,
  actingPartyId: PARTY_ID,
  capabilities: [
    'cms.schema_designer',
    'cms.schema_registry.read',
    'release.block_registry.write',
  ],
  mfaFresh: true,
};
export const ok = <T>(value: T): ContentSchemaRegistryResult<T> => ({
  ok: true,
  value,
});
export const error = (
  status: 400 | 401 | 403 | 404 | 409 | 415 | 422 | 429 | 500 | 502 | 503 | 504,
  code: string,
  message = 'The operation could not be completed.',
  details: Record<string, unknown> = {},
  retryAfterSeconds?: number,
): ContentSchemaRegistryResult<never> => ({
  ok: false,
  status,
  code,
  message,
  details,
  ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
});
export const versionMeta = (id: string, version = '1') => ({
  id,
  version,
  contentHash: HASH,
  createdAt: '2026-09-02T12:00:00.000Z',
  updatedAt: '2026-09-02T12:00:00.000Z',
});
export const field = {
  ...versionMeta(FIELD_ID),
  resourceKind: 'field_definition_version' as const,
  contentTypeVersionId: VERSION_ID,
  stableFieldId: FIELD_ID,
  key: 'title',
  kind: 'short_text' as const,
  required: true,
  validatorKey: null,
  validatorVersion: null,
  defaultMode: 'none' as const,
  localizationMode: 'none' as const,
  lifecycle: 'active' as const,
  migrationPlanId: null,
};
export const artifact = {
  resourceKind: 'schema_artifact' as const,
  id: ARTIFACT_ID,
  version: '1',
  state: 'compiled' as const,
  contentTypeVersionId: VERSION_ID,
  compilerVersion: '1.0.0',
  zodContractRef: 'contracts/cms/content-type-v1',
  artifactHash: HASH,
  createdAt: '2026-09-02T12:00:00.000Z',
  updatedAt: '2026-09-02T12:00:00.000Z',
  compiledAt: '2026-09-02T12:00:00.000Z',
};
export const resource = {
  ...versionMeta(VERSION_ID),
  resourceKind: 'content_type_version' as const,
  state: 'draft' as const,
  contentTypeId: TYPE_ID,
  typeKey: 'article',
  label: 'Article',
  ownerCapability: 'cms.content.article',
  sourceLocale: 'en-US',
  defaultLocale: 'en-US',
  supportedLocales: ['en-US'],
  fallbackChains: {},
  localeConfigHash: HASH,
  workflowKey: 'editorial.default',
  workflowVersion: '1',
  defaultTemplateVersionId: null,
  schemaArtifactId: ARTIFACT_ID,
  fieldCount: 1,
  relationCount: 0,
  capabilityBindingCount: 1,
  compatibility: 'additive' as const,
  dryRunId: DRY_RUN_ID,
  activationEvidence: null,
};
export const relation = {
  ...versionMeta('d0000000-0000-4000-8000-000000000010'),
  resourceKind: 'relation_definition' as const,
  state: 'draft' as const,
  contentTypeVersionId: VERSION_ID,
  fieldId: FIELD_ID,
  targetKind: 'content' as const,
  targetType: 'artist',
  projectionKey: 'public.summary',
  cardinality: 'many' as const,
  min: 0,
  max: 8,
  ordered: false,
  onUnavailable: 'placeholder' as const,
};
export const safeBlock = {
  resourceKind: 'block_definition_registry_record' as const,
  id: BLOCK_ID,
  version: '1',
  blockKey: 'hero.banner',
  blockVersion: 1,
  propsSchemaRef: 'schemas/hero-banner.json',
  propsSchemaHash: HASH,
  rendererRef: 'renderer/hero-banner',
  releaseDigest: HASH,
  lifecycle: 'supported' as const,
};
export const block = {
  ...versionMeta(BLOCK_ID),
  resourceKind: 'block_definition_version' as const,
  blockKey: 'hero.banner',
  blockVersion: 1,
  propsSchemaRef: 'schemas/hero-banner.json',
  propsSchemaHash: HASH,
  propsSchemaSnapshot: {
    schemaVersion: '1',
    fields: [],
    additionalProperties: false,
  },
  propsSnapshotHash: HASH,
  propsSnapshotAttestation: {
    algorithm: 'Ed25519' as const,
    keyId: 'release-key-1',
    signature: SIGNATURE,
  },
  rendererRef: 'renderer/hero-banner',
  releaseDigest: HASH,
  releaseKeyId: 'release-key-1',
  releaseRawBodyHash: HASH,
  releaseSignatureHash: HASH,
  releaseNonceHash: HASH,
  releaseVerifiedAt: '2026-09-02T12:00:00.000Z',
  lifecycle: 'supported' as const,
};
export const activation = {
  ...versionMeta(VERSION_ID),
  state: 'active' as const,
  contentTypeVersionId: VERSION_ID,
  activatedAt: '2026-09-02T12:00:00.000Z',
  migrationPlanId: null,
  localeConfigHash: HASH,
  activationEvidence: {
    key: 'editorial.default',
    version: '1',
    policyHash: HASH,
    riskClass: 'ordinary' as const,
    requiredDecisionCount: 1,
    requiredCapabilities: [],
    approvalEvidenceHash: HASH,
  },
  jobId: null,
  eventType: 'cms.schema.activated.v1' as const,
};
export const lifecycleEvent = {
  resourceKind: 'block_definition_lifecycle_event' as const,
  id: EVENT_ID,
  version: '1',
  blockDefinitionVersionId: BLOCK_ID,
  blockKey: 'hero.banner',
  blockVersion: 1,
  fromLifecycle: 'supported' as const,
  toLifecycle: 'deprecated' as const,
  lifecycle: 'deprecated' as const,
  releaseDigest: HASH,
  releaseKeyId: 'release-key-1',
  releaseNonceHash: HASH,
  releaseVerifiedAt: '2026-09-02T12:00:00.000Z',
  eventType: 'cms.block.lifecycle.changed.v1' as const,
  createdAt: '2026-09-02T12:00:00.000Z',
};
export const detail = {
  resourceKind: 'content_type_version' as const,
  resource,
  fields: [field],
  relations: [relation],
  schemaArtifact: artifact,
  templateBindings: [],
  capabilityBindings: [
    {
      resourceKind: 'capability_binding' as const,
      id: 'e0000000-0000-4000-8000-000000000011',
      contentTypeVersionId: VERSION_ID,
      capabilityKey: 'cms.content.article',
      capabilityVersion: '1',
      version: '1',
      state: 'draft' as const,
    },
  ],
  blockDefinitions: [safeBlock],
};
export const validDraft = {
  typeKey: 'article',
  label: 'Article',
  ownerCapability: 'cms.content.article',
  sourceLocale: 'en-US',
  defaultLocale: 'en-US',
  supportedLocales: ['en-US'],
  fallbackChains: {},
  workflowKey: 'editorial.default',
  workflowVersion: '1',
  defaultTemplateVersionId: null,
  fields: [],
  relations: [],
  templateBindings: [],
  capabilityBindings: [],
};
export const validField = {
  key: 'title',
  kind: 'short_text',
  constraints: {},
  required: true,
  validatorKey: null,
  validatorVersion: null,
  defaultMode: 'none',
  localizationMode: 'none',
  editorConfig: { label: 'Title', order: 0 },
  lifecycle: 'active',
  migrationPlanId: null,
};
export const validRelation = {
  fieldId: FIELD_ID,
  targetKind: 'content',
  targetType: 'artist',
  projectionKey: 'public.summary',
  cardinality: 'many',
  min: 0,
  max: 8,
  ordered: false,
  onUnavailable: 'placeholder',
};
export const validActivation = {
  expectedVersion: '1',
  dryRunId: DRY_RUN_ID,
  approvalIds: ['f0000000-0000-4000-8000-000000000012'],
  migrationPlanId: null,
};
export const validBlock = {
  blockKey: 'hero.banner',
  blockVersion: 1,
  propsSchemaRef: 'schemas/hero-banner.json',
  propsSchemaHash: HASH,
  propsSchemaSnapshot: {
    schemaVersion: '1',
    fields: [],
    additionalProperties: false,
  },
  propsSnapshotHash: HASH,
  propsSnapshotAttestation: {
    algorithm: 'Ed25519',
    keyId: 'release-key-1',
    signature: SIGNATURE,
  },
  rendererRef: 'renderer/hero-banner',
  allowedChildren: [],
  slotRules: { maxDepth: 1, maxNodes: 32 },
  dataSourcePermissions: [],
  accessibility: {
    nameRequired: true,
    keyboard: true,
    focusOrder: 'document',
    statusAnnouncement: true,
  },
  compatibility: { minSchemaCompiler: '1', maxSchemaCompiler: '2' },
  lifecycle: 'supported',
  releaseDigest: HASH,
};
export const validLifecycle = {
  fromLifecycle: 'supported',
  toLifecycle: 'deprecated',
  expectedVersion: '1',
  releaseDigest: HASH,
};
