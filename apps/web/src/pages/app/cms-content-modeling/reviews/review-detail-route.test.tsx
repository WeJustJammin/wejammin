import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { CmsEditorialPageReads } from '../../../../components/cms-editorial-pages/cms-editorial-page-reads';
import { loadReviewDetailPage } from '../../../../components/cms-editorial-pages/load-review-detail-page';
import CmsEditorialReviewDetailIsland from '../../../../components/cms-editorial-workflow/CmsEditorialReviewDetailIsland';
import {
  REVIEW_ID,
  REVIEWER_PERSON_ID,
  apiError,
  jsonResponse,
  reviewDetailFixture,
} from '../../../../components/cms-editorial-workflow/cms-workflow-fixtures.test-support';

const fromHere = (relative: string): string =>
  fileURLToPath(new URL(relative, import.meta.url));

const load = (response: Response) =>
  loadReviewDetailPage({
    request: new Request(
      `https://web.test/app/cms-content-modeling/reviews/${REVIEW_ID}`,
    ),
    reviewId: REVIEW_ID,
    reads: {
      reviewDetail: async () => response,
    } as unknown as CmsEditorialPageReads,
  });

const render = async (response: Response): Promise<string> => {
  const outcome = await load(response);
  if (outcome.kind !== 'view') throw new Error('expected a view');
  return renderToStaticMarkup(
    <CmsEditorialReviewDetailIsland
      init={{
        review: outcome.view.review,
        reviewId: outcome.view.reviewId,
        verifiedAt: outcome.view.verifiedAt,
      }}
    />,
  );
};

describe('CMS-03B-16 protected review page, composed', () => {
  it('serves the evidence and the decision form to an assignee', async () => {
    const html = await render(
      jsonResponse(200, reviewDetailFixture(), { etag: '"2"' }),
    );
    expect(html).toContain('Frozen candidate');
    expect(html).toContain('Record your decision');
    expect(html).not.toContain('Assign a reviewer');
  });

  it('serves the assignment controls to the owner and no person identifier', async () => {
    const html = await render(
      jsonResponse(
        200,
        reviewDetailFixture({ permittedNextActions: ['assign_reviewer'] }),
        { etag: '"2"' },
      ),
    );
    expect(html).toContain('Assign a reviewer');
    expect(html).not.toContain(REVIEWER_PERSON_ID);
  });

  it('answers a hidden, absent or cross-owner review with one closed 404 state', async () => {
    const hidden = await load(jsonResponse(404, apiError('NOT_FOUND')));
    expect(hidden.kind === 'notice' && hidden.notice.message).toBe(
      'This review is not available.',
    );
  });
});

describe('reviews/[reviewId].astro response invariants', () => {
  const source = readFileSync(fromHere('./[reviewId].astro'), 'utf8');

  it('is never prerendered or cached, uses the one shared shell and bundles no script of its own', () => {
    expect(source).toContain('export const prerender = false');
    expect(source).toContain(
      "Astro.response.headers.set('Cache-Control', 'no-store')",
    );
    expect(source).toContain('<CmsEditorialDocument');
    expect(source).not.toContain('<script');
    expect(source).not.toContain('set:html');
  });

  it('[P2-S11-AC-060] moves focus to the heading on navigation only: the page hands its heading to the shell that loads the heading-focus script', () => {
    const shell = readFileSync(
      fromHere(
        '../../../../components/cms-editorial/CmsEditorialDocument.astro',
      ),
      'utf8',
    );
    const focusScript = readFileSync(
      fromHere('../../../../lib/route-heading-focus.ts'),
      'utf8',
    );
    // The page composes the shell with a heading prop and writes no script of its own.
    expect(source).toMatch(/<CmsEditorialDocument[^>]*heading=\{heading\}/su);
    expect(source).not.toContain('<script');
    // The shell loads the focus script and owns the one element it focuses.
    expect(shell).toContain('<script src="../../lib/route-heading-focus.ts">');
    expect(shell).toContain('<h1 id="page-title" tabindex="-1">{heading}</h1>');
    expect(focusScript).toContain("const PAGE_HEADING_ID = 'page-title'");
    expect(focusScript).toContain("'astro:page-load'");
  });

  it('hydrates exactly one island and maps a sign-in outcome to the allowlisted 303 only', () => {
    expect(source.match(/client:load/gu)).toHaveLength(1);
    expect(source).toContain('cmsRedirectResponse(outcome.location)');
    expect(source).not.toContain('cmsRedirectResponse(`');
  });
});
