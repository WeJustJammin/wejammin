import { SchemaReviewAssignmentRequestSchema } from '@wejammin/contracts';

/** FE03 reviewer-selection copy (CMS-03A-14 create). */
export const ASSIGNMENT_HELPER =
  'Enter the person ID exactly as the reviewer gave it to you. The reviewer must be an existing person; the assignment gives read and decide access to this one review for at most seven days.';
export const REVIEWER_INVALID = "Enter the reviewer's person ID as a UUID.";
export const EXPIRY_FORMAT_INVALID =
  'Enter the expiry as a UTC instant, for example 2026-10-05T12:00:00.000Z.';
export const EXPIRY_BOUND_INVALID =
  'The expiry must be in the future and no more than seven days from now.';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export interface AssignmentFields {
  readonly expectedVersion: string;
  readonly reviewerPersonId: string;
  readonly expiresAt: string;
  readonly reason: string;
}

export interface AssignmentErrors {
  readonly reviewerPersonId: string | null;
  readonly expiresAt: string | null;
}

const create = (fields: AssignmentFields) => ({
  action: 'create' as const,
  expectedVersion: fields.expectedVersion,
  reviewerPersonId: fields.reviewerPersonId,
  expiresAt: fields.expiresAt,
  ...(fields.reason.trim() === '' ? {} : { reason: fields.reason }),
});

export const reviewerError = (fields: AssignmentFields): string | null => {
  const parsed = SchemaReviewAssignmentRequestSchema.safeParse(create(fields));
  return parsed.success ||
    !parsed.error.issues.some((issue) => issue.path[0] === 'reviewerPersonId')
    ? null
    : REVIEWER_INVALID;
};

/** The Zod instant shape plus the BE03a bound: future and at most 7 days. */
export const expiryError = (
  fields: AssignmentFields,
  now: number,
): string | null => {
  const parsed = SchemaReviewAssignmentRequestSchema.safeParse(create(fields));
  if (
    !parsed.success &&
    parsed.error.issues.some((issue) => issue.path[0] === 'expiresAt')
  )
    return EXPIRY_FORMAT_INVALID;
  const at = Date.parse(fields.expiresAt);
  return Number.isFinite(at) && at > now && at - now <= SEVEN_DAYS_MS
    ? null
    : EXPIRY_BOUND_INVALID;
};

export const validateAssignment = (
  fields: AssignmentFields,
  now: number,
): AssignmentErrors => ({
  reviewerPersonId: reviewerError(fields),
  expiresAt: expiryError(fields, now),
});
