// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

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

import {
  disableReactAct,
  enableReactAct,
  mountElement,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import { cmsRedirectResponse } from '../cms-editorial-pages/cms-editorial-page-outcome';
import type { CmsEditorialPageOutcome } from '../cms-editorial-pages/cms-editorial-page-view';
import CmsEditorialPageNotice from '../cms-editorial-pages/CmsEditorialPageNotice';
import {
  CMS_REVIEW_QUEUE_RESTART_ANNOUNCEMENT,
  CMS_REVIEW_QUEUE_RESTART_MARKER,
} from '../cms-editorial-pages/load-review-queue-page';
import {
  REQUEST_ID,
  apiError,
  governedQueueItem,
  governedQueuePageFixture,
  jsonResponse,
} from '../../server/cms-governed-review-fixtures.test-support';
import CmsGovernedReviewQueue from './CmsGovernedReviewQueue';
import type { CmsGovernedPageReads } from './governed-review-page-reads';
import {
  loadGovernedQueuePage,
  type CmsGovernedQueuePageView,
} from './load-governed-queue-page';

beforeAll(enableReactAct);
afterAll(disableReactAct);
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const ROUTE = '/app/cms-content-modeling/definition-reviews';
const ORIGIN = 'https://web.test';
const fromHere = (relative: string): string =>
  fileURLToPath(new URL(relative, import.meta.url));

/** The page loader over a fake edge that answers each read with `answer(url)`. */
const load = (answer: (url: string) => Response, search = '') => {
  const seen: string[] = [];
  const outcome = loadGovernedQueuePage({
    request: new Request(`${ORIGIN}${ROUTE}${search}`),
    reads: {
      reviewQueue: async (request: Request) => {
        seen.push(request.url);
        return answer(request.url);
      },
    } as unknown as CmsGovernedPageReads,
  });
  return { outcome, seen };
};

const viewOf = async (
  outcome: Promise<CmsEditorialPageOutcome<CmsGovernedQueuePageView>>,
): Promise<CmsGovernedQueuePageView> => {
  const result = await outcome;
  if (result.kind !== 'view')
    throw new Error(`expected a view: ${result.kind}`);
  return result.view;
};

const queueElement = (view: CmsGovernedQueuePageView) => (
  <CmsGovernedReviewQueue
    page={view.page}
    routePath={view.routePath}
    query={view.query}
    announcement={view.announcement}
  />
);

const statusLine = (container: HTMLElement): string =>
  container.querySelector('[role="status"]')?.textContent?.trim() ?? '';

describe('CmsGovernedReviewQueue (CMS-03C-11) governedReviewState: idle, loading, success', () => {
  it('[P2-S12-AC-271] governedReviewState idle: the server HTML already rendered the queue, and nothing reads, fetches or shows a skeleton afterwards', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const view = await viewOf(
      load(() => jsonResponse(200, governedQueuePageFixture())).outcome,
    );
    const html = renderToStaticMarkup(queueElement(view));
    expect(html).toContain('Definition reviews');
    expect(html).toContain('1 review loaded.');
    expect(html).not.toContain('cms-loading-region');

    const { container } = mountElement(queueElement(view));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(container.querySelector('h2')?.textContent).toBe(
      'Definition reviews',
    );
    expect(statusLine(container)).toBe('1 review loaded.');
    expect(container.querySelector('.cms-loading-region')).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('[P2-S12-AC-271] governedReviewState loading (N/A by construction, evidence only): the queue is server-rendered with no client read, so no skeleton can appear at 250 ms and its native GET filter form is never disabled', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const view = await viewOf(
      load(() => jsonResponse(200, governedQueuePageFixture())).outcome,
    );
    const { container } = mountElement(queueElement(view));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(249);
    });
    expect(container.querySelector('.cms-loading-region')).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(container.querySelector('.cms-loading-region')).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
    const form = container.querySelector('form[method="get"]');
    expect(form?.getAttribute('aria-label')).toBe('Filter reviews');
    expect(form?.querySelector('button')?.hasAttribute('disabled')).toBe(false);
    expect(form?.querySelector('button')?.getAttribute('aria-disabled')).toBe(
      null,
    );

    const page = readFileSync(
      fromHere(
        '../../pages/app/cms-content-modeling/definition-reviews/index.astro',
      ),
      'utf8',
    );
    expect(page).toContain('<CmsGovernedReviewQueue');
    expect(page).not.toMatch(/client:(?:load|idle|visible|media|only)/u);
    const source = readFileSync(
      fromHere('./CmsGovernedReviewQueue.tsx'),
      'utf8',
    );
    expect(source).not.toMatch(/useState|useEffect|useReducer|fetch\(/u);
  });

  it('[P2-S12-AC-271] governedReviewState success: a 200 queue page is the strict page view, one native link per review under a polite count, with the next page as a URL-owned signed cursor', async () => {
    const items = [governedQueueItem(1), governedQueueItem(2)];
    const { outcome, seen } = load(
      () => jsonResponse(200, governedQueuePageFixture(items, 'signed.cursor')),
      '?scope=owned&state=open',
    );
    const result = await outcome;
    expect(result.kind).toBe('view');
    if (result.kind !== 'view') return;
    expect(result.status).toBe(200);
    expect(seen).toEqual([`${ORIGIN}${ROUTE}?scope=owned&state=open`]);
    expect(result.view.page.items).toHaveLength(2);
    const { container } = mountElement(queueElement(result.view));
    expect(statusLine(container)).toBe('2 reviews loaded.');
    const links = [...container.querySelectorAll('ul li > a')].map((link) =>
      link.getAttribute('href'),
    );
    expect(links).toEqual(
      items.map((item) => `${ROUTE}/${String(item.reviewId)}`),
    );
    expect(
      container
        .querySelector('nav[aria-label="Review queue pages"] a')
        ?.getAttribute('href'),
    ).toBe(
      `${ROUTE}?scope=owned&state=open&cursor=signed.cursor#governed-queue-title`,
    );
    expect(container.querySelector('.cms-loading-region')).toBeNull();
  });
});

describe('CmsGovernedReviewQueue (CMS-03C-11) governedReviewState: empty', () => {
  it.each([
    [
      'assigned',
      '',
      'No definition reviews are assigned to you.',
      'See reviews you submitted',
    ],
    [
      'owned',
      '?scope=owned',
      'No definition reviews are open on versions you own.',
      'Go to content modeling',
    ],
  ])(
    '[P2-S12-AC-271] governedReviewState empty: no-records for the %s scope says so in a polite status and offers exactly one action',
    async (_scope, search, sentence, action) => {
      const view = await viewOf(
        load(() => jsonResponse(200, governedQueuePageFixture([])), search)
          .outcome,
      );
      const { container } = mountElement(queueElement(view));
      expect(statusLine(container)).toBe(sentence);
      expect(container.querySelectorAll('ul li')).toHaveLength(0);
      const actions = container.querySelectorAll('section > p:not([role]) a');
      expect(actions).toHaveLength(1);
      expect(actions[0]?.textContent).toBe(action);
    },
  );

  it('[P2-S12-AC-271] governedReviewState empty: filter-miss says the filters excluded every row, offers exactly one action that resets the filters, and is distinct from no-records', async () => {
    const view = await viewOf(
      load(
        () => jsonResponse(200, governedQueuePageFixture([])),
        '?scope=submitted&state=approved',
      ).outcome,
    );
    const { container } = mountElement(queueElement(view));
    expect(statusLine(container)).toBe('No reviews match these filters.');
    const actions = container.querySelectorAll('section > p:not([role]) a');
    expect(actions).toHaveLength(1);
    expect(actions[0]?.textContent).toBe('Reset the filters');
    expect(actions[0]?.getAttribute('href')).toBe(
      `${ROUTE}?scope=submitted#governed-queue-title`,
    );
  });
});

describe('CmsGovernedReviewQueue (CMS-03C-11) governedReviewState: error, degraded, disabled', () => {
  it.each([
    [403, 'Access denied', 'This account cannot read the review list.'],
    [404, 'Not found', 'The review list is not available.'],
    [429, 'Too many requests', 'Too many requests. Try again shortly.'],
  ])(
    '[P2-S12-AC-271] governedReviewState error: a typed ApiError %i is one fixed closed notice, never the response text',
    async (status, heading, message) => {
      const { outcome } = load(() =>
        jsonResponse(status, {
          ...apiError('ANYTHING'),
          message: 'LEAK-FROM-RESPONSE',
        }),
      );
      const result = await outcome;
      expect(result.kind).toBe('notice');
      if (result.kind !== 'notice') return;
      expect(result.notice).toMatchObject({ status, heading, message });
      const { container } = mountElement(
        <CmsEditorialPageNotice notice={result.notice} />,
      );
      expect(container.textContent).toContain(message);
      expect(container.textContent).not.toContain('LEAK-FROM-RESPONSE');
    },
  );

  it('[P2-S12-AC-271] governedReviewState error: a typed ApiError 503 shows its verified request ID as the support reference and retries at the same list position', async () => {
    const result = await load(
      () => jsonResponse(503, apiError('DEPENDENCY_UNAVAILABLE')),
      '?scope=submitted',
    ).outcome;
    expect(result.kind).toBe('notice');
    if (result.kind !== 'notice') return;
    expect(result.notice).toMatchObject({
      status: 503,
      requestId: REQUEST_ID,
      retryHref: `${ROUTE}?scope=submitted`,
    });
    const { container } = mountElement(
      <CmsEditorialPageNotice notice={result.notice} />,
    );
    expect(container.textContent).toContain(`Reference: ${REQUEST_ID}`);
  });

  it('[P2-S12-AC-271] governedReviewState error: a 409 cursor conflict restarts from the first page, dropping only the cursor, keeping the filters and announcing the restart politely', async () => {
    const answer = (url: string): Response =>
      new URL(url).searchParams.has('cursor')
        ? jsonResponse(409, apiError('GOVERNED_REVIEW_VERSION_CONFLICT'))
        : jsonResponse(200, governedQueuePageFixture([governedQueueItem(1)]));
    const first = load(answer, '?scope=owned&state=open&cursor=stale');
    const redirect = await first.outcome;
    expect(redirect).toEqual({
      kind: 'redirect',
      location: `${ROUTE}?scope=owned&state=open&${CMS_REVIEW_QUEUE_RESTART_MARKER}=1`,
    });
    if (redirect.kind !== 'redirect') return;

    const second = load(answer, redirect.location.slice(ROUTE.length));
    const view = await viewOf(second.outcome);
    expect(second.seen).toEqual([`${ORIGIN}${ROUTE}?scope=owned&state=open`]);
    expect(view.query).toEqual({ scope: 'owned', state: 'open' });
    expect(view.page.items).toHaveLength(1);
    const { container } = mountElement(queueElement(view));
    expect(statusLine(container)).toBe(
      `${CMS_REVIEW_QUEUE_RESTART_ANNOUNCEMENT} 1 review loaded.`,
    );
    expect(
      container.querySelector('[role="status"]')?.getAttribute('aria-live'),
    ).toBe('polite');
    expect(
      container.querySelector('nav[aria-label="Review queue pages"]'),
    ).toBeNull();
  });

  it.each([
    ['a 503', () => jsonResponse(503, apiError('DEPENDENCY_UNAVAILABLE'))],
    [
      'a 200 that is not the strict page',
      () => jsonResponse(200, { items: 'no' }),
    ],
  ])(
    '[P2-S12-AC-271] governedReviewState degraded (kept half of the cell, see DEFECT D1 for the last verified queue): %s renders a closed notice saying nothing was loaded and no queue row from any cache',
    async (_label, answer) => {
      const result = await load(answer).outcome;
      expect(result.kind).toBe('notice');
      if (result.kind !== 'notice') return;
      expect(result.notice.message).toMatch(/Nothing was loaded/u);
      const { container } = mountElement(
        <CmsEditorialPageNotice notice={result.notice} />,
      );
      expect(container.querySelector('ul li')).toBeNull();
      expect(container.querySelector('time')).toBeNull();
    },
  );

  it('[P2-S12-AC-271] governedReviewState disabled: an ended session answers the 303 no-store sign-in redirect that returns to this exact list position (scope, filters and cursor)', async () => {
    const result = await load(
      () => new Response('x', { status: 401 }),
      '?scope=submitted&state=open&cursor=abc',
    ).outcome;
    const position = `${ROUTE}?scope=submitted&state=open&cursor=abc`;
    expect(result).toEqual({
      kind: 'redirect',
      location: `/auth/sign-in?returnTo=${encodeURIComponent(position)}`,
    });
    if (result.kind !== 'redirect') return;
    const response = cmsRedirectResponse(result.location);
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(result.location);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const page = readFileSync(
      fromHere(
        '../../pages/app/cms-content-modeling/definition-reviews/index.astro',
      ),
      'utf8',
    );
    expect(page).toContain(
      "if (outcome.kind === 'redirect') return cmsRedirectResponse(outcome.location);",
    );
  });
});
