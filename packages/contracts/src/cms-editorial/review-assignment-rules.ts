/**
 * Zod-free rules of the CMS-03B-18 reviewer assignment (BE03b, DEC-136).
 *
 * The assignment form bounds the expiry it offers and the command table maps an
 * action to its success status without shipping zod. `review-assignment.ts`
 * re-exports these names, so the contract barrel is unchanged.
 */

/** BE03b: a review accepts at most sixteen active assignments (409 `assignment_limit`). */
export const CMS_REVIEW_ASSIGNMENT_MAX_ACTIVE = 16;
/** BE03b: an assignment expires within seven days of creation. */
export const CMS_REVIEW_ASSIGNMENT_MAX_SECONDS = 7 * 24 * 60 * 60;

/** BE03b: create is 201 with `Location`, revoke is 200. */
export const reviewAssignmentSuccessStatus = (
  action: 'create' | 'revoke',
): 200 | 201 => (action === 'create' ? 201 : 200);

/**
 * BE03b: `expiresAt` is after now, at most seven days after now, no later than
 * the end of the reviewer's `cms.reviewer` grant day and no later than the
 * grantor authority end. This is the ceiling (milliseconds) every layer applies.
 */
export const cmsReviewAssignmentExpiryCeiling = (
  nowMs: number,
  reviewerGrantEndMs: number,
  grantorAuthorityEndMs: number,
): number =>
  Math.min(
    nowMs + CMS_REVIEW_ASSIGNMENT_MAX_SECONDS * 1_000,
    reviewerGrantEndMs,
    grantorAuthorityEndMs,
  );
