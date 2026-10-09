import {
  CMS_PREFLIGHT_REGISTRY,
  type EditorialReviewAssignmentResource,
  type EditorialReviewDetailResource,
  type EditorialReviewResource,
  type EntryWorkflowResource,
  type PreflightEvidence,
  type PreviewTokenResource,
  type PublicationResource,
  type PublicationScheduleResource,
  type ReviewQueuePage,
} from '@wejammin/contracts';

/**
 * Shared fixtures for the Slice 11 route suites (CMS-03B-05..09 and 15..18):
 * one canonical, accepted value per request and resource, plus a harness that
 * mounts the app over fake ports. A test derives an invalid variant from a
 * fixture so each refusal names exactly the member it breaks.
 */

export const origin = 'https://cms-console.example.test';
export const requestId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const userId = '10000000-0000-4000-8000-000000000001';
export const partyId = '20000000-0000-4000-8000-000000000002';
export const idempotencyKey = 'idempotency-key-0001';
export const entryId = '123e4567-e89b-42d3-a456-426614174000';
export const revisionId = '123e4567-e89b-42d3-a456-426614174001';
export const reviewId = '123e4567-e89b-42d3-a456-426614174002';
export const schemaId = '123e4567-e89b-42d3-a456-426614174003';
export const templateId = '123e4567-e89b-42d3-a456-426614174004';
export const assignmentId = '123e4567-e89b-42d3-a456-426614174005';
export const reviewerPersonId = '123e4567-e89b-42d3-a456-426614174006';
export const publicationVersionId = '123e4567-e89b-42d3-a456-426614174007';
export const scheduleId = '123e4567-e89b-42d3-a456-426614174008';
export const hash = 'a'.repeat(64);
export const hash2 = 'b'.repeat(64);
export const instant = '2026-10-08T12:00:00Z';
export const laterInstant = '2026-10-09T12:00:00Z';

export const policyEvidence = {
  key: 'editorial.default',
  version: '3',
  policyHash: hash,
  riskClass: 'ordinary',
  requiredDecisionCount: 1,
  requiredCapabilities: ['cms.reviewer'],
  approvalEvidenceHash: hash2,
} as const;

export const activationEvidence = {
  ...policyEvidence,
  key: 'cms.content.workflow',
} as const;

const schemaArtifact = {
  id: entryId,
  contentTypeVersionId: schemaId,
  artifactHash: hash,
  compilerVersion: '1.2.3',
  zodContractRef: 'packages/contracts/src/cms-editorial/requests.ts',
} as const;

export const dependencyManifest = {
  schema: {
    id: schemaId,
    hash,
    schemaArtifact,
    validatorRefs: [{ key: 'rich_text.v1', version: '1' }],
    workflowPolicy: policyEvidence,
    activationEvidence,
  },
  template: { id: templateId, hash: hash2 },
  blocks: [{ id: templateId, hash }],
  patterns: [{ id: schemaId, hash }],
  terms: [{ id: templateId, hash }],
  localeSources: [{ locale: 'en-US', revisionId: schemaId, hash }],
  settings: { version: '1', hash },
  relations: [{ fieldId: templateId, targetId: schemaId, targetVersion: '1' }],
  checker: { key: 'link.checker', version: '2' },
} as const;

export const versionSet = {
  schemaVersionId: schemaId,
  schemaHash: hash,
  schemaArtifact,
  validatorRefs: [{ key: 'rich_text.v1', version: '1' }],
  workflowPolicy: policyEvidence,
  activationEvidence,
  templateVersionId: templateId,
  templateHash: hash2,
  taxonomyVersionIds: [templateId],
  blockVersionIds: [templateId],
  patternVersionIds: [schemaId],
  settingsVersion: '1',
  compilerVersion: '1.2.3',
} as const;

export const submitBody = {
  entryId,
  revisionId,
  frozenHash: hash,
  dependencyManifest,
} as const;

export const decisionBody = {
  reviewId,
  decision: 'approve',
  reason: 'Candidate matches the frozen dependencies.',
  expectedVersion: '2',
} as const;

export const scheduleBody = {
  revisionId,
  action: 'publish',
  localDateTime: '2026-11-01T09:30:00',
  timezone: 'America/New_York',
  resolvedUtc: '2026-11-01T14:30:00Z',
  tzdbVersion: '2026e',
  disambiguation: 'none',
  audience: 'members',
  expectedVersion: '2',
} as const;

export const previewBody = {
  entryId,
  revisionId,
  locale: 'en-US',
  audience: 'members',
  route: '/music/artist/spring-2026-tour',
  versionSet,
} as const;

export const publicationBody = {
  entryId,
  revisionId,
  frozenHash: hash,
  expectedVersionSet: versionSet,
  audience: 'members',
  expectedVersion: '2',
} as const;

export const assignmentCreateBody = {
  action: 'create',
  expectedVersion: '2',
  reviewerPersonId,
  expiresAt: '2026-10-10T12:00:00Z',
  reason: 'Legal review of the disclosure.',
} as const;

export const assignmentRevokeBody = {
  action: 'revoke',
  expectedVersion: '2',
  assignmentId,
} as const;

export const reviewResource: EditorialReviewResource = {
  id: reviewId,
  version: '1',
  createdAt: instant,
  updatedAt: instant,
  state: 'open',
  entryId,
  revisionId,
  riskClass: 'ordinary',
  workflowPolicy: policyEvidence,
  activationEvidence,
  frozenHash: hash,
  requiredDecisionCount: 1,
  recordedDecisionCount: 0,
  dependencyHash: hash2,
  invalidatedReason: null,
  submittedAt: instant,
  decidedAt: null,
};

export const approvedReviewResource: EditorialReviewResource = {
  ...reviewResource,
  version: '2',
  state: 'approved',
  recordedDecisionCount: 1,
  decidedAt: laterInstant,
};

export const scheduleResource: PublicationScheduleResource = {
  id: scheduleId,
  version: '1',
  createdAt: instant,
  updatedAt: instant,
  state: 'pending',
  entryId,
  revisionId,
  action: 'publish',
  localDateTime: '2026-11-01T09:30:00',
  timezone: 'America/New_York',
  resolvedUtc: '2026-11-01T14:30:00Z',
  tzdbVersion: '2026e',
  disambiguation: 'none',
  audience: 'members',
  jobId: null,
  actualUtc: null,
  deviationSeconds: null,
  reasonCode: null,
  attemptCount: 0,
};

export const previewResource: PreviewTokenResource = {
  token: 'A'.repeat(43),
  expiresAt: '2026-10-08T12:15:00Z',
  entryId,
  revisionId,
  locale: 'en-US',
  audience: 'members',
  route: '/music/artist/spring-2026-tour',
  versionSet,
  revoked: false,
};

export const publicationResource: PublicationResource = {
  id: scheduleId,
  version: '3',
  createdAt: instant,
  updatedAt: instant,
  state: 'active',
  action: 'publish',
  publicationVersionId,
  entryId,
  revisionId,
  locale: 'en-US',
  audience: 'members',
  publicationHash: hash,
  projectionState: 'pending',
  eventType: 'cms.publication.changed.v1',
};

export const assignmentResource: EditorialReviewAssignmentResource = {
  id: assignmentId,
  version: '1',
  createdAt: instant,
  updatedAt: instant,
  reviewId,
  state: 'active',
  capability: 'cms.editorial_review',
  actions: ['read', 'decide'],
  startsAt: instant,
  expiresAt: '2026-10-10T12:00:00Z',
  reason: 'Legal review of the disclosure.',
};

export const evidence: PreflightEvidence = {
  category: 'accessibility',
  providerKey: 'cms.a11y.structural',
  providerVersion: '1',
  outcome: 'healthy',
  blockingCount: 0,
  inputHash: hash,
  bindingHash: hash2,
  evaluatedAt: instant,
};

export const preflightReport = {
  evaluatedAt: instant,
  passed: true,
  results: CMS_PREFLIGHT_REGISTRY.map((row) => ({
    category: row.category,
    outcome: 'passed' as const,
    providerKey: row.providerKey,
    providerVersion: row.providerVersion,
    reasonCode: null,
    blockingCount: 0,
  })),
} as const;

export const workflowResource: EntryWorkflowResource = {
  entry: { id: entryId, version: '7', createdAt: instant, updatedAt: instant },
  revision: {
    id: revisionId,
    revisionNumber: '4',
    locale: 'en-US',
    schemaVersionId: schemaId,
    state: 'draft',
    contentHash: hash,
    validationState: 'valid',
    isCurrentDraft: true,
  },
  preparation: {
    frozenHash: hash,
    dependencyManifest,
    dependencyHash: hash2,
    versionSet,
    riskClass: 'ordinary',
    workflowPolicy: policyEvidence,
    preflight: preflightReport,
  },
  review: null,
  schedules: [],
  publications: [],
  permittedNextActions: ['submit_review'],
};

export const reviewDetailResource: EditorialReviewDetailResource = {
  ...reviewResource,
  revisionNumber: '4',
  locale: 'en-US',
  contentTypeLabel: 'Press release',
  frozen: { frozenHash: hash, dependencyHash: hash2, versionSet },
  distinctApprovalCount: 0,
  decisions: [],
  assignments: [],
  myAssignment: null,
  permittedNextActions: ['record_decision'],
};

export const queueItem = {
  reviewId,
  entryId,
  revisionId,
  revisionNumber: '4',
  locale: 'en-US',
  contentTypeLabel: 'Press release',
  state: 'open',
  riskClass: 'ordinary',
  requiredDecisionCount: 1,
  recordedDecisionCount: 0,
  myDecision: 'none',
  assignmentEndsAt: '2026-10-10T12:00:00Z',
  submittedAt: instant,
  updatedAt: instant,
} as const;

export const queuePage: ReviewQueuePage = {
  items: [queueItem],
  nextCursor: null,
  pageVersion: '5',
};
