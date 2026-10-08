import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import CmsEditorialRevisionCompare from '../../../../components/cms-editorial/CmsEditorialRevisionCompare';
import CmsEditorialRevisionHistory from '../../../../components/cms-editorial/CmsEditorialRevisionHistory';
import {
  HISTORY_ENTRY_ID,
  HISTORY_ROUTE,
  LEFT_ID,
  RIGHT_ID,
  change,
  compareWith,
  historyPage,
  restore,
} from '../../../../components/cms-editorial/cms-editorial-history-fixtures.test-support';
import {
  apiError,
  draftDetail,
  json,
} from '../../../../components/cms-editorial/cms-editorial-editor-fixtures.test-support';
import type { CmsEditorialPageReads } from '../../../../components/cms-editorial-pages/cms-editorial-page-reads';
import { loadRevisionHistoryPage } from '../../../../components/cms-editorial-pages/load-revision-history-page';

const fromHere = (relative: string): string =>
  fileURLToPath(new URL(relative, import.meta.url));

/*
 * The history page is a tested loader plus two tested views. This suite drives
 * the REAL composition (loader -> verified view -> server-rendered views) with
 * only the proxy edge replaced, and asserts what a reader gets across the whole
 * journey: the list, the domain-grouped comparison, the LEFT-revision restore
 * review, and the typed refusals. It replaces a suite that grepped the page and
 * view source for words.
 */
const compare = (
  changes = [change('field'), change('relation'), change('block')],
) => compareWith(changes, restore('available', 2));

const render = async (
  history: () => Promise<Response>,
  search = `?compareRevisionId=${RIGHT_ID}`,
): Promise<string> => {
  const reads = {
    revisionHistory: history,
    draftDetail: async () =>
      draftDetail({ entryVersion: '7', revisionNumber: '2', values: {} }),
  } as unknown as CmsEditorialPageReads;
  const outcome = await loadRevisionHistoryPage({
    request: new Request(`https://web.test${HISTORY_ROUTE}${search}`),
    entryId: HISTORY_ENTRY_ID,
    reads,
  });
  if (outcome.kind !== 'view') throw new Error('expected a view');
  const { view } = outcome;
  return renderToStaticMarkup(
    <>
      <CmsEditorialRevisionHistory
        page={view.page}
        entryId={view.entryId}
        routePath={view.routePath}
        query={view.query}
      />
      <CmsEditorialRevisionCompare
        compare={view.page.compare}
        refusal={view.refusal}
        entryId={view.entryId}
        expectedVersion={view.expectedVersion}
      />
    </>,
  );
};

describe('CMS-07 protected revision-history page, composed', () => {
  it('renders the list, the domain-grouped comparison and the restore review of the LEFT revision', async () => {
    const html = await render(async () =>
      json(200, historyPage({ compare: compare() })),
    );
    expect(html).toContain('Revision 2');
    expect(html).toContain('Field changes');
    expect(html).toContain('Block changes');
    expect(html).toContain('Relation changes');
    expect(html).toContain(`/revisions/${LEFT_ID}/restore`);
    expect(html).not.toContain(`/revisions/${RIGHT_ID}/restore`);
    expect(html).toContain('name="expectedVersion" value="7"');
    expect(html).toContain('Migration steps: 2');
  });

  it('keeps the list and shows the typed refusal when the comparison is too large', async () => {
    let calls = 0;
    const html = await render(async () =>
      ++calls === 1
        ? apiError(422, 'VALIDATION_FAILED', {
            reasonCode: 'comparison_too_large',
          })
        : json(200, historyPage()),
    );
    expect(html).toContain('Revision 2');
    expect(html).toContain('more than 512 places');
    expect(html).not.toContain('Field changes');
    expect(html).not.toContain('<form data-cms-editorial-restore');
  });

  it('offers no commit when the restore chain is unavailable', async () => {
    const html = await render(async () =>
      json(
        200,
        historyPage({
          compare: compareWith([change('field')], restore('transform_missing')),
        }),
      ),
    );
    expect(html).toContain(
      'A required transform is missing for this revision.',
    );
    expect(html).not.toContain('Confirm restore');
  });
});

describe('revisions.astro response invariants', () => {
  const source = readFileSync(fromHere('./[entryId]/revisions.astro'), 'utf8');
  const shell = readFileSync(
    fromHere('../../../../components/cms-editorial/CmsEditorialDocument.astro'),
    'utf8',
  );

  it('is never prerendered or cached, uses the one shared shell and bundles no script of its own', () => {
    expect(source).toContain('export const prerender = false');
    expect(source).toContain(
      "Astro.response.headers.set('Cache-Control', 'no-store')",
    );
    expect(source).toContain('<CmsEditorialDocument');
    expect(source).not.toContain('<script');
    expect(source).not.toContain('set:html');
    expect(shell).toContain('src="../../lib/cms-editorial-page-actions.ts"');
    expect(shell).toContain('src="../../lib/route-heading-focus.ts"');
    expect(shell).toContain('src="../../lib/auth-scope-sync.ts"');
  });

  it('maps a sign-in outcome to the allowlisted 303 only', () => {
    expect(source).toContain('Astro.redirect(outcome.location, 303)');
  });
});
