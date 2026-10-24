import type { GovernedReviewDetailResource } from '@wejammin/contracts';
import * as React from 'react';

import CmsWorkflowClosedState from '../cms-editorial-workflow/CmsWorkflowClosedState';
import CmsWorkflowRateLimitNotice from '../cms-editorial-workflow/CmsWorkflowRateLimitNotice';
import CmsWorkflowStatusRegion from '../cms-editorial-workflow/CmsWorkflowStatusRegion';
import type { CanonicalReadResult } from '../cms-editorial-workflow/cms-workflow-canonical-read';
import type { ReviewerOptionsResult } from '../cms-editorial-workflow/cms-workflow-reviewer-options';
import { useCanonicalResource } from '../cms-editorial-workflow/use-cms-workflow-canonical';
import type { WorkflowCommandEnvironment } from '../cms-editorial-workflow/use-cms-workflow-command';
import {
  WorkflowAnnouncerContext,
  useIslandConfirmation,
} from '../cms-editorial-workflow/use-cms-workflow-status';
import { readGovernedReviewLazily } from './governed-answer-machinery';
import CmsGovernedReviewDetail from './CmsGovernedReviewDetail';
import {
  GovernedActivationFormView,
  GovernedAssignmentFormView,
  GovernedDecisionFormView,
} from './governed-review-form-views';
import { governedDisabledActionCopy } from './governed-review-labels';
import { WhenOffered } from '../cms-editorial-workflow/cms-lazy-view';

export interface CmsGovernedReviewDetailIslandInit {
  readonly review: GovernedReviewDetailResource;
  readonly reviewId: string;
  /** When the server verified `review`: the first `lastVerifiedAt`. */
  readonly verifiedAt: string;
}

export interface CmsGovernedReviewDetailIslandProps {
  readonly init: CmsGovernedReviewDetailIslandInit;
  /** Seams for a test. */
  readonly readReview?: () => Promise<
    CanonicalReadResult<GovernedReviewDetailResource>
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
 * The CMS-03C-10 surface: the immutable review evidence and, beside it, the
 * decision form (only with `record_decision`), the owner's assignment controls
 * (only with `assign_reviewer` or `revoke_assignment`) and the owner's
 * activation form (`activate`, `schedule`, `retire`, DEC-190), each form loaded
 * the first time the server offers its action (FE03 island budget). The review is
 * only ever replaced by a later verified read; a failed read keeps the last
 * verified review with the forms off, and a vanished review removes the data.
 */
export default function CmsGovernedReviewDetailIsland({
  init,
  // A read happens only on a refetch (after a command or a lost answer), so the read, its retry
  // policy and the client binding load then, not with the island (P2-S11-AC-106); if they cannot
  // load the read is degraded, never rejected.
  readReview = () => readGovernedReviewLazily(init.reviewId),
  loadOptions,
  environment,
}: CmsGovernedReviewDetailIslandProps): React.ReactElement {
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
  // An approved version waiting to be activated, for a reader who may not act on it.
  const awaitingOwner =
    review.state === 'approved' &&
    (review.subjectState === 'approved' || review.subjectState === 'blocked') &&
    !permitted.has('activate') &&
    !permitted.has('schedule');
  // An active version whose approving review shows a reader who may not retire it.
  const awaitingRetire =
    review.state === 'approved' &&
    review.subjectState === 'active' &&
    !permitted.has('retire');
  const shared = {
    disabledReason,
    refetch,
    onDone: focusHeading,
    ...(environment === undefined ? {} : { environment }),
  };
  return (
    <WorkflowAnnouncerContext.Provider value={confirmation.announcer}>
      <div>
        <CmsGovernedReviewDetail
          review={review}
          degradedSince={degraded ? canonical.lastVerifiedAt : null}
        />
        <section aria-labelledby="governed-actions-title">
          <h2 id="governed-actions-title" tabIndex={-1}>
            Actions
          </h2>
          <CmsWorkflowStatusRegion text={confirmation.text} />
          <CmsWorkflowRateLimitNotice rateLimit={canonical.rateLimit} />
          {review.state === 'open' && !permitted.has('record_decision') ? (
            <p>{governedDisabledActionCopy('record_decision')}</p>
          ) : null}
          <WhenOffered offered={permitted.has('record_decision')}>
            <GovernedDecisionFormView
              {...shared}
              review={review}
              permitted={permitted.has('record_decision')}
            />
          </WhenOffered>
          <WhenOffered
            offered={
              permitted.has('assign_reviewer') ||
              permitted.has('revoke_assignment')
            }
          >
            <GovernedAssignmentFormView
              {...shared}
              review={review}
              {...(loadOptions === undefined ? {} : { loadOptions })}
            />
          </WhenOffered>
          {awaitingOwner ? (
            <p>{governedDisabledActionCopy('activate')}</p>
          ) : null}
          {awaitingRetire ? (
            <p>{governedDisabledActionCopy('retire')}</p>
          ) : null}
          <WhenOffered
            offered={
              permitted.has('activate') ||
              permitted.has('schedule') ||
              permitted.has('retire')
            }
          >
            <GovernedActivationFormView {...shared} review={review} />
          </WhenOffered>
        </section>
      </div>
    </WorkflowAnnouncerContext.Provider>
  );
}
