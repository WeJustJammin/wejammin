import { z } from 'zod';

import { refineIfMatchEqualsExpectedVersion } from '../cms-editorial/if-match.ts';
import {
  CMS_REVIEW_ASSIGNMENT_MAX_SECONDS,
  reviewAssignmentSuccessStatus,
} from '../cms-editorial/review-assignment-rules.ts';
import {
  CmsEditorialReviewAssignmentHeadersSchema,
  EditorialReviewAssignmentRequestSchema,
  ReviewAssignmentReasonSchema,
} from '../cms-editorial/review-assignment.ts';
import { ReviewAssignmentStateSchema } from '../cms-editorial/workflow-models.ts';
import {
  CmsInstantSchema,
  CmsUuidSchema,
} from '../content-schema-registry/primitives.ts';
import { resourceMetaShape } from '../content-schema-registry/resources-meta.ts';

/*
 * CMS-03C-08 governed reviewer assignment (DEC-137): the CMS-03B-18 grammar and
 * bounds applied to a definition review with the owner-only, non-grantable
 * `cms.definition_review.assign`. The request, the headers and the 201/200
 * status rule are the 03b definitions (one source, no copy to drift); the
 * resource differs in its capability literal. Reviewer and grantor identities
 * never leave the server.
 */

/** The capability an assignment confers: `read` and `decide` on one frozen review. */
export const CMS_GOVERNED_ASSIGNMENT_CAPABILITY = 'cms.definition_review';

/** `create` (with `reviewerPersonId` and `expiresAt`) or `revoke` (with `assignmentId`). */
export const GovernedReviewAssignmentRequestSchema =
  EditorialReviewAssignmentRequestSchema;

/** Headers: key + the exact strong review-version If-Match. */
export const GovernedReviewAssignmentHeadersSchema =
  CmsEditorialReviewAssignmentHeadersSchema;

/** OpenAPI transport view: the review path, headers and body. */
export const GovernedReviewAssignmentApiRequestSchema = z
  .strictObject({
    reviewId: CmsUuidSchema,
    headers: GovernedReviewAssignmentHeadersSchema,
    body: GovernedReviewAssignmentRequestSchema,
  })
  .superRefine(refineIfMatchEqualsExpectedVersion);

/** Create is 201 with `Location`, revoke is 200. */
export const governedAssignmentSuccessStatus = reviewAssignmentSuccessStatus;

/** `GovernedReviewAssignmentResource`; the window is positive and at most seven days. */
export const GovernedReviewAssignmentResourceSchema = z
  .strictObject({
    ...resourceMetaShape,
    reviewId: CmsUuidSchema,
    state: ReviewAssignmentStateSchema,
    capability: z.literal(CMS_GOVERNED_ASSIGNMENT_CAPABILITY),
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

export type GovernedReviewAssignmentRequest = z.infer<
  typeof GovernedReviewAssignmentRequestSchema
>;
export type GovernedReviewAssignmentResource = z.infer<
  typeof GovernedReviewAssignmentResourceSchema
>;
