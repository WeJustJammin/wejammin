import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createTaxonomyProductionHarness,
  taxonomyDefinitionWriteRequest,
} from './taxonomy-definition.test-support';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/**
 * CMS-03C-16 through the fixed production RPC port, fed the refusals exactly as the database
 * raises them and PostgREST relays them: HTTP 400 {code: 'P0001', message: <token>} (BE03c 184,
 * 1418, 1447). The tokens are the ones the producer raises for this operation:
 *   NOT_FOUND            supabase/migrations/20261014030200_cms_create_taxonomy_version.sql:81
 *                        (hidden owner scope) and :180 (a successor of an absent lineage);
 *   CONFLICT             same file :177 (create over an existing lineage), :181 (stale parent
 *                        version), :184 (version ceiling), :203 (unique key), and
 *                        20261014030300_cms_create_taxonomy_version_public.sql:25 (deadlock /
 *                        lock timeout);
 *   IDEMPOTENCY_MISMATCH platform_private.cms_reserve (20260930150000_cms_idempotency_business_hash.sql:67)
 *                        -> identity_idempotency_reserve (20260901030000_party_identity_aliases.sql:377),
 *                        reached at 20261014030200 :98.
 * The Worker's own catalog codes (TAXONOMY_NOT_FOUND ...) are never raised by SQL.
 */
const path = '/api/v1/cms/taxonomies/versions';

const relayed = (token: string) =>
  vi.fn<typeof fetch>(async () =>
    Response.json({ code: 'P0001', message: token }, { status: 400 }),
  );

const successor = (): RequestInit => taxonomyDefinitionWriteRequest('3');

describe('CMS-03C-16 database refusals as PostgREST relays them', () => {
  it('[P2-S12-AC-126] [P2-S12-AC-128] CMS-03C-16 a hidden or absent taxonomy scope (P0001 NOT_FOUND) is 404 TAXONOMY_NOT_FOUND', async () => {
    const fetchImpl = relayed('NOT_FOUND');
    const harness = createTaxonomyProductionHarness(fetchImpl);
    const response = await harness.request(
      path,
      taxonomyDefinitionWriteRequest(),
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      code: 'TAXONOMY_NOT_FOUND',
      message:
        'TAXONOMY_NOT_FOUND: taxonomy operation rejected or unavailable.',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('[P2-S12-AC-126] [P2-S12-AC-128] CMS-03C-16 a successor over an absent lineage (P0001 NOT_FOUND) is 404 TAXONOMY_NOT_FOUND', async () => {
    const harness = createTaxonomyProductionHarness(relayed('NOT_FOUND'));
    const response = await harness.request(path, successor());
    expect(response.status).toBe(404);
    expect(((await response.json()) as { code: string }).code).toBe(
      'TAXONOMY_NOT_FOUND',
    );
  });

  it.each([
    ['a stale parent version or key (P0001 CONFLICT)', 'CONFLICT'],
    [
      'an idempotency conflict (P0001 IDEMPOTENCY_MISMATCH)',
      'IDEMPOTENCY_MISMATCH',
    ],
  ])(
    '[P2-S12-AC-128] CMS-03C-16 %s is 409 TAXONOMY_VERSION_CONFLICT',
    async (_name, token) => {
      const fetchImpl = relayed(token);
      const harness = createTaxonomyProductionHarness(fetchImpl);
      const response = await harness.request(path, successor());
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({
        code: 'TAXONOMY_VERSION_CONFLICT',
      });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    },
  );

  it('[P2-S12-AC-128] CMS-03C-16 a create over an existing lineage (P0001 CONFLICT) is 409 TAXONOMY_VERSION_CONFLICT', async () => {
    const harness = createTaxonomyProductionHarness(relayed('CONFLICT'));
    const response = await harness.request(
      path,
      taxonomyDefinitionWriteRequest(),
    );
    expect(response.status).toBe(409);
    expect(((await response.json()) as { code: string }).code).toBe(
      'TAXONOMY_VERSION_CONFLICT',
    );
  });
});
