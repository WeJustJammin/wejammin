import {
  GovernedDecisionApiRequestSchema,
  GovernedReviewAssignmentApiRequestSchema,
  GovernedReviewAssignmentResourceSchema,
  GovernedReviewDetailResourceSchema,
  GovernedReviewQueuePageSchema,
  type GovernedReviewAssignmentResource,
  type GovernedReviewDetailResource,
  type GovernedReviewQueuePage,
  type GovernedReviewResource,
} from '@wejammin/contracts';

import { expect } from 'vitest';

import type { CmsEditorialSession } from '../cms-editorial/types';
import {
  HASH,
  ORIGIN,
  PARTY_ID,
  PATH,
  REQUEST_ID,
  REVIEW_ID,
  reviewResource,
  USER_ID,
} from './governed-review-submit.test-support';

import {
  governedHarness,
  jsonReply,
} from './governed-review-submit.test-support';

export {
  expectError,
  governedHarness,
  jsonReply,
  sqlRefusal,
} from './governed-review-submit.test-support';
export { ORIGIN, PARTY_ID, PATH, REQUEST_ID, REVIEW_ID, USER_ID };

export const ASSIGNMENT_ID = 'd1200000-0000-4000-8000-000000000201';
export const REVIEWER_PERSON_ID = 'd1200000-0000-4000-8000-000000000202';
export const DECISION_ID = 'd1200000-0000-4000-8000-000000000203';
export const OTHER_REVIEW_ID = 'd1200000-0000-4000-8000-000000000204';
export const KEY = 'governed-command-0001';
/** `now` of the harness is 1,000 ms: this proof is 1 s old (inside -30 s..+600 s). */
export const FRESH_STEP_UP = new Date(0).toISOString();
/** 701 s old: outside the DEC-111 window. */
export const STALE_STEP_UP = new Date(-700_000).toISOString();

export const reviewerSession: CmsEditorialSession = {
  userId: USER_ID,
  actingPartyId: PARTY_ID,
  capabilities: ['cms.reviewer'],
  mfaFresh: false,
};
/** An owner holds `cms.definition_review.assign` by receipt, never as a session capability. */
export const ownerSession: CmsEditorialSession = {
  ...reviewerSession,
  capabilities: ['cms.template_designer'],
};

type Init = { headers?: Record<string, string | null>; raw?: string };

const requestWith = (
  method: 'GET' | 'POST',
  url: string,
  body: unknown,
  defaults: Record<string, string>,
  init: Init,
): Request => {
  const headers = new Headers(defaults);
  for (const [name, value] of Object.entries(init.headers ?? {}))
    if (value === null) headers.delete(name);
    else headers.set(name, value);
  return new Request(url, {
    method,
    headers,
    ...(method === 'GET' ? {} : { body: init.raw ?? JSON.stringify(body) }),
  });
};

const base = { origin: ORIGIN, 'x-request-id': REQUEST_ID };
const command = {
  ...base,
  'content-type': 'application/json',
  'idempotency-key': KEY,
};

export const decisionPath = (reviewId = REVIEW_ID): string =>
  `https://api.example.test${PATH}/${reviewId}/decision`;
export const assignmentPath = (reviewId = REVIEW_ID): string =>
  `https://api.example.test${PATH}/${reviewId}/assignments`;
export const detailPath = (reviewId = REVIEW_ID): string =>
  `https://api.example.test${PATH}/${reviewId}`;

export const decisionBody = (overrides: Record<string, unknown> = {}) => ({
  reviewId: REVIEW_ID,
  decision: 'approve',
  reason: 'Meets the template review checklist.',
  expectedVersion: '3',
  ...overrides,
});
export const decisionRequest = (
  body: unknown = decisionBody(),
  init: Init = {},
  url = decisionPath(),
): Request =>
  requestWith('POST', url, body, { ...command, 'if-match': '"3"' }, init);

export const createBody = (overrides: Record<string, unknown> = {}) => ({
  action: 'create',
  expectedVersion: '3',
  reviewerPersonId: REVIEWER_PERSON_ID,
  expiresAt: '2026-10-15T00:00:00Z',
  reason: 'Primary reviewer.',
  ...overrides,
});
export const revokeBody = (overrides: Record<string, unknown> = {}) => ({
  action: 'revoke',
  expectedVersion: '3',
  assignmentId: ASSIGNMENT_ID,
  ...overrides,
});
export const assignmentRequest = (
  body: unknown = createBody(),
  init: Init = {},
  url = assignmentPath(),
): Request =>
  requestWith('POST', url, body, { ...command, 'if-match': '"3"' }, init);

export const detailRequest = (init: Init = {}, url = detailPath()): Request =>
  requestWith('GET', url, undefined, base, init);
export const queueRequest = (
  query: Record<string, string> | string = {},
  init: Init = {},
): Request => {
  const search =
    typeof query === 'string' ? query : new URLSearchParams(query).toString();
  return requestWith(
    'GET',
    `https://api.example.test${PATH}${search === '' ? '' : `?${search}`}`,
    undefined,
    base,
    init,
  );
};

/** Valid fixtures: asserted against the frozen transport schemas, never trusted blindly. */
export const assertDecisionContract = (body: unknown): void => {
  const parsed = GovernedDecisionApiRequestSchema.safeParse({
    reviewId: REVIEW_ID,
    headers: {
      contentType: 'application/json',
      idempotencyKey: KEY,
      ifMatch: '"3"',
    },
    body,
  });
  if (!parsed.success) throw new Error('decision fixture violates contract');
};
export const assertAssignmentContract = (body: unknown): void => {
  const parsed = GovernedReviewAssignmentApiRequestSchema.safeParse({
    reviewId: REVIEW_ID,
    headers: {
      contentType: 'application/json',
      idempotencyKey: KEY,
      ifMatch: '"3"',
    },
    body,
  });
  if (!parsed.success) throw new Error('assignment fixture violates contract');
};

/** The review after a decision: CAS version + 1, decided exactly when approved or rejected. */
export const decidedReview = (
  state: 'open' | 'approved' | 'rejected' = 'approved',
  overrides: Record<string, unknown> = {},
): GovernedReviewResource =>
  reviewResource('template_version', {
    version: '4',
    state,
    recordedDecisionCount: 1,
    requiredDecisionCount: state === 'open' ? 2 : 1,
    decidedAt: state === 'open' ? null : '2026-10-14T00:00:05Z',
    updatedAt: '2026-10-14T00:00:05Z',
    ...overrides,
  });

export const assignmentResource = (
  overrides: Record<string, unknown> = {},
): GovernedReviewAssignmentResource =>
  GovernedReviewAssignmentResourceSchema.parse({
    id: ASSIGNMENT_ID,
    version: '1',
    contentHash: 'a'.repeat(64),
    createdAt: '2026-10-14T00:00:00Z',
    updatedAt: '2026-10-14T00:00:00Z',
    reviewId: REVIEW_ID,
    state: 'active',
    capability: 'cms.definition_review',
    actions: ['read', 'decide'],
    startsAt: '2026-10-14T00:00:00Z',
    expiresAt: '2026-10-15T00:00:00Z',
    reason: 'Primary reviewer.',
    ...overrides,
  });

export const detailResource = (
  overrides: Record<string, unknown> = {},
): GovernedReviewDetailResource => {
  return GovernedReviewDetailResourceSchema.parse({
    ...reviewResource(),
    blockRegistryDigest: HASH,
    policyBasis: [],
    distinctApprovalCount: 0,
    decisions: [],
    assignments: [],
    myAssignment: null,
    subjectState: 'review',
    permittedNextActions: ['record_decision'],
    activationSchedule: null,
    ...overrides,
  });
};

export const queueItem = (
  index = 1,
  overrides: Record<string, unknown> = {},
) => ({
  reviewId: `d1200000-0000-4000-8000-0000000003${String(index).padStart(2, '0')}`,
  subjectKind: 'template_version',
  subjectKey: 'profile-header',
  subjectVersion: 2,
  state: 'open',
  riskClass: 'ordinary',
  requiredDecisionCount: 1,
  recordedDecisionCount: 0,
  myDecision: 'none',
  assignmentEndsAt: '2026-10-15T00:00:00Z',
  submittedAt: '2026-10-14T00:00:00Z',
  updatedAt: `2026-10-14T00:00:${String(60 - index).padStart(2, '0')}Z`,
  ...overrides,
});
export const queuePage = (
  items: readonly Record<string, unknown>[] = [queueItem(1), queueItem(2)],
  overrides: Record<string, unknown> = {},
): GovernedReviewQueuePage =>
  GovernedReviewQueuePageSchema.parse({
    items,
    nextCursor: null,
    pageVersion: '7',
    ...overrides,
  });

type HarnessOptions = Parameters<typeof governedHarness>[0];

/** A reviewer with a fresh MFA proof; the RPC answers `reply` unless an option overrides it. */
export const reviewerHarness = (
  options: HarnessOptions = {},
  reply: () => Promise<Response> = () => jsonReply(decidedReview()),
) =>
  governedHarness({
    session: reviewerSession,
    stepUpAt: FRESH_STEP_UP,
    reply,
    ...options,
  });

/** An owner with a fresh MFA proof. */
export const ownerHarness = (
  options: HarnessOptions = {},
  reply: () => Promise<Response> = () => jsonReply(assignmentResource()),
) =>
  governedHarness({
    session: ownerSession,
    stepUpAt: FRESH_STEP_UP,
    reply,
    ...options,
  });

/** A refusal before admission burns no quota and reaches no dependency. */
export const expectNoWork = (
  harness: ReturnType<typeof governedHarness>,
): void => {
  expect(harness.rateLimit).not.toHaveBeenCalled();
  expect(harness.fetchImpl).not.toHaveBeenCalled();
};

/** A copy of `value` without `key`: a request body missing one member. */
export const without = <T extends object, K extends keyof T>(
  value: T,
  key: K,
): Omit<T, K> => {
  const copy = { ...value };
  delete copy[key];
  return copy;
};
