import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { CmsEditorialPageReads } from '../../../../components/cms-editorial-pages/cms-editorial-page-reads';
import { loadReviewQueuePage } from '../../../../components/cms-editorial-pages/load-review-queue-page';
import CmsEditorialReviewQueue from '../../../../components/cms-editorial-workflow/CmsEditorialReviewQueue';
import {
  apiError,
  jsonResponse,
  queueItem,
  queuePageFixture,
} from '../../../../components/cms-editorial-workflow/cms-workflow-fixtures.test-support';

const fromHere = (relative: string): string =>
  fileURLToPath(new URL(relative, import.meta.url));

/*
 * The reviewer queue is a tested loader plus a tested view; this suite drives
 * the REAL composition for FE03's journeys (a page with a signed continuation,
 * nothing in the scope, a filter that excludes every row, a concealed list) with
 * only the proxy edge replaced, and reads the Astro file for the response
 * invariants no other test can.
 */
const render = async (
  response: Response,
  search = '',
): Promise<{ readonly html: string; readonly status: number }> => {
  const outcome = await loadReviewQueuePage({
    request: new Request(
      `https://web.test/app/cms-content-modeling/reviews${search}`,
    ),
    reads: {
      reviewQueue: async () => response,
    } as unknown as CmsEditorialPageReads,
  });
  if (outcome.kind !== 'view') throw new Error('expected a view');
  return {
    status: outcome.status,
    html: renderToStaticMarkup(
      <CmsEditorialReviewQueue
        page={outcome.view.page}
        routePath={outcome.view.routePath}
        query={outcome.view.query}
        announcement={outcome.view.announcement}
      />,
    ),
  };
};

describe('CMS-03B-17 protected reviewer queue page, composed', () => {
  it('lists the scope as native links with a signed, URL-owned continuation', async () => {
    const { html, status } = await render(
      jsonResponse(200, queuePageFixture([queueItem(1)], 'next.cursor'), {
        etag: '"5"',
      }),
      '?scope=submitted&limit=1',
    );
    expect(status).toBe(200);
    expect(html.match(/<li>/gu)).toHaveLength(1);
    expect(html).toContain('1 review loaded.');
    expect(html).toContain('cursor=next.cursor');
    expect(html).toContain('scope=submitted');
  });

  it('shows nothing-in-scope and filter-miss as different states with one action each', async () => {
    const empty = queuePageFixture([]);
    const none = await render(jsonResponse(200, empty));
    expect(none.html).toContain('You have no reviews assigned to you.');
    expect(none.html).toContain('See reviews you submitted');
    const miss = await render(jsonResponse(200, empty), '?state=rejected');
    expect(miss.html).toContain('No reviews match this state.');
    expect(miss.html).toContain('Reset the filter');
  });

  it('lets no concealed row, count or identifier through a queue the API answered 403', async () => {
    const outcome = await loadReviewQueuePage({
      request: new Request('https://web.test/app/cms-content-modeling/reviews'),
      reads: {
        reviewQueue: async () => jsonResponse(403, apiError('FORBIDDEN')),
      } as unknown as CmsEditorialPageReads,
    });
    expect(outcome.kind === 'notice' && outcome.notice.message).toBe(
      'This account cannot read the review list.',
    );
  });
});

describe('reviews/index.astro response invariants', () => {
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
    expect(source).not.toContain('client:');
  });

  it('maps a sign-in outcome to the allowlisted 303 only', () => {
    expect(source).toContain('Astro.redirect(outcome.location, 303)');
    expect(source).not.toContain('Astro.redirect(`');
  });
});
