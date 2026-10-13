import type { EntryWorkflowPreparation } from '@wejammin/contracts';
import * as React from 'react';

import CmsWorkflowCommandFrame from './CmsWorkflowCommandFrame';
import { WORKFLOW_COMMAND_SPECS } from './cms-workflow-command-specs';
import { WORKFLOW_HEADING_IDS } from './CmsEditorialWorkflowPanel';
import { isCommitBlocked } from './cms-workflow-form-state';
import {
  useWorkflowCommand,
  type WorkflowCommandEnvironment,
} from './use-cms-workflow-command';

export interface CmsEditorialReviewSubmitFormProps {
  readonly entryId: string;
  /** The entry `version`: the strong `If-Match` operand of the submission. */
  readonly entryVersion: string;
  readonly revisionId: string;
  readonly preparation: EntryWorkflowPreparation;
  /** Why the commands are withheld right now (an unverified read), else null. */
  readonly disabledReason: string | null;
  readonly refetch: () => Promise<boolean>;
  /** Called after the canonical refetch of a committed command, with the heading to focus. */
  readonly onDone: (headingId: string) => void;
  readonly environment?: WorkflowCommandEnvironment;
}

const FORM_HEADING_ID = 'review-submit-title';

/**
 * CMS-03B-05. The person types nothing: the request is the served preparation
 * (`revisionId`, `frozenHash`, `dependencyManifest`) at the entry version, so
 * the browser can never send a manifest the server did not serve. One confirm
 * action names the risk class and the decisions required. The server alone
 * decides whether the checks pass; a failing report is a note, not a gate.
 */
export default function CmsEditorialReviewSubmitForm({
  entryId,
  entryVersion,
  revisionId,
  preparation,
  disabledReason,
  refetch,
  onDone,
  environment,
}: CmsEditorialReviewSubmitFormProps): React.ReactElement {
  const { controller, state } = useWorkflowCommand({
    spec: WORKFLOW_COMMAND_SPECS['CMS-03B-05'],
    ids: { entryId },
    refetch,
    onCommitted: () => {
      void refetch().then(() => onDone(WORKFLOW_HEADING_IDS.review));
    },
    ...(environment === undefined ? {} : { environment }),
  });
  const blocked = isCommitBlocked(state, disabledReason);
  const required = preparation.workflowPolicy.requiredDecisionCount;
  return (
    <CmsWorkflowCommandFrame
      headingId={FORM_HEADING_ID}
      title="Submit for review"
      state={state}
      controller={controller}
      pendingLabel="Submitting for review…"
      committedLabel={() => 'Review submitted. It is open for decisions.'}
      fieldIds={{}}
      disabledReason={disabledReason}
    >
      {preparation.preflight.passed ? null : (
        <p>Some checks did not pass. The server decides when you submit.</p>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (blocked) return;
          void controller.submit({
            body: {
              entryId,
              revisionId,
              frozenHash: preparation.frozenHash,
              dependencyManifest: preparation.dependencyManifest,
            },
            ifMatch: `"${entryVersion}"`,
            draft: {},
          });
        }}
      >
        <button
          type="submit"
          aria-disabled={blocked ? 'true' : 'false'}
          aria-busy={state.phase === 'pending' ? 'true' : 'false'}
        >
          Submit for review ({preparation.riskClass} risk, {required}{' '}
          {required === 1 ? 'decision' : 'decisions'} required)
        </button>
      </form>
    </CmsWorkflowCommandFrame>
  );
}
