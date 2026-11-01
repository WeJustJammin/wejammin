import type { GovernedReviewDetailResource } from '@wejammin/contracts';
import * as React from 'react';

import {
  loadReviewerOptions,
  type ReviewerOptionsResult,
} from '../cms-editorial-workflow/cms-workflow-reviewer-options';
import type { WorkflowCommandEnvironment } from '../cms-editorial-workflow/use-cms-workflow-command';
import CmsGovernedAssignmentCreate from './CmsGovernedAssignmentCreate';
import CmsGovernedAssignmentRevoke from './CmsGovernedAssignmentRevoke';

export interface CmsGovernedAssignmentFormProps {
  readonly review: GovernedReviewDetailResource;
  readonly disabledReason: string | null;
  readonly refetch: () => Promise<boolean>;
  readonly onDone: (headingId: string) => void;
  readonly environment?: WorkflowCommandEnvironment;
  /** Seams for a test. */
  readonly now?: () => number;
  readonly loadOptions?: () => Promise<ReviewerOptionsResult>;
}

/**
 * The owner-only CMS-03C-08 controls of a definition review: assign (offered
 * only when `permittedNextActions` has `assign_reviewer`) and revoke (only with
 * `revoke_assignment` and at least one active assignment). The two are separate
 * commands with separate keys and step-up drafts; each stays mounted so the
 * sentence of a refusal survives the re-read that removes its action.
 */
export default function CmsGovernedAssignmentForm({
  review,
  disabledReason,
  refetch,
  onDone,
  environment,
  now = Date.now,
  loadOptions = loadReviewerOptions,
}: CmsGovernedAssignmentFormProps): React.ReactElement {
  const canAssign = review.permittedNextActions.includes('assign_reviewer');
  const canRevoke =
    review.permittedNextActions.includes('revoke_assignment') &&
    review.assignments.some((assignment) => assignment.state === 'active');
  const shared = {
    disabledReason,
    refetch,
    onDone,
    ...(environment === undefined ? {} : { environment }),
  };
  return (
    <>
      <CmsGovernedAssignmentCreate
        {...shared}
        reviewId={review.id}
        permitted={canAssign}
        version={review.version}
        now={now}
        loadOptions={loadOptions}
      />
      <CmsGovernedAssignmentRevoke
        {...shared}
        review={review}
        permitted={canRevoke}
      />
    </>
  );
}
