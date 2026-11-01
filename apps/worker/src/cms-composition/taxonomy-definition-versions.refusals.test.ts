import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createTaxonomyProductionHarness,
  taxonomyDefinitionVersionsPath,
  taxonomyDefinitionRequestId,
} from './taxonomy-definition.test-support';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/**
 * [P2-S12-AC-181] cmsTaxonomyVersionsRead (GET /api/v1/cms/taxonomies/{taxonomyId}/versions), BE03c route registry 171 and the
 * taxonomy error catalog: a caller without the curator capability is 403 TAXONOMY_FORBIDDEN.  The private RPC refusal itself
 * (P0001 `capability_missing`) is proven in supabase/tests/phase_02_slice_12_taxonomy_definition/070-versions-read.sqlinc; here the
 * production Worker boundary is driven with a fetch that answers exactly that refusal and the public answer is asserted.
 */
describe('cmsTaxonomyVersionsRead capability refusal at the production boundary', () => {
  const refusal = (message: string, status = 400): Response =>
    Response.json(
      { code: 'P0001', message, details: 'private SQL owner detail' },
      { status },
    );

  it('answers the private capability_missing refusal as 403 TAXONOMY_FORBIDDEN with reasonCode capability_missing', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      refusal('capability_missing'),
    );
    const h = createTaxonomyProductionHarness(fetchImpl);
    const response = await h.request(taxonomyDefinitionVersionsPath());
    expect(response.status).toBe(403);
    expect(response.headers.get('etag')).toBeNull();
    expect(response.headers.get('cache-control')).toBe('no-store');
    const body = await response.json();
    expect(body).toMatchObject({
      code: 'TAXONOMY_FORBIDDEN',
      details: { reasonCode: 'capability_missing' },
    });
    expect(JSON.stringify(body)).not.toContain('private SQL owner detail');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('answers a hidden or absent vocabulary (NOT_FOUND) as 404, not as the capability refusal', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => refusal('NOT_FOUND'));
    const h = createTaxonomyProductionHarness(fetchImpl);
    const response = await h.request(taxonomyDefinitionVersionsPath());
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      code: 'TAXONOMY_NOT_FOUND',
    });
  });

  it('never leaks the request id of another call or SQL prose into the 403 body', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      refusal('capability_missing'),
    );
    const h = createTaxonomyProductionHarness(fetchImpl);
    const response = await h.request(taxonomyDefinitionVersionsPath(), {
      headers: { 'x-request-id': taxonomyDefinitionRequestId },
    });
    expect(response.status).toBe(403);
    const text = await response.text();
    expect(text).not.toMatch(/P0001|SQL|owner detail/);
  });
});
