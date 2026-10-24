import type { GovernedReviewDetailResource } from '@wejammin/contracts';
import * as React from 'react';

import {
  GOVERNED_DECISION_LABEL,
  GOVERNED_INVALIDATED_COPY,
  GOVERNED_RISK_CLASS_LABEL,
  GOVERNED_SUBJECT_KIND_LABEL,
  governedActivationScheduleSentence,
} from './governed-review-labels';
import {
  GOVERNED_REVIEW_STATE_LABEL,
  GOVERNED_SUBJECT_STATE_LABEL,
} from './governed-state-labels';
import { GOVERNED_QUEUE_PATH } from './governed-review-routes';

export interface CmsGovernedReviewDetailProps {
  readonly review: GovernedReviewDetailResource;
  /** The time of the last verified read when a later read failed, else null. */
  readonly degradedSince?: string | null;
}

export const GOVERNED_DETAIL_HEADING_IDS = {
  summary: 'governed-summary-title',
  frozen: 'governed-frozen-title',
  policy: 'governed-policy-title',
  decisions: 'governed-decisions-title',
  assignments: 'governed-assignments-title',
} as const;

// Pages and tests import the queue path from here; it is defined with the other paths.
export { GOVERNED_QUEUE_PATH };

const Time = ({ value }: { readonly value: string }): React.ReactElement => (
  <time dateTime={value}>{value}</time>
);

/**
 * CMS-03C-10 as immutable review evidence: the review and the subject lifecycle
 * in words, the frozen subject as a hash, the policy basis as content type
 * labels and policy keys, the decisions as a semantic list that never names the
 * decider and shows only the caller's own reason, the caller's own assignment end
 * and, for the owner only, the assignment summaries by their server label. No
 * person, actor, party or lineage identifier appears in text. The actions it
 * enables come from `permittedNextActions`, rendered by the forms beside it.
 */
export default function CmsGovernedReviewDetail({
  review,
  degradedSince = null,
}: CmsGovernedReviewDetailProps): React.ReactElement {
  const showAssignments =
    review.assignments.length > 0 ||
    review.permittedNextActions.includes('assign_reviewer') ||
    review.permittedNextActions.includes('revoke_assignment');
  return (
    <div data-cms-governed-review-detail="">
      {degradedSince === null ? null : (
        <p data-cms-workflow-degraded="">
          Showing the last verified state from <Time value={degradedSince} />.
          Commands are off until the page is verified again.
        </p>
      )}
      <p>
        <a href={GOVERNED_QUEUE_PATH}>Back to definition reviews</a>
      </p>
      <section aria-labelledby={GOVERNED_DETAIL_HEADING_IDS.summary}>
        <h2 id={GOVERNED_DETAIL_HEADING_IDS.summary} tabIndex={-1}>
          {GOVERNED_SUBJECT_KIND_LABEL[review.subjectKind]} {review.subjectKey},
          version {review.subjectVersion}
        </h2>
        <p role="status" aria-live="polite" aria-atomic="true">
          State: {GOVERNED_REVIEW_STATE_LABEL[review.state]} · Subject:{' '}
          {GOVERNED_SUBJECT_STATE_LABEL[review.subjectState]} · Risk class:{' '}
          {GOVERNED_RISK_CLASS_LABEL[review.riskClass]}
        </p>
        <p>
          {review.recordedDecisionCount} of {review.requiredDecisionCount}{' '}
          decisions recorded. Qualifying approvals:{' '}
          {review.distinctApprovalCount}.
        </p>
        {review.activationSchedule === null ? null : (
          <p data-cms-governed-activation-schedule="">
            {governedActivationScheduleSentence(review.activationSchedule)}
          </p>
        )}
        {review.invalidatedReason === null ? null : (
          <p>{GOVERNED_INVALIDATED_COPY[review.invalidatedReason]}</p>
        )}
        <p>
          Submitted <Time value={review.submittedAt} />
          {review.decidedAt === null ? null : (
            <>
              . Decided <Time value={review.decidedAt} />
            </>
          )}
          .
        </p>
        {review.myAssignment === null ? null : (
          <p>
            Your assignment ends <Time value={review.myAssignment.endsAt} />.
          </p>
        )}
      </section>
      <section aria-labelledby={GOVERNED_DETAIL_HEADING_IDS.frozen}>
        <h2 id={GOVERNED_DETAIL_HEADING_IDS.frozen} tabIndex={-1}>
          Frozen version
        </h2>
        <p>
          Subject hash: <code>{review.subjectHash}</code>
        </p>
        {review.blockRegistryDigest === null ? null : (
          <p>
            Block registry digest: <code>{review.blockRegistryDigest}</code>
          </p>
        )}
      </section>
      <section aria-labelledby={GOVERNED_DETAIL_HEADING_IDS.policy}>
        <h2 id={GOVERNED_DETAIL_HEADING_IDS.policy} tabIndex={-1}>
          Review policy
        </h2>
        <p>
          Policy basis hash: <code>{review.policyBasisHash}</code>
        </p>
        <ul>
          {review.policyBasis.map((basis) => (
            <li key={`${basis.policyKey}:${basis.contentTypeLabel}`}>
              {basis.contentTypeLabel} · <code>{basis.policyKey}</code>, version{' '}
              {basis.policyVersion}
            </li>
          ))}
        </ul>
        <p>
          Required reviewer slots:{' '}
          {review.requiredCapabilities.map((capability, index) => (
            <React.Fragment key={capability}>
              {index === 0 ? null : ', '}
              <code>{capability}</code>
            </React.Fragment>
          ))}
          .
        </p>
      </section>
      <section aria-labelledby={GOVERNED_DETAIL_HEADING_IDS.decisions}>
        <h2 id={GOVERNED_DETAIL_HEADING_IDS.decisions} tabIndex={-1}>
          Decisions
        </h2>
        {review.decisions.length === 0 ? (
          <p>No decisions recorded yet.</p>
        ) : (
          <ul>
            {review.decisions.map((decision) => (
              <li key={decision.id} data-cms-review-decision="">
                {decision.mine ? 'Your decision' : 'Decision'}:{' '}
                {GOVERNED_DECISION_LABEL[decision.decision]} · Slot{' '}
                <code>{decision.capability}</code> ·{' '}
                <Time value={decision.decidedAt} />
                {decision.reason === null ? null : (
                  <>
                    <br />
                    Your reason: {decision.reason}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      {showAssignments ? (
        <section aria-labelledby={GOVERNED_DETAIL_HEADING_IDS.assignments}>
          <h2 id={GOVERNED_DETAIL_HEADING_IDS.assignments} tabIndex={-1}>
            Assignments
          </h2>
          {review.assignments.length === 0 ? (
            <p>No active assignments</p>
          ) : (
            <ul>
              {review.assignments.map((assignment) => (
                <li key={assignment.assignmentId}>
                  {assignment.reviewerLabel} ·{' '}
                  {assignment.state === 'active' ? 'Active' : 'Revoked'} · from{' '}
                  <Time value={assignment.startsAt} /> to{' '}
                  <Time value={assignment.endsAt} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
