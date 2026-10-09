import { describe, expect, it } from 'vitest';

import {
  apiError,
  jsonResponse,
  queueItem,
  queuePageFixture,
} from '../cms-editorial-workflow/cms-workflow-fixtures.test-support';
import type { CmsEditorialPageReads } from './cms-editorial-page-reads';
import {
  CMS_REVIEW_QUEUE_RESTART_ANNOUNCEMENT,
  CMS_REVIEW_QUEUE_RESTART_MARKER,
  loadReviewQueuePage,
} from './load-review-queue-page';

const ROUTE = '/app/cms-content-modeling/reviews';

const load = (response: Response, search = '') => {
  const seen: string[] = [];
  const outcome = loadReviewQueuePage({
    request: new Request(`https://web.test${ROUTE}${search}`),
    reads: {
      reviewQueue: async (request: Request) => {
        seen.push(request.url);
        return response;
      },
    } as unknown as CmsEditorialPageReads,
  });
  return { outcome, seen };
};

describe('loadReviewQueuePage', () => {
  it('returns the verified page with the URL-owned query for the view', async () => {
    const page = queuePageFixture([queueItem(1)], 'c.1');
    const { outcome } = load(
      jsonResponse(200, page, { etag: '"5"' }),
      '?scope=submitted&state=open&limit=10',
    );
    const result = await outcome;
    expect(result.kind).toBe('view');
    if (result.kind !== 'view') return;
    expect(result).toMatchObject({ title: 'Reviews', heading: 'Reviews' });
    expect(result.view).toMatchObject({
      routePath: ROUTE,
      query: { scope: 'submitted', state: 'open', limit: '10' },
      announcement: null,
    });
    expect(result.view.page).toEqual(page);
  });

  it('returns an expired session to this exact list position', async () => {
    const { outcome } = load(
      new Response('x', { status: 401 }),
      '?scope=submitted&cursor=abc',
    );
    expect(await outcome).toEqual({
      kind: 'redirect',
      location: `/auth/sign-in?returnTo=${encodeURIComponent(`${ROUTE}?scope=submitted&cursor=abc`)}`,
    });
  });

  it('answers a refused cursor by dropping only the cursor and marking the restart', async () => {
    const { outcome } = load(
      jsonResponse(409, apiError('CONFLICT')),
      '?scope=submitted&state=open&cursor=stale',
    );
    expect(await outcome).toEqual({
      kind: 'redirect',
      location: `${ROUTE}?scope=submitted&state=open&${CMS_REVIEW_QUEUE_RESTART_MARKER}=1`,
    });
  });

  it('announces the restart and never forwards the marker to the read', async () => {
    const { outcome, seen } = load(
      jsonResponse(200, queuePageFixture()),
      `?scope=assigned&${CMS_REVIEW_QUEUE_RESTART_MARKER}=1`,
    );
    const result = await outcome;
    expect(seen).toEqual([`https://web.test${ROUTE}?scope=assigned`]);
    expect(result.kind === 'view' && result.view.announcement).toBe(
      CMS_REVIEW_QUEUE_RESTART_ANNOUNCEMENT,
    );
    expect(result.kind === 'view' && result.view.query).toEqual({
      scope: 'assigned',
    });
  });

  it('shows a conflict with no cursor to drop as a closed state', async () => {
    const result = await load(jsonResponse(409, apiError('CONFLICT'))).outcome;
    expect(result.kind === 'notice' && result.notice.status).toBe(409);
    expect(result.kind === 'notice' && result.notice.retryHref).toBe(ROUTE);
  });

  it.each([
    [403, 'Access denied'],
    [404, 'Not found'],
    [429, 'Too many requests'],
    [503, 'Temporarily unavailable'],
  ])('renders a %i as one closed state', async (status, heading) => {
    const result = await load(jsonResponse(status, apiError('X'))).outcome;
    expect(result.kind === 'notice' && result.notice.heading).toBe(heading);
  });

  it.each([400, 422])(
    'restarts from the bare queue after a %i, never repeating the bad query',
    async (status) => {
      const result = await load(
        jsonResponse(status, apiError('X')),
        '?state=bogus&cursor=stale',
      ).outcome;
      expect(result.kind === 'notice' && result.notice.retryHref).toBe(ROUTE);
    },
  );

  it('retries a transient failure at the same list position', async () => {
    const result = await load(
      jsonResponse(503, apiError('X')),
      '?scope=submitted',
    ).outcome;
    expect(result.kind === 'notice' && result.notice.retryHref).toBe(
      `${ROUTE}?scope=submitted`,
    );
  });

  it('refuses a 200 that is not the strict page', async () => {
    for (const response of [
      jsonResponse(200, { items: 'no' }),
      new Response('nope', { status: 200 }),
      jsonResponse(200, {
        items: [{ ...queueItem(1), personId: 'p_1' }],
        nextCursor: null,
        pageVersion: '1',
      }),
    ]) {
      const result = await load(response).outcome;
      expect(result.kind === 'notice' && result.notice.status).toBe(502);
    }
  });
});
