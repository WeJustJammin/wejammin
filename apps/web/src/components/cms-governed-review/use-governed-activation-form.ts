import type { GovernedReviewDetailResource } from '@wejammin/contracts';
import type { TimeAuthority } from '@wejammin/contracts/time-authority';
import * as React from 'react';

import { withCmsValidators } from '../../lib/cms-contract-validators';
import type { WorkflowLocalError } from '../cms-editorial-workflow/CmsWorkflowCommandFrame';
import type {
  CommandState,
  WorkflowCommandController,
} from '../cms-editorial-workflow/cms-workflow-command-controller';
import {
  isCommitBlocked,
  validatorsUnavailableError,
} from '../cms-editorial-workflow/cms-workflow-form-state';
import { validateAssignmentReason } from '../cms-editorial-workflow/cms-workflow-reason';
import {
  resolveScheduleInput,
  type ScheduleResolution,
} from '../cms-editorial-workflow/cms-workflow-schedule-resolution';
import {
  useTimeAuthority,
  type ScheduleTime,
} from '../cms-editorial-workflow/use-cms-schedule-time';
import {
  useDraftFields,
  type DraftFields,
} from '../cms-editorial-workflow/use-cms-workflow-draft-fields';
import type { WorkflowCommandEnvironment } from '../cms-editorial-workflow/use-cms-workflow-command';
import { GOVERNED_DETAIL_HEADING_IDS } from './CmsGovernedReviewDetail';
import {
  GOVERNED_ACTIVATION_SPEC,
  type GovernedActivationCommitted,
} from './governed-activation-command-spec';
import {
  ACTIVATION_FIELD_IDS,
  activationLocalErrors,
  activationSubmission,
  offeredActivationActions,
  typedFrom,
  type ActivationAction,
  type ActivationTyped,
} from './governed-activation-model';
import { useGovernedCommand } from './use-governed-review-command';

export interface GovernedActivationFormInput {
  readonly review: GovernedReviewDetailResource;
  readonly disabledReason: string | null;
  readonly refetch: () => Promise<boolean>;
  readonly onDone: (headingId: string) => void;
  readonly environment?: WorkflowCommandEnvironment | undefined;
  readonly now: () => number;
  readonly defaultTimezone?: string | undefined;
  readonly loadAuthority?: (() => Promise<TimeAuthority>) | undefined;
}

export interface GovernedActivationFormModel {
  readonly offered: readonly ActivationAction[];
  readonly controller: WorkflowCommandController<
    never,
    GovernedActivationCommitted
  >;
  readonly state: CommandState<GovernedActivationCommitted>;
  readonly fields: DraftFields;
  readonly typed: ActivationTyped;
  readonly resolution: ScheduleResolution;
  readonly time: ScheduleTime;
  readonly localErrors: readonly WorkflowLocalError[];
  readonly confirming: boolean;
  /** The action of the command in flight, else the live choice. */
  readonly pendingAction: ActivationAction | '';
  readonly blocked: boolean;
  readonly choose: (action: ActivationAction) => void;
  readonly proceed: (event: React.SyntheticEvent) => void;
  readonly send: () => void;
  readonly cancel: () => void;
}

const browserZone = (): string =>
  Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * The state of the CMS-03C-09 form: the command controller, the typed inputs
 * over a restored step-up draft, the lazily loaded Time authority (fetched only
 * once a schedule is chosen or restored), the local checks and the
 * confirmation. A confirmation belongs to exactly the inputs, the resolved
 * instant and the review version it was made for, so any change withdraws it.
 */
export const useGovernedActivationForm = (
  input: GovernedActivationFormInput,
): GovernedActivationFormModel => {
  const { review, disabledReason, refetch, onDone, environment, now } = input;
  const offered = offeredActivationActions(review.permittedNextActions);
  const permitted = offered.length > 0;
  const [localErrors, setLocalErrors] = React.useState<
    readonly WorkflowLocalError[]
  >([]);
  const [confirmed, setConfirmed] = React.useState<string | null>(null);
  const [scheduleChosen, setScheduleChosen] = React.useState(false);
  const { controller, state } = useGovernedCommand({
    spec: GOVERNED_ACTIVATION_SPEC,
    ids: { reviewId: review.id },
    refetch,
    // Focus stays on the commit control through the re-read; the step is
    // cleared only once the summary heading has taken focus (FE03 :1118).
    onCommitted: () => {
      void refetch().then(() => {
        onDone(GOVERNED_DETAIL_HEADING_IDS.summary);
        setConfirmed(null);
      });
    },
    ...(environment === undefined ? {} : { environment }),
  });
  const { version } = review;
  React.useEffect(() => {
    if (permitted) controller.restore(version);
  }, [controller, permitted, version]);

  const time = useTimeAuthority(
    scheduleChosen || state.restoredValues?.action === 'schedule',
    input.loadAuthority,
  );
  const suggested = input.defaultTimezone ?? browserZone();
  const fields = useDraftFields(state.restoredValues, {
    timezone: time.authority?.hasZone(suggested) === true ? suggested : '',
  });
  const typed = typedFrom(fields.value, offered);
  const resolution: ScheduleResolution =
    typed.action !== 'schedule' || time.authority === null
      ? { kind: 'empty' }
      : resolveScheduleInput(
          time.authority,
          {
            localDateTime: typed.local,
            timezone: typed.zone,
            disambiguation: typed.disambiguation,
          },
          now(),
        );
  const signature = JSON.stringify([
    version,
    typed.action,
    typed.local,
    typed.zone,
    typed.reason,
    resolution.kind === 'resolved'
      ? [resolution.resolvedUtc, resolution.disambiguation]
      : null,
  ]);
  const blocked = isCommitBlocked(state, disabledReason);
  // The confirmation stays mounted while its command is in flight (focus stays
  // on the commit control). A refusal or an unknown outcome clears it as the
  // command settles; a commit clears it in `onCommitted`, after the re-read.
  const pending = state.phase === 'pending';
  const wasPending = React.useRef(false);
  React.useEffect(() => {
    if (wasPending.current && !pending && state.phase !== 'committed')
      setConfirmed(null);
    wasPending.current = pending;
  }, [pending, state.phase]);
  // The words of the command in flight follow what was submitted, not the live choice.
  const [submitted, setSubmitted] = React.useState<ActivationAction | ''>('');

  const restart = (): void => {
    controller.startOver();
    fields.reset();
    setConfirmed(null);
    setLocalErrors([]);
  };
  const check = (reasonError: string | null): void => {
    const found = activationLocalErrors({
      offered,
      typed,
      timeStatus: time.status,
      resolution,
      reasonError,
    });
    setLocalErrors(found);
    if (found.length === 0) setConfirmed(signature);
  };
  return {
    offered,
    controller,
    state,
    fields,
    typed,
    resolution,
    time,
    localErrors,
    confirming: confirmed === signature && typed.action !== '',
    pendingAction: pending && submitted !== '' ? submitted : typed.action,
    blocked,
    // Beginning another command after a commit forgets the committed one.
    choose: (action) => {
      if (state.phase === 'committed') restart();
      if (action === 'schedule') setScheduleChosen(true);
      fields.set('action', action);
    },
    proceed: (event) => {
      event.preventDefault();
      if (state.phase === 'committed') return restart();
      if (blocked) return;
      if (typed.action === 'retire' && typed.reason !== '')
        withCmsValidators(
          (validators) =>
            check(validateAssignmentReason(validators, typed.reason)),
          () =>
            setLocalErrors([
              validatorsUnavailableError(ACTIVATION_FIELD_IDS.reason),
            ]),
        );
      else check(null);
    },
    send: () => {
      const submission = activationSubmission(version, typed, resolution);
      if (blocked || submission === null) return;
      setSubmitted(typed.action);
      void controller.submit(submission);
    },
    cancel: () => {
      setConfirmed(null);
      document.getElementById('governed-activation-continue')?.focus();
    },
  };
};
