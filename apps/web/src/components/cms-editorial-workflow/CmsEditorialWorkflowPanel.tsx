import type { EntryWorkflowResource } from '@wejammin/contracts';
import * as React from 'react';

import CmsEditorialPreflightSummary from './CmsEditorialPreflightSummary';
import {
  INVALIDATED_REASON_COPY,
  PROJECTION_COPY,
  PUBLICATION_ACTION_LABEL,
  PUBLICATION_STATE_LABEL,
  REVIEW_STATE_LABEL,
  REVISION_STATE_LABEL,
  SCHEDULE_REASON_COPY,
  SCHEDULE_STATE_COPY,
} from './cms-workflow-labels';

export interface CmsEditorialWorkflowPanelProps {
  readonly workflow: EntryWorkflowResource;
  /** The time of the last verified read when a later read failed, else null. */
  readonly degradedSince?: string | null;
}

export const REVIEW_PATH_PREFIX = '/app/cms-content-modeling/reviews';

/** The five named regions of the panel, in reading order. */
export const WORKFLOW_HEADING_IDS = {
  revision: 'workflow-revision-title',
  checks: 'workflow-checks-title',
  review: 'workflow-review-title',
  schedules: 'workflow-schedules-title',
  publications: 'workflow-publications-title',
} as const;

const Time = ({ value }: { readonly value: string }): React.ReactElement => (
  <time dateTime={value}>{value}</time>
);

/**
 * CMS-03B-15 as one region per concern: the revision with its derived state,
 * the checks, the latest review, the schedules and the publications. State is
 * always words, never colour alone; every instant is a `<time>`; a scheduled
 * item is "Scheduled, not published" and a pending projection is never public
 * visibility. It renders no hash, manifest, version set or identifier, and it
 * never moves focus: a refetch only rewrites text in place.
 */
export default function CmsEditorialWorkflowPanel({
  workflow,
  degradedSince = null,
}: CmsEditorialWorkflowPanelProps): React.ReactElement {
  const { revision, preparation, review, schedules, publications } = workflow;
  return (
    <div data-cms-workflow-panel="">
      {degradedSince === null ? null : (
        <p data-cms-workflow-degraded="">
          Showing the last verified state from <Time value={degradedSince} />.
          Commands are off until the page is verified again.
        </p>
      )}
      <section aria-labelledby={WORKFLOW_HEADING_IDS.revision}>
        <h2 id={WORKFLOW_HEADING_IDS.revision} tabIndex={-1}>
          Revision
        </h2>
        <p role="status" aria-live="polite" aria-atomic="true">
          Revision {revision.revisionNumber} ({revision.locale}):{' '}
          {REVISION_STATE_LABEL[revision.state]}
          {revision.isCurrentDraft ? ', the current draft' : ''}.
        </p>
      </section>
      {preparation === null ? (
        <section aria-labelledby={WORKFLOW_HEADING_IDS.checks}>
          <h2 id={WORKFLOW_HEADING_IDS.checks} tabIndex={-1}>
            Checks
          </h2>
          <p>Checks run for a draft that can be submitted.</p>
        </section>
      ) : (
        <CmsEditorialPreflightSummary
          headingId={WORKFLOW_HEADING_IDS.checks}
          headingLevel={2}
          results={preparation.preflight.results}
        />
      )}
      <section aria-labelledby={WORKFLOW_HEADING_IDS.review}>
        <h2 id={WORKFLOW_HEADING_IDS.review} tabIndex={-1}>
          Review
        </h2>
        {review === null ? (
          <p>Not submitted</p>
        ) : (
          <>
            <p>
              {REVIEW_STATE_LABEL[review.state]}. Risk class: {review.riskClass}
              . {review.recordedDecisionCount} of {review.requiredDecisionCount}{' '}
              decisions recorded.
            </p>
            {review.invalidatedReason === null ? null : (
              <p>{INVALIDATED_REASON_COPY[review.invalidatedReason]}</p>
            )}
            <p>
              <a href={`${REVIEW_PATH_PREFIX}/${review.id}`}>Open the review</a>
            </p>
          </>
        )}
      </section>
      <section aria-labelledby={WORKFLOW_HEADING_IDS.schedules}>
        <h2 id={WORKFLOW_HEADING_IDS.schedules} tabIndex={-1}>
          Schedules
        </h2>
        {schedules.length === 0 ? (
          <p>No schedules</p>
        ) : (
          <ul>
            {schedules.map((schedule) => (
              <li key={schedule.id}>
                {PUBLICATION_ACTION_LABEL[schedule.action]} for{' '}
                {schedule.audience} at <Time value={schedule.resolvedUtc} />:{' '}
                {SCHEDULE_STATE_COPY[schedule.state]}.
                {schedule.reasonCode === null
                  ? ''
                  : ` ${SCHEDULE_REASON_COPY[schedule.reasonCode]}`}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby={WORKFLOW_HEADING_IDS.publications}>
        <h2 id={WORKFLOW_HEADING_IDS.publications} tabIndex={-1}>
          Publications
        </h2>
        {publications.length === 0 ? (
          <p>No publications</p>
        ) : (
          <ul>
            {publications.map((publication) => (
              <li key={publication.publicationVersionId}>
                {PUBLICATION_ACTION_LABEL[publication.action]} version{' '}
                {publication.version} for {publication.audience} (
                {publication.locale}), recorded{' '}
                <Time value={publication.createdAt} />:{' '}
                {PUBLICATION_STATE_LABEL[publication.state]}.{' '}
                {PROJECTION_COPY[publication.projectionState]}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
