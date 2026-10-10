import {
  CMS_TZDB_VERSION,
  CmsPublicationAudienceSchema,
} from '@wejammin/contracts';
import type { TimeAuthority } from '@wejammin/contracts/time-authority';
import * as React from 'react';

import CmsEditorialScheduleResolution, {
  refusalMessage,
} from './CmsEditorialScheduleResolution';
import CmsWorkflowCommandFrame, {
  type WorkflowLocalError,
} from './CmsWorkflowCommandFrame';
import { WorkflowSelect, WorkflowTextField } from './CmsWorkflowFields';
import { WORKFLOW_HEADING_IDS } from './CmsEditorialWorkflowPanel';
import { WORKFLOW_COMMAND_SPECS } from './cms-workflow-command-specs';
import { isCommitBlocked } from './cms-workflow-form-state';
import {
  PUBLICATION_ACTION_LABEL,
  SCHEDULE_PUBLISH_WITHHELD_COPY,
} from './cms-workflow-labels';
import {
  effectiveScheduleAction,
  scheduleActionChoices,
} from './cms-workflow-schedule-actions';
import {
  resolveScheduleInput,
  zoneSuggestions,
  type Disambiguation,
} from './cms-workflow-schedule-resolution';
import { useTimeAuthority } from './use-cms-schedule-time';
import { useDraftFields } from './use-cms-workflow-draft-fields';
import {
  useWorkflowCommand,
  type WorkflowCommandEnvironment,
} from './use-cms-workflow-command';

export interface CmsEditorialScheduleFormProps {
  readonly revisionId: string;
  /** The approved review's `version`: the `expectedVersion` and strong `If-Match`. */
  readonly reviewVersion: string;
  /**
   * Whether the server proved the caller may publish (the workflow read's
   * `permittedNextActions` holds `publish`). Without it the form still schedules
   * `unpublish`, `expire` and `archive` but offers and defaults no `publish`
   * (BE03b:268-270: only the action `publish` is refused to the revision author).
   */
  readonly publishPermitted: boolean;
  readonly disabledReason: string | null;
  readonly refetch: () => Promise<boolean>;
  readonly onDone: (headingId: string) => void;
  readonly environment?: WorkflowCommandEnvironment;
  /** Seams for a test. */
  readonly now?: () => number;
  readonly defaultTimezone?: string;
  readonly loadAuthority?: () => Promise<TimeAuthority>;
}

const browserZone = (): string =>
  Intl.DateTimeFormat().resolvedOptions().timeZone;

const asDisambiguation = (value: string | undefined): Disambiguation =>
  value === 'earlier' || value === 'later' ? value : 'none';

const AUDIENCE_HINT =
  'Lowercase letters, digits, hyphens and underscores, up to 48 characters.';

/**
 * CMS-03B-07. The person gives an action, a local date and time, a time zone and
 * an audience; `resolvedUtc`, `tzdbVersion` and `disambiguation` are computed by
 * the shared Time authority (the pinned snapshot, lazy-loaded when the form is
 * opened) and shown beside the inputs, so the person sees the instant, chooses
 * earlier/later for an ambiguous time and picks one of two alternatives for a
 * nonexistent one. The server re-resolves and is authoritative. A 202 means
 * scheduled, never published.
 */
export default function CmsEditorialScheduleForm({
  revisionId,
  reviewVersion,
  publishPermitted,
  disabledReason,
  refetch,
  onDone,
  environment,
  now = Date.now,
  defaultTimezone,
  loadAuthority,
}: CmsEditorialScheduleFormProps): React.ReactElement {
  const [toggled, setToggled] = React.useState<boolean | null>(null);
  const [localErrors, setLocalErrors] = React.useState<
    readonly WorkflowLocalError[]
  >([]);
  const { controller, state } = useWorkflowCommand({
    spec: WORKFLOW_COMMAND_SPECS['CMS-03B-07'],
    ids: {},
    refetch,
    onCommitted: () => {
      void refetch().then(() => onDone(WORKFLOW_HEADING_IDS.schedules));
    },
    ...(environment === undefined ? {} : { environment }),
  });
  React.useEffect(() => {
    controller.restore(reviewVersion);
  }, [controller, reviewVersion]);
  // A restored draft opens the form; the person can still close it.
  const open = toggled ?? state.restoredValues !== null;
  const time = useTimeAuthority(open, loadAuthority);
  const { authority } = time;
  const suggested = defaultTimezone ?? browserZone();
  const choices = scheduleActionChoices(publishPermitted);
  const fields = useDraftFields(state.restoredValues, {
    action: choices.defaultAction,
    timezone: authority?.hasZone(suggested) === true ? suggested : '',
  });
  // A typed, restored or earlier `publish` never outlives the permission for it.
  const action = effectiveScheduleAction(fields.value('action'), choices);
  const local = fields.value('localDateTime');
  const zone = fields.value('timezone');
  const audience = fields.value('audience');
  const disambiguation = asDisambiguation(fields.value('disambiguation'));

  const resolution =
    authority === null
      ? ({ kind: 'empty' } as const)
      : resolveScheduleInput(
          authority,
          { localDateTime: local, timezone: zone, disambiguation },
          now(),
        );
  const blocked = isCommitBlocked(state, disabledReason);
  const errorOf = (id: string): string | null =>
    localErrors.find((error) => error.id === id)?.message ?? null;
  const named = state.refusal?.fields ?? [];
  const submit = (event: React.FormEvent): void => {
    event.preventDefault();
    if (blocked) return;
    const found: WorkflowLocalError[] = [];
    const add = (id: string, label: string, message: string): void => {
      found.push({ id, label, message });
    };
    if (local === '')
      add(
        'schedule-local',
        'Local date and time',
        'Choose a local date and time.',
      );
    if (zone === '')
      add('schedule-timezone', 'Time zone', 'Choose a time zone.');
    if (audience === '')
      add('schedule-audience', 'Audience', 'Enter an audience.');
    else if (!CmsPublicationAudienceSchema.safeParse(audience).success)
      add(
        'schedule-audience',
        'Audience',
        `Use lowercase letters, digits, hyphens and underscores, up to 48 characters.`,
      );
    if (local !== '' && zone !== '') {
      if (time.status !== 'ready')
        add(
          'schedule-local',
          'Local date and time',
          'The time zone data is not loaded yet.',
        );
      else if (resolution.kind === 'gap')
        add(
          'schedule-local',
          'Local date and time',
          'That local time does not exist in this time zone.',
        );
      else if (resolution.kind === 'fold')
        add(
          'schedule-disambiguation',
          'Earlier or later',
          'Choose the earlier or later time.',
        );
      else if (resolution.kind === 'refused')
        add(
          'schedule-local',
          'Local date and time',
          refusalMessage(resolution),
        );
    }
    setLocalErrors(found);
    if (found.length > 0 || resolution.kind !== 'resolved') return;
    void controller.submit({
      body: {
        revisionId,
        action,
        localDateTime: local,
        timezone: zone,
        resolvedUtc: resolution.resolvedUtc,
        tzdbVersion: CMS_TZDB_VERSION,
        disambiguation: resolution.disambiguation,
        audience,
        expectedVersion: reviewVersion,
      },
      ifMatch: `"${reviewVersion}"`,
      draft: {
        action,
        localDateTime: local,
        timezone: zone,
        audience,
        disambiguation,
      },
    });
  };
  return (
    <details
      open={open}
      onToggle={(event) => setToggled(event.currentTarget.open)}
    >
      <summary>Schedule publication</summary>
      <CmsWorkflowCommandFrame
        headingId="schedule-form-title"
        title="Schedule publication"
        state={state}
        controller={controller}
        pendingLabel="Scheduling…"
        committedLabel={(resource) =>
          `Scheduled, not published: ${PUBLICATION_ACTION_LABEL[resource.action]} for ${resource.audience} at ${resource.resolvedUtc}.`
        }
        fieldIds={{
          action: { id: 'schedule-action', label: 'Action' },
          localDateTime: { id: 'schedule-local', label: 'Local date and time' },
          timezone: { id: 'schedule-timezone', label: 'Time zone' },
          disambiguation: {
            id: 'schedule-disambiguation',
            label: 'Earlier or later',
          },
          audience: { id: 'schedule-audience', label: 'Audience' },
        }}
        localErrors={localErrors}
        disabledReason={disabledReason}
      >
        {time.status === 'failed' ? (
          <p>The time zone data could not be loaded.</p>
        ) : null}
        <form onSubmit={submit}>
          <WorkflowSelect
            id="schedule-action"
            label="Action"
            value={action}
            hint={publishPermitted ? undefined : SCHEDULE_PUBLISH_WITHHELD_COPY}
            options={choices.options.map((value) => ({
              value,
              label: PUBLICATION_ACTION_LABEL[value],
            }))}
            onChange={(value) => fields.set('action', value)}
          />
          <WorkflowTextField
            id="schedule-local"
            label="Local date and time"
            type="datetime-local"
            value={local}
            error={errorOf('schedule-local')}
            invalid={named.includes('localDateTime')}
            onChange={(value) => {
              fields.set('localDateTime', value);
              fields.set('disambiguation', 'none');
            }}
          />
          <WorkflowTextField
            id="schedule-timezone"
            label="Time zone"
            value={zone}
            autoComplete="off"
            listId="schedule-zones"
            suggestions={authority === null ? [] : zoneSuggestions(authority)}
            error={errorOf('schedule-timezone')}
            invalid={named.includes('timezone')}
            onChange={(value) => {
              fields.set('timezone', value);
              fields.set('disambiguation', 'none');
            }}
          />
          <CmsEditorialScheduleResolution
            resolution={resolution}
            disambiguation={disambiguation}
            onPickLocal={(value) => {
              fields.set('localDateTime', value);
              fields.set('disambiguation', 'none');
            }}
            onPickDisambiguation={(choice) =>
              fields.set('disambiguation', choice)
            }
          />
          <WorkflowTextField
            id="schedule-audience"
            label="Audience"
            value={audience}
            autoComplete="off"
            hint={AUDIENCE_HINT}
            error={errorOf('schedule-audience')}
            invalid={named.includes('audience')}
            onChange={(value) => fields.set('audience', value)}
          />
          <button
            type="submit"
            aria-disabled={blocked ? 'true' : 'false'}
            aria-busy={state.phase === 'pending' ? 'true' : 'false'}
          >
            Schedule
          </button>
        </form>
      </CmsWorkflowCommandFrame>
    </details>
  );
}
