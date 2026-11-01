import {
  activatedResource,
  activationRequest,
} from './governed-activation.test-support';
import {
  assignmentRequest,
  assignmentResource,
  decidedReview,
  decisionRequest,
  detailRequest,
  detailResource,
  FRESH_STEP_UP,
  governedHarness,
  jsonReply,
  ownerSession,
  queuePage,
  queueRequest,
  reviewerSession,
} from './governed-review-ops.test-support';
import { designerSession } from './governed-review-submit.test-support';

type Harness = Parameters<typeof governedHarness>[0];

/** One row per Phase 2 operation: how to call it, what a valid answer is, who may. */
export type OperationRow = Readonly<{
  id: 'CMS-03C-07' | 'CMS-03C-08' | 'CMS-03C-09' | 'CMS-03C-10' | 'CMS-03C-11';
  rpc: string;
  status: 200 | 201;
  rateClass: string;
  limits: readonly [number, number];
  deadlineMs: number;
  request: () => Request;
  valid: () => unknown;
  /** A refusal the operation documents, for tests that need any caller refusal. */
  refusal: Readonly<{ token: string; status: number }>;
  harness: (options?: Harness) => ReturnType<typeof governedHarness>;
}>;

const withReply = (
  base: Harness,
  valid: () => unknown,
  options: Harness,
): Harness => ({
  ...base,
  reply: () => jsonReply(valid()),
  ...options,
});

const reviewer: Harness = { session: reviewerSession, stepUpAt: FRESH_STEP_UP };
const owner: Harness = { session: ownerSession, stepUpAt: FRESH_STEP_UP };
const designer: Harness = { session: designerSession, stepUpAt: FRESH_STEP_UP };

export const OPERATIONS: readonly OperationRow[] = [
  {
    id: 'CMS-03C-07',
    rpc: 'cms_record_governed_decision',
    status: 200,
    rateClass: 'cms-governed-decision',
    limits: [30, 60],
    deadlineMs: 15_000,
    request: () => decisionRequest(),
    valid: () => decidedReview(),
    refusal: { token: 'NOT_FOUND', status: 404 },
    harness: (options = {}) =>
      governedHarness(withReply(reviewer, () => decidedReview(), options)),
  },
  {
    id: 'CMS-03C-08',
    rpc: 'cms_assign_governed_reviewer',
    status: 201,
    rateClass: 'cms-governed-assignment',
    limits: [10, 20],
    deadlineMs: 15_000,
    request: () => assignmentRequest(),
    valid: () => assignmentResource(),
    refusal: { token: 'NOT_FOUND', status: 404 },
    harness: (options = {}) =>
      governedHarness(withReply(owner, () => assignmentResource(), options)),
  },
  {
    id: 'CMS-03C-09',
    rpc: 'cms_activate_governed_subject',
    status: 200,
    rateClass: 'cms-governed-activation',
    limits: [20, 40],
    deadlineMs: 15_000,
    request: () => activationRequest(),
    valid: () => activatedResource(),
    refusal: { token: 'NOT_FOUND', status: 404 },
    harness: (options = {}) =>
      governedHarness(withReply(designer, () => activatedResource(), options)),
  },
  {
    id: 'CMS-03C-10',
    rpc: 'cms_get_governed_review',
    status: 200,
    rateClass: 'cms-governed-review-read',
    limits: [300, 600],
    deadlineMs: 8_000,
    request: () => detailRequest(),
    valid: () => detailResource(),
    refusal: { token: 'NOT_FOUND', status: 404 },
    harness: (options = {}) =>
      governedHarness(
        withReply(
          { session: reviewerSession },
          () => detailResource(),
          options,
        ),
      ),
  },
  {
    id: 'CMS-03C-11',
    rpc: 'cms_list_governed_reviews',
    status: 200,
    rateClass: 'cms-governed-review-read',
    limits: [300, 600],
    deadlineMs: 8_000,
    request: () => queueRequest(),
    valid: () => queuePage(),
    refusal: { token: 'INVALID_REQUEST', status: 400 },
    harness: (options = {}) =>
      governedHarness(
        withReply({ session: reviewerSession }, () => queuePage(), options),
      ),
  },
];

export const COMMANDS = OPERATIONS.filter(
  (row) =>
    row.id === 'CMS-03C-07' ||
    row.id === 'CMS-03C-08' ||
    row.id === 'CMS-03C-09',
);

/** BE03c 1298-1302: a PostgREST or PostgreSQL fault is never the caller's refusal. */
export const PROVIDER_FAULTS: readonly (readonly [string, number, unknown])[] =
  [
    ['PGRST202 function not found', 404, { code: 'PGRST202', message: 'x' }],
    [
      'PGRST301 bad service credential',
      401,
      { code: 'PGRST301', message: 'x' },
    ],
    ['SQLSTATE 42702', 400, { code: '42702', message: 'ambiguous private' }],
    ['SQLSTATE 42501', 403, { code: '42501' }],
    [
      'SQLSTATE 40001 engine serialization',
      409,
      { code: '40001', message: 'could not serialize access' },
    ],
    ['no code', 404, { message: 'NOT_FOUND' }],
    ['unsupported 4xx', 418, { code: 'PGRST999' }],
    ['array payload', 400, ['NOT_FOUND']],
    ['string payload', 404, 'NOT_FOUND'],
  ];
