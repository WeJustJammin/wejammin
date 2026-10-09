import { CMS_TZDB_VERSION } from '@wejammin/contracts';
import * as React from 'react';

import {
  offsetLabel,
  type Disambiguation,
  type ScheduleResolution,
} from './cms-workflow-schedule-resolution';

export interface CmsEditorialScheduleResolutionProps {
  readonly resolution: ScheduleResolution;
  readonly disambiguation: Disambiguation;
  readonly onPickLocal: (localDateTime: string) => void;
  readonly onPickDisambiguation: (choice: Disambiguation) => void;
}

/** The sentence a refusal of the pinned resolver states beside the inputs. */
export const refusalMessage = (
  resolution: Extract<ScheduleResolution, { kind: 'refused' }>,
): string =>
  resolution.reason === 'unknown_timezone'
    ? 'That time zone is not recognised.'
    : resolution.window === undefined
      ? 'This time cannot be scheduled.'
      : `Choose a time between ${resolution.window.minUtc} and ${resolution.window.maxUtc}.`;

/**
 * What the pinned resolver makes of the local time, as text: the one resolved
 * instant with its offset, the two alternatives of a nonexistent time, the
 * earlier/later pair of an ambiguous one, or the reason it cannot be scheduled.
 * The status line is the polite region; the choices sit beside it as native
 * radios, and both instants are always shown so no choice is made blind.
 */
export default function CmsEditorialScheduleResolution({
  resolution,
  disambiguation,
  onPickLocal,
  onPickDisambiguation,
}: CmsEditorialScheduleResolutionProps): React.ReactElement {
  const fold =
    resolution.kind === 'fold'
      ? resolution.alternatives
      : resolution.kind === 'resolved'
        ? (resolution.fold ?? null)
        : null;
  const status =
    resolution.kind === 'empty'
      ? 'Choose a local date and time and a time zone to see the resolved instant.'
      : resolution.kind === 'resolved'
        ? `Resolved to ${resolution.resolvedUtc} (${offsetLabel(resolution.offsetSeconds)}, time zone data ${CMS_TZDB_VERSION}).`
        : resolution.kind === 'gap'
          ? 'That local time does not exist in this time zone.'
          : resolution.kind === 'fold'
            ? 'That local time happens twice.'
            : refusalMessage(resolution);
  return (
    <div data-cms-schedule-resolution="">
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-cms-schedule-status=""
      >
        {status}
      </p>
      {resolution.kind === 'gap' ? (
        <fieldset>
          <legend>Choose a time that exists</legend>
          {resolution.alternatives.map((choice) => (
            <label key={choice.localDateTime}>
              <input
                type="radio"
                name="schedule-gap"
                value={choice.localDateTime}
                checked={false}
                onChange={() => onPickLocal(choice.localDateTime)}
              />
              Use {choice.localDateTime} ({choice.resolvedUtc})
            </label>
          ))}
        </fieldset>
      ) : null}
      {fold === null ? null : (
        <fieldset id="schedule-disambiguation">
          <legend>Earlier or later</legend>
          {fold.map((choice) => (
            <label key={choice.disambiguation}>
              <input
                type="radio"
                name="schedule-fold"
                value={choice.disambiguation}
                checked={disambiguation === choice.disambiguation}
                onChange={() => onPickDisambiguation(choice.disambiguation)}
              />
              {choice.disambiguation === 'earlier' ? 'Earlier' : 'Later'} (
              {choice.resolvedUtc})
            </label>
          ))}
        </fieldset>
      )}
    </div>
  );
}
