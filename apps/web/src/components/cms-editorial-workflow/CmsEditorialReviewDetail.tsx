import type { EditorialReviewDetailResource } from '@wejammin/contracts';
import * as React from 'react';

import {
  INVALIDATED_REASON_COPY,
  REVIEW_STATE_LABEL,
} from './cms-workflow-labels';

export interface CmsEditorialReviewDetailProps {
  readonly review: EditorialReviewDetailResource;
  /** The time of the last verified read when a later read failed, else null. */
  readonly degradedSince?: string | null;
}

export const REVIEW_DETAIL_HEADING_IDS = {
  summary: 'review-summary-title',
  candidate: 'review-candidate-title',
  decisions: 'review-decisions-title',
  assignments: 'review-assignments-title',
} as const;

const Time = ({ value }: { readonly value: string }): React.ReactElement => (
  <time dateTime={value}>{value}</time>
);

const plural = (count: number, one: string, many: string): string =>
  `${count} ${count === 1 ? one : many}`;

/**
 * CMS-03B-16 as immutable review evidence: the state in words, the frozen
 * candidate as hash text and version identities (never the manifest), the
 * decisions as a semantic list that never names the decider and shows only the
 * caller's own reason, the caller's own assignment end and, for the owner only,
 * the assignment summaries by their server label. No person, actor, party or
 * submitter identifier appears in text. The actions it enables come from
 * `permittedNextActions`, rendered by the forms beside it.
 */
export default function CmsEditorialReviewDetail({
  review,
  degradedSince = null,
}: CmsEditorialReviewDetailProps): React.ReactElement {
  const { frozen } = review;
  const showAssignments =
    review.assignments.length > 0 ||
    review.permittedNextActions.includes('assign_reviewer') ||
    review.permittedNextActions.includes('revoke_assignment');
  return (
    <div data-cms-review-detail="">
      {degradedSince === null ? null : (
        <p data-cms-workflow-degraded="">
          Showing the last verified state from <Time value={degradedSince} />.
          Commands are off until the page is verified again.
        </p>
      )}
      <p>
        <a href="/app/cms-content-modeling/reviews">Back to reviews</a>
      </p>
      <section aria-labelledby={REVIEW_DETAIL_HEADING_IDS.summary}>
        <h2 id={REVIEW_DETAIL_HEADING_IDS.summary} tabIndex={-1}>
          {review.contentTypeLabel}
        </h2>
        <p role="status" aria-live="polite" aria-atomic="true">
          Revision {review.revisionNumber} ({review.locale}) · State:{' '}
          {REVIEW_STATE_LABEL[review.state]} · Risk class: {review.riskClass}
        </p>
        <p>
          {review.recordedDecisionCount} of {review.requiredDecisionCount}{' '}
          decisions recorded. Qualifying approvals:{' '}
          {review.distinctApprovalCount}.
        </p>
        {review.invalidatedReason === null ? null : (
          <p>{INVALIDATED_REASON_COPY[review.invalidatedReason]}</p>
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
      <section aria-labelledby={REVIEW_DETAIL_HEADING_IDS.candidate}>
        <h2 id={REVIEW_DETAIL_HEADING_IDS.candidate} tabIndex={-1}>
          Frozen candidate
        </h2>
        <p>
          Frozen hash: <code>{frozen.frozenHash}</code>
        </p>
        <p>
          Dependency hash: <code>{frozen.dependencyHash}</code>
        </p>
        <p>
          Content type version <code>{frozen.versionSet.schemaVersionId}</code>.
          Settings version {frozen.versionSet.settingsVersion}. Compiler{' '}
          {frozen.versionSet.compilerVersion}.{' '}
          {plural(frozen.versionSet.blockVersionIds.length, 'block', 'blocks')},{' '}
          {plural(
            frozen.versionSet.patternVersionIds.length,
            'pattern',
            'patterns',
          )}
          ,{' '}
          {plural(
            frozen.versionSet.taxonomyVersionIds.length,
            'vocabulary',
            'vocabularies',
          )}
          .
        </p>
      </section>
      <section aria-labelledby={REVIEW_DETAIL_HEADING_IDS.decisions}>
        <h2 id={REVIEW_DETAIL_HEADING_IDS.decisions} tabIndex={-1}>
          Decisions
        </h2>
        {review.decisions.length === 0 ? (
          <p>No decisions recorded yet.</p>
        ) : (
          <ul>
            {review.decisions.map((decision) => (
              <li key={decision.id} data-cms-review-decision="">
                {decision.mine ? 'Your decision' : 'Decision'}:{' '}
                {decision.decision} · Slot <code>{decision.capability}</code> ·{' '}
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
        <section aria-labelledby={REVIEW_DETAIL_HEADING_IDS.assignments}>
          <h2 id={REVIEW_DETAIL_HEADING_IDS.assignments} tabIndex={-1}>
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
