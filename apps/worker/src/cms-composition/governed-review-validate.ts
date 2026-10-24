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
 * Response binding: a success body is trusted only when it parses strictly AND answers
 * this very request. A body that parses but names another review, version or filter is
 * a response-contract failure (local 502), never rendered to the browser.
 */

/** A new review is `open` at version 1 with no decision, outcome or activation (BE03c 1502). */
export const validGovernedSubmission = (
  value: unknown,
  body: GovernedReviewSubmissionRequest,
): value is GovernedReviewResource => {
  const parsed = GovernedReviewResourceSchema.safeParse(value);
  if (!parsed.success) return false;
  const review = parsed.data;
  return (
    review.state === 'open' &&
    review.version === '1' &&
    review.recordedDecisionCount === 0 &&
    review.decidedAt === null &&
    review.activatedAt === null &&
    review.subjectKind === body.subjectKind &&
    review.subjectId === body.subjectId &&
    review.subjectHash === body.subjectHash
  );
};

/**
 * A recorded decision advances the review CAS by exactly one (BE03c 215) and leaves it
 * open (more decisions required), approved or - for a rejection, which ends the review
 * - rejected. An invalidation is a committed refusal, never this success.
 */
export const validGovernedDecision = (
  value: unknown,
  reviewId: string,
  body: GovernedDecisionRequest,
): value is GovernedReviewResource => {
  const parsed = GovernedReviewResourceSchema.safeParse(value);
  if (!parsed.success) return false;
  const review = parsed.data;
  const states: readonly string[] =
    body.decision === 'reject' ? ['rejected'] : ['open', 'approved'];
  return (
    review.id === reviewId &&
    review.version === String(BigInt(body.expectedVersion) + 1n) &&
    states.includes(review.state) &&
    review.recordedDecisionCount >= 1
  );
};

const INSTANT_TOLERANCE_MS = 1;

/** An assignment create/revoke names its review and the assignment it created or revoked. */
export const validGovernedAssignment = (
  value: unknown,
  reviewId: string,
  body: GovernedReviewAssignmentRequest,
): value is GovernedReviewAssignmentResource => {
  const parsed = GovernedReviewAssignmentResourceSchema.safeParse(value);
  if (!parsed.success) return false;
  const assignment = parsed.data;
  if (assignment.reviewId !== reviewId) return false;
  if (body.action === 'revoke')
    return (
      assignment.id === body.assignmentId && assignment.state === 'revoked'
    );
  // `timestamptz` keeps microseconds: the stored expiry equals the requested one to the ms.
  return (
    assignment.state === 'active' &&
    Math.abs(Date.parse(assignment.expiresAt) - Date.parse(body.expiresAt)) <=
      INSTANT_TOLERANCE_MS &&
    assignment.reason === (body.reason ?? null)
  );
};

/**
 * The command left the subject in the state it asked for. `activate` advances the review CAS by
 * exactly one (BE03c 215 lists an activation among the version-advancing events); an accepted
 * `schedule` leaves it unchanged and names the instant the Worker verified (the column keeps
 * microseconds, so the compare is to the ms). `retire` (DEC-190) advances it by exactly one, like an
 * activation (root ruling: CMS-03C-10's strong ETag is the review `version` while its body exposes
 * `subjectState` and `permittedNextActions`, so a transition that changes them must change the
 * version; BE03c 215 counts an activation among the version-advancing events).
 */
export const validGovernedActivation = (
  value: unknown,
  reviewId: string,
  body: GovernedActivationRequest,
): value is GovernedActivationResource => {
  const parsed = GovernedActivationResourceSchema.safeParse(value);
  if (!parsed.success) return false;
  const resource = parsed.data;
  if (resource.reviewId !== reviewId || resource.action !== body.action)
    return false;
  if (body.action === 'schedule')
    return (
      resource.reviewVersion === body.expectedVersion &&
      resource.scheduledForUtc !== null &&
      Math.abs(
        Date.parse(resource.scheduledForUtc) -
          Date.parse(body.activateAt.resolvedUtc),
      ) <= INSTANT_TOLERANCE_MS
    );
  const advanced = String(BigInt(body.expectedVersion) + 1n);
  if (body.action === 'retire')
    return (
      resource.subjectState === 'retired' && resource.reviewVersion === advanced
    );
  return resource.reviewVersion === advanced;
};

export const validGovernedDetail = (
  value: unknown,
  reviewId: string,
): value is GovernedReviewDetailResource => {
  const parsed = GovernedReviewDetailResourceSchema.safeParse(value);
  return parsed.success && parsed.data.id === reviewId;
};

/** The page honours the request: at most `limit` unique rows, only the asked filters. */
export const validGovernedPage = (
  value: unknown,
  query: GovernedReviewQueueQuery,
): value is GovernedReviewQueuePage => {
  const parsed = GovernedReviewQueuePageSchema.safeParse(value);
  if (!parsed.success) return false;
  const page = parsed.data;
  return (
    page.nextCursor !== '' &&
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
  );
};
