import { describe, expect, it, vi } from 'vitest';

import {
  REVIEW_ID,
  governedDetailFixture,
  governedQueuePageFixture,
  jsonResponse,
} from '../../server/cms-governed-review-fixtures.test-support';
import { createCmsGovernedPageReads } from './governed-review-page-reads';

const binding = (response: Response) => {
  const fetch = vi.fn(async () => response);
  return { fetch };
};

describe('createCmsGovernedPageReads', () => {
  it('reads the detail from the review path alone, dropping the page query and keeping the session', async () => {
    const api = binding(
      jsonResponse(200, governedDetailFixture(), { etag: '"2"' }),
    );
    const reads = createCmsGovernedPageReads(api);
    const response = await reads.reviewDetail(
      new Request(
        `https://web.test/app/cms-content-modeling/definition-reviews/${REVIEW_ID}?x=1`,
        { headers: { cookie: 'wj_access=a' } },
      ),
      REVIEW_ID,
    );
    expect(response.status).toBe(200);
    const upstream = (api.fetch.mock.calls[0] as unknown as [Request])[0];
    expect(new URL(upstream.url).pathname).toBe(
      `/api/v1/cms/governed-reviews/${REVIEW_ID}`,
    );
    expect(new URL(upstream.url).search).toBe('');
    expect(upstream.headers.get('cookie')).toContain('wj_access=a');
  });

  it('reads the queue with the page query as the typed query', async () => {
    const api = binding(
      jsonResponse(200, governedQueuePageFixture([]), { etag: '"5"' }),
    );
    const reads = createCmsGovernedPageReads(api);
    const response = await reads.reviewQueue(
      new Request(
        'https://web.test/app/cms-content-modeling/definition-reviews?scope=owned&limit=10',
        { headers: { cookie: 'wj_access=a' } },
      ),
    );
    expect(response.status).toBe(200);
    const upstream = (api.fetch.mock.calls[0] as unknown as [Request])[0];
    expect(new URL(upstream.url).pathname).toBe('/api/v1/cms/governed-reviews');
    expect(new URL(upstream.url).search).toBe('?scope=owned&limit=10');
  });

  it('answers 503 without a binding', async () => {
    const reads = createCmsGovernedPageReads(null);
    expect(
      (await reads.reviewQueue(new Request('https://web.test/x'))).status,
    ).toBe(503);
  });
});
