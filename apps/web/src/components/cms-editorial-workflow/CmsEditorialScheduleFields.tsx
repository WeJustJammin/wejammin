import type { TimeAuthority } from '@wejammin/contracts/time-authority';
import * as React from 'react';

import CmsEditorialScheduleResolution from './CmsEditorialScheduleResolution';
import type { WorkflowLocalError } from './CmsWorkflowCommandFrame';
import { WorkflowSelect, WorkflowTextField } from './CmsWorkflowFields';
import {
  PUBLICATION_ACTION_LABEL,
  SCHEDULE_PUBLISH_WITHHELD_COPY,
} from './cms-workflow-labels';
import type { ScheduleActionChoices } from './cms-workflow-schedule-actions';
import {
  AUDIENCE_HINT,
  SCHEDULE_FIELD_IDS,
  type ScheduleTyped,
} from './cms-workflow-schedule-form-model';
import {
  zoneSuggestions,
  type ScheduleResolution,
} from './cms-workflow-schedule-resolution';
import type { DraftFields } from './use-cms-workflow-draft-fields';

export interface CmsEditorialScheduleFieldsProps {
  readonly fields: DraftFields;
  readonly typed: ScheduleTyped;
  readonly choices: ScheduleActionChoices;
  /** False withholds `publish` and says why beside the Action control. */
  readonly publishPermitted: boolean;
  readonly resolution: ScheduleResolution;
  /** The pinned Time authority once loaded; its zones are the suggestions. */
  readonly authority: TimeAuthority | null;
  readonly localErrors: readonly WorkflowLocalError[];
  /** The body members a server refusal named. */
  readonly named: readonly string[];
  readonly blocked: boolean;
  readonly pending: boolean;
  readonly onSubmit: (event: React.FormEvent) => void;
}

/**
 * The controls of the CMS-03B-07 schedule form and the resolver's answer beside
 * them. A changed local time or time zone forgets an earlier/later choice, so a
 * choice made for one instant never carries over to another.
 */
export default function CmsEditorialScheduleFields({
  fields,
  typed,
  choices,
  publishPermitted,
  resolution,
  authority,
  localErrors,
  named,
  blocked,
  pending,
  onSubmit,
}: CmsEditorialScheduleFieldsProps): React.ReactElement {
  const errorOf = (id: string): string | null =>
    localErrors.find((error) => error.id === id)?.message ?? null;
  const setInstantField = (name: string) => (value: string) => {
    fields.set(name, value);
    fields.set('disambiguation', 'none');
  };
  return (
    <form onSubmit={onSubmit}>
      <WorkflowSelect
        id={SCHEDULE_FIELD_IDS.action.id}
        label={SCHEDULE_FIELD_IDS.action.label}
        value={typed.action}
        hint={publishPermitted ? undefined : SCHEDULE_PUBLISH_WITHHELD_COPY}
        options={choices.options.map((value) => ({
          value,
          label: PUBLICATION_ACTION_LABEL[value],
        }))}
        onChange={(value) => fields.set('action', value)}
      />
      <WorkflowTextField
        id={SCHEDULE_FIELD_IDS.localDateTime.id}
        label={SCHEDULE_FIELD_IDS.localDateTime.label}
        type="datetime-local"
        value={typed.local}
        error={errorOf(SCHEDULE_FIELD_IDS.localDateTime.id)}
        invalid={named.includes('localDateTime')}
        onChange={setInstantField('localDateTime')}
      />
      <WorkflowTextField
        id={SCHEDULE_FIELD_IDS.timezone.id}
        label={SCHEDULE_FIELD_IDS.timezone.label}
        value={typed.zone}
        autoComplete="off"
        listId="schedule-zones"
        suggestions={authority === null ? [] : zoneSuggestions(authority)}
        error={errorOf(SCHEDULE_FIELD_IDS.timezone.id)}
        invalid={named.includes('timezone')}
        onChange={setInstantField('timezone')}
      />
      <CmsEditorialScheduleResolution
        resolution={resolution}
        disambiguation={typed.disambiguation}
        onPickLocal={setInstantField('localDateTime')}
        onPickDisambiguation={(choice) => fields.set('disambiguation', choice)}
      />
      <WorkflowTextField
        id={SCHEDULE_FIELD_IDS.audience.id}
        label={SCHEDULE_FIELD_IDS.audience.label}
        value={typed.audience}
        autoComplete="off"
        hint={AUDIENCE_HINT}
        error={errorOf(SCHEDULE_FIELD_IDS.audience.id)}
        invalid={named.includes('audience')}
        onChange={(value) => fields.set('audience', value)}
      />
      <button
        type="submit"
        aria-disabled={blocked ? 'true' : 'false'}
        aria-busy={pending ? 'true' : 'false'}
      >
        Schedule
      </button>
    </form>
  );
}
