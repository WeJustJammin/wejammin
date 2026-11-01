import * as React from 'react';

import { COLLISION_COPY } from './composition-choices';
import type { Choice, DiffPath } from './composition-types';

type NodeValue = NonNullable<DiffPath['base']>;

export const choiceRadioId = (index: number, choice: Choice): string =>
  `cms-diff-choice-${index}-${choice}`;

const KIND_WORDS = {
  props: 'text changed',
  structure: 'structure changed',
  removed_root: 'block removed',
} as const;

/** A node value in words: its block, its props and its sub-blocks (DEC-193). */
function NodeValueView({
  value,
  absent,
}: {
  readonly value: NodeValue | null;
  readonly absent: string;
}): React.ReactElement {
  if (value === null) return <p>{absent}</p>;
  return (
    <dl className="cms-diff-node">
      <dt>Block</dt>
      <dd>
        {value.blockKey} version {value.blockVersion}
      </dd>
      <dt>Props</dt>
      <dd>
        <code>{JSON.stringify(value.props)}</code>
      </dd>
      <dt>Sub-blocks</dt>
      <dd>
        {value.children.length === 0 ? (
          'None'
        ) : (
          <ul>
            {value.children.map((child) => (
              <li key={child}>
                <code>{child}</code>
              </li>
            ))}
          </ul>
        )}
      </dd>
    </dl>
  );
}

interface Props {
  readonly entry: DiffPath;
  readonly index: number;
  readonly choice: Choice | undefined;
  readonly onChoose: (path: string, choice: Choice) => void;
  readonly disabled: boolean;
}

/** One path of the three-way diff, with its radio pair when it collides (never preselected). */
export default function CmsDiffPath({
  entry,
  index,
  choice,
  onChoose,
  disabled,
}: Props): React.ReactElement {
  const copy =
    entry.collisionKind === null ? null : COLLISION_COPY[entry.collisionKind];
  return (
    <li className="cms-diff-path">
      <h4>
        <code>{entry.path}</code>
      </h4>
      <p>
        {entry.collisionKind === null
          ? 'Changed in the new version. No choice is needed.'
          : `Collision: ${KIND_WORDS[entry.collisionKind]}.`}
      </p>
      <div className="cms-diff-columns">
        <section aria-label={`Base for ${entry.path}`}>
          <h5>Base (pinned version)</h5>
          <NodeValueView
            value={entry.base}
            absent="Not in the pinned version"
          />
        </section>
        <section aria-label={`Theirs for ${entry.path}`}>
          <h5>Theirs (new version)</h5>
          <NodeValueView value={entry.theirs} absent="Not in the new version" />
        </section>
        <section aria-label={`Yours for ${entry.path}`}>
          <h5>Yours (your override)</h5>
          {entry.yours === null ? (
            <p>No local override</p>
          ) : (
            <code>{JSON.stringify(entry.yours)}</code>
          )}
        </section>
      </div>
      {copy === null ? null : (
        <fieldset disabled={disabled}>
          <legend>{copy.legend}</legend>
          {(['yours', 'theirs'] as const).map((value) => (
            <label key={value} className="cms-diff-choice">
              <input
                type="radio"
                id={choiceRadioId(index, value)}
                name={`choice-${entry.path}`}
                value={value}
                checked={choice === value}
                onChange={() => onChoose(entry.path, value)}
              />
              {copy[value]}
            </label>
          ))}
        </fieldset>
      )}
    </li>
  );
}
