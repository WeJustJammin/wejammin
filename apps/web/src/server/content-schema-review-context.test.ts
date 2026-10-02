import { describe, expect, it } from 'vitest';

import {
  ACTOR_ID,
  REVIEW_ID,
  REVIEW_PATH,
  approvedProtectedReview,
  reviewResource,
} from '../components/content-schema-registry/content-schema-review-dec108.test-support';
import {
  LABEL,
  resolveReview,
  reviewRequest,
} from './content-schema-review-dec108.test-support';

/**
 * FE03 Page and Route Definitions: `/app/cms-content-modeling/schema-reviews/
 * :reviewId` is a protected server-first page. The server verifies the
 * session and either submitter/designer scope or an assigned review-only
 * scope; malformed UUID is 400, a concealed review is 404, a visible review
 * without scope is 403 and an expired session is a safe sign-in redirect.
 */

describe('[DEC-108] review route guard', () => {
  it('redirects an absent session to sign-in without calling the platform', async () => {
    const { result, bound } = await resolveReview(
      {},
      { request: reviewRequest({ cookie: null }) },
    );
    expect(result.kind).toBe('unauthenticated');
    expect(bound.fetch).not.toHaveBeenCalled();
  });

  it('treats an upstream 401 as an unauthenticated session', async () => {
    const { result } = await resolveReview({
      status: 401,
      errorCode: 'UNAUTHENTICATED',
    });
    expect(result.kind).toBe('unauthenticated');
  });

  it.each([
    undefined,
    '',
    'not-a-uuid',
    `${REVIEW_ID}x`,
    '../x',
    REVIEW_ID.toUpperCase().replace(/-/gu, ''),
  ])(
    'rejects the malformed review id %j as invalid_record without a platform call',
    async (reviewId) => {
      // Control: the canonical id resolves, so a rejection below is the id guard.
      expect((await resolveReview()).result.kind).toBe('authorized');
      const { result, bound } = await resolveReview({}, { reviewId });
      expect(result.kind).toBe('invalid_record');
      expect(bound.fetch).not.toHaveBeenCalled();
    },
  );

  it('conceals an upstream 404 as not_found with no review data', async () => {
    const { result } = await resolveReview({
      status: 404,
      errorCode: 'NOT_FOUND',
    });
    expect(result).toStrictEqual({ kind: 'not_found' });
  });

  it('conceals a resource whose id differs from the requested review id', async () => {
    const other = reviewResource({
      id: '8e5b04f7-2d91-7a6c-b3d8-1f70c4a95e26',
    });
    const { result } = await resolveReview({ body: other });
    expect(result.kind).toBe('not_found');
  });

  it('reports a visible review without the required scope as forbidden', async () => {
    expect((await resolveReview({ status: 403 })).result.kind).toBe(
      'forbidden',
    );
  });

  it('never accepts registry-wide read as authority for a review', async () => {
    // BE03a CMS-03A-13: submitter/designer or assigned review-only scope only.
    const { result } = await resolveReview({
      capability: 'cms.schema_registry.read',
      variant: 'entitledRead',
    });
    expect(result.kind).toBe('forbidden');
  });

  it('refuses a read that carries no capability proof', async () => {
    const { result } = await resolveReview({ capability: null });
    expect(result.kind).toBe('forbidden');
  });
});

describe('[DEC-108] review route projection', () => {
  it('authorizes the schema designer with the full owner variant', async () => {
    const { result } = await resolveReview();
    if (result.kind !== 'authorized')
      throw new Error(`expected authorized, got ${result.kind}`);
    expect(result.page.variant).toBe('ownerFull');
    expect(result.page.access).toBe('full');
    expect(result.page.reviewId).toBe(REVIEW_ID);
    expect(result.page.initialReview.status).toBe('success');
    expect(result.page.initialReview.data?.id).toBe(REVIEW_ID);
  });

  it('authorizes an assigned reviewer with the review-only schemaReviewAssigned variant', async () => {
    const { result } = await resolveReview({
      capability: 'cms.schema_review',
      variant: 'schemaReviewAssigned',
    });
    if (result.kind !== 'authorized')
      throw new Error(`expected authorized, got ${result.kind}`);
    expect(result.page.variant).toBe('schemaReviewAssigned');
    expect(result.page.access).toBe('read-only');
  });

  it('renders an approved review with its decision references from the server read', async () => {
    const { result } = await resolveReview({ body: approvedProtectedReview() });
    if (result.kind !== 'authorized')
      throw new Error(`expected authorized, got ${result.kind}`);
    expect(result.page.initialReview.data?.state).toBe('approved');
  });

  it('carries the CSRF token from the cookie and a disclosure-safe context label', async () => {
    const { result } = await resolveReview();
    if (result.kind !== 'authorized')
      throw new Error(`expected authorized, got ${result.kind}`);
    expect(result.page.csrfToken).toBe('csrf-cookie');
    expect(result.page.actingContextLabel).toBe(LABEL);
    expect(result.page.stepUpState).toBe('verified');
  });

  it('keeps the deep link to the review id only, ignoring any query', async () => {
    const { result } = await resolveReview(
      {},
      { request: reviewRequest({ search: `?reviewer=${ACTOR_ID}&limit=25` }) },
    );
    if (result.kind !== 'authorized')
      throw new Error(`expected authorized, got ${result.kind}`);
    expect(result.page.canonicalUrl).toBe(REVIEW_PATH);
    expect(result.page.retryUrl).toBe(REVIEW_PATH);
    expect(JSON.stringify(result.page)).not.toContain(ACTOR_ID);
  });
});

describe('[DEC-108] review route platform read', () => {
  it('issues exactly one no-store GET to the CMS-03A-13 path with no body or mutation headers', async () => {
    const { result, bound } = await resolveReview(
      {},
      { request: reviewRequest({ search: '?limit=25&cursor=x' }) },
    );
    expect(result.kind).toBe('authorized');
    const reads = bound.requests.filter(
      (request) => !request.url.includes('/acting-contexts'),
    );
    expect(reads).toHaveLength(1);
    const request = reads[0] as Request;
    expect(request.method).toBe('GET');
    expect(new URL(request.url).pathname).toBe(
      `/api/v1/cms/schema-reviews/${REVIEW_ID}`,
    );
    expect(new URL(request.url).search).toBe('');
    expect(request.headers.get('cache-control')).toBe('no-store');
    for (const forbidden of ['idempotency-key', 'if-match', 'x-csrf-token'])
      expect(request.headers.has(forbidden)).toBe(false);
    expect(request.headers.get('cookie')).toContain('wj_access=opaque');
  });

  it('forwards only session cookies and never analytics cookies', async () => {
    const { bound } = await resolveReview(
      {},
      {
        request: reviewRequest({
          cookie: 'wj_access=opaque; tracking=omit; wj_csrf=csrf-cookie',
        }),
      },
    );
    const read = bound.requests.find((request) =>
      request.url.includes('/schema-reviews/'),
    );
    expect(read?.headers.get('cookie')).not.toContain('tracking');
  });
});

describe('[DEC-108] review route failure states', () => {
  it.each([
    [502, 'DEPENDENCY_INVALID_RESPONSE'],
    [503, 'DEPENDENCY_UNAVAILABLE'],
    [504, 'DEPENDENCY_DEADLINE_EXCEEDED'],
  ] as const)(
    'maps an upstream %i to a degraded page with a degraded review state',
    async (status, errorCode) => {
      const { result } = await resolveReview({ status, errorCode });
      if (result.kind !== 'degraded')
        throw new Error(`expected degraded, got ${result.kind}`);
      expect(result.status).toBe(status);
      expect(result.page.initialReview.status).toBe('degraded');
    },
  );

  it('maps an unreachable platform binding to a degraded 503', async () => {
    const { result } = await resolveReview({ throws: true });
    if (result.kind !== 'degraded')
      throw new Error(`expected degraded, got ${result.kind}`);
    expect(result.status).toBe(503);
  });

  it('maps a contract-invalid review body to a degraded 502', async () => {
    const invalid = {
      ...reviewResource(),
      approvalEvidenceHash: 'a'.repeat(64),
    };
    const { result } = await resolveReview({ body: invalid });
    if (result.kind !== 'degraded')
      throw new Error(`expected degraded, got ${result.kind}`);
    expect(result.status).toBe(502);
  });

  it('maps a rate limit to a retryable error state', async () => {
    const { result } = await resolveReview({
      status: 429,
      errorCode: 'RATE_LIMITED',
    });
    if (result.kind !== 'error')
      throw new Error(`expected error, got ${result.kind}`);
    expect(result.status).toBe(429);
    expect(result.page.initialReview.status).toBe('error');
  });
});
