import { describe, expect, it, vi } from 'vitest';

import { createProductionCmsRelatedContentDependencies } from './cms-composition-production-related';
import { createCmsRelatedContentApp } from './cms-composition/related-content-routes';
import {
  environment,
  PARTY_ID,
  REQUEST_ID,
  USER_ID,
} from './cms-editorial-production.test-support';

const path =
  '/api/v1/cms/entries/10000000-0000-4000-8000-000000000001/related-content';

describe('CMS-03C-05 production related-content boundary', () => {
  it('admits a valid editor but refuses curation while the rule authority is absent', async () => {
    const fetchImpl = vi.fn(async () => Response.json({ unexpected: true }));
    const dependencies = createProductionCmsRelatedContentDependencies({
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
          capabilities: ['cms.author'],
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
    const response = await createCmsRelatedContentApp(dependencies).request(
      new Request(`https://api.example.test${path}`, {
        method: 'POST',
        headers: {
          origin: 'https://cms.example.test',
          'content-type': 'application/json',
          'idempotency-key': 'related-content-0001',
          'if-match': '"1"',
          'x-request-id': REQUEST_ID,
        },
        body: JSON.stringify({
          entryId: '10000000-0000-4000-8000-000000000001',
          pins: [],
          exclusions: [],
          derivedRule: null,
          expectedVersion: '1',
        }),
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
    const dependencies = createProductionCmsRelatedContentDependencies({
      environment,
    });
    expect(dependencies.humanOrigins).toEqual([]);
    const result = await dependencies.actRelatedContent(
      {
        operationId: 'CMS-03C-05',
        request: new Request(`https://api.example.test${path}`),
        requestId: REQUEST_ID,
        session: {
          userId: USER_ID,
          actingPartyId: PARTY_ID,
          capabilities: ['cms.author'],
          mfaFresh: true,
        },
        path: { entryId: '10000000-0000-4000-8000-000000000001' },
        body: {
          entryId: '10000000-0000-4000-8000-000000000001',
          pins: [],
          exclusions: [],
          derivedRule: null,
          expectedVersion: '1',
        },
        idempotencyKey: 'related-content-0001',
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
