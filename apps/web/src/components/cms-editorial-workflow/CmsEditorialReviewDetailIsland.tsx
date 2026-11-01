import type { EditorialReviewDetailResource } from '@wejammin/contracts';
import * as React from 'react';

import CmsEditorialReviewDetail from './CmsEditorialReviewDetail';
import CmsWorkflowClosedState from './CmsWorkflowClosedState';
import CmsWorkflowRateLimitNotice from './CmsWorkflowRateLimitNotice';
import CmsWorkflowStatusRegion from './CmsWorkflowStatusRegion';
import {
  readCanonicalReview,
  type CanonicalReadResult,
} from './cms-workflow-canonical-read';
import {
  DecisionFormView,
  ReviewAssignmentFormView,
} from './cms-review-form-views';
import { disabledActionCopy } from './cms-workflow-labels';
import type { ReviewerOptionsResult } from './cms-workflow-reviewer-options';
import { useCanonicalResource } from './use-cms-workflow-canonical';
import type { WorkflowCommandEnvironment } from './use-cms-workflow-command';
import {
  WorkflowAnnouncerContext,
  useIslandConfirmation,
} from './use-cms-workflow-status';

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
  const confirmation = useIslandConfirmation();
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
    <WorkflowAnnouncerContext.Provider value={confirmation.announcer}>
      <div>
        <CmsEditorialReviewDetail
          review={review}
          degradedSince={degraded ? canonical.lastVerifiedAt : null}
        />
        <section aria-labelledby="review-actions-title">
          <h2 id="review-actions-title" tabIndex={-1}>
            Actions
          </h2>
          <CmsWorkflowStatusRegion text={confirmation.text} />
          <CmsWorkflowRateLimitNotice rateLimit={canonical.rateLimit} />
          {review.state === 'open' && !permitted.has('record_decision') ? (
            <p>{disabledActionCopy('record_decision')}</p>
          ) : null}
          {permitted.has('record_decision') ? (
            <React.Suspense fallback={null}>
              <DecisionFormView {...shared} review={review} />
            </React.Suspense>
          ) : null}
          {permitted.has('assign_reviewer') ||
          permitted.has('revoke_assignment') ? (
            <React.Suspense fallback={null}>
              <ReviewAssignmentFormView
                {...shared}
                review={review}
                {...(loadOptions === undefined ? {} : { loadOptions })}
              />
            </React.Suspense>
          ) : null}
        </section>
      </div>
    </WorkflowAnnouncerContext.Provider>
  );
}
