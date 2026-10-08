import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import CmsEditorialRevisionHistory from './CmsEditorialRevisionHistory';
import {
  HISTORY_ENTRY_ID,
  HISTORY_ROUTE,
  RIGHT_ID,
  historyPage,
  summary,
} from './cms-editorial-history-fixtures.test-support';

const render = (
  page = historyPage(),
  query: Record<string, string> = {},
): string =>
  renderToStaticMarkup(
    <CmsEditorialRevisionHistory
      page={page}
      entryId={HISTORY_ENTRY_ID}
      routePath={HISTORY_ROUTE}
      query={query}
    />,
  );

describe('CmsEditorialRevisionHistory', () => {
  it('names its list heading as a focus target and binds the GET filter to it', () => {
    const html = render();
    expect(html).toContain(
      '<h2 id="history-list-title" tabindex="-1">Revisions</h2>',
    );
    expect(html).toContain(`action="${HISTORY_ROUTE}#history-list-title"`);
    expect(html).toContain('method="get"');
    expect(html).toContain('aria-label="Filter revisions"');
    expect(html).toContain('id="history-limit"');
    expect(html).toContain('value="25"');
  });

  it('carries the URL-owned filter selection into the native controls', () => {
    const html = render(historyPage(), {
      state: 'approved',
      limit: '10',
      locale: 'fr-FR',
    });
    expect(html).toContain(
      '<option value="approved" selected="">approved</option>',
    );
    expect(html).toContain('value="10"');
    expect(html).toContain('value="fr-FR"');
  });

  it('lists each revision as text with a compare link whose name is unique per row', () => {
    const html = render(
      historyPage({
        items: [
          summary(),
          summary({
            id: '018f0c45-73fe-7dc2-9c09-68f7ecf132d9',
            revisionNumber: '1',
          }),
        ],
      }),
    );
    expect(html).toContain('Revision 2');
    expect(html).toContain('Locale: en-US');
    expect(html).toContain('Content hash: <code>');
    expect(html).toContain(
      'Compare with latest<span class="visually-hidden"> revision 2</span>',
    );
    expect(html).toContain(
      'Compare with latest<span class="visually-hidden"> revision 1</span>',
    );
  });

  it('links comparison at the first page with the filters kept and the cursor dropped', () => {
    const html = render(historyPage(), {
      state: 'draft',
      cursor: 'signed-cursor',
    });
    expect(html).toContain(`compareRevisionId=${RIGHT_ID}`);
    expect(html).toContain('state=draft');
    expect(html).not.toContain('signed-cursor');
    expect(html).toContain('#history-compare-title');
  });

  it('continues with the signed cursor in a named navigation', () => {
    const html = render(historyPage({ nextCursor: 'next-window' }), {
      state: 'draft',
    });
    expect(html).toContain('aria-label="Revision history pages"');
    expect(html).toContain(
      `href="${HISTORY_ROUTE}?state=draft&amp;cursor=next-window#history-list-title">Next page</a>`,
    );
  });

  it('separates an entry with no earlier revision from a filter that excludes every row', () => {
    const none = render(historyPage({ items: [] }));
    expect(none).toContain(
      'This entry has no earlier revision to compare or restore.',
    );
    expect(none).not.toContain('Reset filters');
    const miss = render(historyPage({ items: [] }), { state: 'published' });
    expect(miss).toContain('No revisions match these filters.');
    // Exactly one action for the state: reset.
    expect(miss.match(/Reset filters/gu)).toHaveLength(1);
    expect(miss).toContain(
      `href="${HISTORY_ROUTE}#history-list-title">Reset filters</a>`,
    );
  });

  it('escapes a hostile author class instead of rendering it', () => {
    const html = render(
      historyPage({
        items: [summary({ authorClass: '<script>alert(1)</script>' })],
      }),
    );
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
