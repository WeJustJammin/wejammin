import type {
  CmsDefinitionVersionState,
  GovernedSubjectKind,
} from '@wejammin/contracts';
import * as React from 'react';

import CmsLoadingRegion from '../cms-editorial-workflow/CmsLoadingRegion';
import type { WorkflowCommandEnvironment } from '../cms-editorial-workflow/use-cms-workflow-command';
import CmsGovernedLifecycleIcon from './CmsGovernedLifecycleIcon';
import CmsGovernedPanelReviewSummary from './CmsGovernedPanelReviewSummary';
import type { GovernedReviewCommitted } from './governed-review-command-specs';
import {
  GOVERNED_PANEL_NOTE,
  GOVERNED_PANEL_REVIEW_LINK_STATES,
  GOVERNED_SUBJECT_STATE_LABEL,
} from './governed-state-labels';
import { WhenOffered } from '../cms-editorial-workflow/cms-lazy-view';
import { GovernedSubmitFormView } from './governed-panel-form-views';
import { GOVERNED_QUEUE_PATH } from './governed-review-routes';
import type { GovernedPanelReview } from './load-governed-subject-review';

/** The subject version a definition panel acts on, exactly as the latest read served it. */
export interface GovernedPanelSubject {
  readonly kind: GovernedSubjectKind;
  readonly id: string;
  readonly hash: string;
  readonly key: string;
  readonly version: number;
  readonly state: CmsDefinitionVersionState;
}

export interface CmsGovernedReviewPanelProps {
  readonly subject: GovernedPanelSubject;
  /** The canonical re-read of the subject's latest version; null when it cannot be verified. */
  readonly readSubject: () => Promise<GovernedPanelSubject | null>;
  /** The subject's review as the owned queue served it (FE03 :877), else null/absent. */
  readonly review?: GovernedPanelReview | null;
  /** Why the commands are withheld right now, else null/absent. */
  readonly disabledReason?: string | null;
  readonly environment?: WorkflowCommandEnvironment;
}

export const GOVERNED_PANEL_RESULT_ID = 'governed-panel-result';
const UNVERIFIED =
  'The current state could not be verified. Submitting is off until it is.';

/**
 * The submit action of the bounded CMS-03C-06 panel on a definition page. The
 * request is the subject version's id and hash exactly as the latest read served
 * them: the person types nothing, so the browser can never submit a subject the
 * server did not serve. The server alone decides whether the version may be
 * submitted. The lifecycle is text; a submit control exists only for a `draft`,
 * and after every command the subject is re-read before anything else is offered.
 */
export default function CmsGovernedReviewPanel({
  subject: initial,
  readSubject,
  review: servedReview = null,
  disabledReason = null,
  environment,
}: CmsGovernedReviewPanelProps): React.ReactElement {
  const [subject, setSubject] = React.useState(initial);
  const [degraded, setDegraded] = React.useState(false);
  // The subject re-read is a read of known layout: a status line over a skeleton once it has run 250 ms (P2-S12-AC-271).
  const [refreshing, setRefreshing] = React.useState(false);
  // The review belongs to one subject version: a successor draft starts without one.
  const [known, setKnown] = React.useState<{
    readonly subjectId: string;
    readonly review: GovernedPanelReview | null;
    readonly submittedNow: boolean;
  }>({ subjectId: initial.id, review: servedReview, submittedNow: false });
  const review = known.subjectId === subject.id ? known.review : null;
  const submittedNow = known.subjectId === subject.id && known.submittedNow;

  const refetch = async (): Promise<boolean> => {
    setRefreshing(true);
    let next: GovernedPanelSubject | null;
    try {
      next = await readSubject();
    } finally {
      setRefreshing(false);
    }
    if (next === null) {
      setDegraded(true);
      return false;
    }
    setSubject(next);
    setDegraded(false);
    return true;
  };
  const onCommitted = (committed: GovernedReviewCommitted): void => {
    setKnown({
      subjectId: committed.subjectId,
      review: {
        reviewId: committed.id,
        state: committed.state,
        requiredDecisionCount: committed.requiredDecisionCount,
        recordedDecisionCount: committed.recordedDecisionCount,
      },
      submittedNow: true,
    });
    void refetch().then(() => {
      document.getElementById(GOVERNED_PANEL_RESULT_ID)?.focus();
    });
  };

  const reason = disabledReason ?? (degraded ? UNVERIFIED : null);
  const showForm = subject.state === 'draft';
  const note = GOVERNED_PANEL_NOTE[subject.state];
  return (
    <section aria-labelledby="governed-panel-title">
      <h2 id="governed-panel-title" tabIndex={-1}>
        Definition review
      </h2>
      <p data-governed-lifecycle>
        <CmsGovernedLifecycleIcon state={subject.state} /> Lifecycle:{' '}
        {GOVERNED_SUBJECT_STATE_LABEL[subject.state]}
        {note === undefined ? null : ` · ${note}`}
      </p>
      <CmsLoadingRegion
        active={refreshing}
        label="Checking the current state…"
      />
      {submittedNow ? (
        <h3 id={GOVERNED_PANEL_RESULT_ID} tabIndex={-1}>
          Submitted for review
        </h3>
      ) : null}
      {review === null ? null : (
        <CmsGovernedPanelReviewSummary review={review} />
      )}
      {review === null &&
      GOVERNED_PANEL_REVIEW_LINK_STATES.has(subject.state) ? (
        <p>
          <a
            href={`${GOVERNED_QUEUE_PATH}?scope=owned&subjectKind=${subject.kind}`}
          >
            See its reviews
          </a>
        </p>
      ) : null}
      {degraded && !showForm ? <p>{UNVERIFIED}</p> : null}
      <WhenOffered offered={showForm}>
        <GovernedSubmitFormView
          subject={subject}
          showForm={showForm}
          disabledReason={reason}
          refetch={refetch}
          onCommitted={onCommitted}
          busy={refreshing}
          {...(environment === undefined ? {} : { environment })}
        />
      </WhenOffered>
    </section>
  );
}
