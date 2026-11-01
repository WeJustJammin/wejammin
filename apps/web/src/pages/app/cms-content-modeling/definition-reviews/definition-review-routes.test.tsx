import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import CmsGovernedReviewDetailIsland from '../../../../components/cms-governed-review/CmsGovernedReviewDetailIsland';
import CmsGovernedReviewQueue from '../../../../components/cms-governed-review/CmsGovernedReviewQueue';
import type { CmsGovernedPageReads } from '../../../../components/cms-governed-review/governed-review-page-reads';
import { loadGovernedDetailPage } from '../../../../components/cms-governed-review/load-governed-detail-page';
import { loadGovernedQueuePage } from '../../../../components/cms-governed-review/load-governed-queue-page';
import {
  REVIEWER_PERSON_ID,
  REVIEW_ID,
  apiError,
  governedAssignmentSummaryFixture,
  governedDetailFixture,
  governedQueueItem,
  governedQueuePageFixture,
  jsonResponse,
} from '../../../../server/cms-governed-review-fixtures.test-support';

const fromHere = (relative: string): string =>
  fileURLToPath(new URL(relative, import.meta.url));

const ROUTE = 'https://web.test/app/cms-content-modeling/definition-reviews';

/*
 * The definition-review pages are a tested loader plus a tested view; this suite
 * drives the REAL composition for FE03's journeys with only the proxy edge
 * replaced, and reads each Astro file for the response invariants no other test
 * can.
 */
const renderQueue = async (response: Response, search = '') => {
  const outcome = await loadGovernedQueuePage({
    request: new Request(`${ROUTE}${search}`),
    reads: {
      reviewQueue: async () => response,
    } as unknown as CmsGovernedPageReads,
  });
  if (outcome.kind !== 'view') throw new Error('expected a view');
  return renderToStaticMarkup(
    <CmsGovernedReviewQueue
      page={outcome.view.page}
      routePath={outcome.view.routePath}
      query={outcome.view.query}
      announcement={outcome.view.announcement}
    />,
  );
};

const renderDetail = async (response: Response): Promise<string> => {
  const outcome = await loadGovernedDetailPage({
    request: new Request(`${ROUTE}/${REVIEW_ID}`),
    reviewId: REVIEW_ID,
    reads: {
      reviewDetail: async () => response,
    } as unknown as CmsGovernedPageReads,
  });
  if (outcome.kind !== 'view') throw new Error('expected a view');
  return renderToStaticMarkup(
    <CmsGovernedReviewDetailIsland
      init={{
        review: outcome.view.review,
        reviewId: outcome.view.reviewId,
        verifiedAt: outcome.view.verifiedAt,
      }}
    />,
  );
};

describe('CMS-03C-11 protected definition-review queue page, composed', () => {
  it('lists the scope as native links with a signed, URL-owned continuation', async () => {
    const html = await renderQueue(
      jsonResponse(
        200,
        governedQueuePageFixture([governedQueueItem(1)], 'next.cursor'),
        { etag: '"5"' },
      ),
      '?scope=owned&limit=1',
    );
    expect(html.match(/<li>/gu)).toHaveLength(1);
    expect(html).toContain('1 review loaded.');
    expect(html).toContain('cursor=next.cursor');
    expect(html).toContain('scope=owned');
  });

  it('shows nothing-in-scope and filter-miss as different states with one action each', async () => {
    const empty = governedQueuePageFixture([]);
    const none = await renderQueue(jsonResponse(200, empty));
    expect(none).toContain('No definition reviews are assigned to you.');
    const miss = await renderQueue(jsonResponse(200, empty), '?state=rejected');
    expect(miss).toContain('No reviews match these filters.');
    expect(miss).toContain('Reset the filters');
  });

  it('lets no concealed row, count or identifier through a queue the API answered 403', async () => {
    const outcome = await loadGovernedQueuePage({
      request: new Request(ROUTE),
      reads: {
        reviewQueue: async () => jsonResponse(403, apiError('X')),
      } as unknown as CmsGovernedPageReads,
    });
    expect(outcome.kind === 'notice' && outcome.notice.message).toBe(
      'This account cannot read the review list.',
    );
  });
});

describe('CMS-03C-10 protected definition-review detail page, composed', () => {
  it('serves the evidence and the decision form to an assignee', async () => {
    const html = await renderDetail(
      jsonResponse(200, governedDetailFixture(), { etag: '"2"' }),
    );
    expect(html).toContain('Frozen version');
    expect(html).toContain('Record your decision');
    expect(html).not.toContain('Assign a reviewer');
  });

  it('serves the assignment controls to the owner and no person identifier', async () => {
    const html = await renderDetail(
      jsonResponse(
        200,
        governedDetailFixture({
          permittedNextActions: ['assign_reviewer', 'revoke_assignment'],
          assignments: [governedAssignmentSummaryFixture()],
        }),
        { etag: '"2"' },
      ),
    );
    expect(html).toContain('Assign a reviewer');
    expect(html).toContain('Revoke an assignment');
    expect(html).toContain('Reviewer A');
    expect(html).not.toContain(REVIEWER_PERSON_ID);
  });

  it('refuses, and never renders, a detail body that names a reviewer person', async () => {
    const leaking = governedDetailFixture({
      permittedNextActions: ['assign_reviewer', 'revoke_assignment'],
      assignments: [governedAssignmentSummaryFixture()],
    });
    const outcome = await loadGovernedDetailPage({
      request: new Request(`${ROUTE}/${REVIEW_ID}`),
      reviewId: REVIEW_ID,
      reads: {
        reviewDetail: async () =>
          jsonResponse(
            200,
            {
              ...leaking,
              assignments: leaking.assignments.map((assignment) => ({
                ...assignment,
                reviewerPersonId: REVIEWER_PERSON_ID,
              })),
            },
            { etag: '"2"' },
          ),
      } as unknown as CmsGovernedPageReads,
    });
    expect(outcome.kind).toBe('notice');
    expect(JSON.stringify(outcome)).not.toContain(REVIEWER_PERSON_ID);
  });

  it('answers a hidden, absent or cross-owner review with one closed 404 state', async () => {
    const outcome = await loadGovernedDetailPage({
      request: new Request(`${ROUTE}/${REVIEW_ID}`),
      reviewId: REVIEW_ID,
      reads: {
        reviewDetail: async () => jsonResponse(404, apiError('X')),
      } as unknown as CmsGovernedPageReads,
    });
    expect(outcome.kind === 'notice' && outcome.notice.message).toBe(
      'This review is not available.',
    );
  });
});

describe.each([
  ['index.astro', false],
  ['[reviewId].astro', true],
] as const)('definition-reviews/%s response invariants', (file, hydrates) => {
  const source = readFileSync(fromHere(`./${file}`), 'utf8');

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

  it('hands its heading to the shell that loads the heading-focus script', () => {
    expect(source).toMatch(/<CmsEditorialDocument[^>]*heading=\{heading\}/su);
    const shell = readFileSync(
      fromHere(
        '../../../../components/cms-editorial/CmsEditorialDocument.astro',
      ),
      'utf8',
    );
    expect(shell).toContain('<script src="../../lib/route-heading-focus.ts">');
  });

  it('maps a sign-in outcome to the allowlisted 303 only', () => {
    expect(source).toContain('cmsRedirectResponse(outcome.location)');
    expect(source).not.toContain('cmsRedirectResponse(`');
  });

  it(hydrates ? 'hydrates exactly one island' : 'hydrates nothing', () => {
    expect(source.match(/client:load/gu) ?? []).toHaveLength(hydrates ? 1 : 0);
  });

  it('builds its reads from the private binding through the governed page reads', () => {
    expect(source).toContain('createCmsGovernedPageReads(env.PLATFORM_API)');
  });
});

describe('definition-reviews/[reviewId].astro', () => {
  const source = readFileSync(fromHere('./[reviewId].astro'), 'utf8');

  it('passes the island only the verified review, its id and the verification time', () => {
    expect(source).toContain('review: outcome.view.review');
    expect(source).toContain('reviewId: outcome.view.reviewId');
    expect(source).toContain('verifiedAt: outcome.view.verifiedAt');
  });
});
