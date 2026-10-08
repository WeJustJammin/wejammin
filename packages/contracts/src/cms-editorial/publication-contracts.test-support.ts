/**
 * Shared valid fixtures for the BE03b publication contract suites
 * (`publication-contracts.test.ts` and `publication-schedule-contracts.test.ts`).
 * Each fixture is one canonical, accepted request; a test derives its invalid
 * variants from it so every refusal names exactly the member it breaks.
 */

export const uuid = '123e4567-e89b-42d3-a456-426614174000';
export const uuid2 = '123e4567-e89b-42d3-a456-426614174001';
export const uuid3 = '123e4567-e89b-42d3-a456-426614174002';
export const hash = 'a'.repeat(64);
export const hash2 = 'b'.repeat(64);
export const version = '3';

export const validPolicyEvidence = {
  key: 'editorial.default',
  version,
  policyHash: hash,
  riskClass: 'ordinary',
  requiredDecisionCount: 1,
  requiredCapabilities: ['cms.reviewer'],
  approvalEvidenceHash: hash2,
} as const;

export const validActivationEvidence = {
  ...validPolicyEvidence,
  key: 'cms.content.workflow',
} as const;

export const validSchemaArtifact = {
  id: uuid,
  contentTypeVersionId: uuid2,
  artifactHash: hash,
  compilerVersion: '1.2.3',
  zodContractRef: 'packages/contracts/src/cms-editorial/requests.ts',
} as const;

export const validDependencyManifest = {
  schema: {
    id: uuid2,
    hash,
    schemaArtifact: validSchemaArtifact,
    validatorRefs: [{ key: 'rich_text.v1', version: '1' }],
    workflowPolicy: validPolicyEvidence,
    activationEvidence: validActivationEvidence,
  },
  template: { id: uuid3, hash: hash2 },
  blocks: [{ id: uuid3, hash }],
  patterns: [{ id: uuid2, hash }],
  terms: [{ id: uuid3, hash }],
  localeSources: [{ locale: 'en-US', revisionId: uuid2, hash }],
  settings: { version: '1', hash },
  relations: [{ fieldId: uuid3, targetId: uuid2, targetVersion: '1' }],
  checker: { key: 'link.checker', version: '2' },
} as const;

export const validVersionSet = {
  schemaVersionId: uuid2,
  schemaHash: hash,
  schemaArtifact: validSchemaArtifact,
  validatorRefs: [{ key: 'rich_text.v1', version: '1' }],
  workflowPolicy: validPolicyEvidence,
  activationEvidence: validActivationEvidence,
  templateVersionId: uuid3,
  templateHash: hash2,
  taxonomyVersionIds: [uuid3],
  blockVersionIds: [uuid3],
  patternVersionIds: [uuid2],
  settingsVersion: '1',
  compilerVersion: '1.2.3',
} as const;

export const validReviewSubmission = {
  entryId: uuid,
  revisionId: uuid2,
  frozenHash: hash,
  dependencyManifest: validDependencyManifest,
} as const;

export const validDecision = {
  reviewId: uuid2,
  decision: 'approve',
  reason: 'Candidate matches the frozen dependencies.',
  expectedVersion: version,
} as const;

export const validSchedule = {
  revisionId: uuid2,
  action: 'publish',
  localDateTime: '2026-11-01T09:30:00',
  timezone: 'America/New_York',
  // 2026-11-01 09:30 in America/New_York is after the 02:00 DST end, so it is
  // EST (UTC-5): 14:30Z. The contract cannot compute this (the nonexistent- and
  // ambiguous-local-time rules are Slice 11 runtime); the fixture is simply right.
  resolvedUtc: '2026-11-01T14:30:00Z',
  tzdbVersion: '2025b',
  disambiguation: 'none',
  audience: 'members',
  expectedVersion: version,
} as const;

export const validPreview = {
  entryId: uuid,
  revisionId: uuid2,
  locale: 'en-US',
  audience: 'members',
  route: '/music/artist/spring-2026-tour',
  versionSet: validVersionSet,
} as const;

export const validPublication = {
  entryId: uuid,
  revisionId: uuid2,
  frozenHash: hash,
  expectedVersionSet: validVersionSet,
  audience: 'members',
  expectedVersion: version,
} as const;
