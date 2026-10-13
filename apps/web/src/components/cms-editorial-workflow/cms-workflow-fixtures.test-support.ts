import {
  CMS_PREFLIGHT_REGISTRY,
  EditorialReviewAssignmentResourceSchema,
  EditorialReviewDetailResourceSchema,
  EditorialReviewResourceSchema,
  EntryWorkflowResourceSchema,
  PreflightReportSchema,
  PreviewTokenResourceSchema,
  PublicationResourceSchema,
  PublicationScheduleResourceSchema,
  ReviewQueuePageSchema,
  type EditorialReviewAssignmentResource,
  type EditorialReviewDetailResource,
  type EditorialReviewResource,
  type EntryWorkflowResource,
  type PreviewTokenResource,
  type PublicationResource,
  type PublicationScheduleResource,
  type ReviewQueuePage,
} from '@wejammin/contracts';

/*
 * Valid Slice 11 fixtures for the web suites. Every builder returns a value
 * parsed through the REAL generated contract, so a fixture can never drift from
 * the schema it stands for; a test derives the variant it needs with `with*`
 * overrides and the parse proves the variant is still a contract-valid body.
 */

export const ENTRY_ID = '123e4567-e89b-42d3-a456-426614174002';
export const REVISION_ID = '123e4567-e89b-42d3-a456-426614174003';
export const REVIEW_ID = '123e4567-e89b-42d3-a456-426614174000';
export const SCHEMA_VERSION_ID = '123e4567-e89b-42d3-a456-426614174001';
export const ASSIGNMENT_ID = '123e4567-e89b-42d3-a456-42661417400b';
export const REVIEWER_PERSON_ID = '123e4567-e89b-42d3-a456-42661417400c';
export const HASH_A = 'a'.repeat(64);
export const HASH_B = 'b'.repeat(64);
export const INSTANT = '2026-10-08T12:00:00Z';
export const LATER = '2026-10-09T12:00:00Z';
export const TOKEN = 'Zx9_-'.repeat(8) + 'Abc';
export const REQUEST_ID = '0195b6f0-0000-7000-8000-000000000001';

const policy = {
  key: 'editorial.default',
  version: '3',
  policyHash: HASH_A,
  riskClass: 'ordinary',
  requiredDecisionCount: 1,
  requiredCapabilities: ['cms.reviewer'],
  approvalEvidenceHash: HASH_B,
} as const;

const activation = { ...policy, key: 'cms.content.workflow' } as const;

const schemaArtifact = {
  id: ENTRY_ID,
  contentTypeVersionId: SCHEMA_VERSION_ID,
  artifactHash: HASH_A,
  compilerVersion: '1.2.3',
  zodContractRef: 'packages/contracts/src/cms-editorial/requests.ts',
} as const;

export const versionSetFixture = {
  schemaVersionId: SCHEMA_VERSION_ID,
  schemaHash: HASH_A,
  schemaArtifact,
  validatorRefs: [{ key: 'rich_text.v1', version: '1' }],
  workflowPolicy: policy,
  activationEvidence: activation,
  templateVersionId: REVISION_ID,
  templateHash: HASH_B,
  taxonomyVersionIds: [REVISION_ID],
  blockVersionIds: [REVISION_ID],
  patternVersionIds: [SCHEMA_VERSION_ID],
  settingsVersion: '1',
  compilerVersion: '1.2.3',
} as const;

export const dependencyManifestFixture = {
  schema: {
    id: SCHEMA_VERSION_ID,
    hash: HASH_A,
    schemaArtifact,
    validatorRefs: [{ key: 'rich_text.v1', version: '1' }],
    workflowPolicy: policy,
    activationEvidence: activation,
  },
  template: { id: REVISION_ID, hash: HASH_B },
  blocks: [{ id: REVISION_ID, hash: HASH_A }],
  patterns: [{ id: SCHEMA_VERSION_ID, hash: HASH_A }],
  terms: [{ id: REVISION_ID, hash: HASH_A }],
  localeSources: [
    { locale: 'en-US', revisionId: SCHEMA_VERSION_ID, hash: HASH_A },
  ],
  settings: { version: '1', hash: HASH_A },
  relations: [
    { fieldId: REVISION_ID, targetId: SCHEMA_VERSION_ID, targetVersion: '1' },
  ],
  checker: { key: 'link.checker', version: '2' },
} as const;

export const preflightReportFixture = (
  overrides: Readonly<
    Record<string, { outcome: string; reasonCode: string | null }>
  > = {},
) => {
  const results = CMS_PREFLIGHT_REGISTRY.map((row) => ({
    category: row.category,
    outcome: overrides[row.category]?.outcome ?? 'passed',
    providerKey: row.providerKey,
    providerVersion: row.providerVersion,
    reasonCode: overrides[row.category]?.reasonCode ?? null,
    blockingCount: overrides[row.category]?.outcome === 'failed' ? 1 : 0,
  }));
  return PreflightReportSchema.parse({
    evaluatedAt: INSTANT,
    passed: results.every((result) => result.outcome === 'passed'),
    results,
  });
};

const reviewBase = {
  id: REVIEW_ID,
  version: '2',
  createdAt: INSTANT,
  updatedAt: INSTANT,
  state: 'open',
  entryId: ENTRY_ID,
  revisionId: REVISION_ID,
  riskClass: 'ordinary',
  workflowPolicy: policy,
  activationEvidence: activation,
  frozenHash: HASH_A,
  requiredDecisionCount: 1,
  recordedDecisionCount: 0,
  dependencyHash: HASH_B,
  invalidatedReason: null,
  submittedAt: INSTANT,
  decidedAt: null,
} as const;

const frozen = {
  frozenHash: HASH_A,
  dependencyHash: HASH_B,
  versionSet: versionSetFixture,
} as const;

export const reviewFixture = (
  overrides: Readonly<Record<string, unknown>> = {},
): EditorialReviewResource =>
  EditorialReviewResourceSchema.parse({ ...reviewBase, ...overrides });

export const approvedReviewFixture = (
  overrides: Readonly<Record<string, unknown>> = {},
): EditorialReviewResource =>
  reviewFixture({
    state: 'approved',
    version: '5',
    recordedDecisionCount: 1,
    decidedAt: LATER,
    ...overrides,
  });

export const workflowFixture = (
  overrides: Readonly<Record<string, unknown>> = {},
): EntryWorkflowResource =>
  EntryWorkflowResourceSchema.parse({
    entry: {
      id: ENTRY_ID,
      version: '7',
      createdAt: INSTANT,
      updatedAt: INSTANT,
    },
    revision: {
      id: REVISION_ID,
      revisionNumber: '4',
      locale: 'en-US',
      schemaVersionId: SCHEMA_VERSION_ID,
      state: 'draft',
      contentHash: HASH_A,
      validationState: 'valid',
      isCurrentDraft: true,
    },
    preparation: {
      frozenHash: HASH_A,
      dependencyManifest: dependencyManifestFixture,
      dependencyHash: HASH_B,
      versionSet: versionSetFixture,
      riskClass: 'ordinary',
      workflowPolicy: policy,
      preflight: preflightReportFixture(),
    },
    review: null,
    schedules: [],
    publications: [],
    permittedNextActions: ['submit_review', 'preview'],
    ...overrides,
  });

/** A workflow whose revision is approved: no preparation, a review with its frozen candidate. */
export const approvedWorkflowFixture = (
  overrides: Readonly<Record<string, unknown>> = {},
): EntryWorkflowResource =>
  workflowFixture({
    revision: {
      id: REVISION_ID,
      revisionNumber: '4',
      locale: 'en-US',
      schemaVersionId: SCHEMA_VERSION_ID,
      state: 'approved',
      contentHash: HASH_A,
      validationState: 'valid',
      isCurrentDraft: false,
    },
    preparation: null,
    review: { ...approvedReviewFixture(), frozen },
    permittedNextActions: ['schedule', 'preview', 'publish'],
    ...overrides,
  });

export const reviewDetailFixture = (
  overrides: Readonly<Record<string, unknown>> = {},
): EditorialReviewDetailResource =>
  EditorialReviewDetailResourceSchema.parse({
    ...reviewBase,
    revisionNumber: '4',
    locale: 'en-US',
    contentTypeLabel: 'Press release',
    frozen,
    distinctApprovalCount: 0,
    decisions: [],
    assignments: [],
    myAssignment: null,
    permittedNextActions: ['record_decision'],
    ...overrides,
  });

export const queuePageFixture = (
  items: readonly Record<string, unknown>[] = [queueItem(1)],
  nextCursor: string | null = null,
): ReviewQueuePage =>
  ReviewQueuePageSchema.parse({ items, nextCursor, pageVersion: '5' });

export const queueItem = (
  index: number,
  overrides: Readonly<Record<string, unknown>> = {},
): Record<string, unknown> => ({
  reviewId: `123e4567-e89b-42d3-a456-4266141750${String(index).padStart(2, '0')}`,
  entryId: ENTRY_ID,
  revisionId: REVISION_ID,
  revisionNumber: String(index),
  locale: 'en-US',
  contentTypeLabel: 'Press release',
  state: 'open',
  riskClass: 'ordinary',
  requiredDecisionCount: 1,
  recordedDecisionCount: 0,
  myDecision: 'none',
  assignmentEndsAt: LATER,
  submittedAt: INSTANT,
  // Strictly decreasing so a fixture page always honours the keyset order.
  updatedAt: `2026-10-08T12:00:${String(59 - index).padStart(2, '0')}Z`,
  ...overrides,
});

export const scheduleResourceFixture = (
  overrides: Readonly<Record<string, unknown>> = {},
): PublicationScheduleResource =>
  PublicationScheduleResourceSchema.parse({
    id: ASSIGNMENT_ID,
    version: '1',
    createdAt: INSTANT,
    updatedAt: INSTANT,
    state: 'pending',
    entryId: ENTRY_ID,
    revisionId: REVISION_ID,
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
    ...overrides,
  });

export const previewResourceFixture = (
  overrides: Readonly<Record<string, unknown>> = {},
): PreviewTokenResource =>
  PreviewTokenResourceSchema.parse({
    token: TOKEN,
    expiresAt: '2026-10-08T12:15:00Z',
    entryId: ENTRY_ID,
    revisionId: REVISION_ID,
    locale: 'en-US',
    audience: 'members',
    route: '/music/artist/spring-2026-tour',
    versionSet: versionSetFixture,
    revoked: false,
    ...overrides,
  });

export const publicationResourceFixture = (
  overrides: Readonly<Record<string, unknown>> = {},
): PublicationResource =>
  PublicationResourceSchema.parse({
    id: ASSIGNMENT_ID,
    version: '1',
    createdAt: INSTANT,
    updatedAt: INSTANT,
    state: 'active',
    action: 'publish',
    publicationVersionId: SCHEMA_VERSION_ID,
    entryId: ENTRY_ID,
    revisionId: REVISION_ID,
    locale: 'en-US',
    audience: 'members',
    publicationHash: HASH_A,
    projectionState: 'pending',
    eventType: 'cms.publication.changed.v1',
    ...overrides,
  });

export const assignmentResourceFixture = (
  overrides: Readonly<Record<string, unknown>> = {},
): EditorialReviewAssignmentResource =>
  EditorialReviewAssignmentResourceSchema.parse({
    id: ASSIGNMENT_ID,
    version: '1',
    createdAt: INSTANT,
    updatedAt: INSTANT,
    reviewId: REVIEW_ID,
    state: 'active',
    capability: 'cms.editorial_review',
    actions: ['read', 'decide'],
    startsAt: INSTANT,
    expiresAt: LATER,
    reason: null,
    ...overrides,
  });

/** An `ApiError` body in the exact envelope the Worker emits. */
export const apiError = (
  code: string,
  details: Readonly<Record<string, unknown>> = {},
): Record<string, unknown> => ({
  code,
  message: 'A fixed message.',
  details,
  requestId: REQUEST_ID,
});

export const jsonResponse = (
  status: number,
  body: unknown,
  headers: Readonly<Record<string, string>> = {},
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
