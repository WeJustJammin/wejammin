// @vitest-environment jsdom
import * as React from 'react';
import { act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { loadCmsValidators } from '../../lib/cms-contract-validators';
import {
  disableReactAct,
  enableReactAct,
  flush,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import { preloadWorkflowAnswerMachinery } from '../cms-editorial-workflow/cms-workflow-answer-machinery.test-support';
import {
  INSTANT,
  REVIEW_ID,
  apiError,
  governedDecisionFixture,
  governedDetailFixture,
  jsonResponse,
} from '../../server/cms-governed-review-fixtures.test-support';
import CmsGovernedReviewDetailIsland from './CmsGovernedReviewDetailIsland';
import { readCanonicalGovernedReview } from './governed-review-canonical-read';
import type { CmsGovernedPageReads } from './governed-review-page-reads';
import { loadGovernedDetailPage } from './load-governed-detail-page';
import {
  advance,
  aria,
  commitControls,
  everyFormReview,
  loadingRegion,
  mountDetail,
  provokeRefetch,
  reasonsShown,
  type Read,
} from './CmsGovernedReviewDetailIsland.states.test-support';

beforeAll(preloadWorkflowAnswerMachinery);
beforeAll(enableReactAct);
beforeAll(async () => {
  await loadCmsValidators();
});
afterAll(disableReactAct);
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const ROUTE = `https://web.test/app/cms-content-modeling/definition-reviews/${REVIEW_ID}`;

const loadDetail = (response: Response) =>
  loadGovernedDetailPage({
    request: new Request(ROUTE),
    reviewId: REVIEW_ID,
    reads: {
      reviewDetail: async () => response,
    } as unknown as CmsGovernedPageReads,
  });

describe('CmsGovernedReviewDetailIsland (CMS-03C-10) governedReviewState: idle and loading', () => {
  it('[P2-S12-AC-271] governedReviewState idle: the server HTML already rendered the review and the island does no read, shows no skeleton and no degraded notice', async () => {
    const review = governedDetailFixture();
    const html = renderToStaticMarkup(
      <CmsGovernedReviewDetailIsland
        init={{ review, reviewId: REVIEW_ID, verifiedAt: INSTANT }}
      />,
    );
    expect(html).toContain('Frozen version');
    expect(html).toContain('State: Open');
    expect(html).not.toContain('cms-loading-region');
    expect(html).not.toContain('data-cms-workflow-degraded');

    const readReview = vi.fn(async (): Promise<Read> => {
      throw new Error('idle must not read');
    });
    const { container } = mountDetail(review, readReview);
    await flush();
    await advance(5_000);
    expect(container.textContent).toContain('Frozen version');
    expect(container.textContent).toContain('State: Open');
    expect(readReview).not.toHaveBeenCalled();
    expect(loadingRegion(container)).toBeNull();
    expect(container.querySelector('[data-cms-workflow-degraded]')).toBeNull();
    expect(container.querySelector('[data-cms-workflow-closed]')).toBeNull();
  });

  it('[P2-S12-AC-271] governedReviewState loading: a refetch shows nothing at 249 ms, a polite skeleton at 250 ms with the last review kept, and every form (decision, assign, revoke, activation) disabled with its reason until the read answers', async () => {
    const review = everyFormReview();
    let finish: (value: Read) => void = () => undefined;
    const readReview = vi.fn(
      () => new Promise<Read>((resolve) => (finish = resolve)),
    );
    const { container } = mountDetail(review, readReview);
    await flush();
    expect(commitControls(container).map(aria)).toEqual([
      'false',
      'false',
      'false',
      'false',
    ]);
    await provokeRefetch(container);
    expect(readReview).toHaveBeenCalledTimes(1);

    await advance(248);
    expect(loadingRegion(container)).toBeNull();
    await advance(1);
    expect(loadingRegion(container)).toBeNull();
    expect(reasonsShown(container)).not.toContain('Reading the review…');
    await advance(1);

    const skeleton = loadingRegion(container) as HTMLElement;
    expect(skeleton.getAttribute('role')).toBe('status');
    expect(skeleton.textContent).toContain('Loading the current review');
    expect(container.textContent).toContain('Frozen version');
    expect(commitControls(container).map(aria)).toEqual([
      'true',
      'true',
      'true',
      'true',
    ]);
    expect(reasonsShown(container)).toEqual([
      'Reading the review…',
      'Reading the review…',
      'Reading the review…',
      'Reading the review…',
    ]);

    await act(async () => {
      finish({ kind: 'ok', resource: review });
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(loadingRegion(container)).toBeNull();
    expect(commitControls(container).slice(1).map(aria)).toEqual([
      'false',
      'false',
      'false',
    ]);
    expect(reasonsShown(container)).not.toContain('Reading the review…');
  });
});

describe('CmsGovernedReviewDetailIsland (CMS-03C-10) governedReviewState: success and empty', () => {
  it('[P2-S12-AC-271] governedReviewState success: a 200 review detail is the strict page view, and a later 200 read replaces the shown review (server-authoritative, never optimistic)', async () => {
    const first = governedDetailFixture();
    const outcome = await loadDetail(jsonResponse(200, first, { etag: '"2"' }));
    expect(outcome.kind).toBe('view');
    if (outcome.kind !== 'view') return;
    expect(outcome.status).toBe(200);
    expect(outcome.view.review).toEqual(first);

    const approved = governedDetailFixture({
      version: '3',
      state: 'approved',
      decidedAt: '2026-10-08T13:00:00Z',
      recordedDecisionCount: 1,
      distinctApprovalCount: 1,
      decisions: [governedDecisionFixture({ mine: true, reason: 'Fine.' })],
      permittedNextActions: [],
      subjectState: 'approved',
    });
    const fetcher = vi.fn(async () =>
      jsonResponse(200, approved, { etag: '"3"' }),
    );
    const { container } = mountDetail(outcome.view.review, () =>
      readCanonicalGovernedReview(REVIEW_ID, fetcher),
    );
    await flush();
    expect(container.textContent).toContain('State: Open');
    await provokeRefetch(container);
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('State: Approved');
    expect(container.textContent).toContain('Your reason: Fine.');
    expect(container.querySelector('input[type="radio"]')).toBeNull();
    expect(loadingRegion(container)).toBeNull();
    expect(container.querySelector('[data-cms-workflow-degraded]')).toBeNull();
  });

  it('[P2-S12-AC-271] governedReviewState empty: a concealed or absent review is not-disclosed (one identical 404 notice at the page; the data is removed at the island) and names no review', async () => {
    const concealed = await loadDetail(
      jsonResponse(404, apiError('NOT_FOUND')),
    );
    expect(concealed.kind).toBe('notice');
    if (concealed.kind !== 'notice') return;
    expect(concealed.notice).toMatchObject({
      status: 404,
      title: 'Not found',
      message: 'This review is not available.',
      requestId: null,
    });
    const absent = await loadDetail(
      jsonResponse(404, apiError('SOMETHING_ELSE')),
    );
    expect(absent).toEqual(concealed);

    const fetcher = vi.fn(async () => jsonResponse(404, apiError('NOT_FOUND')));
    const { container } = mountDetail(governedDetailFixture(), () =>
      readCanonicalGovernedReview(REVIEW_ID, fetcher),
    );
    await flush();
    await provokeRefetch(container);
    await flush();
    const closed = container.querySelector('[data-cms-workflow-closed="gone"]');
    expect(closed?.textContent).toBe('This record is not available.');
    expect(container.textContent).not.toContain('Frozen version');
    expect(container.textContent).not.toContain('profile-header');
    expect(container.querySelector('form')).toBeNull();
  });
});
