import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import CmsEditorialEntryList from '../../../../components/cms-editorial/CmsEditorialEntryList';
import {
  apiError,
  json,
} from '../../../../components/cms-editorial/cms-editorial-editor-fixtures.test-support';
import type { CmsEditorialPageReads } from '../../../../components/cms-editorial-pages/cms-editorial-page-reads';
import { loadEntryListPage } from '../../../../components/cms-editorial-pages/load-entry-list-page';

const fromHere = (relative: string): string =>
  fileURLToPath(new URL(relative, import.meta.url));

/*
 * The entry list is a tested loader plus a tested view; this suite drives the
 * REAL composition for FE03's three list journeys (a page with a continuation,
 * no assigned entries, filters that exclude every row) and for a concealed
 * list, with only the proxy edge replaced. FE03:531 requires native list links
 * with identity, lifecycle, revision, state and update time as text, and
 * FE03:751 requires `no-records` and `filter-miss` as distinct empty states with
 * one action each. It replaces a suite that grepped the page source.
 */
const entry = (n: number) => ({
  id: `018f0c45-73fe-7dc2-9c09-68f7ecf2${String(n).padStart(4, '0')}`,
  entryId: `018f0c45-73fe-7dc2-9c09-68f7ecf1${String(n).padStart(4, '0')}`,
  revisionNumber: String(n),
  locale: 'en-US',
  state: 'draft',
  contentHash: 'a'.repeat(64),
  createdAt: '2026-10-05T00:00:00Z',
  authorClass: 'author',
  entryLifecycle: 'active',
  entryUpdatedAt: '2026-10-05T01:00:00Z',
});

const render = async (
  response: Response,
  search = '',
): Promise<{ readonly html: string; readonly status: number }> => {
  const outcome = await loadEntryListPage({
    request: new Request(
      `https://web.test/app/cms-content-modeling/entries${search}`,
    ),
    reads: {
      entryList: async () => response,
    } as unknown as CmsEditorialPageReads,
  });
  if (outcome.kind !== 'view') throw new Error('expected a view');
  return {
    status: outcome.status,
    html: renderToStaticMarkup(
      <CmsEditorialEntryList
        page={outcome.view.page}
        routePath={outcome.view.routePath}
        query={outcome.view.query}
      />,
    ),
  };
};

describe('CMS-03B-13 protected entry-list page, composed', () => {
  it('lists the assigned entries as native links with a signed, URL-owned continuation', async () => {
    const { html, status } = await render(
      json(200, { items: [entry(1)], nextCursor: 'next', pageVersion: '1' }),
      '?limit=1',
    );
    expect(status).toBe(200);
    expect(html.match(/<li>/gu)).toHaveLength(1);
    expect(html).toContain('1 entry loaded.');
    expect(html).toContain('limit=1');
    expect(html).toContain('cursor=next');
    expect(html).toContain('#entry-list-title">Next page</a>');
  });

  it('shows no-records and filter-miss as different states with one action each', async () => {
    const empty = { items: [], nextCursor: null, pageVersion: '1' };
    const none = await render(json(200, empty));
    expect(none.html).toContain('You have no assigned entries yet.');
    expect(none.html).toContain('Create entry');
    const miss = await render(json(200, empty), '?state=published&limit=25');
    expect(miss.html).toContain('No entries match these filters.');
    expect(miss.html).toContain('Reset filters');
    expect(miss.html).not.toContain('Create entry');
  });

  it('lets no concealed row, count or identifier through a list the API answered 404', async () => {
    const outcome = await loadEntryListPage({
      request: new Request('https://web.test/app/cms-content-modeling/entries'),
      reads: {
        entryList: async () => apiError(404, 'NOT_FOUND'),
      } as unknown as CmsEditorialPageReads,
    });
    expect(outcome.kind === 'notice' && outcome.notice.message).toBe(
      'The entry list is not available.',
    );
  });
});

describe('entries/index.astro response invariants', () => {
  const source = readFileSync(fromHere('./index.astro'), 'utf8');

  it('is never prerendered or cached, uses the one shared shell and bundles no script of its own', () => {
    expect(source).toContain('export const prerender = false');
    expect(source).toContain(
      "Astro.response.headers.set('Cache-Control', 'no-store')",
    );
    expect(source).toContain('<CmsEditorialDocument');
    expect(source).not.toContain('<script');
    expect(source).not.toContain('set:html');
    expect(source).not.toContain('<form method="post"');
  });

  it('maps a sign-in outcome to the allowlisted 303 only', () => {
    expect(source).toContain('Astro.redirect(outcome.location, 303)');
  });
});
