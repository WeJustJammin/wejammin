// @vitest-environment jsdom
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
  mountElement,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import CmsEditorialPageNotice from '../cms-editorial-pages/CmsEditorialPageNotice';
import { preloadWorkflowAnswerMachinery } from '../cms-editorial-workflow/cms-workflow-answer-machinery.test-support';
import {
  INSTANT,
  REQUEST_ID,
  REVIEW_ID,
  apiError,
  governedDetailFixture,
  jsonResponse,
} from '../../server/cms-governed-review-fixtures.test-support';
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

const PATH = `/app/cms-content-modeling/definition-reviews/${REVIEW_ID}`;
const UNVERIFIED =
  'The last read could not be verified. Commands are off until it is.';

const loadDetail = (response: Response) =>
  loadGovernedDetailPage({
    request: new Request(`https://web.test${PATH}`),
    reviewId: REVIEW_ID,
    reads: {
      reviewDetail: async () => response,
    } as unknown as CmsGovernedPageReads,
  });

describe('CmsGovernedReviewDetailIsland (CMS-03C-10) governedReviewState: error', () => {
  it.each([
    [403, 'Access denied', 'This account cannot read this review.'],
    [404, 'Not found', 'This review is not available.'],
  ])(
    '[P2-S12-AC-271] governedReviewState error: a typed ApiError %i reads as one fixed notice (403 for a visible review without read scope, 404 as concealment), never the response text',
    async (status, heading, message) => {
      const outcome = await loadDetail(
        jsonResponse(status, {
          ...apiError('ANYTHING'),
          message: 'LEAK-FROM-RESPONSE',
        }),
      );
      expect(outcome.kind).toBe('notice');
      if (outcome.kind !== 'notice') return;
      expect(outcome.notice).toMatchObject({
        status,
        heading,
        message,
        requestId: null,
        retryHref: null,
      });
      const { container } = mountElement(
        <CmsEditorialPageNotice notice={outcome.notice} />,
      );
      expect(container.textContent).toContain(message);
      expect(container.textContent).not.toContain('LEAK-FROM-RESPONSE');
    },
  );

  it('[P2-S12-AC-271] governedReviewState error: a typed ApiError 503 keeps its verified request ID as the support reference and offers a retry to the same review', async () => {
    const outcome = await loadDetail(
      jsonResponse(503, apiError('DEPENDENCY_UNAVAILABLE')),
    );
    expect(outcome.kind).toBe('notice');
    if (outcome.kind !== 'notice') return;
    expect(outcome.notice).toMatchObject({
      status: 503,
      heading: 'Temporarily unavailable',
      requestId: REQUEST_ID,
      retryHref: PATH,
    });
    const { container } = mountElement(
      <CmsEditorialPageNotice notice={outcome.notice} />,
    );
    expect(container.textContent).toContain(`Reference: ${REQUEST_ID}`);
    expect(container.querySelector(`a[href="${PATH}"]`)?.textContent).toBe(
      'Try again',
    );
  });

  it('[P2-S12-AC-271] governedReviewState error: the island read keeps a typed ApiError request ID and reads a 403 or 404 as one gone state', async () => {
    const read = (response: Response) =>
      readCanonicalGovernedReview(
        REVIEW_ID,
        vi.fn(async () => response),
      );
    expect(await read(jsonResponse(500, apiError('INTERNAL')))).toEqual({
      kind: 'degraded',
      requestId: REQUEST_ID,
    });
    expect(await read(jsonResponse(403, apiError('FORBIDDEN')))).toEqual({
      kind: 'gone',
    });
    expect(await read(jsonResponse(404, apiError('NOT_FOUND')))).toEqual({
      kind: 'gone',
    });
  });
});

describe('CmsGovernedReviewDetailIsland (CMS-03C-10) governedReviewState: degraded and disabled', () => {
  it('[P2-S12-AC-271] governedReviewState degraded: a failed read keeps the last verified review with lastVerifiedAt, turns every form off with the unverified reason, and re-enables them only after a later read verifies', async () => {
    const review = everyFormReview();
    const reads: Read[] = [
      {
        kind: 'degraded',
        requestId: null,
        rateLimit: { retryAfterSeconds: 6 },
      },
      { kind: 'ok', resource: review },
    ];
    const readReview = vi.fn(async () => reads.shift() as Read);
    const { container } = mountDetail(review, readReview);
    await flush();
    await provokeRefetch(container);

    expect(container.textContent).toContain('Frozen version');
    const notice = container.querySelector('[data-cms-workflow-degraded]');
    expect(notice?.textContent).toContain(
      'Showing the last verified state from',
    );
    expect(notice?.querySelector('time')?.getAttribute('datetime')).toBe(
      INSTANT,
    );
    expect(commitControls(container).map(aria)).toEqual([
      'true',
      'true',
      'true',
      'true',
    ]);
    expect(reasonsShown(container)).toEqual([
      UNVERIFIED,
      UNVERIFIED,
      UNVERIFIED,
      UNVERIFIED,
    ]);
    expect(loadingRegion(container)).toBeNull();

    await advance(5_999);
    expect(readReview).toHaveBeenCalledTimes(1);
    expect(commitControls(container).map(aria)).toEqual([
      'true',
      'true',
      'true',
      'true',
    ]);
    await advance(1);
    expect(readReview).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[data-cms-workflow-degraded]')).toBeNull();
    expect(commitControls(container).slice(1).map(aria)).toEqual([
      'false',
      'false',
      'false',
    ]);
    expect(reasonsShown(container)).not.toContain(UNVERIFIED);
  });

  it('[P2-S12-AC-271] governedReviewState disabled: an ended session removes the review and every form and names the missing sign-in with a return link (the page answers the 303 sign-in redirect to the same review)', async () => {
    const redirect = await loadDetail(
      jsonResponse(401, apiError('UNAUTHENTICATED')),
    );
    expect(redirect).toEqual({
      kind: 'redirect',
      location: `/auth/sign-in?returnTo=${encodeURIComponent(PATH)}`,
    });

    const fetcher = vi.fn(async () =>
      jsonResponse(401, apiError('UNAUTHENTICATED')),
    );
    const { container } = mountDetail(governedDetailFixture(), () =>
      readCanonicalGovernedReview(REVIEW_ID, fetcher),
    );
    await flush();
    await provokeRefetch(container);
    await flush();
    const closed = container.querySelector(
      '[data-cms-workflow-closed="signed-out"]',
    );
    expect(closed?.textContent).toContain('Your session expired.');
    expect(closed?.textContent).toContain('Sign in again');
    expect(closed?.querySelector('a')?.getAttribute('href')).toBe(
      `/auth/sign-in?returnTo=${encodeURIComponent(
        `${window.location.pathname}${window.location.search}`,
      )}`,
    );
    expect(container.textContent).not.toContain('Frozen version');
    expect(container.querySelector('form')).toBeNull();
    expect(container.querySelector('button')).toBeNull();
  });
});
