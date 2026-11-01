import type { EntryWorkflowResource } from '@wejammin/contracts';
import * as React from 'react';

import { readWorkflowLazily } from './cms-workflow-answer-machinery';
import CmsEditorialWorkflowPanel from './CmsEditorialWorkflowPanel';
import CmsWorkflowClosedState from './CmsWorkflowClosedState';
import CmsWorkflowRateLimitNotice from './CmsWorkflowRateLimitNotice';
import CmsWorkflowStatusRegion from './CmsWorkflowStatusRegion';
import type { CanonicalReadResult } from './cms-workflow-canonical-read';
import {
  PreviewFormView,
  PublishConfirmationView,
  ReviewSubmitFormView,
  ScheduleFormView,
} from './cms-workflow-form-views';
import { disabledActionCopy } from './cms-workflow-labels';
import { useCanonicalResource } from './use-cms-workflow-canonical';
import type { WorkflowCommandEnvironment } from './use-cms-workflow-command';
import {
  WorkflowAnnouncerContext,
  useIslandConfirmation,
} from './use-cms-workflow-status';

export interface CmsEditorialWorkflowIslandInit {
  readonly workflow: EntryWorkflowResource;
  readonly entryId: string;
  /** The URL-owned revision, else null for the entry's current draft. */
  readonly revisionId: string | null;
  /** When the server verified `workflow`: the first `lastVerifiedAt`. */
  readonly verifiedAt: string;
}

export interface CmsEditorialWorkflowIslandProps {
  readonly init: CmsEditorialWorkflowIslandInit;
  /** Seams for a test. */
  readonly readWorkflow?: () => Promise<
    CanonicalReadResult<EntryWorkflowResource>
  >;
  readonly environment?: WorkflowCommandEnvironment;
}

const UNVERIFIED =
  'The last read could not be verified. Commands are off until it is.';

/** Focus lands on a result heading only after a command, never on a refetch. */
const focusHeading = (headingId: string): void => {
  document.getElementById(headingId)?.focus();
};

/**
 * The CMS-03B-15 surface: the panel for the current canonical workflow and, under
 * it, exactly the command forms `permittedNextActions` allows. The workflow is
 * only ever replaced by a later verified read; every command refetches it, a
 * failed read keeps the last verified panel with the commands off, and an ended
 * session or a vanished record removes the protected data.
 */
export default function CmsEditorialWorkflowIsland({
  init,
  // A read happens only on a refetch (after a command or a lost answer), so the read, its retry
  // policy and the client binding load then, not with the island (P2-S11-AC-106); if they cannot
  // load the read is degraded, never rejected.
  readWorkflow = () => readWorkflowLazily(init.entryId, init.revisionId),
  environment,
}: CmsEditorialWorkflowIslandProps): React.ReactElement {
  const canonical = useCanonicalResource(
    init.workflow,
    init.verifiedAt,
    readWorkflow,
  );
  const { data: workflow, status, refetch } = canonical;
  const confirmation = useIslandConfirmation();
  if (workflow === null)
    return (
      <CmsWorkflowClosedState
        kind={status === 'gone' ? 'gone' : 'signed-out'}
      />
    );

  const degraded = status === 'degraded';
  const disabledReason = degraded ? UNVERIFIED : null;
  const permitted = new Set(workflow.permittedNextActions);
  const { preparation, review } = workflow;
  const approved = review !== null && review.state === 'approved';
  const versionSet =
    preparation?.versionSet ?? review?.frozen.versionSet ?? null;
  const shared = {
    disabledReason,
    refetch,
    onDone: focusHeading,
    ...(environment === undefined ? {} : { environment }),
  };
  const notes = [
    preparation !== null && !permitted.has('submit_review')
      ? disabledActionCopy('submit_review')
      : null,
    approved && !permitted.has('schedule')
      ? disabledActionCopy('schedule')
      : null,
    approved && !permitted.has('publish')
      ? disabledActionCopy('publish')
      : null,
  ].filter((note): note is string => note !== null);
  return (
    <WorkflowAnnouncerContext.Provider value={confirmation.announcer}>
      <div>
        <CmsEditorialWorkflowPanel
          workflow={workflow}
          degradedSince={degraded ? canonical.lastVerifiedAt : null}
        />
        <section aria-labelledby="workflow-actions-title">
          <h2 id="workflow-actions-title" tabIndex={-1}>
            Actions
          </h2>
          <CmsWorkflowStatusRegion text={confirmation.text} />
          <CmsWorkflowRateLimitNotice rateLimit={canonical.rateLimit} />
          {notes.map((note) => (
            <p key={note}>{note}</p>
          ))}
          {permitted.has('submit_review') && preparation !== null ? (
            <React.Suspense fallback={null}>
              <ReviewSubmitFormView
                {...shared}
                entryId={workflow.entry.id}
                entryVersion={workflow.entry.version}
                revisionId={workflow.revision.id}
                preparation={preparation}
              />
            </React.Suspense>
          ) : null}
          {permitted.has('schedule') && approved ? (
            <React.Suspense fallback={null}>
              <ScheduleFormView
                {...shared}
                revisionId={workflow.revision.id}
                reviewVersion={review.version}
                publishPermitted={permitted.has('publish')}
              />
            </React.Suspense>
          ) : null}
          {permitted.has('preview') && versionSet !== null ? (
            <React.Suspense fallback={null}>
              <PreviewFormView
                disabledReason={disabledReason}
                refetch={refetch}
                {...(environment === undefined ? {} : { environment })}
                entryId={workflow.entry.id}
                entryVersion={workflow.entry.version}
                revisionId={workflow.revision.id}
                locale={workflow.revision.locale}
                versionSet={versionSet}
              />
            </React.Suspense>
          ) : null}
          {permitted.has('publish') && approved ? (
            <React.Suspense fallback={null}>
              <PublishConfirmationView
                {...shared}
                entryId={workflow.entry.id}
                revisionId={workflow.revision.id}
                reviewVersion={review.version}
                frozen={review.frozen}
              />
            </React.Suspense>
          ) : null}
        </section>
      </div>
    </WorkflowAnnouncerContext.Provider>
  );
}
