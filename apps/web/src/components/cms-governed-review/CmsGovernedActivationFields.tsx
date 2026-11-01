import type { TimeAuthority } from '@wejammin/contracts/time-authority';
import * as React from 'react';

import CmsEditorialScheduleResolution from '../cms-editorial-workflow/CmsEditorialScheduleResolution';
import type { WorkflowLocalError } from '../cms-editorial-workflow/CmsWorkflowCommandFrame';
import {
  WorkflowRadioGroup,
  WorkflowTextArea,
  WorkflowTextField,
} from '../cms-editorial-workflow/CmsWorkflowFields';
import {
  zoneSuggestions,
  type ScheduleResolution,
} from '../cms-editorial-workflow/cms-workflow-schedule-resolution';
import { countCharacters } from '../cms-editorial-workflow/cms-workflow-reason';
import type { TimeAuthorityStatus } from '../cms-editorial-workflow/use-cms-schedule-time';
import type { DraftFields } from '../cms-editorial-workflow/use-cms-workflow-draft-fields';
import {
  ACTIVATION_ACTION_LABEL,
  ACTIVATION_CONSEQUENCE,
  ACTIVATION_FIELD_IDS,
  RETIRE_REASON_MAX,
  type ActivationAction,
  type ActivationTyped,
} from './governed-activation-model';

export interface CmsGovernedActivationFieldsProps {
  readonly offered: readonly ActivationAction[];
  readonly fields: DraftFields;
  readonly typed: ActivationTyped;
  readonly resolution: ScheduleResolution;
  /** The pinned Time authority once loaded; its zones are the suggestions. */
  readonly authority: TimeAuthority | null;
  readonly timeStatus: TimeAuthorityStatus;
  readonly localErrors: readonly WorkflowLocalError[];
  /** The body members a server refusal named. */
  readonly named: readonly string[];
  readonly blocked: boolean;
  readonly pending: boolean;
  readonly onChoose: (action: ActivationAction) => void;
  readonly onContinue: (event: React.SyntheticEvent) => void;
}

/**
 * The controls of the CMS-03C-09 form: the offered actions as native radios,
 * the named consequence of the chosen one and, for a schedule, the local time
 * and zone with the shared Time authority's answer beside them, or, for a
 * retirement, the optional reason. A changed local time or zone forgets an
 * earlier/later choice, so a choice made for one instant never carries over.
 */
export default function CmsGovernedActivationFields({
  offered,
  fields,
  typed,
  resolution,
  authority,
  timeStatus,
  localErrors,
  named,
  blocked,
  pending,
  onChoose,
  onContinue,
}: CmsGovernedActivationFieldsProps): React.ReactElement {
  const errorOf = (id: string): string | null =>
    localErrors.find((error) => error.id === id)?.message ?? null;
  const setInstantField = (name: string) => (value: string) => {
    fields.set(name, value);
    fields.set('disambiguation', 'none');
  };
  const { action, localDateTime, timezone, reason } = ACTIVATION_FIELD_IDS;
  return (
    <form onSubmit={onContinue}>
      <WorkflowRadioGroup
        id={action.id}
        legend={action.label}
        name="action"
        value={typed.action}
        error={errorOf(action.id)}
        options={offered.map((value) => ({
          value,
          label: ACTIVATION_ACTION_LABEL[value],
        }))}
        onChange={(value) => onChoose(value as ActivationAction)}
      />
      {typed.action === '' ? null : (
        <p>{ACTIVATION_CONSEQUENCE[typed.action]}</p>
      )}
      {typed.action !== 'schedule' ? null : (
        <>
          {timeStatus === 'failed' ? (
            <p>The time zone data could not be loaded.</p>
          ) : null}
          <WorkflowTextField
            id={localDateTime.id}
            label={localDateTime.label}
            type="datetime-local"
            value={typed.local}
            error={errorOf(localDateTime.id)}
            invalid={named.includes('localDateTime')}
            onChange={setInstantField('localDateTime')}
          />
          <WorkflowTextField
            id={timezone.id}
            label={timezone.label}
            value={typed.zone}
            autoComplete="off"
            listId="governed-activation-zones"
            suggestions={authority === null ? [] : zoneSuggestions(authority)}
            error={errorOf(timezone.id)}
            invalid={named.includes('timezone')}
            onChange={setInstantField('timezone')}
          />
          <CmsEditorialScheduleResolution
            resolution={resolution}
            disambiguation={typed.disambiguation}
            onPickLocal={setInstantField('localDateTime')}
            onPickDisambiguation={(choice) =>
              fields.set('disambiguation', choice)
            }
          />
        </>
      )}
      {typed.action !== 'retire' ? null : (
        <WorkflowTextArea
          id={reason.id}
          label={reason.label}
          value={typed.reason}
          counter={{
            used: countCharacters(typed.reason),
            max: RETIRE_REASON_MAX,
          }}
          error={errorOf(reason.id)}
          invalid={named.includes('reason')}
          onChange={(value) => fields.set('reason', value)}
        />
      )}
      <button
        id="governed-activation-continue"
        type="submit"
        aria-disabled={blocked ? 'true' : 'false'}
        aria-busy={pending ? 'true' : 'false'}
      >
        Continue
      </button>
    </form>
  );
}
