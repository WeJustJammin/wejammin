import { z } from 'zod';

import {
  CmsInstantSchema,
  CmsUuidSchema,
  CmsVersionSchema,
} from '../content-schema-registry/primitives.ts';
import {
  IdempotencyKeySchema,
  QuotedVersionSchema,
} from '../request-navigation-security.ts';
import { refineIfMatchEqualsExpectedVersion } from './if-match.ts';
import { entryRevisionResourceMetaShape } from './models.ts';
import { ReviewAssignmentStateSchema } from './workflow-models.ts';

/*
 * BE03b CMS-03B-18 reviewer assignment (DEC-136), mirroring the 03a
 * CMS-03A-14 schema-review assignment. Only the receipt-derived owner holding
 * the non-grantable `cms.editorial_review.assign` creates or revokes an
 * assignment; it confers `read` and `decide` on one frozen review and nothing
 * else. Ownership, the grantor, the reviewer capability and the MFA instant are
 * server-derived, so none is a request member.
 */

/** BE03b: a review accepts at most sixteen active assignments (409 `assignment_limit`). */
export const CMS_REVIEW_ASSIGNMENT_MAX_ACTIVE = 16;
/** BE03b: an assignment expires within seven days of creation. */
export const CMS_REVIEW_ASSIGNMENT_MAX_SECONDS = 7 * 24 * 60 * 60;
const REASON_MAX_CHARACTERS = 256;

/**
 * BE03b assignment `reason`: 1-256 Unicode characters (code points, never UTF-16
 * units), already NFC. A non-NFC reason is refused rather than normalized, so the
 * audited reason is exactly what the owner submitted.
 */
export const ReviewAssignmentReasonSchema = z
  .string()
  .min(1)
  .max(REASON_MAX_CHARACTERS * 2)
  .refine(
    (value) => Array.from(value).length <= REASON_MAX_CHARACTERS,
    'reason_too_long',
  )
  .refine((value) => value === value.normalize('NFC'), 'reason_must_be_nfc')
  .meta({
    minLength: 1,
    maxLength: REASON_MAX_CHARACTERS,
    'x-unicode-normalization': 'NFC',
  });

/**
 * BE03b `EditorialReviewAssignmentRequest`: a discriminated `create` or
 * `revoke`. Both carry the review `expectedVersion` (the strong `If-Match`
 * operand); neither advances the review `version`.
 */
export const EditorialReviewAssignmentRequestSchema = z
  .discriminatedUnion('action', [
    z
      .strictObject({
        action: z.literal('create'),
        expectedVersion: CmsVersionSchema,
        reviewerPersonId: CmsUuidSchema,
        expiresAt: CmsInstantSchema,
        reason: ReviewAssignmentReasonSchema.optional(),
      })
      .readonly(),
    z
      .strictObject({
        action: z.literal('revoke'),
        expectedVersion: CmsVersionSchema,
        assignmentId: CmsUuidSchema,
        reason: ReviewAssignmentReasonSchema.optional(),
      })
      .readonly(),
  ])
  .readonly();

/** BE03b CMS-03B-18 addressing: the review receiving the assignment change. */
export const EditorialReviewAssignmentPathParamsSchema = z
  .strictObject({ reviewId: CmsUuidSchema })
  .readonly();

/** BE03b CMS-03B-18 headers: key + the exact strong review-version If-Match. */
export const CmsEditorialReviewAssignmentHeadersSchema = z
  .strictObject({
    contentType: z.literal('application/json'),
    idempotencyKey: IdempotencyKeySchema,
    ifMatch: QuotedVersionSchema,
  })
  .readonly();

/** OpenAPI transport view for CMS-03B-18: the review path, headers and body. */
export const EditorialReviewAssignmentApiRequestSchema = z
  .strictObject({
    reviewId: CmsUuidSchema,
    headers: CmsEditorialReviewAssignmentHeadersSchema,
    body: EditorialReviewAssignmentRequestSchema,
  })
  .superRefine(refineIfMatchEqualsExpectedVersion);

/** BE03b: create is 201 with `Location`, revoke is 200. */
export const reviewAssignmentSuccessStatus = (
  action: 'create' | 'revoke',
): 200 | 201 => (action === 'create' ? 201 : 200);

/**
 * BE03b `EditorialReviewAssignmentResource` (CMS-03B-18). The window is at most
 * seven days; the reviewer and grantor identities never leave the server.
 */
export const EditorialReviewAssignmentResourceSchema = z
  .strictObject({
    ...entryRevisionResourceMetaShape,
    reviewId: CmsUuidSchema,
    state: ReviewAssignmentStateSchema,
    capability: z.literal('cms.editorial_review'),
    actions: z.tuple([z.literal('read'), z.literal('decide')]).readonly(),
    startsAt: CmsInstantSchema,
    expiresAt: CmsInstantSchema,
    reason: ReviewAssignmentReasonSchema.nullable(),
  })
  .superRefine((value, context) => {
    const span = Date.parse(value.expiresAt) - Date.parse(value.startsAt);
    if (!(span > 0 && span <= CMS_REVIEW_ASSIGNMENT_MAX_SECONDS * 1_000))
      context.addIssue({
        code: 'custom',
        path: ['expiresAt'],
        message: 'an assignment window is positive and at most seven days',
      });
  })
  .readonly();

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

export type EditorialReviewAssignmentRequest = z.infer<
  typeof EditorialReviewAssignmentRequestSchema
>;
export type EditorialReviewAssignmentResource = z.infer<
  typeof EditorialReviewAssignmentResourceSchema
>;
