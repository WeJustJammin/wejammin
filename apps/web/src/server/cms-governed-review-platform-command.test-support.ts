import { cmsCompositionCatalogMessage } from '@wejammin/contracts';

import {
  ASSIGNMENT_ID,
  CSRF,
  HASH_A,
  HASH_B,
  KEY,
  LATER,
  REVIEWER_PERSON_ID,
  REVIEW_ID,
  SCHEDULED_INSTANT,
  SUBJECT_ID,
  governedActivationFixture,
  governedApiError,
  governedAssignmentFixture,
  governedRetiredFixture,
  governedReviewFixture,
  governedScheduledFixture,
  jsonResponse,
} from './cms-governed-review-fixtures.test-support';
import {
  forwardCmsGovernedReviewCommand,
  type CmsGovernedCommandOperationId,
} from './cms-governed-review-platform-command';
import { ORIGIN } from './cms-workflow-platform-command.test-support';

export interface CommandCase {
  readonly name: string;
  readonly operationId: CmsGovernedCommandOperationId;
  readonly params: Readonly<{ reviewId?: string }>;
  readonly path: string;
  readonly body: Record<string, unknown>;
  /** The strong If-Match, or null when the operation takes none. */
  readonly ifMatch: string | null;
  readonly status: 200 | 201 | 202;
  readonly resource: unknown;
  readonly mismatched: unknown;
  readonly etag: string;
  readonly location: string | null;
}

const decided = governedReviewFixture({
  version: '3',
  state: 'approved',
  recordedDecisionCount: 1,
  decidedAt: LATER,
});

export const CASES: readonly CommandCase[] = [
  {
    name: 'CMS-03C-06 submit',
    operationId: 'CMS-03C-06',
    params: {},
    path: '/api/v1/cms/governed-reviews',
    body: {
      subjectKind: 'template_version',
      subjectId: SUBJECT_ID,
      subjectHash: HASH_A,
    },
    ifMatch: null,
    status: 201,
    resource: governedReviewFixture(),
    mismatched: governedReviewFixture({ subjectHash: HASH_B }),
    etag: '"1"',
    location: null,
  },
  {
    name: 'CMS-03C-07 decision',
    operationId: 'CMS-03C-07',
    params: { reviewId: REVIEW_ID },
    path: `/api/v1/cms/governed-reviews/${REVIEW_ID}/decision`,
    body: {
      reviewId: REVIEW_ID,
      decision: 'approve',
      reason: 'The candidate matches its frozen dependencies.',
      expectedVersion: '2',
    },
    ifMatch: '"2"',
    status: 200,
    resource: decided,
    mismatched: governedReviewFixture({
      id: SUBJECT_ID,
      version: '3',
      state: 'approved',
      recordedDecisionCount: 1,
      decidedAt: LATER,
    }),
    etag: '"3"',
    location: null,
  },
  {
    name: 'CMS-03C-08 assignment create',
    operationId: 'CMS-03C-08',
    params: { reviewId: REVIEW_ID },
    path: `/api/v1/cms/governed-reviews/${REVIEW_ID}/assignments`,
    body: {
      action: 'create',
      expectedVersion: '2',
      reviewerPersonId: REVIEWER_PERSON_ID,
      expiresAt: LATER,
    },
    ifMatch: '"2"',
    status: 201,
    resource: governedAssignmentFixture(),
    mismatched: governedAssignmentFixture({ reviewId: SUBJECT_ID }),
    etag: '"1"',
    location: null,
  },
  {
    name: 'CMS-03C-08 assignment revoke',
    operationId: 'CMS-03C-08',
    params: { reviewId: REVIEW_ID },
    path: `/api/v1/cms/governed-reviews/${REVIEW_ID}/assignments`,
    body: {
      action: 'revoke',
      expectedVersion: '2',
      assignmentId: ASSIGNMENT_ID,
    },
    ifMatch: '"2"',
    status: 200,
    resource: governedAssignmentFixture({ state: 'revoked' }),
    mismatched: governedAssignmentFixture({
      id: SUBJECT_ID,
      state: 'revoked',
    }),
    etag: '"1"',
    location: null,
  },
  {
    name: 'CMS-03C-09 activate',
    operationId: 'CMS-03C-09',
    params: { reviewId: REVIEW_ID },
    path: `/api/v1/cms/governed-reviews/${REVIEW_ID}/activation`,
    body: { action: 'activate', expectedVersion: '2' },
    ifMatch: '"2"',
    status: 200,
    resource: governedActivationFixture(),
    mismatched: governedActivationFixture({ reviewId: SUBJECT_ID }),
    etag: '"3"',
    location: `/api/v1/cms/governed-reviews/${REVIEW_ID}`,
  },
  {
    name: 'CMS-03C-09 schedule',
    operationId: 'CMS-03C-09',
    params: { reviewId: REVIEW_ID },
    path: `/api/v1/cms/governed-reviews/${REVIEW_ID}/activation`,
    body: {
      action: 'schedule',
      expectedVersion: '2',
      activateAt: SCHEDULED_INSTANT,
    },
    ifMatch: '"2"',
    status: 202,
    resource: governedScheduledFixture(),
    mismatched: governedScheduledFixture({
      scheduledForUtc: '2026-12-01T15:00:00Z',
    }),
    etag: '"2"',
    location: `/api/v1/cms/governed-reviews/${REVIEW_ID}`,
  },
  {
    name: 'CMS-03C-09 retire',
    operationId: 'CMS-03C-09',
    params: { reviewId: REVIEW_ID },
    path: `/api/v1/cms/governed-reviews/${REVIEW_ID}/activation`,
    body: {
      action: 'retire',
      expectedVersion: '2',
      reason: 'Superseded by the redesign.',
    },
    ifMatch: '"2"',
    status: 200,
    resource: governedRetiredFixture(),
    mismatched: governedRetiredFixture({ reviewId: SUBJECT_ID }),
    etag: '"3"',
    location: `/api/v1/cms/governed-reviews/${REVIEW_ID}`,
  },
];

export const request = (
  testCase: CommandCase,
  overrides: Readonly<{
    body?: BodyInit;
    headers?: Readonly<Record<string, string | null>>;
    url?: string;
    method?: string;
  }> = {},
): Request => {
  const headers = new Headers({
    cookie: `wj_access=a; wj_csrf=${CSRF}`,
    origin: ORIGIN,
    'x-csrf-token': CSRF,
    'idempotency-key': KEY,
    'content-type': 'application/json',
  });
  if (testCase.ifMatch !== null) headers.set('if-match', testCase.ifMatch);
  for (const [name, value] of Object.entries(overrides.headers ?? {}))
    if (value === null) headers.delete(name);
    else headers.set(name, value);
  return new Request(overrides.url ?? `${ORIGIN}${testCase.path}`, {
    method: overrides.method ?? 'POST',
    headers,
    body: overrides.body ?? JSON.stringify(testCase.body),
  });
};

export const success = (
  testCase: CommandCase,
  overrides: Readonly<{
    status?: number;
    etag?: string | null;
    location?: string | null;
    resource?: unknown;
  }> = {},
): Response => {
  const headers: Record<string, string> = { 'cache-control': 'no-store' };
  const etag = overrides.etag === undefined ? testCase.etag : overrides.etag;
  const location =
    overrides.location === undefined ? testCase.location : overrides.location;
  if (etag !== null) headers.etag = etag;
  if (location !== null) headers.location = location;
  return jsonResponse(
    overrides.status ?? testCase.status,
    overrides.resource ?? testCase.resource,
    headers,
  );
};

export const run = (testCase: CommandCase, req: Request, binding: unknown) =>
  forwardCmsGovernedReviewCommand(
    testCase.operationId,
    req,
    testCase.params,
    binding,
  );

export const catalogError = (
  status: number,
  code: string,
  details: Record<string, unknown> = {},
): Response =>
  jsonResponse(
    status,
    governedApiError(
      code,
      cmsCompositionCatalogMessage('governedReview', code),
      details,
    ),
  );
