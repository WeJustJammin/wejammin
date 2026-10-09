import { describe, expect, it } from 'vitest';

import { createCmsEditorialPageReads } from './cms-editorial-page-reads';

const ENTRY_ID = '123e4567-e89b-42d3-a456-426614174002';
const REVIEW_ID = '123e4567-e89b-42d3-a456-426614174000';
const REVISION_ID = '123e4567-e89b-42d3-a456-426614174003';

const page = (path: string) =>
  new Request(`https://web.test${path}`, {
    method: 'GET',
    headers: { cookie: 'wj_access=a; tracking=drop' },
  });

const binding = () => {
  const upstream: Request[] = [];
  return {
    upstream,
    fetch: async (input: RequestInfo | URL) => {
      upstream.push(input as Request);
      return new Response(null, { status: 404 });
    },
  };
};

describe('Slice 11 page reads', () => {
  it('reads the workflow with the page query of its own and the session only', async () => {
    const api = binding();
    await createCmsEditorialPageReads(api).workflow(
      page(
        `/app/cms-content-modeling/entries/${ENTRY_ID}/workflow?revisionId=${REVISION_ID}`,
      ),
      ENTRY_ID,
    );
    expect(api.upstream[0]?.url).toBe(
      `https://platform-api.internal/api/v1/cms/entries/${ENTRY_ID}/workflow?revisionId=${REVISION_ID}`,
    );
    expect(api.upstream[0]?.headers.get('cookie')).toBe('wj_access=a');
  });

  it('reads the review detail without any query of the page', async () => {
    const api = binding();
    await createCmsEditorialPageReads(api).reviewDetail(
      page(`/app/cms-content-modeling/reviews/${REVIEW_ID}?utm=x`),
      REVIEW_ID,
    );
    expect(api.upstream[0]?.url).toBe(
      `https://platform-api.internal/api/v1/cms/reviews/${REVIEW_ID}`,
    );
  });

  it('reads the reviewer queue with the typed query of the page', async () => {
    const api = binding();
    await createCmsEditorialPageReads(api).reviewQueue(
      page('/app/cms-content-modeling/reviews?scope=submitted&state=open'),
    );
    expect(api.upstream[0]?.url).toBe(
      'https://platform-api.internal/api/v1/cms/reviews?scope=submitted&state=open',
    );
  });
});
