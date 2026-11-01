import * as React from 'react';

import type { TermIssue } from './term-action-request';
import { TERM_LIMITS } from './term-rules';
import type { LabelRowState } from './use-term-form';

interface Props {
  readonly rows: readonly LabelRowState[];
  readonly onChange: (rows: readonly LabelRowState[]) => void;
  readonly issues: readonly TermIssue[];
}

const rowId = (id: string, part: string): string =>
  `cms-term-label-${id}-${part}`;

/**
 * The localized labels of a term: one row per language, each with a persistent label, an
 * explicit Remove and an Add control (nothing depends on pointer precision). A label is
 * 1 to 160 characters; a language is a code such as `en` or `en-GB`.
 */
export default function CmsTaxonomyLabelRows({
  rows,
  onChange,
  issues,
}: Props): React.ReactElement {
  const update = (id: string, change: Partial<LabelRowState>): void =>
    onChange(rows.map((row) => (row.id === id ? { ...row, ...change } : row)));
  const rowIssues = (index: number): TermIssue[] =>
    issues.filter((entry) => entry.field === 'labels' && entry.row === index);
  const generic = issues.filter(
    (entry) => entry.field === 'labels' && entry.row === undefined,
  );
  return (
    <fieldset id="cms-term-labels" tabIndex={-1}>
      <legend>Labels</legend>
      <p id="cms-term-labels-help">
        What authors see, one per language: a language code such as en or en-GB,
        and the label (up to 160 characters).
      </p>
      {generic.map((entry) => (
        <p key={entry.code} className="cms-field-errors">
          {entry.message}
        </p>
      ))}
      <ol className="cms-term-label-rows">
        {rows.map((row, index) => (
          <li key={row.id}>
            <div className="cms-term-field">
              <label htmlFor={rowId(row.id, 'locale')}>
                Language of label {index + 1}
              </label>
              <input
                id={rowId(row.id, 'locale')}
                value={row.locale}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                aria-describedby="cms-term-labels-help"
                aria-invalid={
                  rowIssues(index).some(
                    (e) => e.code === 'label_locale_invalid',
                  )
                    ? true
                    : undefined
                }
                onChange={(event) =>
                  update(row.id, { locale: event.currentTarget.value })
                }
              />
            </div>
            <div className="cms-term-field">
              <label htmlFor={rowId(row.id, 'text')}>Label {index + 1}</label>
              <input
                id={rowId(row.id, 'text')}
                value={row.label}
                maxLength={160}
                autoComplete="off"
                aria-invalid={
                  rowIssues(index).some((e) => e.code === 'label_text_invalid')
                    ? true
                    : undefined
                }
                onChange={(event) =>
                  update(row.id, { label: event.currentTarget.value })
                }
              />
            </div>
            {rowIssues(index).map((entry) => (
              <p key={entry.code} className="cms-field-errors">
                Label {index + 1}: {entry.message}
              </p>
            ))}
            <button
              type="button"
              aria-label={`Remove label ${index + 1}`}
              disabled={rows.length === 1}
              onClick={() =>
                onChange(rows.filter((entry) => entry.id !== row.id))
              }
            >
              Remove
            </button>
          </li>
        ))}
      </ol>
      <button
        type="button"
        disabled={rows.length >= TERM_LIMITS.labels}
        onClick={() =>
          onChange([
            ...rows,
            { id: crypto.randomUUID(), locale: '', label: '' },
          ])
        }
      >
        Add a label in another language
      </button>
    </fieldset>
  );
}
