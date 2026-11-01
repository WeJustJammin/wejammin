import {
  GovernedActivationResourceSchema,
  GovernedReviewAssignmentResourceSchema,
  GovernedReviewDetailResourceSchema,
  GovernedReviewQueuePageSchema,
  GovernedReviewResourceSchema,
  type GovernedActivationResource,
  type GovernedReviewAssignmentResource,
  type GovernedReviewDetailResource,
  type GovernedReviewQueuePage,
  type GovernedReviewResource,
} from '@wejammin/contracts';
import { CMS_TZDB_VERSION } from '@wejammin/contracts/client';

import {
  ASSIGNMENT_ID,
  HASH_A,
  HASH_B,
  INSTANT,
  LATER,
  REVIEWER_PERSON_ID,
  REVIEW_ID,
  REQUEST_ID,
  SCHEMA_VERSION_ID,
  apiError,
  jsonResponse,
} from '../components/cms-editorial-workflow/cms-workflow-fixtures.test-support';

/*
 * Valid Slice 12 governed-review fixtures for the web suites. Every builder
 * returns a value parsed through the REAL generated contract, so a fixture can
 * never drift from the schema it stands for.
 */

export {
  ASSIGNMENT_ID,
  HASH_A,
  HASH_B,
  INSTANT,
  LATER,
  REQUEST_ID,
  REVIEWER_PERSON_ID,
  REVIEW_ID,
  apiError,
  jsonResponse,
};

/** The subject version row the review freezes. */
export const SUBJECT_ID = SCHEMA_VERSION_ID;
export const LINEAGE_ID = '123e4567-e89b-42d3-a456-426614174099';
export const CSRF = 'csrf-token-000000000001';
export const KEY = 'idem-key-governed-0001';

const reviewBase = {
  id: REVIEW_ID,
  version: '1',
  contentHash: HASH_B,
  createdAt: INSTANT,
  updatedAt: INSTANT,
  state: 'open',
  subjectKind: 'template_version',
  subjectId: SUBJECT_ID,
  lineageId: LINEAGE_ID,
  subjectKey: 'profile-header',
  subjectVersion: 2,
  subjectHash: HASH_A,
  riskClass: 'ordinary',
  requiredDecisionCount: 1,
  recordedDecisionCount: 0,
  requiredCapabilities: ['cms.reviewer'],
  policyBasisHash: HASH_B,
  submittedAt: INSTANT,
  decidedAt: null,
  activatedAt: null,
  invalidatedReason: null,
} as const;

export const governedReviewFixture = (
  overrides: Readonly<Record<string, unknown>> = {},
): GovernedReviewResource =>
  GovernedReviewResourceSchema.parse({ ...reviewBase, ...overrides });

export const governedDecisionFixture = (
  overrides: Readonly<Record<string, unknown>> = {},
) => ({
  id: '123e4567-e89b-42d3-a456-426614174a01',
  decision: 'approve',
  capability: 'cms.reviewer',
  decidedAt: LATER,
  mine: false,
  reason: null,
  ...overrides,
});

export const governedAssignmentSummaryFixture = (
  overrides: Readonly<Record<string, unknown>> = {},
) => ({
  assignmentId: ASSIGNMENT_ID,
  version: '1',
  state: 'active',
  startsAt: INSTANT,
  endsAt: LATER,
  reviewerLabel: 'Reviewer A',
  ...overrides,
});

export const governedDetailFixture = (
  overrides: Readonly<Record<string, unknown>> = {},
): GovernedReviewDetailResource =>
  GovernedReviewDetailResourceSchema.parse({
    ...reviewBase,
    version: '2',
    blockRegistryDigest: HASH_A,
    policyBasis: [
      {
        contentTypeLabel: 'Profile',
        policyKey: 'editorial.default',
        policyVersion: '1',
      },
    ],
    distinctApprovalCount: 0,
    decisions: [],
    assignments: [],
    myAssignment: null,
    subjectState: 'review',
    permittedNextActions: ['record_decision'],
    activationSchedule: null,
    ...overrides,
  });

export const governedQueueItem = (
  index: number,
  overrides: Readonly<Record<string, unknown>> = {},
): Record<string, unknown> => ({
  reviewId: `123e4567-e89b-42d3-a456-4266141760${String(index).padStart(2, '0')}`,
  subjectKind: 'template_version',
  subjectKey: 'profile-header',
  subjectVersion: index,
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

export const governedQueuePageFixture = (
  items: readonly Record<string, unknown>[] = [governedQueueItem(1)],
  nextCursor: string | null = null,
): GovernedReviewQueuePage =>
  GovernedReviewQueuePageSchema.parse({ items, nextCursor, pageVersion: '5' });

export const governedAssignmentFixture = (
  overrides: Readonly<Record<string, unknown>> = {},
): GovernedReviewAssignmentResource =>
  GovernedReviewAssignmentResourceSchema.parse({
    id: ASSIGNMENT_ID,
    version: '1',
    contentHash: HASH_A,
    createdAt: INSTANT,
    updatedAt: INSTANT,
    reviewId: REVIEW_ID,
    state: 'active',
    capability: 'cms.definition_review',
    actions: ['read', 'decide'],
    startsAt: INSTANT,
    expiresAt: LATER,
    reason: null,
    ...overrides,
  });

/** A governed catalog error body in the exact envelope the Worker emits. */
export const governedApiError = (
  code: string,
  message: string,
  details: Readonly<Record<string, unknown>> = {},
): Record<string, unknown> => ({
  code,
  message,
  details,
  requestId: REQUEST_ID,
});

/**
 * A CMS-03C-09 answer parsed through the real contract; the defaults are an activation of version 2
 * that superseded version 1 (DEC-191).
 */
export const governedActivationFixture = (
  overrides: Readonly<Record<string, unknown>> = {},
): GovernedActivationResource =>
  GovernedActivationResourceSchema.parse({
    reviewId: REVIEW_ID,
    reviewVersion: '3',
    subjectKind: 'template_version',
    subjectId: SUBJECT_ID,
    lineageId: LINEAGE_ID,
    subjectVersion: 2,
    supersededVersion: 1,
    action: 'activate',
    subjectState: 'active',
    activatedAt: LATER,
    scheduledForUtc: null,
    eventType: 'cms.template.activated.v1',
    ...overrides,
  });

/** A scheduled acceptance: the review version is unchanged and no event is emitted. */
export const governedScheduledFixture = (
  overrides: Readonly<Record<string, unknown>> = {},
): GovernedActivationResource =>
  governedActivationFixture({
    reviewVersion: '2',
    supersededVersion: null,
    action: 'schedule',
    subjectState: 'scheduled',
    activatedAt: null,
    scheduledForUtc: '2026-12-01T14:00:00Z',
    eventType: null,
    ...overrides,
  });

/** A retirement: the subject is retired and the review version advanced by one. */
export const governedRetiredFixture = (
  overrides: Readonly<Record<string, unknown>> = {},
): GovernedActivationResource =>
  governedActivationFixture({
    reviewVersion: '3',
    supersededVersion: null,
    action: 'retire',
    subjectState: 'retired',
    activatedAt: INSTANT,
    ...overrides,
  });

/** The `ScheduledInstant` a schedule request carries (New York, standard time). */
export const SCHEDULED_INSTANT = {
  localDateTime: '2026-12-01T09:00',
  timezone: 'America/New_York',
  resolvedUtc: '2026-12-01T14:00:00Z',
  tzdbVersion: CMS_TZDB_VERSION,
  disambiguation: 'none',
} as const;
