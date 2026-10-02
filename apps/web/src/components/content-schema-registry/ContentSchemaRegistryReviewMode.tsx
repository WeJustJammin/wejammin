import * as React from 'react';

import ContentSchemaRegistryReviewAssignmentForm from './ContentSchemaRegistryReviewAssignmentForm';
import ContentSchemaRegistryReviewAssignments from './ContentSchemaRegistryReviewAssignments';
import ContentSchemaRegistryReviewDecisionForm from './ContentSchemaRegistryReviewDecisionForm';
import ContentSchemaRegistryReviewPanel from './ContentSchemaRegistryReviewPanel';
import { reviewRouteFor } from './content-schema-registry-version-actions';
import type { ContentSchemaRegistryStepUpState } from './ContentSchemaRegistryConfirmationStep';
import type {
  ContentSchemaRegistryAccess,
  ContentSchemaRegistryReviewState,
  ContentSchemaRegistryVariant,
} from './content-schema-registry-types';

export interface ContentSchemaRegistryReviewModeProps {
  readonly reviewId: string;
  readonly state: ContentSchemaRegistryReviewState | null;
  readonly variant: ContentSchemaRegistryVariant;
  readonly access: ContentSchemaRegistryAccess;
  readonly retryUrl: string;
  readonly supportReference: string;
  readonly csrfToken: string;
  readonly idempotencyKey: (operationId: string) => string;
  readonly actingContextLabel?: string | undefined;
  readonly stepUpState: ContentSchemaRegistryStepUpState;
  readonly stepUpFreshUntil?: string | undefined;
}

const decisionPrerequisiteCopy = (
  state: 'open' | 'approved' | 'rejected' | 'invalidated',
): string =>
  state === 'open'
    ? 'You cannot record a decision on this review: your assignment to decide it is missing or has ended.'
    : `Decisions are recorded only while a review is open; this review is ${state}.`;

/**
 * The protected review route (CMS-03A-13). It renders the exact review and,
 * only when the server's per-review `permittedNextActions` allow, the decision
 * form (assigned reviewer) or the assignment form (owner). It never links to a
 * registry list or version a review-only reader could not read.
 */
export default function ContentSchemaRegistryReviewMode(
  props: ContentSchemaRegistryReviewModeProps,
): React.ReactElement {
  const { state, variant, access, reviewId } = props;
  const review = state?.status === 'success' ? state.data : null;
  const action = reviewRouteFor(reviewId);
  const reviewOnly = variant === 'schemaReviewAssigned';
  const permitted = (name: 'record_decision' | 'assign_reviewer'): boolean =>
    review !== null &&
    review.state === 'open' &&
    review.permittedNextActions.includes(name);
  const owner = variant === 'ownerFull' && access === 'full';
  // FE03 reviewState `disabled`: a reviewer without the decision form is told
  // which prerequisite is missing, from what the server already disclosed.
  const decisionPrerequisite =
    reviewOnly && review !== null && !permitted('record_decision')
      ? decisionPrerequisiteCopy(review.state)
      : null;
  const candidateUrl =
    review === null || reviewOnly
      ? undefined
      : `/app/cms-content-modeling/${encodeURIComponent(review.contentTypeId)}/versions/${encodeURIComponent(review.contentTypeVersionId)}`;
  return (
    <ContentSchemaRegistryReviewPanel
      state={state}
      retryUrl={props.retryUrl}
      supportReference={props.supportReference}
      candidateUrl={candidateUrl}
      decisionReferences
    >
      {decisionPrerequisite === null ? null : (
        <p data-decision-prerequisite="true">{decisionPrerequisite}</p>
      )}
      {review !== null && permitted('record_decision') ? (
        <ContentSchemaRegistryReviewDecisionForm
          action={action}
          reviewId={reviewId}
          expectedVersion={review.version}
          csrfToken={props.csrfToken}
          idempotencyKey={props.idempotencyKey('CMS-03A-12')}
          stepUpState={props.stepUpState}
          stepUpFreshUntil={props.stepUpFreshUntil}
          actingContextLabel={props.actingContextLabel}
        />
      ) : null}
      {review !== null && owner && permitted('assign_reviewer') ? (
        <ContentSchemaRegistryReviewAssignmentForm
          action={action}
          reviewId={reviewId}
          expectedVersion={review.version}
          csrfToken={props.csrfToken}
          idempotencyKey={props.idempotencyKey('CMS-03A-14')}
        />
      ) : null}
      {review !== null && owner && permitted('assign_reviewer') ? (
        <ContentSchemaRegistryReviewAssignments
          action={action}
          reviewId={reviewId}
          expectedVersion={review.version}
          csrfToken={props.csrfToken}
          idempotencyKey={props.idempotencyKey('CMS-03A-14')}
          assignments={review.assignments}
        />
      ) : null}
    </ContentSchemaRegistryReviewPanel>
  );
}
