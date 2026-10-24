import * as React from 'react';

import type { TermFacts } from './taxonomy-terms-read';
import type { TermIssue } from './term-action-request';
import { termName, type HeldChoice } from './term-names';

const errors = (issues: readonly TermIssue[]): React.ReactElement[] =>
  issues.map((entry) => (
    <p key={entry.code} className="cms-field-errors">
      {entry.message}
    </p>
  ));

interface KeyProps {
  readonly value: string;
  readonly issues: readonly TermIssue[];
  readonly onChange: (value: string) => void;
}

/** The key of a new term: it names the term for good. */
export function TermKeyField({
  value,
  issues,
  onChange,
}: KeyProps): React.ReactElement {
  return (
    <div className="cms-term-field">
      <label htmlFor="cms-term-key">Term key</label>
      <input
        id="cms-term-key"
        value={value}
        maxLength={64}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        aria-describedby="cms-term-key-help"
        aria-invalid={issues.length > 0 ? true : undefined}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
      <small id="cms-term-key-help">
        2 to 64 lowercase letters, digits or hyphens, starting with a letter. It
        never changes.
      </small>
      {errors(issues)}
    </div>
  );
}

interface SelectProps {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly empty: string;
  readonly choices: readonly TermFacts[];
  /** Values no loaded page lists: offered as their own options until a page brings them. */
  readonly held?: readonly HeldChoice[] | undefined;
  readonly help: string;
  readonly issues: readonly TermIssue[];
  readonly onChange: (value: string) => void;
}

/** A native choice among the terms of the loaded page (the parent or the survivor). */
export function TermSelect({
  id,
  label,
  value,
  empty,
  choices,
  held = [],
  help,
  issues,
  onChange,
}: SelectProps): React.ReactElement {
  return (
    <div className="cms-term-field">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={value}
        aria-describedby={`${id}-help`}
        aria-invalid={issues.length > 0 ? true : undefined}
        onChange={(event) => onChange(event.currentTarget.value)}
      >
        <option value="">{empty}</option>
        {held.map((choice) => (
          <option key={choice.termId} value={choice.termId}>
            {choice.label}
          </option>
        ))}
        {choices.map((term) => (
          <option key={term.termId} value={term.termId}>
            {termName(term)}
          </option>
        ))}
      </select>
      <small id={`${id}-help`}>{help}</small>
      {errors(issues)}
    </div>
  );
}
