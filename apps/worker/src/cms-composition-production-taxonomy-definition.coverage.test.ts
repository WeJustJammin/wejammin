import { describe, expect, it, vi } from 'vitest';

import {
  createTaxonomyProductionHarness,
  taxonomyDefinitionRequestId,
  taxonomyDefinitionWriteRequest,
  taxonomySession,
} from './cms-composition/taxonomy-definition.test-support';
import type { CmsTaxonomyDefinitionWriteInput } from './cms-composition/taxonomy-definition-shared';

/*
 * CMS-03C-16 production `createVersion` (BE03c 161, 166-167): the Worker re-proves the request shape, the strong
 * If-Match / Idempotency-Key headers and the curator capability before it selects the named RPC; a request that
 * fails any of them is a 400 (or the 403 `capability_missing`) with no network call.
 */

describe('CMS-03C-16 production createVersion admission (before any RPC)', () => {
  const base = (): CmsTaxonomyDefinitionWriteInput => {
    const init = taxonomyDefinitionWriteRequest();
    return {
      operationId: 'CMS-03C-16',
      request: new Request(
        'https://api.example.test/api/v1/cms/taxonomies/versions',
        init,
      ),
      requestId: taxonomyDefinitionRequestId,
      session: taxonomySession,
      body: JSON.parse(String(init.body)),
      idempotencyKey: 'taxonomy-definition-red-001',
      ifMatch: null,
    };
  };
  const refuse = async (override: Partial<CmsTaxonomyDefinitionWriteInput>) => {
    const fetchImpl = vi.fn<typeof fetch>();
    const h = createTaxonomyProductionHarness(fetchImpl);
    const result = await h.dependencies.createVersion(
      { ...base(), ...override },
      new AbortController().signal,
    );
    expect(fetchImpl).not.toHaveBeenCalled();
    return result;
  };
  const withRequest = (url: string, init: RequestInit) =>
    new Request(url, { ...taxonomyDefinitionWriteRequest(), ...init });

  it.each([
    ['another operation', { operationId: 'CMS-03C-17' as never }],
    [
      'a method other than POST',
      {
        request: withRequest(
          'https://api.example.test/api/v1/cms/taxonomies/versions',
          { method: 'PUT' },
        ),
      },
    ],
    [
      'another path',
      {
        request: withRequest(
          'https://api.example.test/api/v1/cms/taxonomies/other',
          {},
        ),
      },
    ],
    [
      'a query string',
      {
        request: withRequest(
          'https://api.example.test/api/v1/cms/taxonomies/versions?x=1',
          {},
        ),
      },
    ],
    [
      'a body that breaks the contract',
      { body: { ...base().body, shape: 'graph-of-everything' as never } },
    ],
    [
      'an Idempotency-Key that differs from the header',
      { idempotencyKey: 'taxonomy-definition-red-002' },
    ],
    ['an If-Match the request did not carry', { ifMatch: '1' }],
  ])('answers a 400 for %s', async (_label, override) => {
    expect(await refuse(override)).toMatchObject({ ok: false, status: 400 });
  });

  it('answers a 403 capability_missing for a session without the curator capability', async () => {
    expect(
      await refuse({
        session: { ...taxonomySession, capabilities: ['cms.author'] },
      }),
    ).toMatchObject({
      ok: false,
      status: 403,
      details: { reasonCode: 'capability_missing' },
    });
  });
});
