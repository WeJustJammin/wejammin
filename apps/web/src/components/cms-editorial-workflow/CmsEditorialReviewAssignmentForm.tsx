import type { EditorialReviewDetailResource } from '@wejammin/contracts';
import * as React from 'react';

import CmsEditorialAssignmentCreate from './CmsEditorialAssignmentCreate';
import CmsEditorialAssignmentRevoke from './CmsEditorialAssignmentRevoke';
import {
  loadReviewerOptions,
  type ReviewerOptionsResult,
} from './cms-workflow-reviewer-options';
import type { WorkflowCommandEnvironment } from './use-cms-workflow-command';

export interface CmsEditorialReviewAssignmentFormProps {
  readonly review: EditorialReviewDetailResource;
  readonly disabledReason: string | null;
  readonly refetch: () => Promise<boolean>;
  readonly onDone: (headingId: string) => void;
  readonly environment?: WorkflowCommandEnvironment;
  /** Seams for a test. */
  readonly now?: () => number;
  readonly loadOptions?: () => Promise<ReviewerOptionsResult>;
}

/**
 * The owner-only CMS-03B-18 controls of a review: assign (rendered only when
 * `permittedNextActions` has `assign_reviewer`) and revoke (only with
 * `revoke_assignment` and at least one active assignment). The two are separate
 * commands with separate keys and step-up drafts.
 */
export default function CmsEditorialReviewAssignmentForm({
  review,
  disabledReason,
  refetch,
  onDone,
  environment,
  now = Date.now,
  loadOptions = loadReviewerOptions,
}: CmsEditorialReviewAssignmentFormProps): React.ReactElement {
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
      {canAssign ? (
        <CmsEditorialAssignmentCreate
          {...shared}
          reviewId={review.id}
          version={review.version}
          now={now}
          loadOptions={loadOptions}
        />
      ) : null}
      {canRevoke ? (
        <CmsEditorialAssignmentRevoke {...shared} review={review} />
      ) : null}
    </>
  );
}
