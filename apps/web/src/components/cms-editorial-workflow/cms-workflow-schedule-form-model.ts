import type {
  PublicationAction,
  PublicationScheduleRequest,
} from '@wejammin/contracts';
import { CMS_TZDB_VERSION } from '@wejammin/contracts/client';

import type { CmsValidators } from '../../lib/cms-contract-validators';
import { refusalMessage } from './CmsEditorialScheduleResolution';
import type { WorkflowLocalError } from './CmsWorkflowCommandFrame';
import type { WorkflowSubmission } from './cms-workflow-command-controller';
import type {
  Disambiguation,
  ScheduleResolution,
} from './cms-workflow-schedule-resolution';
import type { TimeAuthorityStatus } from './use-cms-schedule-time';

/*
 * The model of the CMS-03B-07 schedule form, free of React: the control ids its
 * command frame names, what the person has typed, the sentences a local check
 * finds before anything is sent, and the submission a resolved input becomes.
 * The component reads this; it owns no rule of its own.
 */

/** The id of each control and the label a local or server error names it by. */
export const SCHEDULE_FIELD_IDS = {
  action: { id: 'schedule-action', label: 'Action' },
  localDateTime: { id: 'schedule-local', label: 'Local date and time' },
  timezone: { id: 'schedule-timezone', label: 'Time zone' },
  disambiguation: { id: 'schedule-disambiguation', label: 'Earlier or later' },
  audience: { id: 'schedule-audience', label: 'Audience' },
} as const;

export const AUDIENCE_HINT =
  'Lowercase letters, digits, hyphens and underscores, up to 48 characters.';

/** What the person has entered (the action already limited to the offered ones). */
export interface ScheduleTyped {
  readonly action: PublicationAction;
  readonly local: string;
  readonly zone: string;
  readonly audience: string;
  readonly disambiguation: Disambiguation;
}

export const asDisambiguation = (value: string | undefined): Disambiguation =>
  value === 'earlier' || value === 'later' ? value : 'none';

/** A local error naming the control `field` by the id and label its server twin uses. */
const errorOn = (
  field: { readonly id: string; readonly label: string },
  message: string,
): WorkflowLocalError => ({ id: field.id, label: field.label, message });

/**
 * Every problem with the input that can be named without asking the server, in
 * form order: the three required values, the audience grammar, then what the
 * pinned resolver makes of the local time. Empty means the form may send.
 */
export const scheduleLocalErrors = (
  validators: Pick<CmsValidators, 'CmsPublicationAudienceSchema'>,
  typed: ScheduleTyped,
  timeStatus: TimeAuthorityStatus,
  resolution: ScheduleResolution,
): readonly WorkflowLocalError[] => {
  const { localDateTime, timezone, disambiguation, audience } =
    SCHEDULE_FIELD_IDS;
  const found: WorkflowLocalError[] = [];
  if (typed.local === '')
    found.push(errorOn(localDateTime, 'Choose a local date and time.'));
  if (typed.zone === '') found.push(errorOn(timezone, 'Choose a time zone.'));
  if (typed.audience === '')
    found.push(errorOn(audience, 'Enter an audience.'));
  else if (
    !validators.CmsPublicationAudienceSchema.safeParse(typed.audience).success
  )
    found.push(
      errorOn(
        audience,
        'Use lowercase letters, digits, hyphens and underscores, up to 48 characters.',
      ),
    );
  if (typed.local === '' || typed.zone === '') return found;
  if (timeStatus !== 'ready')
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
  return found;
};

/**
 * The command a resolved input sends: the instant, the pinned tz version and the
 * disambiguation the resolver settled on, at the review version the form holds.
 * The draft is only the editable text, what a step-up detour stores.
 */
export const scheduleSubmission = (
  revisionId: string,
  reviewVersion: string,
  typed: ScheduleTyped,
  resolved: Extract<ScheduleResolution, { kind: 'resolved' }>,
): WorkflowSubmission<PublicationScheduleRequest> => ({
  body: {
    revisionId,
    action: typed.action,
    localDateTime: typed.local,
    timezone: typed.zone,
    resolvedUtc: resolved.resolvedUtc,
    tzdbVersion: CMS_TZDB_VERSION,
    disambiguation: resolved.disambiguation,
    audience: typed.audience,
    expectedVersion: reviewVersion,
  },
  ifMatch: `"${reviewVersion}"`,
  draft: {
    action: typed.action,
    localDateTime: typed.local,
    timezone: typed.zone,
    audience: typed.audience,
    disambiguation: typed.disambiguation,
  },
});
