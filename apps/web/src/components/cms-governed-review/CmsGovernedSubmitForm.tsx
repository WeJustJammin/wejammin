import * as React from 'react';

import CmsWorkflowCommandFrame from '../cms-editorial-workflow/CmsWorkflowCommandFrame';
import CmsWorkflowStatusRegion from '../cms-editorial-workflow/CmsWorkflowStatusRegion';
import { isCommitBlocked } from '../cms-editorial-workflow/cms-workflow-form-state';
import type { WorkflowCommandEnvironment } from '../cms-editorial-workflow/use-cms-workflow-command';
import {
  WorkflowAnnouncerContext,
  useIslandConfirmation,
} from '../cms-editorial-workflow/use-cms-workflow-status';
import type { GovernedPanelSubject } from './CmsGovernedReviewPanel';
import {
  GOVERNED_COMMAND_SPECS,
  type GovernedReviewCommitted,
} from './governed-review-command-specs';
import { governedFrameVisible } from './governed-review-form-visibility';
import { useGovernedCommand } from './use-governed-review-command';

export interface CmsGovernedSubmitFormProps {
  /** The subject version exactly as the latest read served it. */
  readonly subject: GovernedPanelSubject;
  /** The subject is a `draft`, so a submit control exists. */
  readonly showForm: boolean;
  /** Why the command is withheld right now, else null. */
  readonly disabledReason: string | null;
  /** The canonical re-read of the subject; resolves false when it cannot be verified. */
  readonly refetch: () => Promise<boolean>;
  /** The review the server committed; the panel shows it and re-reads the subject. */
  readonly onCommitted: (committed: GovernedReviewCommitted) => void;
  /** The panel is re-reading the subject: only the commit control is withheld (P2-S12-AC-271 `loading`). */
  readonly busy?: boolean;
  readonly environment?: WorkflowCommandEnvironment;
}

/**
 * The CMS-03C-06 submit command of the bounded panel on a definition page. It is its own
 * module so the command machinery (controller, specs, transport, frame) loads when the form is
 * first offered, not with the panel island (FE03 island and initial-route budgets). The request
 * is the subject version's id and hash exactly as the latest read served them: the person types
 * nothing, so the browser can never submit a subject the server did not serve.
 */
export default function CmsGovernedSubmitForm({
  subject,
  showForm,
  disabledReason,
  refetch,
  onCommitted,
  busy = false,
  environment,
}: CmsGovernedSubmitFormProps): React.ReactElement {
  const confirmation = useIslandConfirmation();
  const { controller, state } = useGovernedCommand({
    spec: GOVERNED_COMMAND_SPECS['CMS-03C-06'],
    ids: {},
    refetch,
    onCommitted,
    ...(environment === undefined ? {} : { environment }),
  });
  // A different draft version is a new subject: forget the committed command.
  React.useEffect(() => {
    controller.startOver();
  }, [controller, subject.id]);

  const blocked = isCommitBlocked(state, disabledReason) || busy;
  return (
    <WorkflowAnnouncerContext.Provider value={confirmation.announcer}>
      <CmsWorkflowStatusRegion text={confirmation.text} />
      {governedFrameVisible(showForm, state.phase) ? (
        <CmsWorkflowCommandFrame
          headingId="governed-panel-form-title"
          title="Submit for review"
          state={state}
          controller={controller}
          pendingLabel="Submitting for review…"
          committedLabel={() => 'Review submitted. It is open for decisions.'}
          lazyRegion="governed-submit"
          fieldIds={{}}
          disabledReason={disabledReason}
        >
          {showForm ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (blocked) return;
                void controller.submit({
                  body: {
                    subjectKind: subject.kind,
                    subjectId: subject.id,
                    subjectHash: subject.hash,
                  },
                  // A submission names its subject by id and hash: no If-Match is sent.
                  ifMatch: `"${subject.version}"`,
                  draft: {},
                });
              }}
            >
              <button
                type="submit"
                aria-disabled={blocked ? 'true' : 'false'}
                aria-busy={state.phase === 'pending' ? 'true' : 'false'}
              >
                Submit for review
              </button>
            </form>
          ) : null}
        </CmsWorkflowCommandFrame>
      ) : null}
    </WorkflowAnnouncerContext.Provider>
  );
}
