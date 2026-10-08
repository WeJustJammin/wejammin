import { describe, expect, it } from 'vitest';

import { createCmsEditorialPageReads } from './cms-editorial-page-reads';

const ENTRY_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132dc';
const CONFLICT_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132dd';
const VERSION_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132db';

const page = (path: string) =>
  new Request(`https://web.test${path}`, {
    method: 'GET',
    headers: { cookie: 'wj_access=a; wj_csrf=c; tracking=drop' },
  });

const binding = () => {
  const upstream: string[] = [];
  return {
    upstream,
    fetch: async (input: RequestInfo | URL) => {
      upstream.push(
        input instanceof Request ? input.url : new URL(String(input)).href,
      );
      return new Response(null, { status: 404 });
    },
  };
};

describe('createCmsEditorialPageReads', () => {
  it('derives the authoring-context read for a draft schema version from the page request', async () => {
    const api = binding();
    const reads = createCmsEditorialPageReads(api);
    await reads.authoringContext(
      page('/app/cms-content-modeling/entries/x?locale=en-US'),
      VERSION_ID,
    );
    expect(api.upstream).toEqual([
      `https://platform-api.internal/api/v1/cms/entries/authoring-context?contentTypeVersionId=${VERSION_ID}`,
    ]);
  });

  it('reads the create page context without a selector when none is chosen', async () => {
    const api = binding();
    await createCmsEditorialPageReads(api).authoringContext(
      page('/app/cms-content-modeling/entries/new'),
    );
    expect(api.upstream).toEqual([
      'https://platform-api.internal/api/v1/cms/entries/authoring-context',
    ]);
  });

  it('forwards the URL-owned selector of the create page query', async () => {
    const api = binding();
    await createCmsEditorialPageReads(api).authoringContext(
      page(
        `/app/cms-content-modeling/entries/new?contentTypeVersionId=${VERSION_ID}`,
      ),
    );
    expect(api.upstream[0]).toContain(`contentTypeVersionId=${VERSION_ID}`);
  });

  it('addresses draft detail, conflict detail, history and the list by their API paths', async () => {
    const api = binding();
    const reads = createCmsEditorialPageReads(api);
    const request = page('/app/cms-content-modeling/entries/x');
    await reads.draftDetail(request, ENTRY_ID);
    await reads.conflictDetail(request, ENTRY_ID, CONFLICT_ID);
    await reads.revisionHistory(request, ENTRY_ID);
    await reads.entryList(page('/app/cms-content-modeling/entries'));
    expect(api.upstream).toEqual([
      `https://platform-api.internal/api/v1/cms/entries/${ENTRY_ID}`,
      `https://platform-api.internal/api/v1/cms/entries/${ENTRY_ID}/conflicts/${CONFLICT_ID}`,
      `https://platform-api.internal/api/v1/cms/entries/${ENTRY_ID}/revisions`,
      'https://platform-api.internal/api/v1/cms/entries',
    ]);
  });
});
