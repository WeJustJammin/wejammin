import { z } from 'zod';

import { refineIfMatchEqualsExpectedVersion } from '../cms-editorial/if-match.ts';
import { DecisionReasonSchema } from '../cms-editorial/publication-contracts.ts';
import { EditorialDecisionKindSchema } from '../cms-editorial/workflow-models.ts';
import {
  CmsUuidSchema,
  CmsVersionSchema,
} from '../content-schema-registry/primitives.ts';
import {
  IdempotencyKeySchema,
  QuotedVersionSchema,
} from '../request-navigation-security.ts';

/*
 * CMS-03C-07 governed decision, the 03b CMS-03B-06 contract applied to a
 * definition review (DEC-137). `capability` and `stepUpAt` are deliberately not
 * members: the satisfied reviewer slot and the recent-MFA instant are
 * server-derived, so either one in a body is an unknown key (422).
 */

/** CMS-03C-07 body: the decision reason is the 03b `SafeText` grammar (1-2000 code points). */
export const GovernedDecisionRequestSchema = z.strictObject({
  reviewId: CmsUuidSchema,
  decision: EditorialDecisionKindSchema,
  reason: DecisionReasonSchema,
  /** The review `version`; the strong `If-Match` equals it exactly. */
  expectedVersion: CmsVersionSchema,
});

/** CMS-03C-07 headers: key + the exact strong review-version If-Match. */
export const GovernedDecisionHeadersSchema = z.strictObject({
  contentType: z.literal('application/json'),
  idempotencyKey: IdempotencyKeySchema,
  ifMatch: QuotedVersionSchema,
});

/**
 * CMS-03C-07 OpenAPI transport view: the review path, headers and body. The
 * path `reviewId` equals the body `reviewId`, and the `If-Match` operand equals
 * `expectedVersion`; each fault is reported once, at the member that owns it.
 */
export const GovernedDecisionApiRequestSchema = z
  .strictObject({
    reviewId: CmsUuidSchema,
    headers: GovernedDecisionHeadersSchema,
    body: GovernedDecisionRequestSchema,
  })
  .superRefine((value, context) => {
    refineIfMatchEqualsExpectedVersion(value, context);
    if (value.reviewId.toLowerCase() !== value.body.reviewId.toLowerCase())
      context.addIssue({
        code: 'custom',
        path: ['body', 'reviewId'],
        message: 'review_id_path_body_mismatch',
      });
  });

export type GovernedDecisionRequest = z.infer<
  typeof GovernedDecisionRequestSchema
>;
export type GovernedDecisionHeaders = z.infer<
  typeof GovernedDecisionHeadersSchema
>;
