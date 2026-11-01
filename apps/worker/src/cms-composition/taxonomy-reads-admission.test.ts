import { ApiErrorSchema } from '@wejammin/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createTaxonomyDefinitionAdmissionHarness,
  taxonomyDefinitionOrigin,
  taxonomyDefinitionRequestId,
} from './taxonomy-definition.test-support';
import {
  SELECTOR_PATH,
  SELECTOR_QUERY,
  TERMS_PATH,
} from './taxonomy-reads.test-support';

/**
 * The two term-store reads and the term action are mounted by the production-composed Worker app: an unauthenticated
 * caller reaches the typed 401 (never the generic 404) and no outbound dependency is touched.
 */
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const reads = [
  ['cmsTaxonomyTermsRead', TERMS_PATH],
  ['CMS-03C-17', `${SELECTOR_PATH}?${SELECTOR_QUERY}`],
] as const;

describe('production-composed Worker admission of the taxonomy term-store routes', () => {
  it.each(reads)('%s reaches the typed 401, not a 404', async (_id, path) => {
    const harness = createTaxonomyDefinitionAdmissionHarness();
    const response = await harness.request(path, {
      method: 'GET',
      headers: {
        origin: taxonomyDefinitionOrigin,
        'x-request-id': taxonomyDefinitionRequestId,
      },
    });
    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('etag')).toBeNull();
    expect(ApiErrorSchema.parse(await response.json())).toEqual({
      code: 'UNAUTHENTICATED',
      message: 'UNAUTHENTICATED: taxonomy operation rejected or unavailable.',
      requestId: taxonomyDefinitionRequestId,
      details: { recoveryAction: 'reauthenticate' },
    });
    expect(harness.fetchImpl).not.toHaveBeenCalled();
    expect(harness.captureException).not.toHaveBeenCalled();
  });

  it('CMS-03C-03 is mounted and reaches its typed 401 as well', async () => {
    const harness = createTaxonomyDefinitionAdmissionHarness();
    const response = await harness.request(
      '/api/v1/cms/taxonomies/22222222-2222-4222-8222-222222222222/terms/actions',
      {
        method: 'POST',
        headers: {
          origin: taxonomyDefinitionOrigin,
          'content-type': 'application/json',
          'x-request-id': taxonomyDefinitionRequestId,
        },
        body: '{}',
      },
    );
    expect(response.status).toBe(401);
    expect(harness.fetchImpl).not.toHaveBeenCalled();
  });
});
