import type {
  ContentSchemaRegistryReviewState,
  SchemaActivationPreparation,
  SchemaReviewResource,
} from './content-schema-registry-types';

/**
 * Pure FE03 `activationPreparation` mapping. `permittedNextActions` is the
 * only readiness expression: a control renders only when the server lists its
 * action, and a prefilled identifier comes only from server state.
 */

export type NextAction =
  SchemaActivationPreparation['permittedNextActions'][number];

export const SCHEMA_REVIEWS_ROUTE = '/app/cms-content-modeling/schema-reviews';

export const hasNextAction = (
  preparation: SchemaActivationPreparation,
  action: NextAction,
): boolean => preparation.permittedNextActions.includes(action);

/** The sealed, passed dry run id; a job state alone never qualifies. */
export const sealedPassedDryRunId = (
  preparation: SchemaActivationPreparation,
): string | null => {
  const dryRun = preparation.dryRunRef;
  return dryRun !== null &&
    dryRun.state === 'completed' &&
    dryRun.result === 'passed'
    ? dryRun.id
    : null;
};

/** Submit-review needs the action AND a sealed passed dry run (FE03). */
export const submitReviewDryRunId = (
  preparation: SchemaActivationPreparation,
): string | null =>
  hasNextAction(preparation, 'submit_review')
    ? sealedPassedDryRunId(preparation)
    : null;

export interface ActivationInputs {
  readonly dryRunId: string;
  readonly approvalIds: readonly string[];
}

/** The approved review that is available to read, if any. */
export const approvedReview = (
  review: ContentSchemaRegistryReviewState | null | undefined,
): SchemaReviewResource | null =>
  review?.status === 'success' && review.data.state === 'approved'
    ? review.data
    : null;

/**
 * Activation prefill (G8): the approve-decision ids of exactly one approved
 * review, in recorded order. The user never types JSON or identifiers.
 */
export const activationInputs = (
  preparation: SchemaActivationPreparation,
  review: ContentSchemaRegistryReviewState | null | undefined,
): ActivationInputs | null => {
  if (!hasNextAction(preparation, 'activate')) return null;
  const approved = approvedReview(review);
  const dryRunId = sealedPassedDryRunId(preparation);
  if (
    approved === null ||
    dryRunId === null ||
    approved.id !== preparation.reviewRef?.id
  )
    return null;
  const approvalIds = approved.decisions
    .filter((decision) => decision.decision === 'approve')
    .map((decision) => decision.id);
  return approvalIds.length === 0 ? null : { dryRunId, approvalIds };
};

export const reviewRouteFor = (reviewId: string): string =>
  `${SCHEMA_REVIEWS_ROUTE}/${encodeURIComponent(reviewId)}`;
