import type {
  GovernedActivationRequest,
  GovernedReviewDetailResource,
} from '@wejammin/contracts';
import { CMS_TZDB_VERSION } from '@wejammin/contracts/client';

import type { WorkflowLocalError } from '../cms-editorial-workflow/CmsWorkflowCommandFrame';
import { refusalMessage } from '../cms-editorial-workflow/CmsEditorialScheduleResolution';
import type { WorkflowSubmission } from '../cms-editorial-workflow/cms-workflow-command-controller';
import {
  SCHEDULE_FIELD_IDS,
  asDisambiguation,
} from '../cms-editorial-workflow/cms-workflow-schedule-form-model';
import type {
  Disambiguation,
  ScheduleResolution,
} from '../cms-editorial-workflow/cms-workflow-schedule-resolution';
import type { TimeAuthorityStatus } from '../cms-editorial-workflow/use-cms-schedule-time';
import type { GovernedActivationCommitted } from './governed-activation-command-spec';
import {
  GOVERNED_SUBJECT_KIND_LABEL,
  governedSupersededSentence,
} from './governed-review-labels';

/*
 * The model of the CMS-03C-09 form, free of React: which actions the server
 * offers, the fixed words of each (the consequence, the confirmation, the
 * result), what the person has typed, the sentences a local check finds before
 * anything is sent, and the request a confirmed input becomes. The component
 * reads this; it owns no rule of its own.
 */

export type ActivationAction = 'activate' | 'schedule' | 'retire';

const ORDER: readonly ActivationAction[] = ['activate', 'schedule', 'retire'];

/** The actions the server permits, in the order the form offers them. */
export const offeredActivationActions = (
  permitted: GovernedReviewDetailResource['permittedNextActions'],
): readonly ActivationAction[] =>
  ORDER.filter((action) => permitted.includes(action));

export const asActivationAction = (
  value: string,
  offered: readonly ActivationAction[],
): ActivationAction | '' =>
  (offered as readonly string[]).includes(value)
    ? (value as ActivationAction)
    : '';

export const ACTIVATION_ACTION_LABEL: Readonly<
  Record<ActivationAction, string>
> = {
  activate: 'Activate now',
  schedule: 'Schedule activation',
  retire: 'Retire this version',
};

/** The commit control names what it does, exactly as the confirmation heading does. */
export const ACTIVATION_COMMIT_LABEL: Readonly<
  Record<ActivationAction, string>
> = {
  activate: 'Activate this version',
  schedule: 'Schedule activation',
  retire: 'Retire this version',
};

export const ACTIVATION_CONFIRM_TITLE: Readonly<
  Record<ActivationAction, string>
> = {
  activate: 'Confirm activation',
  schedule: 'Confirm scheduled activation',
  retire: 'Confirm retirement',
};

export const RETIRE_CONSEQUENCE =
  'Entries bound to this version can no longer publish.';

export const ACTIVATION_CONSEQUENCE: Readonly<
  Record<ActivationAction, string>
> = {
  activate:
    'This version becomes the active one and any version that is active now is superseded. Activation is not publication.',
  schedule:
    'This version is not active until the time you choose. Nothing changes before then.',
  retire: RETIRE_CONSEQUENCE,
};

const VERB: Readonly<Record<ActivationAction, string>> = {
  activate: 'activate',
  schedule: 'schedule',
  retire: 'retire',
};

const sentenceOf = (offered: readonly ActivationAction[]): string => {
  const verbs = offered.map((action) => VERB[action]);
  const last = verbs[verbs.length - 1] as string;
  return verbs.length === 1
    ? last
    : `${verbs.slice(0, -1).join(', ')} or ${last}`;
};

export const activationFormTitle = (
  offered: readonly ActivationAction[],
): string => {
  const phrase = sentenceOf(offered);
  return `${phrase.charAt(0).toUpperCase()}${phrase.slice(1)} this version`;
};

export const activationChoiceError = (
  offered: readonly ActivationAction[],
): string => `Choose ${sentenceOf(offered)}.`;

/** What the person has entered; `action` is already limited to the offered ones. */
export interface ActivationTyped {
  readonly action: ActivationAction | '';
  readonly local: string;
  readonly zone: string;
  readonly reason: string;
  readonly disambiguation: Disambiguation;
}

export const ACTIVATION_FIELD_IDS = {
  action: { id: 'governed-activation', label: 'Action' },
  localDateTime: SCHEDULE_FIELD_IDS.localDateTime,
  timezone: SCHEDULE_FIELD_IDS.timezone,
  disambiguation: SCHEDULE_FIELD_IDS.disambiguation,
  reason: { id: 'governed-activation-reason', label: 'Reason (optional)' },
} as const;

export const RETIRE_REASON_MAX = 256;

export const typedFrom = (
  value: (name: string) => string,
  offered: readonly ActivationAction[],
): ActivationTyped => ({
  action: asActivationAction(value('action'), offered),
  local: value('localDateTime'),
  zone: value('timezone'),
  reason: value('reason'),
  disambiguation: asDisambiguation(value('disambiguation')),
});

/** A non-empty local value the resolver cannot read, such as a five-digit year. */
const INVALID_LOCAL_MESSAGE = 'Enter a valid local date and time.';

const errorOn = (
  field: { readonly id: string; readonly label: string },
  message: string,
): WorkflowLocalError => ({ id: field.id, label: field.label, message });

/**
 * Every problem with the input that can be named without asking the server, in
 * form order: the choice, then for a schedule the three time inputs and what the
 * pinned resolver makes of them, then for a retirement the reason. Empty means
 * the form may go on to the confirmation.
 */
export const activationLocalErrors = (input: {
  readonly offered: readonly ActivationAction[];
  readonly typed: ActivationTyped;
  readonly timeStatus: TimeAuthorityStatus;
  readonly resolution: ScheduleResolution;
  readonly reasonError: string | null;
}): readonly WorkflowLocalError[] => {
  const { typed, resolution } = input;
  const { action, localDateTime, timezone, disambiguation, reason } =
    ACTIVATION_FIELD_IDS;
  if (typed.action === '')
    return [errorOn(action, activationChoiceError(input.offered))];
  if (typed.action === 'retire')
    return input.reasonError === null
      ? []
      : [errorOn(reason, input.reasonError)];
  if (typed.action === 'activate') return [];
  const found: WorkflowLocalError[] = [];
  if (typed.local === '')
    found.push(errorOn(localDateTime, 'Choose a local date and time.'));
  if (typed.zone === '') found.push(errorOn(timezone, 'Choose a time zone.'));
  if (typed.local === '' || typed.zone === '') return found;
  if (input.timeStatus !== 'ready')
    found.push(errorOn(localDateTime, 'The time zone data is not loaded yet.'));
  else if (resolution.kind === 'gap')
    found.push(
      errorOn(
        localDateTime,
        'That local time does not exist in this time zone.',
      ),
    );
  else if (resolution.kind === 'fold')
    found.push(errorOn(disambiguation, 'Choose the earlier or later time.'));
  else if (resolution.kind === 'refused')
    found.push(errorOn(localDateTime, refusalMessage(resolution)));
  else if (resolution.kind !== 'resolved')
    found.push(errorOn(localDateTime, INVALID_LOCAL_MESSAGE));
  return found;
};

/** The subject version the confirmation and the result name, in words. */
const subjectOf = (
  review: Pick<GovernedReviewDetailResource, 'subjectKind' | 'subjectKey'>,
  version: number,
): string =>
  `${GOVERNED_SUBJECT_KIND_LABEL[review.subjectKind]} ${review.subjectKey}, version ${version}`;

/**
 * The sentence the confirmation states about what is about to happen; null
 * when there is nothing to confirm (no action, or a schedule that did not
 * resolve). Exhaustive by action: none borrows another's sentence.
 */
export const confirmationSentence = (
  review: GovernedReviewDetailResource,
  typed: ActivationTyped,
  resolution: ScheduleResolution,
): string | null => {
  const subject = subjectOf(review, review.subjectVersion);
  switch (typed.action) {
    case 'activate':
      return `Activate ${subject} now.`;
    case 'retire':
      return `Retire ${subject}.`;
    case 'schedule':
      return resolution.kind === 'resolved'
        ? `Schedule activation of ${subject} for ${typed.local} in ${typed.zone} (${resolution.resolvedUtc}).`
        : null;
    case '':
      return null;
  }
};

/** The result in words; an activation names its superseded version (DEC-191). */
export const activationCommittedLabel = (
  review: Pick<GovernedReviewDetailResource, 'subjectKind' | 'subjectKey'>,
  resource: GovernedActivationCommitted,
): string => {
  const subject = subjectOf(review, resource.subjectVersion);
  switch (resource.action) {
    case 'activate':
      return `Activated, not published: ${subject} is now the active version.${governedSupersededSentence(resource.supersededVersion)}`;
    case 'schedule':
      return `Scheduled, not active: ${subject} will activate at ${resource.scheduledForUtc ?? ''}. Nothing changes before then.`;
    case 'retire':
      return `Retired: ${subject}. ${RETIRE_CONSEQUENCE}`;
  }
};

/**
 * The command a confirmed input becomes, at the review version the form holds.
 * The draft is only the editable text, what a step-up detour stores; the
 * resolved instant is recomputed on return.
 */
export const activationSubmission = (
  version: string,
  typed: ActivationTyped,
  resolution: ScheduleResolution,
): WorkflowSubmission<GovernedActivationRequest> | null => {
  const draft = {
    action: typed.action,
    localDateTime: typed.local,
    timezone: typed.zone,
    disambiguation: typed.disambiguation,
    reason: typed.reason,
  };
  const base = { ifMatch: `"${version}"`, draft };
  switch (typed.action) {
    case 'activate':
      return {
        ...base,
        body: { action: 'activate', expectedVersion: version },
      };
    case 'retire':
      return {
        ...base,
        body: {
          action: 'retire',
          expectedVersion: version,
          ...(typed.reason === '' ? {} : { reason: typed.reason }),
        },
      };
    case 'schedule':
      return resolution.kind !== 'resolved'
        ? null
        : {
            ...base,
            body: {
              action: 'schedule',
              expectedVersion: version,
              activateAt: {
                localDateTime: typed.local,
                timezone: typed.zone,
                resolvedUtc: resolution.resolvedUtc,
                tzdbVersion: CMS_TZDB_VERSION,
                disambiguation: resolution.disambiguation,
              },
            },
          };
    default:
      return null;
  }
};
