import type { RevisionHistoryPage } from '@wejammin/contracts';
import * as React from 'react';

export interface CmsEditorialRevisionHistoryProps {
  readonly page: RevisionHistoryPage;
  readonly entryId: string;
  /** The encoded route path the filter, compare and continuation links target. */
  readonly routePath: string;
  /** The request's own query: the URL owns the filter, compare and cursor. */
  readonly query: Readonly<Record<string, string>>;
}

const STATES = [
  'draft',
  'submitted',
  'approved',
  'rejected',
  'scheduled',
  'published',
] as const;

const search = (
  query: Readonly<Record<string, string>>,
  change: (params: URLSearchParams) => void,
): string => {
  const params = new URLSearchParams(query);
  change(params);
  const text = params.toString();
  return text === '' ? '' : `?${text}`;
};

/**
 * The CMS-03B-03 revision list (server-rendered): a native GET filter, one row
 * of text per authorized summary with its own compare link, and a URL-owned
 * signed continuation. Rows carry no draft value. Empty is two different
 * states (no earlier revision, or filters that exclude every row), each with
 * exactly one action at most.
 */
export default function CmsEditorialRevisionHistory({
  page,
  routePath,
  query,
}: CmsEditorialRevisionHistoryProps): React.ReactElement {
  const filtered = (query.state ?? '') !== '' || (query.locale ?? '') !== '';
  const compareHref = (id: string): string =>
    `${routePath}${search(query, (params) => {
      // A selection changes the signed cursor's query binding, so a comparison
      // starts at the first page instead of replaying a stale cursor.
      params.delete('cursor');
      params.set('compareRevisionId', id);
    })}#history-compare-title`;
  const nextHref =
    page.nextCursor === null
      ? null
      : `${routePath}${search(query, (params) => {
          params.set('cursor', page.nextCursor as string);
        })}#history-list-title`;
  return (
    <section aria-labelledby="history-list-title">
      <h2 id="history-list-title" tabIndex={-1}>
        Revisions
      </h2>
      <form
        method="get"
        action={`${routePath}#history-list-title`}
        aria-label="Filter revisions"
      >
        <label htmlFor="history-state">State</label>
        <select
          id="history-state"
          name="state"
          defaultValue={query.state ?? ''}
        >
          <option value="">All states</option>
          {STATES.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </select>
        <label htmlFor="history-limit">Rows per page</label>
        <input
          id="history-limit"
          name="limit"
          type="number"
          min={1}
          max={50}
          defaultValue={query.limit ?? '25'}
        />
        <label htmlFor="history-locale">Locale</label>
        <input
          id="history-locale"
          name="locale"
          autoComplete="off"
          defaultValue={query.locale ?? ''}
        />
        <button type="submit">Filter history</button>
      </form>
      {page.items.length === 0 ? (
        filtered ? (
          <>
            <p>No revisions match these filters.</p>
            <p>
              <a href={`${routePath}#history-list-title`}>Reset filters</a>
            </p>
          </>
        ) : (
          <p>This entry has no earlier revision to compare or restore.</p>
        )
      ) : (
        <ol>
          {page.items.map((item) => (
            <li key={item.id}>
              Revision {item.revisionNumber} · {item.state} · Locale:{' '}
              {item.locale} ·{' '}
              <time dateTime={item.createdAt}>{item.createdAt}</time> ·{' '}
              {item.authorClass} · Content hash: <code>{item.contentHash}</code>{' '}
              ·{' '}
              <a href={compareHref(item.id)}>
                Compare with latest
                <span className="visually-hidden">
                  {' '}
                  revision {item.revisionNumber}
                </span>
              </a>
            </li>
          ))}
        </ol>
      )}
      {nextHref === null ? null : (
        <nav aria-label="Revision history pages">
          <a href={nextHref}>Next page</a>
        </nav>
      )}
    </section>
  );
}
