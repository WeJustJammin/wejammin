import * as React from 'react';

import CmsReviewerChoice from '../cms-editorial-workflow/CmsReviewerChoice';
import {
  WorkflowTextArea,
  WorkflowTextField,
} from '../cms-editorial-workflow/CmsWorkflowFields';
import {
  ASSIGNMENT_REASON_MAX,
  countCharacters,
} from '../cms-editorial-workflow/cms-workflow-reason';
import type { ReviewerOptionsResult } from '../cms-editorial-workflow/cms-workflow-reviewer-options';

/** The controls a refusal or a local check can name, by field name. */
export const ASSIGNMENT_REVIEWER = {
  id: 'governed-assignment-reviewer',
  label: 'Reviewer',
};
export const ASSIGNMENT_EXPIRES = {
  id: 'governed-assignment-expires',
  label: 'Assignment ends',
};
export const ASSIGNMENT_REASON = {
  id: 'governed-assignment-reason',
  label: 'Reason (optional)',
};

export interface CmsGovernedAssignmentFieldsProps {
  readonly reviewers: ReviewerOptionsResult | null;
  /** Reads the reviewer choices again after a failed read. */
  readonly retry: () => void;
  /** A step-up restored the entries but, by design, never the person: ask again. */
  readonly askAgain: boolean;
  readonly personId: string;
  readonly expires: string;
  readonly reason: string;
  /** Local validation sentences by control id. */
  readonly errorOf: (id: string) => string | null;
  /** The controls a server refusal names. */
  readonly named: readonly string[];
  readonly onPerson: (personId: string) => void;
  readonly onExpires: (value: string) => void;
  readonly onReason: (value: string) => void;
}

/**
 * The three native controls of the assignment create form. The reviewer options
 * are the owner-only grant list; the person id is the value of a `<select>` held
 * by the parent's state only and is never rendered as text outside the option.
 */
export default function CmsGovernedAssignmentFields({
  reviewers,
  retry,
  askAgain,
  personId,
  expires,
  reason,
  errorOf,
  named,
  onPerson,
  onExpires,
  onReason,
}: CmsGovernedAssignmentFieldsProps): React.ReactElement {
  return (
    <>
      {askAgain && personId === '' ? <p>Choose the reviewer again.</p> : null}
      <CmsReviewerChoice
        id={ASSIGNMENT_REVIEWER.id}
        label="Reviewer"
        value={personId}
        reviewers={reviewers}
        retry={retry}
        error={errorOf(ASSIGNMENT_REVIEWER.id)}
        invalid={named.includes('reviewerPersonId')}
        onChange={onPerson}
      />
      <WorkflowTextField
        id={ASSIGNMENT_EXPIRES.id}
        label="Assignment ends"
        type="datetime-local"
        value={expires}
        hint="Up to seven days from now, and not after the reviewer’s access ends."
        error={errorOf(ASSIGNMENT_EXPIRES.id)}
        invalid={named.includes('expiresAt')}
        onChange={onExpires}
      />
      <WorkflowTextArea
        id={ASSIGNMENT_REASON.id}
        label="Reason (optional)"
        value={reason}
        counter={{ used: countCharacters(reason), max: ASSIGNMENT_REASON_MAX }}
        error={errorOf(ASSIGNMENT_REASON.id)}
        onChange={onReason}
      />
    </>
  );
}
