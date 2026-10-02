import { emptyActivationPreparation } from './content-schema-registry-activation-preparation.test-support';
export const ACTOR_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132d8';
export const PARTY_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132d9';
export const TYPE_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132da';
export const VERSION_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132db';
export const ARTIFACT_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132dc';
const HASH = 'b'.repeat(64);

export const list = {
  items: [
    {
      resourceKind: 'content_type',
      id: TYPE_ID,
      version: '4',
      typeKey: 'release_note',
      builtIn: false,
      lifecycle: 'active',
      createdAt: '2026-09-02T12:00:00.000Z',
      updatedAt: '2026-09-02T12:00:00.000Z',
    },
  ],
  nextCursor: null,
} as const;

export const detail = {
  resourceKind: 'content_type_version',
  resource: {
    id: VERSION_ID,
    version: '4',
    contentHash: HASH,
    createdAt: '2026-09-02T12:00:00.000Z',
    updatedAt: '2026-09-02T12:00:00.000Z',
    resourceKind: 'content_type_version',
    state: 'active',
    contentTypeId: TYPE_ID,
    typeKey: 'release_note',
    label: 'Release note',
    ownerCapability: 'cms.schema_registry.read',
    sourceLocale: 'en-US',
    defaultLocale: 'en-US',
    supportedLocales: ['en-US'],
    fallbackChains: {},
    localeConfigHash: 'c'.repeat(64),
    workflowKey: 'cms.content.workflow',
    workflowVersion: '1',
    defaultTemplateVersionId: null,
    schemaArtifactId: ARTIFACT_ID,
    fieldCount: 0,
    relationCount: 0,
    capabilityBindingCount: 0,
    compatibility: 'additive',
    dryRunId: ARTIFACT_ID,
    activationEvidence: {
      key: 'cms.schema.activation',
      version: '1',
      policyHash: HASH,
      riskClass: 'ordinary',
      requiredDecisionCount: 1,
      requiredCapabilities: [],
      approvalEvidenceHash: HASH,
    },
  },
  fields: [],
  relations: [],
  schemaArtifact: {
    resourceKind: 'schema_artifact',
    id: ARTIFACT_ID,
    version: '1',
    state: 'compiled',
    contentTypeVersionId: VERSION_ID,
    compilerVersion: '1.0',
    zodContractRef: 'schemas/release-note.json',
    artifactHash: HASH,
    createdAt: '2026-09-02T12:00:00.000Z',
    updatedAt: '2026-09-02T12:00:00.000Z',
    compiledAt: '2026-09-02T12:00:00.000Z',
  },
  templateBindings: [],
  capabilityBindings: [],
  blockDefinitions: [],
  activationPreparation: emptyActivationPreparation,
} as const;
