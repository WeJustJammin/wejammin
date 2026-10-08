import type { EntryListPage } from '@wejammin/contracts';
import * as React from 'react';

export interface CmsEditorialEntryListProps {
  readonly page: EntryListPage;
  readonly routePath: string;
  /** The request's URL-owned state: filters, limit and the signed cursor. */
  readonly query: Readonly<Record<string, string>>;
  /** A polite announcement (for example that the list restarted), if any. */
  readonly announcement?: string | null;
}

const STATES = [
  'draft',
  'submitted',
  'approved',
  'rejected',
  'scheduled',
  'published',
] as const;

/**
 * The CMS-03B-13 assigned-entry list (server-rendered, never optimistic): a
 * native GET filter, a polite count, one native link per entry with its
 * lifecycle, draft revision, state and last update as text (DEC-145), and a
 * URL-owned signed continuation. Empty is two states, each with one action:
 * no assigned entries (create) or filters that exclude every row (reset).
 */
export default function CmsEditorialEntryList({
  page,
  routePath,
  query,
  announcement = null,
}: CmsEditorialEntryListProps): React.ReactElement {
  const filtered =
    (query.state ?? '') !== '' || (query.contentTypeId ?? '') !== '';
  const count = page.items.length;
  const next =
    page.nextCursor === null
      ? null
      : (() => {
          const params = new URLSearchParams(query);
          params.set('cursor', page.nextCursor);
          return `${routePath}?${params.toString()}#entry-list-title`;
        })();
  return (
    <section aria-labelledby="entry-list-title">
      <h2 id="entry-list-title" tabIndex={-1}>
        Your entries
      </h2>
      <form
        method="get"
        action={`${routePath}#entry-list-title`}
        aria-label="Filter entries"
      >
        <label htmlFor="entry-state-filter">State</label>
        <select
          id="entry-state-filter"
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
        <label htmlFor="entry-content-type-filter">Content type id</label>
        <input
          id="entry-content-type-filter"
          name="contentTypeId"
          autoComplete="off"
          spellCheck={false}
          defaultValue={query.contentTypeId ?? ''}
        />
        <button type="submit">Filter entries</button>
      </form>
      <p role="status" aria-live="polite" data-cms-editorial-list-status="">
        {announcement === null ? '' : `${announcement} `}
        {count === 0
          ? filtered
            ? 'No entries match these filters.'
            : 'You have no assigned entries yet.'
          : `${count} ${count === 1 ? 'entry' : 'entries'} loaded.`}
      </p>
      {count === 0 ? (
        <p>
          {filtered ? (
            <a href={`${routePath}#entry-list-title`}>Reset filters</a>
          ) : (
            <a href={`${routePath}/new`}>Create entry</a>
          )}
        </p>
      ) : (
        <>
          <p>
            <a href={`${routePath}/new`}>Create entry</a>
          </p>
          <ul>
            {page.items.map((item) => (
              <li key={item.id}>
                <a href={`${routePath}/${encodeURIComponent(item.entryId)}`}>
                  Entry {item.entryId}
                </a>
                <br />
                Lifecycle: {item.entryLifecycle} · Draft revision{' '}
                {item.revisionNumber} · State: {item.state} · Updated{' '}
                <time dateTime={item.entryUpdatedAt}>
                  {item.entryUpdatedAt}
                </time>
              </li>
            ))}
          </ul>
        </>
      )}
      {next === null ? null : (
        <nav aria-label="Entry list pages">
          <a href={next}>Next page</a>
        </nav>
      )}
    </section>
  );
}
