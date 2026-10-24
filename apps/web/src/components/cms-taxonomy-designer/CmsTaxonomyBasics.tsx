import * as React from 'react';

import { TAXONOMY_KEY_ID, TAXONOMY_SHAPE_ID } from './taxonomy-designer-ids';
import { TAXONOMY_SHAPES, type TaxonomyShape } from './taxonomy-vocabulary';

const SHAPE_HELP: Readonly<Record<TaxonomyShape, string>> = {
  flat: 'Flat: terms form one list.',
  hierarchical: 'Hierarchical: a term may sit under a parent term.',
};

interface Props {
  readonly taxonomyKey: string;
  readonly onKeyChange: (value: string) => void;
  /** A saved key is immutable: a successor keeps it. */
  readonly keyReadOnly: boolean;
  readonly shape: TaxonomyShape | '';
  readonly onShapeChange: (shape: TaxonomyShape) => void;
  readonly keyIssues: readonly string[];
  readonly shapeIssues: readonly string[];
}

/** The vocabulary key and its shape. */
export default function CmsTaxonomyBasics({
  taxonomyKey,
  onKeyChange,
  keyReadOnly,
  shape,
  onShapeChange,
  keyIssues,
  shapeIssues,
}: Props): React.ReactElement {
  return (
    <>
      <div className="cms-taxonomy-field">
        <label htmlFor={TAXONOMY_KEY_ID}>Vocabulary key</label>
        <input
          id={TAXONOMY_KEY_ID}
          value={taxonomyKey}
          readOnly={keyReadOnly}
          maxLength={64}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          aria-describedby={`cms-taxonomy-key-help${keyIssues.length > 0 ? ' cms-taxonomy-key-errors' : ''}`}
          aria-invalid={keyIssues.length > 0 ? true : undefined}
          onChange={(event) => onKeyChange(event.currentTarget.value)}
        />
        <small id="cms-taxonomy-key-help">
          {keyReadOnly
            ? 'The key of a saved vocabulary cannot change.'
            : '2 to 64 lowercase letters, digits or hyphens, starting with a letter. It cannot change later.'}
        </small>
        {keyIssues.length > 0 ? (
          <ul id="cms-taxonomy-key-errors" className="cms-field-errors">
            {keyIssues.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        ) : null}
      </div>
      <fieldset
        id={TAXONOMY_SHAPE_ID}
        tabIndex={-1}
        aria-describedby={
          shapeIssues.length > 0 ? 'cms-taxonomy-shape-errors' : undefined
        }
      >
        <legend>Shape</legend>
        {TAXONOMY_SHAPES.map((option) => (
          <label key={option}>
            <input
              type="radio"
              name="cms-taxonomy-shape"
              checked={shape === option}
              onChange={() => onShapeChange(option)}
            />
            {SHAPE_HELP[option]}
          </label>
        ))}
        {shapeIssues.length > 0 ? (
          <ul id="cms-taxonomy-shape-errors" className="cms-field-errors">
            {shapeIssues.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        ) : null}
      </fieldset>
    </>
  );
}
