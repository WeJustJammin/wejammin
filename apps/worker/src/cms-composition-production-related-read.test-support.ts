import type { CmsRelatedContentReadInput } from './cms-composition/related-content-routes';
import {
  create,
  entryId,
  path,
  portInput,
  resource,
  signal,
} from './cms-composition-production-related.test-support';
import { REQUEST_ID } from './cms-editorial-production.test-support';

export { create, entryId, path, resource, signal };

export const READ_RPC =
  'https://supabase.example.test/rest/v1/rpc/cms_get_related_content';

export const readInput = (
  overrides: Partial<CmsRelatedContentReadInput> = {},
): CmsRelatedContentReadInput => ({
  operationId: 'cmsRelatedContentRead',
  request: new Request(`https://api.example.test${path}`, {
    headers: { 'x-correlation-id': REQUEST_ID },
  }),
  requestId: REQUEST_ID,
  session: portInput().session,
  path: { entryId },
  ...overrides,
});

export const readRoute = () =>
  new Request(`https://api.example.test${path}`, {
    method: 'GET',
    headers: {
      origin: 'https://cms.example.test',
      'x-request-id': REQUEST_ID,
    },
  });

export const readAs = (
  fetchImpl: typeof fetch,
  overrides: Partial<CmsRelatedContentReadInput> = {},
  extra: object = {},
) =>
  create(fetchImpl, extra).readRelatedContent(readInput(overrides), signal());
