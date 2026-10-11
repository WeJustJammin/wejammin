import type { TimeAuthority } from '@wejammin/contracts/time-authority';
import * as React from 'react';

import CmsEditorialScheduleFields from './CmsEditorialScheduleFields';
import CmsWorkflowCommandFrame, {
  type WorkflowLocalError,
} from './CmsWorkflowCommandFrame';
import { WORKFLOW_HEADING_IDS } from './CmsEditorialWorkflowPanel';
import { WORKFLOW_COMMAND_SPECS } from './cms-workflow-command-specs';
import { isCommitBlocked } from './cms-workflow-form-state';
import { PUBLICATION_ACTION_LABEL } from './cms-workflow-labels';
import {
  effectiveScheduleAction,
  scheduleActionChoices,
} from './cms-workflow-schedule-actions';
import {
  SCHEDULE_FIELD_IDS,
  asDisambiguation,
  scheduleLocalErrors,
  scheduleSubmission,
  type ScheduleTyped,
} from './cms-workflow-schedule-form-model';
import { resolveScheduleInput } from './cms-workflow-schedule-resolution';
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
  const typed: ScheduleTyped = {
    // A typed, restored or earlier `publish` never outlives the permission for it.
    action: effectiveScheduleAction(fields.value('action'), choices),
    local: fields.value('localDateTime'),
    zone: fields.value('timezone'),
    audience: fields.value('audience'),
    disambiguation: asDisambiguation(fields.value('disambiguation')),
  };
  const resolution =
    authority === null
      ? ({ kind: 'empty' } as const)
      : resolveScheduleInput(
          authority,
          {
            localDateTime: typed.local,
            timezone: typed.zone,
            disambiguation: typed.disambiguation,
          },
          now(),
        );
  const blocked = isCommitBlocked(state, disabledReason);
  const submit = (event: React.FormEvent): void => {
    event.preventDefault();
    if (blocked) return;
    const found = scheduleLocalErrors(typed, time.status, resolution);
    setLocalErrors(found);
    if (found.length > 0 || resolution.kind !== 'resolved') return;
    void controller.submit(
      scheduleSubmission(revisionId, reviewVersion, typed, resolution),
    );
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
        fieldIds={SCHEDULE_FIELD_IDS}
        localErrors={localErrors}
        disabledReason={disabledReason}
      >
        {time.status === 'failed' ? (
          <p>The time zone data could not be loaded.</p>
        ) : null}
        <CmsEditorialScheduleFields
          fields={fields}
          typed={typed}
          choices={choices}
          publishPermitted={publishPermitted}
          resolution={resolution}
          authority={authority}
          localErrors={localErrors}
          named={state.refusal?.fields ?? []}
          blocked={blocked}
          pending={state.phase === 'pending'}
          onSubmit={submit}
        />
      </CmsWorkflowCommandFrame>
    </details>
  );
}
