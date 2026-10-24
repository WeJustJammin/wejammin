import { describe, expect, it } from 'vitest';

import { createCmsRelatedContentApp } from './related-content-routes';
import { dependencies, ENTRY_ID } from './related-content-routes.test-support';

const probe = async (method: string, path: string) => {
  const response = await createCmsRelatedContentApp(dependencies()).request(
    new Request(`https://api.example.test${path}`, {
      method,
      headers: { origin: 'https://cms.example.test' },
    }),
  );
  return response.status;
};

// BE03c 190: CMS-03C-21 is an internal service operation with no browser route (tracker P2-S12-AC-158).
// `GET /api/v1/cms/entries/{entryId}/related-content` is no longer probed here: DEC-195 registers it as the protected
// saved-rule read `cmsRelatedContentRead` (BE03c route registry), which is not the public-target projection.
describe('CMS-03C-21 has no browser route (BE03c 190)', () => {
  it.each([
    ['GET', `/api/v1/cms/entries/${ENTRY_ID}/related-content/public-targets`],
    ['POST', `/api/v1/cms/entries/${ENTRY_ID}/related-content/public-targets`],
    ['GET', `/api/v1/cms/related-content/public-targets`],
    ['GET', `/api/v1/cms/entries/${ENTRY_ID}/related`],
  ])('answers 404 or 405 for %s %s', async (method, path) => {
    expect([404, 405]).toContain(await probe(method, path));
  });
});
