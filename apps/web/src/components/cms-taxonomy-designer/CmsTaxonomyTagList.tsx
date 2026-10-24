import * as React from 'react';

import { TAG_PROBLEM_COPY } from './taxonomy-designer-copy';
import {
  TAG_LIMIT,
  addTags,
  type TagKind,
  type TagProblem,
} from './taxonomy-tags';

interface Props {
  /** The id of the text input: the control an error summary link focuses. */
  readonly id: string;
  readonly kind: TagKind;
  readonly label: string;
  /** The singular noun of one key: "content type key". */
  readonly noun: string;
  readonly help: string;
  readonly tags: readonly string[];
  readonly onChange: (tags: readonly string[]) => void;
  /** Problems the form found on submit, shown with the field. */
  readonly issues: readonly string[];
}

/**
 * A validated tag list (FE03 :886): keys are typed or pasted, split on commas and
 * whitespace, checked against the contract grammar and kept unique and in entry order. A
 * key that does not fit is named, never dropped silently. Every key has its own Remove
 * button; nothing depends on pointer precision.
 */
export default function CmsTaxonomyTagList({
  id,
  kind,
  label,
  noun,
  help,
  tags,
  onChange,
  issues,
}: Props): React.ReactElement {
  const [text, setText] = React.useState('');
  const [problems, setProblems] = React.useState<readonly TagProblem[]>([]);
  const input = React.useRef<HTMLInputElement>(null);
  const helpId = `${id}-help`;
  const problemId = `${id}-problems`;
  const errorId = `${id}-errors`;

  const commit = (): void => {
    if (text.trim() === '') return;
    const added = addTags(text, tags, kind);
    setProblems(added.problems);
    onChange(added.tags);
    // Keys that did not fit stay in the box so they can be corrected.
    setText(
      added.problems
        .filter((problem) => problem.code === 'tag_invalid')
        .map((problem) => problem.value)
        .join(' '),
    );
  };

  return (
    <div className="cms-taxonomy-field">
      <label htmlFor={id}>{label}</label>
      <div className="cms-taxonomy-tag-entry">
        <input
          ref={input}
          id={id}
          value={text}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          aria-describedby={[
            helpId,
            problems.length > 0 ? problemId : null,
            issues.length > 0 ? errorId : null,
          ]
            .filter(Boolean)
            .join(' ')}
          aria-invalid={
            issues.length > 0 || problems.length > 0 ? true : undefined
          }
          onChange={(event) => {
            setText(event.currentTarget.value);
            setProblems([]);
          }}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            // Enter adds the key; it never submits the vocabulary.
            event.preventDefault();
            commit();
          }}
        />
        <button type="button" onClick={commit}>
          Add {noun}
        </button>
      </div>
      <small id={helpId}>
        {help} {tags.length} of {TAG_LIMIT} added.
      </small>
      <div id={problemId} role="status" aria-live="polite">
        {problems.length === 0 ? null : (
          <ul className="cms-field-errors">
            {problems.map((problem) => (
              <li key={`${problem.code}-${problem.value}`}>
                &ldquo;{problem.value}&rdquo; {TAG_PROBLEM_COPY[problem.code]}
              </li>
            ))}
          </ul>
        )}
      </div>
      {issues.length > 0 ? (
        <ul id={errorId} className="cms-field-errors">
          {issues.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}
      {tags.length === 0 ? (
        <p>No {noun}s added yet.</p>
      ) : (
        <ul className="cms-taxonomy-tags" aria-label={`Added ${noun}s`}>
          {tags.map((tag) => (
            <li key={tag}>
              <code>{tag}</code>
              <button
                type="button"
                aria-label={`Remove ${noun} ${tag}`}
                onClick={() => {
                  onChange(tags.filter((entry) => entry !== tag));
                  input.current?.focus();
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
