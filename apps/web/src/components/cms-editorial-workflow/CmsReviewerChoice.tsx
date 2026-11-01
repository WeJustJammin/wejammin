import * as React from 'react';

import CmsReviewerOptionsNotice from './CmsReviewerOptionsNotice';
import { WorkflowSelect } from './CmsWorkflowFields';
import type { ReviewerOptionsResult } from './cms-workflow-reviewer-options';

export interface CmsReviewerChoiceProps {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  /** `null` while the read is in flight. */
  readonly reviewers: ReviewerOptionsResult | null;
  readonly retry: () => void;
  readonly error: string | null;
  readonly invalid: boolean;
  readonly onChange: (personId: string) => void;
}

const LOADING = 'Loading reviewers…';
const FAILED = 'Reviewer choices could not be loaded';

/**
 * The reviewer list of an assignment form (CMS-03B-18, CMS-03C-08). The read starts on the first
 * sign of intent in the form, so a person can open the list before it has answered: while it is in
 * flight the list is ONE disabled option that says so, the control is `aria-busy` and stays
 * enabled (opening it is itself a sign of intent), and a polite status speaks each state. The
 * choices replace the placeholder; a failed read says so in the list and offers the retry, a rate
 * limited one announces its wait and repeats itself.
 */
export default function CmsReviewerChoice({
  id,
  label,
  value,
  reviewers,
  retry,
  error,
  invalid,
  onChange,
}: CmsReviewerChoiceProps): React.ReactElement {
  const options =
    reviewers === null
      ? [{ value: '', label: LOADING, disabled: true }]
      : reviewers.kind === 'ok'
        ? [
            { value: '', label: 'Choose a reviewer' },
            ...reviewers.options.map((option) => ({
              value: option.personId,
              label: `${option.personId} (access ends ${option.endsAt})`,
            })),
          ]
        : [
            {
              value: '',
              label:
                reviewers.rateLimit === undefined ? FAILED : `${FAILED} yet`,
              disabled: true,
            },
          ];
  return (
    <>
      <CmsReviewerOptionsNotice reviewers={reviewers} retry={retry} />
      {reviewers?.kind === 'ok' && reviewers.options.length === 0 ? (
        <p>
          No reviewer has an active cms.reviewer grant.{' '}
          <a href="/app/cms-content-modeling/capability-grants">Grant access</a>
        </p>
      ) : null}
      <WorkflowSelect
        id={id}
        label={label}
        value={value}
        error={error}
        invalid={invalid}
        busy={reviewers === null}
        options={options}
        onChange={onChange}
      />
    </>
  );
}
