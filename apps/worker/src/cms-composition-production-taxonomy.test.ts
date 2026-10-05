import { describe, expect, it, vi } from 'vitest';
import type { TaxonomyTermActionRequest } from '@wejammin/contracts';

import { createCmsTaxonomyApp } from './cms-composition/taxonomy-routes';
import { createProductionCmsTaxonomyDependencies } from './cms-composition-production-taxonomy';
import {
  environment,
  PARTY_ID,
  REQUEST_ID,
  USER_ID,
} from './cms-editorial-production.test-support';

const taxonomyId = 'd1200000-0000-4000-8000-000000000001';
const path = `/api/v1/cms/taxonomies/${taxonomyId}/terms/actions`;
const body: TaxonomyTermActionRequest = {
  taxonomyId,
  action: 'create',
  termKey: 'jazz-fusion',
  parentId: null,
  survivorId: null,
  labels: [{ locale: 'en-US', label: 'Jazz fusion' }],
  aliases: [],
  expectedVersion: '1',
};

describe('CMS-03C-03 production taxonomy boundary', () => {
  it('admits a valid curator but refuses mutation while canonical source and RPC are absent', async () => {
    const fetchImpl = vi.fn(async () => Response.json({ unexpected: true }));
    const dependencies = createProductionCmsTaxonomyDependencies({
      environment,
      fetchImpl: fetchImpl as typeof fetch,
      humanOrigins: ['https://cms.example.test'],
      now: () => 1_000,
      maxResponseBytes: 1024,
      resolveSession: async () => ({
        ok: true,
        value: {
          userId: USER_ID,
          actingPartyId: PARTY_ID,
          capabilities: ['cms.taxonomy_curator'],
          mfaFresh: true,
        },
      }),
      rateLimit: async (input) => ({
        ok: true,
        value: {
          allowed: true,
          limit: input.limit,
          remaining: input.limit - 1,
          resetAt: 2_000,
        },
      }),
    });
    const response = await createCmsTaxonomyApp(dependencies).request(
      new Request(`https://api.example.test${path}`, {
        method: 'POST',
        headers: {
          origin: 'https://cms.example.test',
          'content-type': 'application/json',
          'idempotency-key': 'taxonomy-action-0001',
          'if-match': '"1"',
          'x-request-id': REQUEST_ID,
        },
        body: JSON.stringify(body),
      }),
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      code: 'DEPENDENCY_UNAVAILABLE',
      details: { dependencyClass: 'cms_composition', retryable: true },
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('has no implicit allow when production auth or rate dependencies are absent', async () => {
    const dependencies = createProductionCmsTaxonomyDependencies({
      environment,
    });
    expect(dependencies.humanOrigins).toEqual([]);
    const result = await dependencies.actTerm(
      {
        operationId: 'CMS-03C-03',
        request: new Request(`https://api.example.test${path}`),
        requestId: REQUEST_ID,
        session: {
          userId: USER_ID,
          actingPartyId: PARTY_ID,
          capabilities: ['cms.taxonomy_curator'],
          mfaFresh: true,
        },
        path: { taxonomyId },
        body,
        idempotencyKey: 'taxonomy-action-0001',
        ifMatch: '1',
      },
      new AbortController().signal,
    );
    expect(result).toMatchObject({ ok: false, status: 503 });
    const session = await dependencies.resolveSession(
      new Request(`https://api.example.test${path}`),
      new AbortController().signal,
    );
    expect(session).toMatchObject({ ok: false, status: 503 });
  });
});
