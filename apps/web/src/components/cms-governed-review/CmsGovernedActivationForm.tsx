import type { GovernedReviewDetailResource } from '@wejammin/contracts';
import type { TimeAuthority } from '@wejammin/contracts/time-authority';
import * as React from 'react';

import CmsWorkflowCommandFrame from '../cms-editorial-workflow/CmsWorkflowCommandFrame';
import type { WorkflowCommandEnvironment } from '../cms-editorial-workflow/use-cms-workflow-command';
import CmsGovernedActivationConfirm from './CmsGovernedActivationConfirm';
import CmsGovernedActivationFields from './CmsGovernedActivationFields';
import {
  ACTIVATION_FIELD_IDS,
  activationCommittedLabel,
  activationFormTitle,
  confirmationSentence,
  type ActivationAction,
} from './governed-activation-model';
import { governedFrameVisible } from './governed-review-form-visibility';
import { useGovernedActivationForm } from './use-governed-activation-form';

export interface CmsGovernedActivationFormProps {
  readonly review: GovernedReviewDetailResource;
  readonly disabledReason: string | null;
  readonly refetch: () => Promise<boolean>;
  readonly onDone: (headingId: string) => void;
  readonly environment?: WorkflowCommandEnvironment;
  /** Seams for a test. */
  readonly now?: () => number;
  readonly defaultTimezone?: string;
  readonly loadAuthority?: () => Promise<TimeAuthority>;
}

/** The frame of a refusal outlives the permission it was about; its title stays general. */
const ALL_ACTIONS: readonly ActivationAction[] = [
  'activate',
  'schedule',
  'retire',
];

const FRAME_HEADING_ID = 'governed-activation-title';

/** The frame's own control (`CmsWorkflowCommandFrame` ids it from its heading id). */
const focusCheckControl = (): void => {
  document.getElementById(`${FRAME_HEADING_ID}-check`)?.focus();
};

const PENDING_LABEL: Readonly<Record<ActivationAction | '', string>> = {
  '': 'Working…',
  activate: 'Activating…',
  schedule: 'Scheduling…',
  retire: 'Retiring…',
};

/**
 * CMS-03C-09. The request is the review `version` as `expectedVersion` and one
 * of `activate`, `schedule` (a `ScheduledInstant` the shared Time authority
 * resolves from the local time and zone) or `retire` (an optional reason); the
 * actions offered are exactly the server's `permittedNextActions`. Nothing is
 * sent before an explicit confirmation that names the consequence. Every action
 * needs recent MFA: a 401 shortfall stores the scoped draft (the choice and the
 * typed text, never an instant), goes to `/step-up?returnTo=` and on return
 * restores the entries and waits for a new confirmation under the original key.
 * The form stays mounted for the life of its island: it draws its frame while
 * the server permits an action or while its command still has something to say.
 */
export default function CmsGovernedActivationForm({
  review,
  disabledReason,
  refetch,
  onDone,
  environment,
  now = Date.now,
  defaultTimezone,
  loadAuthority,
}: CmsGovernedActivationFormProps): React.ReactElement {
  const form = useGovernedActivationForm({
    review,
    disabledReason,
    refetch,
    onDone,
    environment,
    now,
    defaultTimezone,
    loadAuthority,
  });
  const { state, typed, offered } = form;
  // An unknown outcome removes the step that held focus: move it to the control
  // that resolves the outcome (FE03 :1118, :1223).
  React.useEffect(() => {
    if (state.phase === 'unknown') focusCheckControl();
  }, [state.phase]);
  const permitted = offered.length > 0;
  const sentence = confirmationSentence(review, typed, form.resolution);
  if (!governedFrameVisible(permitted, state.phase)) return <></>;
  return (
    <CmsWorkflowCommandFrame
      lazyRegion="governed-activation"
      headingId={FRAME_HEADING_ID}
      title={activationFormTitle(permitted ? offered : ALL_ACTIONS)}
      state={state}
      controller={form.controller}
      pendingLabel={PENDING_LABEL[form.pendingAction]}
      committedLabel={(resource) => activationCommittedLabel(review, resource)}
      fieldIds={ACTIVATION_FIELD_IDS}
      localErrors={form.localErrors}
      disabledReason={disabledReason}
    >
      {permitted ? (
        <>
          <CmsGovernedActivationFields
            offered={offered}
            fields={form.fields}
            typed={typed}
            resolution={form.resolution}
            authority={form.time.authority}
            timeStatus={form.time.status}
            localErrors={form.localErrors}
            named={state.refusal?.fields ?? []}
            blocked={form.blocked}
            pending={state.phase === 'pending'}
            onChoose={form.choose}
            onContinue={form.proceed}
          />
          {form.confirming && typed.action !== '' && sentence !== null ? (
            <CmsGovernedActivationConfirm
              action={typed.action}
              sentence={sentence}
              blocked={form.blocked}
              pending={state.phase === 'pending'}
              pendingLabel={PENDING_LABEL[form.pendingAction]}
              onConfirm={form.send}
              onCancel={form.cancel}
            />
          ) : null}
        </>
      ) : null}
    </CmsWorkflowCommandFrame>
  );
}
