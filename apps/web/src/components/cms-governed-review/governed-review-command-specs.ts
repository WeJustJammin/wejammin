import type {
  GovernedDecisionRequest,
  GovernedReviewAssignmentRequest,
  GovernedReviewAssignmentResource,
  GovernedReviewResource,
  GovernedReviewSubmissionRequest,
} from '@wejammin/contracts';
import {
  CMS_HASH_PATTERN,
  isCmsUuid,
  isCmsVersion,
} from '@wejammin/contracts/client';

import type { CmsWorkflowCommandOperationId } from '../cms-editorial-workflow/cms-workflow-command-specs';
import type { GovernedCommandOperation } from './governed-review-reasons';
import { GOVERNED_ROUTE_BASE } from './governed-review-routes';

/**
 * The governed browser commands as one zod-free table (CMS-03C-06 submit, -07
 * decision, -08 assignment; CMS-03C-09 activation has its own spec file that
 * builds on the helpers here; FE03 AC261: an island never ships zod). Requests
 * are built by code from server-verified data, so the table only proves the
 * exact member set; the strict contract check happens in the same-origin proxy,
 * which also verifies every committed resource before it reaches the browser.
 * The browser repeats the identity binding structurally, so a 2xx that is not
 * the answer to THIS request is an unknown outcome and never a guessed success.
 */

export type GovernedCommandIds = Readonly<{ reviewId?: string }>;

/** What a committed review command proves to the form that sent it. */
export type GovernedReviewCommitted = Pick<
  GovernedReviewResource,
  | 'id'
  | 'version'
  | 'state'
  | 'subjectId'
  | 'requiredDecisionCount'
  | 'recordedDecisionCount'
>;
export type GovernedAssignmentCommitted = Pick<
  GovernedReviewAssignmentResource,
  'id' | 'version' | 'state' | 'reviewId' | 'expiresAt'
>;

export interface GovernedCommandSpec<
  TBody,
  TResource extends { readonly version: string },
> {
  readonly operationId: GovernedCommandOperation;
  /**
   * The 03b operation whose fixed refusal copy applies: CMS-03C-07 and -08 are the
   * CMS-03B-06 and CMS-03B-18 contracts applied to a definition review (DEC-137).
   */
  readonly classifyAs: CmsWorkflowCommandOperationId;
  /** Only a submission takes no `If-Match`: it names its subject by id and hash. */
  readonly hasIfMatch: boolean;
  /** The exact request member set and the safe local constraints of each member. */
  readonly requestValid: (body: TBody) => boolean;
  readonly successStatus: (body: TBody) => 200 | 201 | 202;
  /** The structurally verified answer bound to this request, or null. */
  readonly bound: (
    ids: GovernedCommandIds,
    body: TBody,
    resource: unknown,
  ) => TResource | null;
  readonly location: (
    ids: GovernedCommandIds,
    body: TBody,
    resource: TResource,
  ) => string | null;
}

/** The browser path of a command (the BE03c registry row). */
export const governedCommandPath = (
  operation: GovernedCommandOperation,
  ids: GovernedCommandIds,
): string => {
  const base = GOVERNED_ROUTE_BASE;
  if (operation === 'CMS-03C-06') return base;
  const id = encodeURIComponent(ids.reviewId as string);
  if (operation === 'CMS-03C-07') return `${base}/${id}/decision`;
  return operation === 'CMS-03C-09'
    ? `${base}/${id}/activation`
    : `${base}/${id}/assignments`;
};

export const isRecord = (
  value: unknown,
): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const hasExactly = (
  value: object,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean => {
  const keys = Object.keys(value);
  return (
    required.every((key) => keys.includes(key)) &&
    keys.every((key) => required.includes(key) || optional.includes(key))
  );
};

const SUBJECT_KINDS: readonly string[] = [
  'template_version',
  'pattern_version',
  'taxonomy_version',
];
const REVIEW_STATES: readonly string[] = [
  'open',
  'approved',
  'rejected',
  'invalidated',
];
const ASSIGNMENT_STATES: readonly string[] = ['active', 'revoked'];

const asReview = (value: unknown): GovernedReviewCommitted | null =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.version === 'string' &&
  typeof value.state === 'string' &&
  REVIEW_STATES.includes(value.state) &&
  typeof value.subjectId === 'string' &&
  Number.isInteger(value.requiredDecisionCount) &&
  Number.isInteger(value.recordedDecisionCount)
    ? (value as unknown as GovernedReviewCommitted)
    : null;

const SUBMIT: GovernedCommandSpec<
  GovernedReviewSubmissionRequest,
  GovernedReviewCommitted
> = {
  operationId: 'CMS-03C-06',
  classifyAs: 'CMS-03B-05',
  hasIfMatch: false,
  requestValid: (body) =>
    hasExactly(body, ['subjectKind', 'subjectId', 'subjectHash']) &&
    SUBJECT_KINDS.includes(body.subjectKind) &&
    isCmsUuid(body.subjectId) &&
    CMS_HASH_PATTERN.test(body.subjectHash),
  successStatus: () => 201,
  bound: (_ids, body, resource) => {
    const review = asReview(resource);
    const raw = resource as Readonly<Record<string, unknown>>;
    return review !== null &&
      review.state === 'open' &&
      review.version === '1' &&
      review.recordedDecisionCount === 0 &&
      raw.subjectKind === body.subjectKind &&
      raw.subjectId === body.subjectId &&
      raw.subjectHash === body.subjectHash
      ? review
      : null;
  },
  location: () => null,
};

const DECIDE: GovernedCommandSpec<
  GovernedDecisionRequest,
  GovernedReviewCommitted
> = {
  operationId: 'CMS-03C-07',
  classifyAs: 'CMS-03B-06',
  hasIfMatch: true,
  requestValid: (body) =>
    hasExactly(body, ['reviewId', 'decision', 'reason', 'expectedVersion']) &&
    isCmsUuid(body.reviewId) &&
    (body.decision === 'approve' || body.decision === 'reject') &&
    typeof body.reason === 'string' &&
    body.reason.length > 0 &&
    isCmsVersion(body.expectedVersion),
  successStatus: () => 200,
  bound: (ids, body, resource) => {
    const review = asReview(resource);
    // A decision advances the review CAS by exactly one; a rejection ends the review.
    const states =
      body.decision === 'reject' ? ['rejected'] : ['open', 'approved'];
    return review !== null &&
      review.id === ids.reviewId &&
      review.version === String(BigInt(body.expectedVersion) + 1n) &&
      states.includes(review.state) &&
      review.recordedDecisionCount >= 1
      ? review
      : null;
  },
  location: () => null,
};

const asAssignment = (value: unknown): GovernedAssignmentCommitted | null =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.version === 'string' &&
  typeof value.reviewId === 'string' &&
  typeof value.expiresAt === 'string' &&
  typeof value.state === 'string' &&
  ASSIGNMENT_STATES.includes(value.state)
    ? (value as unknown as GovernedAssignmentCommitted)
    : null;

const ASSIGN: GovernedCommandSpec<
  GovernedReviewAssignmentRequest,
  GovernedAssignmentCommitted
> = {
  operationId: 'CMS-03C-08',
  classifyAs: 'CMS-03B-18',
  hasIfMatch: true,
  requestValid: (body) =>
    isCmsVersion(body.expectedVersion) &&
    (body.action === 'create'
      ? hasExactly(
          body,
          ['action', 'expectedVersion', 'reviewerPersonId', 'expiresAt'],
          ['reason'],
        ) &&
        isCmsUuid(body.reviewerPersonId) &&
        typeof body.expiresAt === 'string'
      : body.action === 'revoke' &&
        hasExactly(
          body,
          ['action', 'expectedVersion', 'assignmentId'],
          ['reason'],
        ) &&
        isCmsUuid(body.assignmentId)),
  successStatus: (body) => (body.action === 'create' ? 201 : 200),
  bound: (ids, body, resource) => {
    const assignment = asAssignment(resource);
    if (assignment === null || assignment.reviewId !== ids.reviewId)
      return null;
    return body.action === 'revoke'
      ? assignment.id === body.assignmentId && assignment.state === 'revoked'
        ? assignment
        : null
      : assignment.state === 'active'
        ? assignment
        : null;
  },
  // BE03c row 176 defines no Location; no assignment id enters a URL (AC-272, DEC-239).
  location: () => null,
};

/** The spec of every governed command, by operation id. */
export const GOVERNED_COMMAND_SPECS = {
  'CMS-03C-06': SUBMIT,
  'CMS-03C-07': DECIDE,
  'CMS-03C-08': ASSIGN,
} as const;
