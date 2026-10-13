import { z } from 'zod';

import {
  CmsCapabilityKeySchema,
  CmsInstantSchema,
  CmsUuidSchema,
  CmsVersionSchema,
} from '../content-schema-registry/primitives.ts';
import { SchemaReviewAssignmentSummarySchema } from '../content-schema-registry/resources-review-assignments.ts';
import { Bcp47Schema } from './primitives.ts';
import { DecisionReasonSchema } from './publication-contracts.ts';
import {
  FrozenCandidateSchema,
  checkEditorialReviewFrozen,
  editorialReviewBaseShape,
} from './review-resources.ts';
import {
  EditorialDecisionKindSchema,
  EditorialReviewStateSchema,
  ReviewNextActionSchema,
  ReviewQueueScopeSchema,
  WorkflowRiskClassSchema,
} from './workflow-models.ts';

/*
 * BE03b CMS-03B-16 review detail and CMS-03B-17 reviewer queue. Both are safe,
 * no-store reads: no person, actor or party identifier is serialized, a decision
 * reason is visible only to its decider, and the assignment list only to the
 * receipt-derived owner.
 */

/** BE03b CMS-03B-16 addressing: exactly the review UUID. */
export const EditorialReviewDetailPathParamsSchema = z
  .strictObject({ reviewId: CmsUuidSchema })
  .readonly();

/** CMS-03B-16 is addressed entirely by path: any query key is a 400. */
export const EditorialReviewDetailQuerySchema = z.strictObject({}).readonly();

/** OpenAPI transport view for CMS-03B-16: the path UUID plus the empty strict query. */
export const EditorialReviewDetailApiRequestSchema = z.strictObject({
  reviewId: CmsUuidSchema,
  query: z.strictObject({}),
});

/**
 * BE03b `EditorialDecisionSummary`: safe decision metadata. `capability` is the
 * satisfied slot (server-derived at decision time) and `reason` is non-null only
 * on the caller's own decision (`mine`). The decider's identity is never listed.
 */
export const EditorialDecisionSummarySchema = z
  .strictObject({
    id: CmsUuidSchema,
    decision: EditorialDecisionKindSchema,
    capability: CmsCapabilityKeySchema,
    decidedAt: CmsInstantSchema,
    mine: z.boolean(),
    reason: DecisionReasonSchema.nullable(),
  })
  .superRefine((value, context) => {
    if (value.reason !== null && !value.mine)
      context.addIssue({
        code: 'custom',
        path: ['reason'],
        message: 'a decision reason is visible only to its decider',
      });
  })
  .readonly();

/**
 * BE03b `EditorialReviewAssignmentSummary`: owner-only, with a server-built
 * display label and never an identifier. It has the exact shape of the 03a
 * schema-review assignment summary (DEC-136 mirrors CMS-03A-14), so the two
 * share one definition.
 */
export const EditorialReviewAssignmentSummarySchema =
  SchemaReviewAssignmentSummarySchema;

const uniqueBy = <T>(items: readonly T[], key: (item: T) => string): boolean =>
  new Set(items.map(key)).size === items.length;

/** BE03b `EditorialReviewDetailResource` (CMS-03B-16). */
export const EditorialReviewDetailResourceSchema = z
  .strictObject({
    ...editorialReviewBaseShape,
    revisionNumber: CmsVersionSchema,
    locale: Bcp47Schema,
    contentTypeLabel: z.string().min(1).max(120),
    frozen: FrozenCandidateSchema,
    /** Distinct humans who still qualify (live recount), never above the approvals. */
    distinctApprovalCount: z.number().int().min(0).max(8),
    decisions: z.array(EditorialDecisionSummarySchema).max(8).readonly(),
    /** Owner-only; every other reader receives []. No person, actor or party id. */
    assignments: z
      .array(EditorialReviewAssignmentSummarySchema)
      .max(32)
      .readonly()
      .default([]),
    myAssignment: z
      .strictObject({ assignmentId: CmsUuidSchema, endsAt: CmsInstantSchema })
      .readonly()
      .nullable(),
    permittedNextActions: z
      .array(ReviewNextActionSchema)
      .max(5)
      .refine((actions) => uniqueBy(actions, String), 'actions_must_be_unique')
      .readonly(),
  })
  .superRefine((value, context) => {
    checkEditorialReviewFrozen(value, context);
    const approvals = value.decisions.filter(
      (decision) => decision.decision === 'approve',
    ).length;
    if (value.distinctApprovalCount > approvals)
      context.addIssue({
        code: 'custom',
        path: ['distinctApprovalCount'],
        message: 'distinctApprovalCount cannot exceed the approve decisions',
      });
    if (value.decisions.length !== value.recordedDecisionCount)
      context.addIssue({
        code: 'custom',
        path: ['decisions'],
        message: 'one decision row exists per recorded decision',
      });
    if (!uniqueBy(value.decisions, (decision) => decision.id))
      context.addIssue({
        code: 'custom',
        path: ['decisions'],
        message: 'decision ids must be unique',
      });
    if (value.decisions.filter((decision) => decision.mine).length > 1)
      context.addIssue({
        code: 'custom',
        path: ['decisions'],
        message: 'one human records at most one decision per review',
      });
    if (!uniqueBy(value.assignments, (assignment) => assignment.assignmentId))
      context.addIssue({
        code: 'custom',
        path: ['assignments'],
        message: 'assignment ids must be unique',
      });
  })
  .readonly();

/**
 * BE03b `ReviewQueueQuery` (CMS-03B-17): the signed keyset cursor, the 1-50 page
 * size defaulting to 25, the `assigned` (default) or `submitted` scope and the
 * closed review state filter. The caller's identity and acting scope are never
 * part of the query: the server derives them.
 */
export const ReviewQueueQuerySchema = z
  .strictObject({
    cursor: z.string().max(512).nullable().optional(),
    limit: z.number().int().min(1).max(50).default(25),
    scope: ReviewQueueScopeSchema.default('assigned'),
    state: EditorialReviewStateSchema.optional(),
  })
  .readonly();

/** OpenAPI transport view for CMS-03B-17: the allowlisted query keys, no path. */
export const ReviewQueueApiRequestSchema = z.strictObject({
  query: z.strictObject({
    cursor: z.string().max(512).nullable().optional(),
    limit: z.number().int().min(1).max(50).default(25),
    scope: ReviewQueueScopeSchema.default('assigned'),
    state: EditorialReviewStateSchema.optional(),
  }),
});

/** BE03b `ReviewQueueItem`: one review of the caller's scope, identifier-free. */
export const ReviewQueueItemSchema = z
  .strictObject({
    reviewId: CmsUuidSchema,
    entryId: CmsUuidSchema,
    revisionId: CmsUuidSchema,
    revisionNumber: CmsVersionSchema,
    locale: Bcp47Schema,
    contentTypeLabel: z.string().min(1).max(120),
    state: EditorialReviewStateSchema,
    riskClass: WorkflowRiskClassSchema,
    requiredDecisionCount: z.number().int().min(1).max(8),
    recordedDecisionCount: z.number().int().min(0).max(8),
    myDecision: z.enum(['none', 'approve', 'reject']),
    /** The caller's active assignment end for scope `assigned`, else null. */
    assignmentEndsAt: CmsInstantSchema.nullable(),
    submittedAt: CmsInstantSchema,
    updatedAt: CmsInstantSchema,
  })
  .superRefine((value, context) => {
    if (value.recordedDecisionCount > value.requiredDecisionCount)
      context.addIssue({
        code: 'custom',
        path: ['recordedDecisionCount'],
        message: 'Recorded decisions cannot exceed required decisions',
      });
    if (value.riskClass === 'protected' && value.requiredDecisionCount < 2)
      context.addIssue({
        code: 'custom',
        path: ['requiredDecisionCount'],
        message: 'Protected review requires at least two decisions',
      });
  })
  .readonly();

/** True when `left` sorts strictly before `right` in (updatedAt DESC, reviewId DESC). */
const followsInKeysetOrder = (
  previous: { updatedAt: string; reviewId: string },
  next: { updatedAt: string; reviewId: string },
): boolean => {
  const previousMs = Date.parse(previous.updatedAt);
  const nextMs = Date.parse(next.updatedAt);
  return (
    nextMs < previousMs ||
    (nextMs === previousMs && next.reviewId < previous.reviewId)
  );
};

/** BE03b `ReviewQueuePage`: at most 50 rows in keyset order, one opaque cursor. */
export const ReviewQueuePageSchema = z
  .strictObject({
    items: z.array(ReviewQueueItemSchema).max(50).readonly(),
    nextCursor: z.string().max(512).nullable(),
    pageVersion: CmsVersionSchema,
  })
  .superRefine((value, context) => {
    for (let index = 1; index < value.items.length; index += 1) {
      const previous = value.items[index - 1];
      const next = value.items[index];
      if (
        previous !== undefined &&
        next !== undefined &&
        !followsInKeysetOrder(previous, next)
      ) {
        context.addIssue({
          code: 'custom',
          path: ['items', index],
          message:
            'items follow the (updatedAt DESC, reviewId DESC) keyset order',
        });
        break;
      }
    }
  })
  .readonly();

export type EditorialDecisionSummary = z.infer<
  typeof EditorialDecisionSummarySchema
>;
export type EditorialReviewAssignmentSummary = z.infer<
  typeof EditorialReviewAssignmentSummarySchema
>;
export type EditorialReviewDetailResource = z.infer<
  typeof EditorialReviewDetailResourceSchema
>;
export type ReviewQueueQuery = z.infer<typeof ReviewQueueQuerySchema>;
export type ReviewQueueItem = z.infer<typeof ReviewQueueItemSchema>;
export type ReviewQueuePage = z.infer<typeof ReviewQueuePageSchema>;
