/**
 * Slice 11 valid fixtures for the review, schedule, preview, publication,
 * workflow-read and internal-RPC contract suites. Each is one canonical,
 * accepted value; a test derives its invalid variants from it so every refusal
 * names exactly the member it breaks. The Slice 10 fixtures are re-exported so
 * a Slice 11 suite imports one support module.
 */
import { CMS_PREFLIGHT_REGISTRY } from './preflight.ts';
import {
  hash,
  hash2,
  uuid,
  uuid2,
  uuid3,
  validActivationEvidence,
  validDecision,
  validDependencyManifest,
  validPolicyEvidence,
  validPreview,
  validPublication,
  validReviewSubmission,
  validSchedule,
  validVersionSet,
  version,
} from './publication-contracts.test-support.ts';

export {
  hash,
  hash2,
  uuid,
  uuid2,
  uuid3,
  validActivationEvidence,
  validDecision,
  validDependencyManifest,
  validPolicyEvidence,
  validPreview,
  validPublication,
  validReviewSubmission,
  validSchedule,
  validVersionSet,
  version,
};

/** A distinct valid lowercase UUID per index, for lists that need many ids. */
export const uid = (index: number): string =>
  `123e4567-e89b-42d3-a456-${String(426614175000 + index)}`;

/** A copy of `value` without `key` (the lint-clean way to build an invalid variant). */
export const without = <T extends object, K extends keyof T>(
  value: T,
  key: K,
): Omit<T, K> =>
  Object.fromEntries(
    Object.entries(value).filter(([name]) => name !== key),
  ) as Omit<T, K>;

export const instant = '2026-10-08T12:00:00Z';
export const laterInstant = '2026-10-09T12:00:00Z';

/** A 43-character base64url token, the exact derived preview-token length. */
export const previewToken = 'A'.repeat(43);

export const validFrozenCandidate = {
  frozenHash: hash,
  dependencyHash: hash2,
  versionSet: validVersionSet,
} as const;

export const validReview = {
  id: uuid,
  version: '1',
  createdAt: instant,
  updatedAt: instant,
  state: 'open',
  entryId: uuid2,
  revisionId: uuid3,
  riskClass: 'ordinary',
  workflowPolicy: validPolicyEvidence,
  activationEvidence: validActivationEvidence,
  frozenHash: hash,
  requiredDecisionCount: 1,
  recordedDecisionCount: 0,
  dependencyHash: hash2,
  invalidatedReason: null,
  submittedAt: instant,
  decidedAt: null,
} as const;

export const validApprovedReview = {
  ...validReview,
  version: '2',
  state: 'approved',
  recordedDecisionCount: 1,
  decidedAt: laterInstant,
} as const;

export const validProtectedPolicy = {
  ...validPolicyEvidence,
  key: 'cms.disclosure.legal',
  riskClass: 'protected',
  requiredDecisionCount: 2,
  requiredCapabilities: ['cms.reviewer', 'cms.reviewer.legal'],
} as const;

export const validScheduleResource = {
  id: uuid,
  version: '1',
  createdAt: instant,
  updatedAt: instant,
  state: 'pending',
  entryId: uuid2,
  revisionId: uuid3,
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
} as const;

export const validPreviewTokenResource = {
  token: previewToken,
  expiresAt: '2026-10-08T12:15:00Z',
  entryId: uuid,
  revisionId: uuid2,
  locale: 'en-US',
  audience: 'members',
  route: '/music/artist/spring-2026-tour',
  versionSet: validVersionSet,
  revoked: false,
} as const;

export const validPublicationResource = {
  id: uuid,
  version: '1',
  createdAt: instant,
  updatedAt: instant,
  state: 'active',
  action: 'publish',
  publicationVersionId: uuid2,
  entryId: uuid3,
  revisionId: uuid,
  locale: 'en-US',
  audience: 'members',
  publicationHash: hash,
  projectionState: 'pending',
  eventType: 'cms.publication.changed.v1',
} as const;

export const validPreflightReport = {
  evaluatedAt: instant,
  passed: true,
  results: CMS_PREFLIGHT_REGISTRY.map((row) => ({
    category: row.category,
    outcome: 'passed',
    providerKey: row.providerKey,
    providerVersion: row.providerVersion,
    reasonCode: null,
    blockingCount: 0,
  })),
} as const;

export const validWorkflowRevision = {
  id: uuid3,
  revisionNumber: '4',
  locale: 'en-US',
  schemaVersionId: uuid2,
  state: 'draft',
  contentHash: hash,
  validationState: 'valid',
  isCurrentDraft: true,
} as const;

export const validWorkflowPreparation = {
  frozenHash: hash,
  dependencyManifest: validDependencyManifest,
  dependencyHash: hash2,
  versionSet: validVersionSet,
  riskClass: 'ordinary',
  workflowPolicy: validPolicyEvidence,
  preflight: validPreflightReport,
} as const;

export const validWorkflowSchedule = {
  id: uid(1),
  version: '2',
  state: 'pending',
  action: 'publish',
  audience: 'members',
  resolvedUtc: '2026-11-01T14:30:00Z',
  reasonCode: null,
} as const;

export const validWorkflowPublication = {
  publicationId: uid(2),
  publicationVersionId: uid(3),
  version: '1',
  state: 'active',
  action: 'publish',
  revisionId: uuid3,
  locale: 'en-US',
  audience: 'members',
  publicationHash: hash,
  projectionState: 'pending',
  createdAt: instant,
} as const;

export const validWorkflowResource = {
  entry: { id: uuid2, version: '7', createdAt: instant, updatedAt: instant },
  revision: validWorkflowRevision,
  preparation: validWorkflowPreparation,
  review: null,
  schedules: [],
  publications: [],
  permittedNextActions: ['submit_review'],
} as const;

export const validDecisionSummary = {
  id: uid(10),
  decision: 'approve',
  capability: 'cms.reviewer',
  decidedAt: laterInstant,
  mine: false,
  reason: null,
} as const;

export const validAssignmentSummary = {
  assignmentId: uid(11),
  version: '1',
  state: 'active',
  startsAt: instant,
  endsAt: '2026-10-10T12:00:00Z',
  reviewerLabel: 'Reviewer 1',
} as const;

export const validReviewDetail = {
  ...validReview,
  revisionNumber: '4',
  locale: 'en-US',
  contentTypeLabel: 'Press release',
  frozen: validFrozenCandidate,
  distinctApprovalCount: 0,
  decisions: [],
  assignments: [],
  myAssignment: null,
  permittedNextActions: ['record_decision'],
} as const;

export const validQueueItem = {
  reviewId: uid(20),
  entryId: uuid2,
  revisionId: uuid3,
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

export const validQueuePage = {
  items: [validQueueItem],
  nextCursor: null,
  pageVersion: '5',
} as const;

export const validAssignmentCreate = {
  action: 'create',
  expectedVersion: version,
  reviewerPersonId: uuid2,
  expiresAt: '2026-10-10T12:00:00Z',
  reason: 'Covers the legal disclosure slot.',
} as const;

export const validAssignmentRevoke = {
  action: 'revoke',
  expectedVersion: version,
  assignmentId: uid(11),
} as const;

export const validAssignmentResource = {
  id: uid(11),
  version: '1',
  createdAt: instant,
  updatedAt: instant,
  reviewId: uuid,
  state: 'active',
  capability: 'cms.editorial_review',
  actions: ['read', 'decide'],
  startsAt: instant,
  expiresAt: '2026-10-10T12:00:00Z',
  reason: null,
} as const;

export const validVerificationRequest = {
  tokenHash: hash,
  actorPersonId: uuid,
  actingContextVersion: hash2,
  route: '/music/artist/spring-2026-tour',
  locale: 'en-US',
  audience: 'members',
} as const;

export const validVerificationValid = {
  valid: true,
  userId: uuid,
  entryId: uuid2,
  revisionId: uuid3,
  exactVersionSet: validVersionSet,
  expiresAt: '2026-10-08T12:15:00Z',
  revoked: false,
} as const;

export const validVerificationDenied = {
  valid: false,
  userId: null,
  entryId: null,
  revisionId: null,
  exactVersionSet: null,
  expiresAt: null,
  revoked: false,
} as const;

export const validClaimedSchedule = {
  scheduleId: uid(1),
  revisionId: uuid3,
  scheduleVersion: '2',
  expectedVersion: '3',
  leaseId: uid(4),
  dependencyHash: hash2,
  activationEvidenceHash: hash,
  correlationId: uid(5),
} as const;

export const validPreflightEvidence = {
  category: 'accessibility',
  providerKey: 'cms.a11y.structural',
  providerVersion: '1',
  outcome: 'healthy',
  blockingCount: 0,
  inputHash: hash,
  bindingHash: hash2,
  evaluatedAt: instant,
} as const;

export const validExecuteRequest = {
  scheduleId: uid(1),
  expectedVersion: '2',
  leaseId: uid(4),
  evidence: validPreflightEvidence,
} as const;

export const validExecutionCompleted = {
  scheduleId: uid(1),
  outcome: 'completed',
  reasonCode: null,
  publicationVersionId: uid(3),
  actualUtc: '2026-11-01T14:30:07Z',
  deviationSeconds: 7,
} as const;
