import * as React from 'react';

import { TermSelect } from './CmsTaxonomyTermFields';
import type { TermFacts } from './taxonomy-terms-read';
import type { TermIssue } from './term-action-request';
import type { HeldChoice } from './term-names';
import type { TermChoices } from './use-term-choices';

interface Props {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly empty: string;
  readonly help: string;
  readonly issues: readonly TermIssue[];
  /** The terms offered: the choices already filtered of merged terms and the term itself. */
  readonly choices: readonly TermFacts[];
  /** Values no loaded page lists (see `TermSelect`). */
  readonly held?: readonly HeldChoice[] | undefined;
  readonly loader: Pick<TermChoices, 'more' | 'retry' | 'status' | 'load'>;
  readonly onChange: (value: string) => void;
}

/**
 * A native term choice (parent or merge survivor) that reaches the whole vocabulary: further
 * pages load on request through one named button, so it is operable by keyboard alone. The
 * button stays mounted, and keeps its label, while a page loads, and a failed read turns it into
 * "Try again" in place, so keyboard focus never falls to the page (FE03 :898, WCAG 2.4.3); a press
 * while a page loads does nothing, because the hook reads one page at a time. Focus moves to the
 * choice only when the last page has loaded and the button leaves, and only if focus fell to the
 * page with the button: a person who moved on to another field keeps it there (WCAG 2.4.3).
 */
export default function CmsTaxonomyTermChoice({
  choices,
  loader,
  ...field
}: Props): React.ReactElement {
  const { more, retry, status, load } = loader;
  const loading = status === 'loading';
  const paging = more || retry;
  const hadButton = React.useRef(false);
  React.useEffect(() => {
    if (hadButton.current && !paging) {
      if (document.activeElement === document.body)
        document.getElementById(field.id)?.focus();
    }
    hadButton.current = paging;
  }, [field.id, paging]);
  return (
    <div className="cms-term-choices">
      <TermSelect {...field} choices={choices} />
      {status === 'loading' ? <p role="status">Loading terms…</p> : null}
      {status === 'restarted' ? (
        <p role="status">
          The list of terms changed while loading, so it restarted from the
          first page.
        </p>
      ) : null}
      {status === 'failed' ? (
        <p role="alert">More terms could not be loaded.</p>
      ) : null}
      {more && !retry ? <p>More terms are available.</p> : null}
      {paging ? (
        <button
          type="button"
          aria-disabled={loading ? 'true' : undefined}
          onClick={load}
        >
          {retry ? 'Try again' : 'Load more terms'}
        </button>
      ) : null}
    </div>
  );
}
