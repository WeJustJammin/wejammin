import { vi } from 'vitest';

import {
  ASSIGNMENT_ID,
  CSRF,
  HASH_A,
  KEY,
  LATER,
  REVIEWER_PERSON_ID,
  REVIEW_ID,
  SCHEDULED_INSTANT,
  SUBJECT_ID,
  governedApiError,
  governedReviewFixture,
  jsonResponse,
} from '../../server/cms-governed-review-fixtures.test-support';

export const documentRef = { cookie: `wj_csrf=${CSRF}; other=1` };

export const decided = governedReviewFixture({
  version: '3',
  state: 'approved',
  recordedDecisionCount: 1,
  decidedAt: LATER,
});

export const submitInput = {
  ids: {},
  body: {
    subjectKind: 'template_version',
    subjectId: SUBJECT_ID,
    subjectHash: HASH_A,
  },
  ifMatch: '"2"',
  idempotencyKey: KEY,
} as const;
export const decideInput = {
  ids: { reviewId: REVIEW_ID },
  body: {
    reviewId: REVIEW_ID,
    decision: 'approve',
    reason: 'The candidate matches its frozen dependencies.',
    expectedVersion: '2',
  },
  ifMatch: '"2"',
  idempotencyKey: KEY,
} as const;
export const createInput = {
  ids: { reviewId: REVIEW_ID },
  body: {
    action: 'create',
    expectedVersion: '2',
    reviewerPersonId: REVIEWER_PERSON_ID,
    expiresAt: LATER,
  },
  ifMatch: '"2"',
  idempotencyKey: KEY,
} as const;
export const revokeInput = {
  ids: { reviewId: REVIEW_ID },
  body: { action: 'revoke', expectedVersion: '2', assignmentId: ASSIGNMENT_ID },
  ifMatch: '"2"',
  idempotencyKey: KEY,
} as const;

export const fetcherFor = (...queue: readonly (Response | Error)[]) => {
  const remaining = [...queue];
  return vi.fn(async () => {
    const next = remaining.shift() ?? new Error('unexpected call');
    if (next instanceof Error) throw next;
    return next;
  });
};

export const environment = (fetcher: ReturnType<typeof fetcherFor>) => ({
  fetcher,
  documentRef,
});

export const catalogError = (
  status: number,
  code: string,
  details: Record<string, unknown> = {},
): Response =>
  jsonResponse(status, governedApiError(code, 'A fixed message.', details));

export const activateInput = {
  ids: { reviewId: REVIEW_ID },
  body: { action: 'activate', expectedVersion: '2' },
  ifMatch: '"2"',
  idempotencyKey: KEY,
} as const;
export const scheduleInput = {
  ids: { reviewId: REVIEW_ID },
  body: {
    action: 'schedule',
    expectedVersion: '2',
    activateAt: SCHEDULED_INSTANT,
  },
  ifMatch: '"2"',
  idempotencyKey: KEY,
} as const;
export const retireInput = {
  ids: { reviewId: REVIEW_ID },
  body: {
    action: 'retire',
    expectedVersion: '2',
    reason: 'Superseded by the redesign.',
  },
  ifMatch: '"2"',
  idempotencyKey: KEY,
} as const;

/** The Location every CMS-03C-09 answer carries: the review itself. */
export const REVIEW_LOCATION = `/api/v1/cms/governed-reviews/${REVIEW_ID}`;
