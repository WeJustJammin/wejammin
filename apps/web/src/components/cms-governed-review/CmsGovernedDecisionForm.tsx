import type { GovernedReviewDetailResource } from '@wejammin/contracts';
import * as React from 'react';

import { withCmsValidators } from '../../lib/cms-contract-validators';
import CmsWorkflowCommandFrame, {
  type WorkflowLocalError,
} from '../cms-editorial-workflow/CmsWorkflowCommandFrame';
import {
  WorkflowRadioGroup,
  WorkflowTextArea,
} from '../cms-editorial-workflow/CmsWorkflowFields';
import {
  isCommitBlocked,
  validatorsUnavailableError,
} from '../cms-editorial-workflow/cms-workflow-form-state';
import {
  DECISION_REASON_MAX,
  countCharacters,
  validateDecisionReason,
} from '../cms-editorial-workflow/cms-workflow-reason';
import { useDraftFields } from '../cms-editorial-workflow/use-cms-workflow-draft-fields';
import type { WorkflowCommandEnvironment } from '../cms-editorial-workflow/use-cms-workflow-command';
import { GOVERNED_DETAIL_HEADING_IDS } from './CmsGovernedReviewDetail';
import { GOVERNED_COMMAND_SPECS } from './governed-review-command-specs';
import { governedFrameVisible } from './governed-review-form-visibility';
import { useGovernedCommand } from './use-governed-review-command';
import { useClearSentOnCommit, useSentDraft } from './use-governed-sent-draft';

export interface CmsGovernedDecisionFormProps {
  readonly review: GovernedReviewDetailResource;
  /** The server permits `record_decision`; the form stays mounted to say why a refusal happened. */
  readonly permitted: boolean;
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

const REASON_FIELD = { id: 'governed-decision-reason', label: 'Reason' };
const CHOICE_FIELD = { id: 'governed-decision-approve', label: 'Decision' };

const RECORDED = 'Decision recorded.';
const NO_LONGER_OPEN =
  'The current state is loaded. This review no longer takes your decision.';
const settledAfterLostAnswer = (
  review: GovernedReviewDetailResource,
): string =>
  review.decisions.some((decision) => decision.mine)
    ? RECORDED
    : NO_LONGER_OPEN;

/**
 * CMS-03C-07. The request is the review id, the decision, the reason and the
 * review `version` as `expectedVersion`; no capability and no MFA instant exist
 * in the form, because both are server-derived. The reason is refused inline by
 * the generated schema. Every decision needs recent MFA: a 401 shortfall stores
 * the scoped draft (decision and reason only), goes to `/step-up?returnTo=` and
 * on return restores the entries and waits for an explicit confirmation under
 * the original `Idempotency-Key`. A `separation_of_duties` refusal is the
 * capability gate, never a step-up route.
 */
export default function CmsGovernedDecisionForm({
  review,
  permitted,
  disabledReason,
  refetch,
  onDone,
  environment,
}: CmsGovernedDecisionFormProps): React.ReactElement {
  const [localErrors, setLocalErrors] = React.useState<
    readonly WorkflowLocalError[]
  >([]);
  const sentDraft = useSentDraft();
  const { controller, state } = useGovernedCommand({
    spec: GOVERNED_COMMAND_SPECS['CMS-03C-07'],
    ids: { reviewId: review.id },
    refetch,
    onCommitted: () => {
      // FE03 1048: a verified success clears the form's draft.
      sentDraft.commit();
      void refetch().then(() => onDone(GOVERNED_DETAIL_HEADING_IDS.decisions));
    },
    ...(environment === undefined ? {} : { environment }),
  });
  const { version } = review;
  React.useEffect(() => {
    if (permitted) controller.restore(version);
  }, [controller, permitted, version]);
  const fields = useDraftFields(state.restoredValues);
  useClearSentOnCommit(sentDraft, fields.clearSent);
  const decision = asChoice(fields.value('decision'));
  const reason = fields.value('reason');
  const blocked = isCommitBlocked(state, disabledReason);
  const named = state.refusal?.fields ?? [];
  const errorOf = (id: string): string | null =>
    localErrors.find((error) => error.id === id)?.message ?? null;

  const submit = (event: React.SyntheticEvent): void => {
    event.preventDefault();
    if (blocked) return;
    withCmsValidators(
      (validators) => {
        const found: WorkflowLocalError[] = [];
        if (decision === '')
          found.push({ ...CHOICE_FIELD, message: 'Choose approve or reject.' });
        const reasonError = validateDecisionReason(validators, reason);
        if (reasonError !== null)
          found.push({ ...REASON_FIELD, message: reasonError });
        setLocalErrors(found);
        if (decision === '' || found.length > 0) return;
        sentDraft.remember(fields.typedValues);
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
      },
      () => setLocalErrors([validatorsUnavailableError(REASON_FIELD)]),
    );
  };
  if (!governedFrameVisible(permitted, state.phase)) return <></>;
  // After a lost answer the canonical re-read says what happened. A decision of the caller's own
  // on the review is this command, recorded (the same key would only replay it); a review that
  // no longer offers the decision cannot take the same request again. Either way the retry goes.
  const settled = permitted ? null : settledAfterLostAnswer(review);
  return (
    <CmsWorkflowCommandFrame
      lazyRegion="governed-decision"
      headingId="governed-decision-title"
      title="Record your decision"
      state={state}
      controller={controller}
      pendingLabel="Recording decision…"
      committedLabel={() => 'Decision recorded.'}
      fieldIds={{ decision: CHOICE_FIELD, reason: REASON_FIELD }}
      localErrors={localErrors}
      disabledReason={disabledReason}
      settled={settled}
    >
      {permitted ? (
        <form onSubmit={submit}>
          <WorkflowRadioGroup
            id="governed-decision"
            legend="Decision"
            name="decision"
            value={decision}
            error={errorOf(CHOICE_FIELD.id)}
            options={[
              { value: 'approve', label: 'Approve' },
              { value: 'reject', label: 'Reject' },
            ]}
            onChange={(value) => fields.set('decision', value)}
          />
          <WorkflowTextArea
            id={REASON_FIELD.id}
            label="Reason"
            value={reason}
            counter={{
              used: countCharacters(reason),
              max: DECISION_REASON_MAX,
            }}
            error={errorOf(REASON_FIELD.id)}
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
      ) : null}
    </CmsWorkflowCommandFrame>
  );
}
