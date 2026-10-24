import { z } from 'zod';

import {
  EditorialDecisionSummarySchema,
  EditorialReviewAssignmentSummarySchema,
} from '../cms-editorial/review-read.ts';
import {
  CmsHashSchema,
  CmsInstantSchema,
  CmsUuidSchema,
  CmsVersionSchema,
} from '../content-schema-registry/primitives.ts';
import { CMS_GOVERNED_SCHEDULE_BLOCK_REASONS } from './governed-activation-job.ts';
import {
  GovernedReviewStateSchema,
  GovernedRiskClassSchema,
  GovernedSubjectKindSchema,
  checkGovernedReview,
  governedReviewBaseShape,
} from './governed-review.ts';
import { CmsDefinitionVersionStateSchema } from './definition-state.ts';

/*
 * CMS-03C-10 governed review detail and CMS-03C-11 queue. Both are safe,
 * no-store reads: no person, actor or party identifier is serialized, a decision
 * reason is visible only to its decider and the assignment list only to the
 * receipt-derived owner (every other reader receives `[]`).
 */

/** CMS-03C-10 addressing: exactly the review UUID. */
export const GovernedReviewDetailPathParamsSchema = z.strictObject({
  reviewId: CmsUuidSchema,
});

/** CMS-03C-10 is addressed entirely by path: any query key is a 400. */
export const GovernedReviewDetailQuerySchema = z.strictObject({});

/** OpenAPI transport view for CMS-03C-10: the path UUID plus the empty strict query. */
export const GovernedReviewDetailApiRequestSchema = z.strictObject({
  reviewId: CmsUuidSchema,
  query: z.strictObject({}),
});

/** The actions a review may offer its reader, derived from role and state. */
export const GovernedNextActionSchema = z.enum([
  'record_decision',
  'assign_reviewer',
  'revoke_assignment',
  'activate',
  'schedule',
  'retire',
]);

/** Safe decision metadata (`id`, `decision`, `capability`, `decidedAt`, `mine`, `reason`). */
export const GovernedDecisionSummarySchema = EditorialDecisionSummarySchema;

/** Owner-only assignment summary with a server-built label, never an identifier. */
export const GovernedAssignmentSummarySchema =
  EditorialReviewAssignmentSummarySchema;

const uniqueBy = <T>(items: readonly T[], key: (item: T) => string): boolean =>
  new Set(items.map(key)).size === items.length;

/** The six states of a `cms_governed_activation_schedules` row (BE03c). */
export const GovernedActivationScheduleStateSchema = z.enum([
  'pending',
  'executing',
  'completed',
  'failed_retryable',
  'blocked',
  'cancelled',
]);

/** The closed `reason_code` vocabulary of a blocked or cancelled schedule (BE03c). */
export const GovernedActivationScheduleReasonSchema = z.enum(
  CMS_GOVERNED_SCHEDULE_BLOCK_REASONS,
);

/**
 * DEC-191: the review's most recent activation schedule as its state and closed
 * reason. `reasonCode` is set exactly when the state is `blocked` or `cancelled`
 * (the table CHECK `(state IN ('blocked','cancelled')) = (reason_code IS NOT NULL)`).
 */
export const GovernedActivationScheduleSummarySchema = z
  .strictObject({
    state: GovernedActivationScheduleStateSchema,
    reasonCode: GovernedActivationScheduleReasonSchema.nullable(),
  })
  .superRefine((value, context) => {
    const closed = value.state === 'blocked' || value.state === 'cancelled';
    if (closed !== (value.reasonCode !== null))
      context.addIssue({
        code: 'custom',
        path: ['reasonCode'],
        message:
          'reasonCode exists exactly for a blocked or cancelled schedule',
      });
  })
  .readonly();

/** `GovernedReviewDetailResource` (CMS-03C-10). */
export const GovernedReviewDetailResourceSchema = z
  .strictObject({
    ...governedReviewBaseShape,
    blockRegistryDigest: CmsHashSchema.nullable(),
    /** One summary per bound content type, sorted by label then policy key. */
    policyBasis: z
      .array(
        z
          .strictObject({
            contentTypeLabel: z.string().min(1).max(120),
            policyKey: z.string().regex(/^[a-z][a-z0-9._-]{0,127}$/u),
            policyVersion: CmsVersionSchema,
          })
          .readonly(),
      )
      .max(64)
      .readonly(),
    /** Distinct humans who still qualify (live recount), never above the approvals. */
    distinctApprovalCount: z.number().int().min(0).max(8),
    decisions: z.array(GovernedDecisionSummarySchema).max(8).readonly(),
    /** Owner-only; every other reader receives []. */
    assignments: z
      .array(GovernedAssignmentSummarySchema)
      .max(32)
      .readonly()
      .default([]),
    myAssignment: z
      .strictObject({ assignmentId: CmsUuidSchema, endsAt: CmsInstantSchema })
      .readonly()
      .nullable(),
    subjectState: CmsDefinitionVersionStateSchema,
    permittedNextActions: z
      .array(GovernedNextActionSchema)
      .max(6)
      .refine((actions) => uniqueBy(actions, String), 'actions_must_be_unique')
      .readonly(),
    /** DEC-191: the most recent activation schedule of this review, or null when it has none. */
    activationSchedule: GovernedActivationScheduleSummarySchema.nullable(),
  })
  .superRefine((value, context) => {
    checkGovernedReview(value, context);
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

const queueQueryShape = {
  cursor: z.string().max(512).nullable().optional(),
  limit: z.number().int().min(1).max(50).default(25),
  scope: z.enum(['assigned', 'submitted', 'owned']).default('assigned'),
  state: GovernedReviewStateSchema.optional(),
  subjectKind: GovernedSubjectKindSchema.optional(),
} as const;

/**
 * `GovernedReviewQueueQuery` (CMS-03C-11): the signed keyset cursor, the 1-50
 * page size defaulting to 25, the `assigned` (default), `submitted` or `owned`
 * scope and the closed state and subject-kind filters. The caller's identity
 * and acting scope are never part of the query: the server derives them.
 */
export const GovernedReviewQueueQuerySchema = z.strictObject(queueQueryShape);

/** OpenAPI transport view for CMS-03C-11: the allowlisted query keys, no path. */
export const GovernedReviewQueueApiRequestSchema = z.strictObject({
  query: z.strictObject(queueQueryShape),
});

/** One review of the caller's scope, identifier-free. */
export const GovernedReviewQueueItemSchema = z
  .strictObject({
    reviewId: CmsUuidSchema,
    subjectKind: GovernedSubjectKindSchema,
    subjectKey: z
      .string()
      .regex(/^[a-z][a-z0-9-]{1,63}$/u, 'subject_key_invalid'),
    subjectVersion: z.number().int().positive(),
    state: GovernedReviewStateSchema,
    riskClass: GovernedRiskClassSchema,
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

/** True when `next` sorts strictly after `previous` in (updatedAt DESC, reviewId DESC). */
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

/** `GovernedReviewQueuePage`: at most 50 rows in keyset order, one opaque cursor. */
export const GovernedReviewQueuePageSchema = z
  .strictObject({
    items: z.array(GovernedReviewQueueItemSchema).max(50).readonly(),
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

export type GovernedReviewDetailResource = z.infer<
  typeof GovernedReviewDetailResourceSchema
>;
export type GovernedActivationScheduleSummary = z.infer<
  typeof GovernedActivationScheduleSummarySchema
>;
export type GovernedReviewQueueQuery = z.infer<
  typeof GovernedReviewQueueQuerySchema
>;
export type GovernedReviewQueueItem = z.infer<
  typeof GovernedReviewQueueItemSchema
>;
export type GovernedReviewQueuePage = z.infer<
  typeof GovernedReviewQueuePageSchema
>;
