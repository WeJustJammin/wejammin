import { describe, expect, it, vi } from 'vitest';

import {
  REVIEW_ID,
  SCHEMA_VERSION_ID,
  apiError,
  jsonResponse,
  reviewDetailFixture,
} from '../cms-editorial-workflow/cms-workflow-fixtures.test-support';
import type { CmsEditorialPageReads } from './cms-editorial-page-reads';
import { loadReviewDetailPage } from './load-review-detail-page';

const ROUTE = `/app/cms-content-modeling/reviews/${REVIEW_ID}`;

const load = (response: Response | undefined, reviewId = REVIEW_ID) => {
  const reviewDetail = vi.fn(async () => response as Response);
  const outcome = loadReviewDetailPage({
    request: new Request(`https://web.test${ROUTE}`),
    reviewId,
    reads: { reviewDetail } as unknown as CmsEditorialPageReads,
  });
  return { outcome, reviewDetail };
};

describe('loadReviewDetailPage', () => {
  it('returns the verified review for the detail island', async () => {
    const resource = reviewDetailFixture();
    const result = await load(jsonResponse(200, resource, { etag: '"2"' }))
      .outcome;
    expect(result.kind).toBe('view');
    if (result.kind !== 'view') return;
    expect(result).toMatchObject({ title: 'Review', heading: 'Review' });
    expect(result.view).toMatchObject({
      reviewId: REVIEW_ID,
      routePath: ROUTE,
    });
    expect(result.view.review).toEqual(resource);
  });

  it('refuses a malformed review id as 400 without an upstream call', async () => {
    const { outcome, reviewDetail } = load(undefined, 'nope');
    const result = await outcome;
    expect(result.kind === 'notice' && result.notice.status).toBe(400);
    expect(reviewDetail).not.toHaveBeenCalled();
  });

  it('returns an expired session to this review', async () => {
    const result = await load(new Response('x', { status: 401 })).outcome;
    expect(result).toEqual({
      kind: 'redirect',
      location: `/auth/sign-in?returnTo=${encodeURIComponent(ROUTE)}`,
    });
  });

  it.each([
    [403, 'Access denied', 'This account cannot read this review.'],
    [404, 'Not found', 'This review is not available.'],
    [429, 'Too many requests', 'Too many requests. Try again shortly.'],
    [
      503,
      'Temporarily unavailable',
      'The editorial service is not responding. Nothing was loaded; try again shortly.',
    ],
  ])('renders a %i as one closed state', async (status, heading, message) => {
    const result = await load(jsonResponse(status, apiError('X'))).outcome;
    expect(result.kind === 'notice' && result.notice.heading).toBe(heading);
    expect(result.kind === 'notice' && result.notice.message).toBe(message);
  });

  it('treats a concealed review exactly like an absent one', async () => {
    const hidden = await load(jsonResponse(404, apiError('NOT_FOUND'))).outcome;
    const absent = await load(new Response('x', { status: 404 })).outcome;
    expect(hidden).toEqual(absent);
  });

  it('refuses a 200 that is not the strict review or names another review', async () => {
    for (const response of [
      jsonResponse(200, { id: 1 }),
      new Response('nope', { status: 200 }),
      jsonResponse(200, reviewDetailFixture({ id: SCHEMA_VERSION_ID })),
    ]) {
      const result = await load(response).outcome;
      expect(result.kind === 'notice' && result.notice.status).toBe(502);
    }
  });
});
