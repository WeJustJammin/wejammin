import { z } from 'zod';

import {
  CmsInstantSchema,
  CmsUuidSchema,
  CmsVersionSchema,
} from './primitives.ts';
import { CmsSchemaReviewAssignmentStateSchema } from './models-enums.ts';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const UUID_TEXT =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

/**
 * Owner-only safe summary of one reviewer assignment on a review. It carries
 * the assignment id and version the owner needs to revoke (CMS-03A-14) and a
 * server-built display label. It never carries the reviewer's person, actor
 * or party identifier, and the label is never an identifier.
 */
export const SchemaReviewAssignmentSummarySchema = z
  .strictObject({
    assignmentId: CmsUuidSchema,
    version: CmsVersionSchema,
    state: CmsSchemaReviewAssignmentStateSchema,
    startsAt: CmsInstantSchema,
    endsAt: CmsInstantSchema,
    reviewerLabel: z
      .string()
      .min(1)
      .max(120)
      .refine((value) => value.trim().length > 0, 'label_must_not_be_blank')
      .refine((value) => !UUID_TEXT.test(value.trim()), 'label_is_not_an_id'),
  })
  .superRefine((value, context) => {
    const span = Date.parse(value.endsAt) - Date.parse(value.startsAt);
    if (!(span > 0 && span <= SEVEN_DAYS_MS))
      context.addIssue({
        code: 'custom',
        path: ['endsAt'],
        message: 'assignment_span_must_be_positive_and_at_most_seven_days',
      });
  })
  .readonly();

export type SchemaReviewAssignmentSummary = z.infer<
  typeof SchemaReviewAssignmentSummarySchema
>;
