import * as React from 'react';

import type { TermIssue } from './term-action-request';
import { ALIAS_MAX_CHARACTERS, TERM_LIMITS } from './term-rules';

interface Props {
  readonly aliases: readonly string[];
  readonly onChange: (aliases: readonly string[]) => void;
  readonly issues: readonly TermIssue[];
  readonly help: string;
}

/** Aliases are free text (1 to 160 characters, spaces allowed): one is added at a time. */
export default function CmsTaxonomyAliasList({
  aliases,
  onChange,
  issues,
  help,
}: Props): React.ReactElement {
  const [text, setText] = React.useState('');
  const input = React.useRef<HTMLInputElement>(null);
  const add = (): void => {
    const alias = text.trim();
    if (alias === '' || aliases.includes(alias)) {
      setText('');
      return;
    }
    onChange([...aliases, alias]);
    setText('');
  };
  const mine = issues.filter((entry) => entry.field === 'aliases');
  return (
    <div className="cms-term-field" id="cms-term-aliases" tabIndex={-1}>
      <label htmlFor="cms-term-alias-input">Alias</label>
      <div className="cms-term-alias-entry">
        <input
          ref={input}
          id="cms-term-alias-input"
          value={text}
          maxLength={ALIAS_MAX_CHARACTERS}
          autoComplete="off"
          aria-describedby="cms-term-alias-help"
          aria-invalid={mine.length > 0 ? true : undefined}
          onChange={(event) => setText(event.currentTarget.value)}
          onBlur={add}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            // Enter adds the alias; it never submits the action.
            event.preventDefault();
            add();
          }}
        />
        <button
          type="button"
          disabled={aliases.length >= TERM_LIMITS.aliases}
          onClick={add}
        >
          Add alias
        </button>
      </div>
      <small id="cms-term-alias-help">
        {help} {aliases.length} of {TERM_LIMITS.aliases} added.
      </small>
      {mine.map((entry) => (
        <p key={entry.code} className="cms-field-errors">
          {entry.message}
        </p>
      ))}
      {aliases.length === 0 ? null : (
        <ul className="cms-term-aliases" aria-label="Aliases to add">
          {aliases.map((alias) => (
            <li key={alias}>
              <span>{alias}</span>
              <button
                type="button"
                aria-label={`Remove alias ${alias}`}
                onClick={() => {
                  onChange(aliases.filter((entry) => entry !== alias));
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
