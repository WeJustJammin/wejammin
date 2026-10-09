import { z } from 'zod';

/*
 * BE03b closed vocabularies for the Slice 11 review, schedule, preview and
 * publication resources. Every browser-visible state is one of these exact
 * enums (BE03b "Browser-envelope tests ... exact EditorialReviewState,
 * PublicationScheduleState, PublicationState ... mappings"), and no resource
 * carries an ownership or authority identifier beside them.
 */

/** BE03b `EditorialReviewState`: `rejected` and `invalidated` are terminal. */
export const EditorialReviewStateSchema = z.enum([
  'open',
  'approved',
  'rejected',
  'invalidated',
]);

/** BE03b `PublicationScheduleState`: `completed`, `blocked`, `cancelled` are terminal. */
export const PublicationScheduleStateSchema = z.enum([
  'pending',
  'executing',
  'completed',
  'failed_retryable',
  'blocked',
  'cancelled',
]);

/**
 * BE03b `PublicationState` (E3): physical rows are `active` or `revoked`;
 * `superseded` is derived for an `active` row that is no longer the head of its
 * lineage. Projection convergence is `projectionState`, never a state.
 */
export const PublicationStateSchema = z.enum([
  'active',
  'superseded',
  'revoked',
]);

/** BE03b publication action vocabulary, shared by schedule and publication rows. */
export const PublicationActionSchema = z.enum([
  'publish',
  'unpublish',
  'expire',
  'archive',
]);

/** BE03b editorial risk class: derived from the frozen workflow-policy evidence. */
export const WorkflowRiskClassSchema = z.enum(['ordinary', 'protected']);

/** BE03b `projectionState` (E3): Shard 04 convergence of one lineage row. */
export const PublicationProjectionStateSchema = z.enum([
  'pending',
  'converged',
  'degraded',
]);

/** BE03b Review invalidation: exactly one of these four closed reasons. */
export const ReviewInvalidatedReasonSchema = z.enum([
  'revision_superseded',
  'dependency_changed',
  'reviewer_authority_changed',
  'entry_unavailable',
]);

/**
 * BE03b Schedule execution: the closed `reasonCode` set of a `blocked` or
 * `cancelled` schedule. `entry_unavailable` cancels, the other five block or
 * (for `approval_invalidated`) cancel on invalidation.
 */
export const ScheduleReasonCodeSchema = z.enum([
  'approval_invalidated',
  'preflight_failed',
  'publisher_authority_ended',
  'publication_not_active',
  'retries_exhausted',
  'entry_unavailable',
]);

/** BE03b `EditorialReviewAssignment` state: an expired window stays `active` and inert. */
export const ReviewAssignmentStateSchema = z.enum(['active', 'revoked']);

/** BE03b CMS-03B-17 `scope`: the two listing scopes, never a hidden population. */
export const ReviewQueueScopeSchema = z.enum(['assigned', 'submitted']);

/** BE03b `disambiguation` for a schedule's local time (Time authority, E8). */
export const ScheduleDisambiguationSchema = z.enum([
  'none',
  'earlier',
  'later',
]);

/** BE03b `WorkflowNextAction`: the actions CMS-03B-15 may offer for the revision. */
export const WorkflowNextActionSchema = z.enum([
  'submit_review',
  'assign_reviewer',
  'record_decision',
  'schedule',
  'preview',
  'publish',
]);

/** BE03b `ReviewNextAction`: the actions CMS-03B-16 may offer on a review. */
export const ReviewNextActionSchema = z.enum([
  'record_decision',
  'assign_reviewer',
  'revoke_assignment',
  'schedule',
  'publish',
]);

/** BE03b decision vocabulary: the whole `decision` member of CMS-03B-06. */
export const EditorialDecisionKindSchema = z.enum(['approve', 'reject']);

export type EditorialReviewState = z.infer<typeof EditorialReviewStateSchema>;
export type PublicationScheduleState = z.infer<
  typeof PublicationScheduleStateSchema
>;
export type PublicationState = z.infer<typeof PublicationStateSchema>;
export type PublicationAction = z.infer<typeof PublicationActionSchema>;
export type WorkflowRiskClass = z.infer<typeof WorkflowRiskClassSchema>;
export type PublicationProjectionState = z.infer<
  typeof PublicationProjectionStateSchema
>;
export type ReviewInvalidatedReason = z.infer<
  typeof ReviewInvalidatedReasonSchema
>;
export type ScheduleReasonCode = z.infer<typeof ScheduleReasonCodeSchema>;
export type ReviewQueueScope = z.infer<typeof ReviewQueueScopeSchema>;
export type ScheduleDisambiguation = z.infer<
  typeof ScheduleDisambiguationSchema
>;
export type WorkflowNextAction = z.infer<typeof WorkflowNextActionSchema>;
export type ReviewNextAction = z.infer<typeof ReviewNextActionSchema>;
