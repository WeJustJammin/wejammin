/**
 * Shared valid fixtures for the CMS-03B-14 authoring-context contract suites
 * (`authoring-context.test.ts` and `authoring-context-read.test.ts`). Each is
 * one canonical, accepted value; a suite derives its invalid variants from it
 * so every refusal names exactly the member it breaks.
 */
export const uuid = '123e4567-e89b-42d3-a456-426614174000';
export const uuid2 = '123e4567-e89b-42d3-a456-426614174001';
export const uuid3 = '123e4567-e89b-42d3-a456-426614174002';
const uuid4 = '123e4567-e89b-42d3-a456-426614174003';
const hash = 'a'.repeat(64);

export const schemaArtifact = {
  id: uuid3,
  contentTypeVersionId: uuid2,
  artifactHash: hash,
  compilerVersion: '1.0.0',
  zodContractRef: 'cms.article.v1',
} as const;

export const validatorEvidence = { key: 'cms.slug', version: '1' } as const;

const ordinaryPolicy = {
  key: 'cms.publish',
  version: '1',
  policyHash: hash,
  riskClass: 'ordinary',
  requiredDecisionCount: 1,
  requiredCapabilities: [],
  approvalEvidenceHash: hash,
} as const;

export const protectedPolicy = {
  ...ordinaryPolicy,
  riskClass: 'protected',
  requiredDecisionCount: 2,
  requiredCapabilities: ['cms.publisher'],
} as const;

export const validType = {
  contentTypeId: uuid,
  contentTypeVersionId: uuid2,
  typeKey: 'article',
  label: 'Article',
  sourceLocale: 'en-US',
  defaultLocale: 'en-US',
  supportedLocales: ['en-US'],
  schemaArtifact,
  validatorRefs: [validatorEvidence],
  workflowPolicy: ordinaryPolicy,
  activationEvidence: ordinaryPolicy,
} as const;

export const selectedType = { ...validType } as const;

export const validField = {
  stableFieldId: uuid4,
  key: 'display_name',
  kind: 'short_text',
  constraints: { minLength: 1 },
  required: true,
  defaultMode: 'none',
  localizationMode: 'none',
  editorConfig: { label: 'Display name', order: 0 },
  relationDefinition: null,
} as const;

export const emptyResource = {
  creatableTypes: [validType],
  selectedType: null,
  fields: [],
} as const;

export const selectedResource = {
  creatableTypes: [validType],
  selectedType,
  fields: [validField],
} as const;

/** The canonical field row with the optional defaultValue member removed. */
export const withoutDefaultValue = (): Record<string, unknown> => {
  const clone: Record<string, unknown> = { ...validField };
  delete clone.defaultValue;
  return clone;
};

export const leakedKeys = [
  'ownerId',
  'assigneeId',
  'createdByPersonId',
  'actingPartyId',
  'registryPrivate',
  'cmsSchemaRegistryRead',
  'extra',
] as const;
