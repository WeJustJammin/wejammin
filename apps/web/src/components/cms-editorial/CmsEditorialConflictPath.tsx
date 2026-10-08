import type { JsonValue } from '@wejammin/contracts';
import * as React from 'react';

import CmsFieldEditor from '../cms-editorial-fields/CmsFieldEditor';
import CmsFieldValueView from '../cms-editorial-fields/CmsFieldValueView';
import type { CmsFieldDescriptor } from '../cms-editorial-fields/cms-field-descriptor';
import type { CmsFieldIssue } from '../cms-editorial-fields/cms-field-issue';
import type {
  CmsEditorialConflictChoice,
  CmsEditorialConflictSide,
  CmsEditorialConflictChoiceState,
  CmsEditorialConflictPathView,
} from './cms-editorial-conflict-state';

export interface CmsEditorialConflictPathProps {
  readonly path: CmsEditorialConflictPathView;
  readonly descriptor: CmsFieldDescriptor;
  readonly choice: CmsEditorialConflictChoiceState;
  readonly issues: readonly CmsFieldIssue[];
  readonly disabled: boolean;
  readonly onChoose: (choice: CmsEditorialConflictChoice) => void;
  readonly onExplicit: (value: JsonValue | null) => void;
  readonly onInputError: (message: string | null) => void;
}

const SIDES = [
  { key: 'base', group: 'Base', radio: 'Keep base' },
  { key: 'theirs', group: 'Their version', radio: 'Keep their version' },
  { key: 'yours', group: 'Your version', radio: 'Keep your version' },
] as const;

/**
 * A side is rendered by its provenance: one the draft holds no value for
 * (`missing`) or holds an explicit null for (`explicit_null`) shows no value,
 * whatever the response carried, so an upstream inconsistency (which the
 * contract also refuses) can never be disclosed.
 */
const shownValue = (side: CmsEditorialConflictSide): JsonValue | null =>
  side.provenance === 'missing' || side.provenance === 'explicit_null'
    ? null
    : side.value;

/**
 * One divergent field: its three preimages as typed values, one radio per
 * preimage and a fourth for an explicit replacement edited with the field's own
 * native editor. Nothing is preselected: a winner is never inferred.
 */
export default function CmsEditorialConflictPath({
  path,
  descriptor,
  choice,
  issues,
  disabled,
  onChoose,
  onExplicit,
  onInputError,
}: CmsEditorialConflictPathProps): React.ReactElement {
  const name = `choice-${path.fieldId}`;
  const errorId = `conflict-${path.fieldId}-errors`;
  return (
    <fieldset
      id={`conflict-${path.fieldId}`}
      data-cms-editorial-conflict-path={path.fieldId}
      aria-describedby={issues.length > 0 ? errorId : undefined}
      disabled={disabled}
    >
      <legend>{descriptor.label}</legend>
      <div className="cms-conflict-sides">
        {SIDES.map((side, index) => (
          <div key={side.key} role="group" aria-label={side.group}>
            <p className="cms-conflict-side-name">{side.group}</p>
            <div className="cms-conflict-value">
              <CmsFieldValueView
                descriptor={descriptor}
                value={shownValue(path[side.key])}
                provenance={path[side.key].provenance}
              />
            </div>
            <label>
              <input
                type="radio"
                id={index === 0 ? `field-${path.fieldId}` : undefined}
                name={name}
                value={side.key}
                checked={choice.choice === side.key}
                onChange={() => onChoose(side.key)}
              />{' '}
              {side.radio}
            </label>
          </div>
        ))}
      </div>
      <div>
        <label>
          <input
            type="radio"
            name={name}
            value="explicit"
            checked={choice.choice === 'explicit'}
            onChange={() => onChoose('explicit')}
          />{' '}
          Use a new value
        </label>
        {choice.choice === 'explicit' ? (
          <CmsFieldEditor
            descriptor={{ ...descriptor, fieldId: `${path.fieldId}-explicit` }}
            value={choice.explicit}
            issues={[]}
            onChange={onExplicit}
            onInputError={onInputError}
          />
        ) : null}
      </div>
      {issues.length > 0 ? (
        <ul id={errorId} className="cms-field-errors">
          {issues.map((issue, index) => (
            <li key={`${issue.code}-${index}`}>{issue.message}</li>
          ))}
        </ul>
      ) : null}
    </fieldset>
  );
}
