import { describe, expect, it } from 'vitest';

import {
  REVIEW_ID,
  SUBJECT_ID,
  apiError,
  governedDetailFixture,
  jsonResponse,
} from '../../server/cms-governed-review-fixtures.test-support';
import type { CmsGovernedPageReads } from './governed-review-page-reads';
import { loadGovernedDetailPage } from './load-governed-detail-page';

const ROUTE = `/app/cms-content-modeling/definition-reviews/${REVIEW_ID}`;

const load = (response: Response, reviewId = REVIEW_ID) => {
  const calls: string[] = [];
  const outcome = loadGovernedDetailPage({
    request: new Request(`https://web.test${ROUTE}`),
    reviewId,
    reads: {
      reviewDetail: async (_request: Request, id: string) => {
        calls.push(id);
        return response;
      },
    } as unknown as CmsGovernedPageReads,
  });
  return { outcome, calls };
};

describe('loadGovernedDetailPage', () => {
  it('returns the verified detail for this review with its verification time', async () => {
    const detail = governedDetailFixture();
    const result = await load(jsonResponse(200, detail, { etag: '"2"' }))
      .outcome;
    expect(result.kind).toBe('view');
    if (result.kind !== 'view') return;
    expect(result).toMatchObject({
      status: 200,
      title: 'Definition review',
      heading: 'Definition review',
    });
    expect(result.view).toMatchObject({
      reviewId: REVIEW_ID,
      routePath: ROUTE,
    });
    expect(result.view.review).toEqual(detail);
    expect(Number.isNaN(Date.parse(result.view.verifiedAt))).toBe(false);
  });

  it('carries a blocked schedule and its closed reason to the page (DEC-191)', async () => {
    const detail = governedDetailFixture({
      activationSchedule: { state: 'blocked', reasonCode: 'retries_exhausted' },
    });
    const result = await load(jsonResponse(200, detail, { etag: '"2"' }))
      .outcome;
    expect(
      result.kind === 'view' && result.view.review.activationSchedule,
    ).toEqual({ state: 'blocked', reasonCode: 'retries_exhausted' });
  });

  it('answers a malformed review id with a 400 before any read', async () => {
    const { outcome, calls } = load(jsonResponse(200, {}), 'not-a-uuid');
    const result = await outcome;
    expect(result.kind === 'notice' && result.notice.status).toBe(400);
    expect(calls).toEqual([]);
  });

  it('returns an expired session to this exact review', async () => {
    expect(await load(new Response('x', { status: 401 })).outcome).toEqual({
      kind: 'redirect',
      location: `/auth/sign-in?returnTo=${encodeURIComponent(ROUTE)}`,
    });
  });

  it('answers a hidden, absent or cross-owner review with one identical 404 state', async () => {
    const result = await load(jsonResponse(404, apiError('X'))).outcome;
    expect(result.kind === 'notice' && result.notice.status).toBe(404);
    expect(result.kind === 'notice' && result.notice.message).toBe(
      'This review is not available.',
    );
  });

  it.each([
    [403, 'This account cannot read this review.'],
    [429, 'Too many requests'],
    [503, 'The editorial service is not responding'],
  ] as const)('renders a %i as one closed state', async (status, copy) => {
    const result = await load(jsonResponse(status, apiError('X'))).outcome;
    expect(result.kind === 'notice' && result.notice.message).toContain(copy);
  });

  it.each([
    [
      'a body that names another review',
      jsonResponse(200, governedDetailFixture({ id: SUBJECT_ID })),
    ],
    [
      'a body with a person identifier beyond the contract',
      jsonResponse(200, {
        ...governedDetailFixture(),
        reviewerPersonId: SUBJECT_ID,
      }),
    ],
    [
      'a body without its activation schedule member (DEC-191)',
      jsonResponse(200, {
        ...governedDetailFixture(),
        activationSchedule: undefined,
      }),
    ],
    [
      'a blocked schedule without its closed reason (DEC-191)',
      jsonResponse(200, {
        ...governedDetailFixture(),
        activationSchedule: { state: 'blocked', reasonCode: null },
      }),
    ],
    ['a body that is not JSON', new Response('nope', { status: 200 })],
  ] as const)('refuses %s, never rendering it', async (_name, response) => {
    const result = await load(response).outcome;
    expect(result.kind === 'notice' && result.notice.status).toBe(502);
  });
});
