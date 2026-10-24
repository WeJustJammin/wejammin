import * as React from 'react';

import { GOVERNED_REVIEW_STATE_LABEL } from './governed-state-labels';
import { GOVERNED_QUEUE_PATH } from './governed-review-routes';
import type { GovernedPanelReview } from './load-governed-subject-review';

export interface CmsGovernedPanelReviewSummaryProps {
  readonly review: GovernedPanelReview;
}

/**
 * The review summary of a definition panel (FE03 :877) and its link to the
 * governed review itself (FE03 :1066). Every figure is the server's, shown as
 * words: the state label and the recorded-of-required decision count.
 */
export default function CmsGovernedPanelReviewSummary({
  review,
}: CmsGovernedPanelReviewSummaryProps): React.ReactElement {
  return (
    <p>
      Review: {GOVERNED_REVIEW_STATE_LABEL[review.state]} ·{' '}
      {review.recordedDecisionCount} of {review.requiredDecisionCount} decisions
      ·{' '}
      <a href={`${GOVERNED_QUEUE_PATH}/${encodeURIComponent(review.reviewId)}`}>
        Open the review
      </a>
    </p>
  );
}
