import * as React from 'react';

import type { TermFacts } from './taxonomy-terms-read';
import { redirectText } from './term-names';
import type { TermAction } from './term-action-request';

const LIFECYCLE_LABEL: Readonly<Record<TermFacts['lifecycle'], string>> = {
  active: 'Active',
  deprecated: 'Deprecated',
  merged: 'Merged',
};

interface Props {
  readonly terms: readonly TermFacts[];
  readonly taxonomyKey: string;
  /** Whether term actions exist at all: an active version and a verified list. */
  readonly canAct: boolean;
  readonly onAction: (
    action: TermAction,
    term: TermFacts,
    trigger: HTMLElement,
  ) => void;
}

/** The curator's terms as a semantic table; each action is a named button (FE03 :1718). */
export default function CmsTaxonomyTermTable({
  terms,
  taxonomyKey,
  canAct,
  onAction,
}: Props): React.ReactElement {
  if (terms.length === 0)
    return <p>No terms match. A new vocabulary starts without terms.</p>;
  return (
    <table className="cms-term-table">
      <caption>Terms of {taxonomyKey}</caption>
      <thead>
        <tr>
          <th scope="col">Term</th>
          <th scope="col">Labels</th>
          <th scope="col">Aliases</th>
          <th scope="col">State</th>
          {canAct ? <th scope="col">Actions</th> : null}
        </tr>
      </thead>
      <tbody>
        {terms.map((term) => {
          const act =
            (action: TermAction) =>
            (event: React.MouseEvent<HTMLButtonElement>) =>
              onAction(action, term, event.currentTarget);
          return (
            <tr key={term.termId}>
              <th scope="row" data-label="Term">
                {term.termKey}
              </th>
              <td data-label="Labels">
                {term.labels.map((entry) => (
                  <span key={entry.locale} className="cms-term-label">
                    {entry.locale}:{' '}
                    <span lang={entry.locale}>{entry.label}</span>
                  </span>
                ))}
              </td>
              <td data-label="Aliases">
                {term.aliases.length === 0 ? 'None' : term.aliases.join(', ')}
              </td>
              <td data-label="State">
                {LIFECYCLE_LABEL[term.lifecycle]}
                {term.lifecycle === 'merged' ? (
                  <small> {redirectText(term, terms)}</small>
                ) : null}
              </td>
              {canAct ? (
                <td data-label="Actions" className="cms-term-actions">
                  {term.lifecycle === 'merged' ? (
                    <small>No actions</small>
                  ) : (
                    <>
                      <button
                        type="button"
                        aria-label={`Rename term ${term.termKey}`}
                        onClick={act('rename')}
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        aria-label={`Add an alias to term ${term.termKey}`}
                        onClick={act('alias')}
                      >
                        Add alias
                      </button>
                      {term.lifecycle === 'active' ? (
                        <button
                          type="button"
                          aria-label={`Deprecate term ${term.termKey}`}
                          onClick={act('deprecate')}
                        >
                          Deprecate
                        </button>
                      ) : null}
                      <button
                        type="button"
                        aria-label={`Merge term ${term.termKey} into another`}
                        onClick={act('merge')}
                      >
                        Merge
                      </button>
                    </>
                  )}
                </td>
              ) : null}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
