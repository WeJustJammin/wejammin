import {
  GovernedActivationResourceSchema,
  GovernedReviewAssignmentResourceSchema,
  GovernedReviewDetailResourceSchema,
  GovernedReviewQueuePageSchema,
  GovernedReviewResourceSchema,
  type GovernedActivationRequest,
  type GovernedActivationResource,
  type GovernedDecisionRequest,
  type GovernedReviewAssignmentRequest,
  type GovernedReviewAssignmentResource,
  type GovernedReviewDetailResource,
  type GovernedReviewQueuePage,
  type GovernedReviewQueueQuery,
  type GovernedReviewResource,
  type GovernedReviewSubmissionRequest,
} from '@wejammin/contracts';

/**
 * Response binding at the web boundary: a success body is relayed only when it
 * parses strictly AND answers this very request. A body that parses but names
 * another review, version or filter is a response-contract failure, never
 * rendered. Each verifier returns the parsed value or null (BE03c 1502).
 */

/** A new review is `open` at version 1 with no decision, outcome or activation. */
export const boundGovernedSubmission = (
  value: unknown,
  body: GovernedReviewSubmissionRequest,
): GovernedReviewResource | null => {
  const parsed = GovernedReviewResourceSchema.safeParse(value);
  if (!parsed.success) return null;
  const review = parsed.data;
  return review.state === 'open' &&
    review.version === '1' &&
    review.recordedDecisionCount === 0 &&
    review.decidedAt === null &&
    review.activatedAt === null &&
    review.subjectKind === body.subjectKind &&
    review.subjectId === body.subjectId &&
    review.subjectHash === body.subjectHash
    ? review
    : null;
};

/**
 * A recorded decision advances the review CAS by exactly one and leaves it open,
 * approved or, for a rejection (which ends the review), rejected.
 */
export const boundGovernedDecision = (
  value: unknown,
  reviewId: string,
  body: GovernedDecisionRequest,
): GovernedReviewResource | null => {
  const parsed = GovernedReviewResourceSchema.safeParse(value);
  if (!parsed.success) return null;
  const review = parsed.data;
  const states: readonly string[] =
    body.decision === 'reject' ? ['rejected'] : ['open', 'approved'];
  return review.id === reviewId &&
    review.version === String(BigInt(body.expectedVersion) + 1n) &&
    states.includes(review.state) &&
    review.recordedDecisionCount >= 1
    ? review
    : null;
};

const INSTANT_TOLERANCE_MS = 1;

/** An assignment create or revoke names its review and the assignment it made or revoked. */
export const boundGovernedAssignment = (
  value: unknown,
  reviewId: string,
  body: GovernedReviewAssignmentRequest,
): GovernedReviewAssignmentResource | null => {
  const parsed = GovernedReviewAssignmentResourceSchema.safeParse(value);
  if (!parsed.success || parsed.data.reviewId !== reviewId) return null;
  const assignment = parsed.data;
  if (body.action === 'revoke')
    return assignment.id === body.assignmentId && assignment.state === 'revoked'
      ? assignment
      : null;
  // `timestamptz` keeps microseconds: the stored expiry equals the requested one to the ms.
  return assignment.state === 'active' &&
    Math.abs(Date.parse(assignment.expiresAt) - Date.parse(body.expiresAt)) <=
      INSTANT_TOLERANCE_MS &&
    assignment.reason === (body.reason ?? null)
    ? assignment
    : null;
};

/**
 * CMS-03C-09 answers the review it was addressed to, for the action it was sent
 * (BE03c 1326). An activation and a retirement advance the review `version` by
 * exactly one (the new ETag); a scheduled acceptance leaves it unchanged and
 * stores the instant the Time authority resolved, to the millisecond.
 */
export const boundGovernedActivation = (
  value: unknown,
  reviewId: string,
  body: GovernedActivationRequest,
): GovernedActivationResource | null => {
  const parsed = GovernedActivationResourceSchema.safeParse(value);
  if (!parsed.success) return null;
  const result = parsed.data;
  if (result.reviewId !== reviewId || result.action !== body.action)
    return null;
  if (body.action === 'schedule')
    return result.reviewVersion === body.expectedVersion &&
      result.scheduledForUtc !== null &&
      Math.abs(
        Date.parse(result.scheduledForUtc) -
          Date.parse(body.activateAt.resolvedUtc),
      ) <= INSTANT_TOLERANCE_MS
      ? result
      : null;
  return result.reviewVersion === String(BigInt(body.expectedVersion) + 1n)
    ? result
    : null;
};

export const boundGovernedDetail = (
  value: unknown,
  reviewId: string,
): GovernedReviewDetailResource | null => {
  const parsed = GovernedReviewDetailResourceSchema.safeParse(value);
  return parsed.success && parsed.data.id === reviewId ? parsed.data : null;
};

/** The page honours the request: at most `limit` unique rows, only the asked filters. */
export const boundGovernedPage = (
  value: unknown,
  query: GovernedReviewQueueQuery,
): GovernedReviewQueuePage | null => {
  const parsed = GovernedReviewQueuePageSchema.safeParse(value);
  if (!parsed.success) return null;
  const page = parsed.data;
  return page.nextCursor !== '' &&
    page.items.length <= query.limit &&
    new Set(page.items.map((item) => item.reviewId)).size ===
      page.items.length &&
    page.items.every(
      (item) =>
        (query.state === undefined || item.state === query.state) &&
        (query.subjectKind === undefined ||
          item.subjectKind === query.subjectKind) &&
        (query.scope === 'assigned' || item.assignmentEndsAt === null),
    )
    ? page
    : null;
};
