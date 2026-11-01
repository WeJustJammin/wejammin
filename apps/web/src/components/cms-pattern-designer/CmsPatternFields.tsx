import * as React from 'react';

import type { PatternSummaryItem } from './CmsPatternStatus';
import type { PatternDesignerContext } from './pattern-designer-request';
import { PATTERN_KEY_ID, PATTERN_TYPES_ID } from './pattern-designer-ids';

interface Props {
  readonly patternKey: string;
  readonly onKeyChange: (value: string) => void;
  /** A saved key is immutable: a successor keeps it. */
  readonly keyReadOnly: boolean;
  readonly context: PatternDesignerContext;
  readonly compatibleTypeIds: readonly string[];
  /** Content types the version names that the context no longer offers. */
  readonly unavailableTypeIds: readonly string[];
  readonly onToggleType: (id: string) => void;
  readonly keyIssues: readonly PatternSummaryItem[];
  readonly typeIssues: readonly PatternSummaryItem[];
}

/** The pattern key and the content types the pattern may be used with. */
export default function CmsPatternFields({
  patternKey,
  onKeyChange,
  keyReadOnly,
  context,
  compatibleTypeIds,
  unavailableTypeIds,
  onToggleType,
  keyIssues,
  typeIssues,
}: Props): React.ReactElement {
  return (
    <>
      <div className="cms-pattern-field">
        <label htmlFor={PATTERN_KEY_ID}>Pattern key</label>
        <input
          id={PATTERN_KEY_ID}
          value={patternKey}
          readOnly={keyReadOnly}
          maxLength={64}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          aria-describedby={`cms-pattern-key-help${keyIssues.length > 0 ? ' cms-pattern-key-errors' : ''}`}
          aria-invalid={keyIssues.length > 0 ? true : undefined}
          onChange={(event) => onKeyChange(event.currentTarget.value)}
        />
        <small id="cms-pattern-key-help">
          {keyReadOnly
            ? 'The key of a saved pattern cannot change.'
            : '2 to 64 lowercase letters, digits or hyphens, starting with a letter. It names the pattern in its address.'}
        </small>
        {keyIssues.length > 0 ? (
          <ul id="cms-pattern-key-errors" className="cms-field-errors">
            {keyIssues.map((item) => (
              <li key={item.message}>{item.message}</li>
            ))}
          </ul>
        ) : null}
      </div>
      <fieldset
        id={PATTERN_TYPES_ID}
        tabIndex={-1}
        aria-describedby={
          typeIssues.length > 0 ? 'cms-pattern-types-errors' : undefined
        }
      >
        <legend>Content types that may use this pattern</legend>
        {unavailableTypeIds.length > 0 ? (
          <p id="cms-pattern-types-stale">
            Marked "no longer available": the version you are editing names a
            content type that is no longer active. Clear it to save.
          </p>
        ) : null}
        {context.contentTypes.length === 0 ? (
          <p>No active content types are available to this designer.</p>
        ) : (
          context.contentTypes.map((type) => (
            <label key={type.id}>
              <input
                type="checkbox"
                checked={compatibleTypeIds.includes(type.id)}
                onChange={() => onToggleType(type.id)}
              />
              {type.typeKey}
            </label>
          ))
        )}
        {unavailableTypeIds.map((id) => (
          <label key={id}>
            <input
              type="checkbox"
              checked={compatibleTypeIds.includes(id)}
              aria-describedby="cms-pattern-types-stale"
              onChange={() => onToggleType(id)}
            />
            Content type {id.slice(0, 8)} · no longer available
          </label>
        ))}
        {typeIssues.length > 0 ? (
          <ul id="cms-pattern-types-errors" className="cms-field-errors">
            {typeIssues.map((item) => (
              <li key={item.message}>{item.message}</li>
            ))}
          </ul>
        ) : null}
      </fieldset>
    </>
  );
}
