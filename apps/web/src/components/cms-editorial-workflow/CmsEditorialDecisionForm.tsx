import type { EditorialReviewDetailResource } from '@wejammin/contracts';
import * as React from 'react';

import CmsWorkflowCommandFrame, {
  type WorkflowLocalError,
} from './CmsWorkflowCommandFrame';
import { WorkflowRadioGroup, WorkflowTextArea } from './CmsWorkflowFields';
import { REVIEW_DETAIL_HEADING_IDS } from './CmsEditorialReviewDetail';
import { WORKFLOW_COMMAND_SPECS } from './cms-workflow-command-specs';
import { isCommitBlocked } from './cms-workflow-form-state';
import {
  DECISION_REASON_MAX,
  countCharacters,
  validateDecisionReason,
} from './cms-workflow-reason';
import { useDraftFields } from './use-cms-workflow-draft-fields';
import {
  useWorkflowCommand,
  type WorkflowCommandEnvironment,
} from './use-cms-workflow-command';

export interface CmsEditorialDecisionFormProps {
  readonly review: EditorialReviewDetailResource;
  readonly disabledReason: string | null;
  readonly refetch: () => Promise<boolean>;
  readonly onDone: (headingId: string) => void;
  readonly environment?: WorkflowCommandEnvironment;
}

type Choice = '' | 'approve' | 'reject';

const CONSEQUENCE: Readonly<Record<Choice, string>> = {
  '': 'Record decision',
  approve: 'Record approval',
  reject: 'Record rejection. This ends the review.',
};

const asChoice = (value: string | undefined): Choice =>
  value === 'approve' || value === 'reject' ? value : '';

/**
 * CMS-03B-06. The request is the review id, the decision, the reason and the
 * review `version` as `expectedVersion`; no capability and no MFA instant exist
 * in the form, because both are server-derived. The reason is refused inline by
 * the generated schema. Every decision needs recent MFA: a 401 shortfall stores
 * the scoped draft (decision and reason only), goes to `/step-up?returnTo=` and
 * on return restores the entries and waits for an explicit confirmation under
 * the original `Idempotency-Key`.
 */
export default function CmsEditorialDecisionForm({
  review,
  disabledReason,
  refetch,
  onDone,
  environment,
}: CmsEditorialDecisionFormProps): React.ReactElement {
  const [localErrors, setLocalErrors] = React.useState<
    readonly WorkflowLocalError[]
  >([]);
  const { controller, state } = useWorkflowCommand({
    spec: WORKFLOW_COMMAND_SPECS['CMS-03B-06'],
    ids: { reviewId: review.id },
    refetch,
    onCommitted: () => {
      void refetch().then(() => onDone(REVIEW_DETAIL_HEADING_IDS.decisions));
    },
    ...(environment === undefined ? {} : { environment }),
  });
  const { version } = review;
  React.useEffect(() => {
    controller.restore(version);
  }, [controller, version]);
  const fields = useDraftFields(state.restoredValues);
  const decision = asChoice(fields.value('decision'));
  const reason = fields.value('reason');

  const blocked = isCommitBlocked(state, disabledReason);
  const named = state.refusal?.fields ?? [];
  const errorOf = (id: string): string | null =>
    localErrors.find((error) => error.id === id)?.message ?? null;
  return (
    <CmsWorkflowCommandFrame
      headingId="decision-form-title"
      title="Record your decision"
      state={state}
      controller={controller}
      pendingLabel="Recording decision…"
      committedLabel={() => 'Decision recorded.'}
      fieldIds={{
        decision: { id: 'decision-approve', label: 'Decision' },
        reason: { id: 'decision-reason', label: 'Reason' },
      }}
      localErrors={localErrors}
      disabledReason={disabledReason}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (blocked) return;
          const found: WorkflowLocalError[] = [];
          if (decision === '')
            found.push({
              id: 'decision-approve',
              label: 'Decision',
              message: 'Choose approve or reject.',
            });
          const reasonError = validateDecisionReason(reason);
          if (reasonError !== null)
            found.push({
              id: 'decision-reason',
              label: 'Reason',
              message: reasonError,
            });
          setLocalErrors(found);
          if (decision === '' || found.length > 0) return;
          void controller.submit({
            body: {
              reviewId: review.id,
              decision,
              reason,
              expectedVersion: version,
            },
            ifMatch: `"${version}"`,
            draft: { decision, reason },
          });
        }}
      >
        <WorkflowRadioGroup
          id="decision"
          legend="Decision"
          name="decision"
          value={decision}
          error={errorOf('decision-approve')}
          options={[
            { value: 'approve', label: 'Approve' },
            { value: 'reject', label: 'Reject' },
          ]}
          onChange={(value) => fields.set('decision', value)}
        />
        <WorkflowTextArea
          id="decision-reason"
          label="Reason"
          value={reason}
          counter={{ used: countCharacters(reason), max: DECISION_REASON_MAX }}
          error={errorOf('decision-reason')}
          invalid={named.includes('reason')}
          onChange={(value) => fields.set('reason', value)}
        />
        <button
          type="submit"
          aria-disabled={blocked ? 'true' : 'false'}
          aria-busy={state.phase === 'pending' ? 'true' : 'false'}
        >
          {CONSEQUENCE[decision]}
        </button>
      </form>
    </CmsWorkflowCommandFrame>
  );
}
