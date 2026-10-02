import * as React from 'react';

import ContentSchemaRegistryReviewAssignmentForm from './ContentSchemaRegistryReviewAssignmentForm';
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
  readonly requestId: string;
  readonly csrfToken: string;
  readonly idempotencyKey: (operationId: string) => string;
  readonly actingContextLabel?: string | undefined;
  readonly stepUpState: ContentSchemaRegistryStepUpState;
  readonly stepUpFreshUntil?: string | undefined;
}

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
  const candidateUrl =
    review === null || reviewOnly
      ? undefined
      : `/app/cms-content-modeling/${encodeURIComponent(review.contentTypeId)}/versions/${encodeURIComponent(review.contentTypeVersionId)}`;
  return (
    <ContentSchemaRegistryReviewPanel
      state={state}
      retryUrl={props.retryUrl}
      requestId={props.requestId}
      candidateUrl={candidateUrl}
      decisionReferences
    >
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
    </ContentSchemaRegistryReviewPanel>
  );
}
