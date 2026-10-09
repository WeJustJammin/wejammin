import type { EditorialReviewDetailResource } from '@wejammin/contracts';
import * as React from 'react';

import CmsEditorialDecisionForm from './CmsEditorialDecisionForm';
import CmsEditorialReviewAssignmentForm from './CmsEditorialReviewAssignmentForm';
import CmsEditorialReviewDetail from './CmsEditorialReviewDetail';
import CmsWorkflowClosedState from './CmsWorkflowClosedState';
import {
  readCanonicalReview,
  type CanonicalReadResult,
} from './cms-workflow-canonical-read';
import { disabledActionCopy } from './cms-workflow-labels';
import type { ReviewerOptionsResult } from './cms-workflow-reviewer-options';
import { useCanonicalResource } from './use-cms-workflow-canonical';
import type { WorkflowCommandEnvironment } from './use-cms-workflow-command';

export interface CmsEditorialReviewDetailIslandInit {
  readonly review: EditorialReviewDetailResource;
  readonly reviewId: string;
  /** When the server verified `review`: the first `lastVerifiedAt`. */
  readonly verifiedAt: string;
}

export interface CmsEditorialReviewDetailIslandProps {
  readonly init: CmsEditorialReviewDetailIslandInit;
  /** Seams for a test. */
  readonly readReview?: () => Promise<
    CanonicalReadResult<EditorialReviewDetailResource>
  >;
  readonly loadOptions?: () => Promise<ReviewerOptionsResult>;
  readonly environment?: WorkflowCommandEnvironment;
}

const UNVERIFIED =
  'The last read could not be verified. Commands are off until it is.';

const focusHeading = (headingId: string): void => {
  document.getElementById(headingId)?.focus();
};

/**
 * The CMS-03B-16 surface: the immutable review evidence and, beside it, the
 * decision form (only with `record_decision`) and the owner's assignment
 * controls (only with `assign_reviewer` or `revoke_assignment`). The review is
 * only ever replaced by a later verified read; a failed read keeps the last
 * verified review with the forms off, and a vanished review removes the data.
 */
export default function CmsEditorialReviewDetailIsland({
  init,
  readReview = () => readCanonicalReview(init.reviewId),
  loadOptions,
  environment,
}: CmsEditorialReviewDetailIslandProps): React.ReactElement {
  const canonical = useCanonicalResource(
    init.review,
    init.verifiedAt,
    readReview,
  );
  const { data: review, status, refetch } = canonical;
  if (review === null)
    return (
      <CmsWorkflowClosedState
        kind={status === 'gone' ? 'gone' : 'signed-out'}
      />
    );

  const degraded = status === 'degraded';
  const disabledReason = degraded ? UNVERIFIED : null;
  const permitted = new Set(review.permittedNextActions);
  const shared = {
    disabledReason,
    refetch,
    onDone: focusHeading,
    ...(environment === undefined ? {} : { environment }),
  };
  return (
    <div>
      <CmsEditorialReviewDetail
        review={review}
        degradedSince={degraded ? canonical.lastVerifiedAt : null}
      />
      <section aria-labelledby="review-actions-title">
        <h2 id="review-actions-title" tabIndex={-1}>
          Actions
        </h2>
        {review.state === 'open' && !permitted.has('record_decision') ? (
          <p>{disabledActionCopy('record_decision')}</p>
        ) : null}
        {permitted.has('record_decision') ? (
          <CmsEditorialDecisionForm {...shared} review={review} />
        ) : null}
        {permitted.has('assign_reviewer') ||
        permitted.has('revoke_assignment') ? (
          <CmsEditorialReviewAssignmentForm
            {...shared}
            review={review}
            {...(loadOptions === undefined ? {} : { loadOptions })}
          />
        ) : null}
      </section>
    </div>
  );
}
