import { describe, expect, it, vi } from 'vitest';

const fetchMock = vi.hoisted(() => vi.fn());
vi.mock('cloudflare:workers', () => ({
  env: { PLATFORM_API: { fetch: fetchMock } },
}));

import * as assignments from './[reviewId]/assignments';
import * as decisions from './[reviewId]/decisions';
import {
  REVIEW_ID,
  assignmentResource,
  decisionResource,
} from '../../../../../components/content-schema-registry/content-schema-review-dec108.test-support';

/** First-party CMS-03A-12 and CMS-03A-14 transport over the review id route param. */

const ORIGIN = 'https://app.test';
const post = (path: string, body: unknown): Request =>
  new Request(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: {
      origin: ORIGIN,
      cookie: 'wj_access=protected; wj_csrf=csrf-token-123',
      'x-csrf-token': 'csrf-token-123',
      'idempotency-key': 'cms-review-12345678',
      'if-match': '"3"',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
const upstream = (status: number, body: unknown): void => {
  fetchMock.mockResolvedValueOnce(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  );
};

describe('first-party schema review endpoints', () => {
  it('serve on demand only', () => {
    expect(decisions.prerender).toBe(false);
    expect(assignments.prerender).toBe(false);
  });

  it('POST /decisions forwards a decision to the review (CMS-03A-12)', async () => {
    fetchMock.mockClear();
    upstream(201, decisionResource('approve'));
    const response = await decisions.POST({
      request: post(`/api/v1/cms/schema-reviews/${REVIEW_ID}/decisions`, {
        expectedVersion: '3',
        decision: 'approve',
      }),
      params: { reviewId: REVIEW_ID },
    } as unknown as Parameters<typeof decisions.POST>[0]);
    expect(response.status).toBe(201);
    const sent = fetchMock.mock.calls[0]?.[0] as Request;
    expect(new URL(sent.url).pathname).toBe(
      `/api/v1/cms/schema-reviews/${REVIEW_ID}/decisions`,
    );
  });

  it('POST /assignments forwards a revoke to the review (CMS-03A-14)', async () => {
    fetchMock.mockClear();
    upstream(200, assignmentResource());
    const response = await assignments.POST({
      request: post(`/api/v1/cms/schema-reviews/${REVIEW_ID}/assignments`, {
        action: 'revoke',
        expectedVersion: '3',
        assignmentId: '8e5b04f7-2d91-7a6c-b3d8-1f70c4a95e26',
      }),
      params: { reviewId: REVIEW_ID },
    } as unknown as Parameters<typeof assignments.POST>[0]);
    expect(response.status).toBe(200);
    const sent = fetchMock.mock.calls[0]?.[0] as Request;
    expect(new URL(sent.url).pathname).toBe(
      `/api/v1/cms/schema-reviews/${REVIEW_ID}/assignments`,
    );
  });

  it('refuses a malformed review id with 400 and never forwards', async () => {
    fetchMock.mockClear();
    const response = await decisions.POST({
      request: post('/api/v1/cms/schema-reviews/x/decisions', {
        expectedVersion: '3',
        decision: 'approve',
      }),
      params: { reviewId: 'not-a-uuid' },
    } as unknown as Parameters<typeof decisions.POST>[0]);
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
