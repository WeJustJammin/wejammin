import { EntryListPageSchema } from '@wejammin/contracts';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import CmsEditorialEntryList from './CmsEditorialEntryList';

const ROUTE = '/app/cms-content-modeling/entries';
const entryId = (n: number) =>
  `018f0c45-73fe-7dc2-9c09-68f7ecf1${String(n).padStart(4, '0')}`;

const row = (n: number, overrides: Record<string, unknown> = {}) => ({
  id: `018f0c45-73fe-7dc2-9c09-68f7ecf2${String(n).padStart(4, '0')}`,
  entryId: entryId(n),
  revisionNumber: String(n),
  locale: 'en-US',
  state: 'draft',
  contentHash: 'a'.repeat(64),
  createdAt: '2026-10-05T00:00:00Z',
  authorClass: 'author',
  entryLifecycle: 'active',
  entryUpdatedAt: '2026-10-05T01:00:00Z',
  ...overrides,
});

const page = (items: unknown[], nextCursor: string | null = null) =>
  EntryListPageSchema.parse({ items, nextCursor, pageVersion: '1' });

const render = (
  value = page([row(1), row(2)]),
  query: Record<string, string> = {},
): string =>
  renderToStaticMarkup(
    <CmsEditorialEntryList page={value} routePath={ROUTE} query={query} />,
  );

describe('CmsEditorialEntryList (FE03 CmsEditorialEntryList, DEC-145)', () => {
  it('names its heading as a focus target and offers a native GET filter bound to it', () => {
    const html = render();
    expect(html).toContain(
      '<h2 id="entry-list-title" tabindex="-1">Your entries</h2>',
    );
    expect(html).toContain(`action="${ROUTE}#entry-list-title"`);
    expect(html).toContain('method="get"');
    expect(html).toContain('aria-label="Filter entries"');
    expect(html).toContain('for="entry-state-filter"');
    expect(html).toContain('for="entry-content-type-filter"');
  });

  it('lists each entry as a native link to its edit page with lifecycle, revision, state and updated time as text', () => {
    const html = render();
    expect(html).toContain('<ul>');
    expect(html.match(/<li>/gu)).toHaveLength(2);
    expect(html).toContain(`href="${ROUTE}/${entryId(1)}"`);
    expect(html).toContain(`Entry ${entryId(1)}</a>`);
    expect(html).toContain('Lifecycle: active');
    expect(html).toContain('Draft revision 1');
    expect(html).toContain('State: draft');
    expect(html).toContain(
      '<time dateTime="2026-10-05T01:00:00Z">2026-10-05T01:00:00Z</time>',
    );
  });

  it('shows no revision hash, author class or any identifier beyond the entry id', () => {
    const html = render();
    expect(html).not.toContain('a'.repeat(64));
    expect(html).not.toContain('author');
    expect(html).not.toContain('018f0c45-73fe-7dc2-9c09-68f7ecf20001');
  });

  it('puts a restart announcement in the same polite status region as the count (FE03:574)', () => {
    const html = renderToStaticMarkup(
      <CmsEditorialEntryList
        page={page([row(1)])}
        routePath={ROUTE}
        query={{ state: 'draft' }}
        announcement="The list changed, so it restarted from the first page. Your filters are kept."
      />,
    );
    const status = /<p role="status"[^>]*>([^<]*)<\/p>/u.exec(html)?.[1] ?? '';
    expect(status).toContain('The list changed, so it restarted');
    expect(status).toContain('1 entry loaded.');
    expect(render()).not.toContain('restarted from the first page');
  });

  it('announces the loaded count politely', () => {
    const one = render(page([row(1)]));
    expect(one).toContain('role="status"');
    expect(one).toContain('aria-live="polite"');
    expect(one).toContain('1 entry loaded.');
    expect(render()).toContain('2 entries loaded.');
  });

  it('offers Create entry once above a non-empty list so the create page is reachable', () => {
    const html = render();
    expect(html.match(/Create entry/gu)).toHaveLength(1);
    expect(html).toContain(`href="${ROUTE}/new">Create entry</a>`);
  });

  it('states no-records with exactly one action: create', () => {
    const html = render(page([]));
    expect(html).toContain('You have no assigned entries yet.');
    expect(html.match(/Create entry/gu)).toHaveLength(1);
    expect(html).not.toContain('Reset filters');
    expect(html).not.toContain('<ul>');
  });

  it('states filter-miss apart from no-records, with exactly one action: reset', () => {
    const html = render(page([]), { state: 'published' });
    expect(html).toContain('No entries match these filters.');
    expect(html.match(/Reset filters/gu)).toHaveLength(1);
    expect(html).toContain(
      `href="${ROUTE}#entry-list-title">Reset filters</a>`,
    );
    expect(html).not.toContain('Create entry');
    expect(html).not.toContain('You have no assigned entries yet.');
  });

  it('keeps the filters and limit in the continuation and replaces only the cursor', () => {
    const html = render(page([row(1)], 'next-window'), {
      state: 'draft',
      limit: '1',
      cursor: 'previous-window',
    });
    expect(html).toContain('aria-label="Entry list pages"');
    expect(html).toContain('state=draft');
    expect(html).toContain('limit=1');
    expect(html).toContain('cursor=next-window');
    expect(html).not.toContain('previous-window');
    expect(html).toContain('#entry-list-title">Next page</a>');
  });

  it('reflects the URL-owned filters in the controls', () => {
    const html = render(page([row(1)]), {
      state: 'approved',
      contentTypeId: entryId(9),
    });
    expect(html).toContain(
      '<option value="approved" selected="">approved</option>',
    );
    expect(html).toContain(`value="${entryId(9)}"`);
  });
});
