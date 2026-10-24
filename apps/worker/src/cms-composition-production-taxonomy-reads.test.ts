import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  TaxonomySelectorPageSchema,
  TaxonomyTermListPageSchema,
} from '@wejammin/contracts';

import {
  createTaxonomyProductionHarness,
  taxonomyDefinitionId,
  taxonomyDefinitionRequestId,
  taxonomyAuthentication,
} from './cms-composition/taxonomy-definition.test-support';
import {
  SELECTOR_PATH,
  SELECTOR_QUERY,
  selectorPage,
  termItem,
  termsPage,
  TERMS_PATH,
} from './cms-composition/taxonomy-reads.test-support';
import { PROVIDER_FAULTS } from './cms-composition-production-provider-fault.test-support';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const raised = (message: string, details?: string, status = 400): Response =>
  Response.json(
    { code: 'P0001', message, ...(details === undefined ? {} : { details }) },
    { status },
  );
const witness = (page: unknown, taxonomyId = taxonomyDefinitionId) => ({
  taxonomyId,
  page,
});
const AUTHOR = { resolveCapabilities: ['cms.author'] } as const;

describe('cmsTaxonomyTermsRead production port: platform_api.cms_list_taxonomy_terms (BE03c 167, 1447, 1480)', () => {
  it('sends the lineage, the filter, the opaque cursor and the limit with the server context and unwraps the witness', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      Response.json(witness(termsPage(2))),
    );
    const h = createTaxonomyProductionHarness(fetchImpl);
    const response = await h.request(
      `${TERMS_PATH}?limit=2&cursor=${encodeURIComponent('abc==')}`,
      { headers: { 'x-request-id': taxonomyDefinitionRequestId } },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('etag')).toBe('"1790000000000000"');
    expect(TaxonomyTermListPageSchema.parse(await response.json())).toEqual(
      termsPage(2),
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(
      'https://supabase.example.test/rest/v1/rpc/cms_list_taxonomy_terms',
    );
    const headers = new Headers(init?.headers);
    expect(headers.get('x-operation-id')).toBe('cmsTaxonomyTermsRead');
    expect(headers.get('content-profile')).toBe('platform_api');
    expect(headers.get('x-idempotency-key')).toBeNull();
    expect(headers.get('if-match')).toBeNull();
    const sent = JSON.parse(String(init?.body)) as {
      p_request: Record<string, unknown>;
    };
    expect(Object.keys(sent.p_request).sort()).toEqual(
      ['context', 'correlationId', 'cursor', 'limit', 'taxonomyId'].sort(),
    );
    expect(sent.p_request).toMatchObject({
      taxonomyId: taxonomyDefinitionId,
      cursor: 'abc==',
      limit: 2,
      correlationId: taxonomyDefinitionRequestId,
      context: {
        authUserId: taxonomyAuthentication.authUserId,
        actingPartyId: taxonomyAuthentication.actingPartyId,
      },
    });
  });

  it('sends the lifecycle and the default limit, and no cursor member when none was asked', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      Response.json(
        witness(
          termsPage(1, { items: [termItem(1, { lifecycle: 'deprecated' })] }),
        ),
      ),
    );
    const h = createTaxonomyProductionHarness(fetchImpl);
    expect((await h.request(`${TERMS_PATH}?lifecycle=deprecated`)).status).toBe(
      200,
    );
    const sent = JSON.parse(String(fetchImpl.mock.calls[0]![1]?.body)) as {
      p_request: Record<string, unknown>;
    };
    expect(sent.p_request).toMatchObject({
      lifecycle: 'deprecated',
      limit: 25,
    });
    expect(sent.p_request).not.toHaveProperty('cursor');
  });

  it('keeps an empty page of a visible vocabulary a 200 and a hidden vocabulary a 404', async () => {
    const empty = vi.fn<typeof fetch>(async () =>
      Response.json(witness(termsPage(0, { pageVersion: '1' }))),
    );
    expect(
      (await createTaxonomyProductionHarness(empty).request(TERMS_PATH)).status,
    ).toBe(200);
    const hidden = vi.fn<typeof fetch>(async () => raised('NOT_FOUND'));
    const response =
      await createTaxonomyProductionHarness(hidden).request(TERMS_PATH);
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: 'TAXONOMY_NOT_FOUND' });
  });

  it.each([
    ['a bare page without the witness', termsPage(1)],
    [
      'a witness for another vocabulary',
      witness(termsPage(1), '99999999-9999-4999-8999-999999999999'),
    ],
    [
      'a witness with an extra member',
      { ...witness(termsPage(1)), extra: true },
    ],
    ['a page with an unknown member', witness({ ...termsPage(1), extra: 1 })],
    ['more items than the limit', witness(termsPage(3))],
  ])('answers %s as a retryable 502', async (_name, value) => {
    const fetchImpl = vi.fn<typeof fetch>(async () => Response.json(value));
    const response = await createTaxonomyProductionHarness(fetchImpl).request(
      `${TERMS_PATH}?limit=2`,
    );
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      code: 'DEPENDENCY_UNAVAILABLE',
      details: { dependencyClass: 'cms_composition', retryable: true },
    });
  });

  it.each([
    ['capability_missing', 403, 'TAXONOMY_FORBIDDEN'],
    ['NOT_FOUND', 404, 'TAXONOMY_NOT_FOUND'],
    ['CONFLICT', 409, 'TAXONOMY_VERSION_CONFLICT'],
    ['INVALID_REQUEST', 400, 'INVALID_REQUEST'],
    ['UNAUTHENTICATED', 401, 'UNAUTHENTICATED'],
    ['INTERNAL_ERROR', 500, 'INTERNAL_ERROR'],
    ['separation_of_duties', 500, 'INTERNAL_ERROR'],
  ] as const)('maps the raised %s to %i', async (token, status, code) => {
    const fetchImpl = vi.fn<typeof fetch>(async () => raised(token));
    const response =
      await createTaxonomyProductionHarness(fetchImpl).request(TERMS_PATH);
    expect(response.status).toBe(status);
    expect(((await response.json()) as { code: string }).code).toBe(code);
  });

  it.each(PROVIDER_FAULTS)(
    'scrubs the provider fault %s to 500',
    async (_name, status, payload) => {
      const fetchImpl = vi.fn<typeof fetch>(async () =>
        Response.json(payload, { status }),
      );
      const response =
        await createTaxonomyProductionHarness(fetchImpl).request(TERMS_PATH);
      expect(response.status).toBe(500);
      expect(await response.text()).not.toMatch(/PGRST|42702|42501/);
    },
  );

  it('a provider 5xx is a retryable 503 and a nonsettling transport is a 504 at the 8,000 ms read ceiling', async () => {
    const down = vi.fn<typeof fetch>(async () =>
      Response.json({ message: 'boom' }, { status: 500 }),
    );
    expect(
      (await createTaxonomyProductionHarness(down).request(TERMS_PATH)).status,
    ).toBe(503);
    vi.useFakeTimers();
    const hung = vi.fn<typeof fetch>(() => new Promise(() => {}));
    const pending = createTaxonomyProductionHarness(hung).request(TERMS_PATH);
    await vi.advanceTimersByTimeAsync(8_001);
    expect((await pending).status).toBe(504);
    expect(hung).toHaveBeenCalledTimes(1);
  });

  it.each([262144, 262145])(
    'bounds the actual private RPC witness at %i bytes whatever the option says',
    async (bytes) => {
      const items = Array.from({ length: 50 }, (_, i) =>
        termItem(i + 1, {
          labels: Array.from({ length: 64 }, (_, k) => ({
            locale: `${String.fromCharCode(97 + Math.floor(k / 26))}${String.fromCharCode(97 + (k % 26))}`,
            label: 'l',
          })),
        }),
      );
      const base = witness({ items, nextCursor: null, pageVersion: '1' });
      let remaining =
        bytes - new TextEncoder().encode(JSON.stringify(base)).byteLength;
      for (const item of items)
        for (const label of item.labels) {
          const growth = Math.min(Math.max(0, remaining), 159);
          label.label += 'x'.repeat(growth);
          remaining -= growth;
        }
      expect(remaining).toBe(0);
      const wire = JSON.stringify(base);
      expect(new TextEncoder().encode(wire).byteLength).toBe(bytes);
      const fetchImpl = vi.fn<typeof fetch>(
        async () =>
          new Response(wire, {
            headers: { 'content-type': 'application/json' },
          }),
      );
      const response = await createTaxonomyProductionHarness(fetchImpl, {
        maxResponseBytes: 1_048_576,
      }).request(`${TERMS_PATH}?limit=50`);
      // 262,144 bytes is the response ceiling (BE03c 1306; the page itself is smaller by the witness members)
      expect(response.status).toBe(bytes === 262144 ? 200 : 502);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    },
  );

  it('rejects an authority revoked between admission and the RPC before any network', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    let calls = 0;
    const h = createTaxonomyProductionHarness(fetchImpl, {
      resolveCapabilities: () =>
        ++calls === 1 ? ['cms.taxonomy_curator'] : [],
    });
    expect((await h.request(TERMS_PATH)).status).toBe(403);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('CMS-03C-17 production port: platform_api.cms_list_taxonomy_selector (BE03c 179, 1478)', () => {
  it('sends the type, field, locale, limit and cursor with the server context and serves the strict page', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      Response.json(selectorPage(2)),
    );
    const h = createTaxonomyProductionHarness(fetchImpl, AUTHOR);
    const response = await h.request(
      `${SELECTOR_PATH}?${SELECTOR_QUERY}&limit=10&cursor=${encodeURIComponent('xyz==')}`,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('etag')).toBe('"1790000000000000"');
    expect(TaxonomySelectorPageSchema.parse(await response.json())).toEqual(
      selectorPage(2),
    );
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(
      'https://supabase.example.test/rest/v1/rpc/cms_list_taxonomy_selector',
    );
    expect(new Headers(init?.headers).get('x-operation-id')).toBe('CMS-03C-17');
    const sent = JSON.parse(String(init?.body)) as {
      p_request: Record<string, unknown>;
    };
    expect(Object.keys(sent.p_request).sort()).toEqual(
      [
        'context',
        'correlationId',
        'cursor',
        'fieldKey',
        'limit',
        'locale',
        'typeKey',
      ].sort(),
    );
    expect(sent.p_request).toMatchObject({
      typeKey: 'article',
      fieldKey: 'instruments',
      locale: 'en-US',
      limit: 10,
      cursor: 'xyz==',
    });
  });

  it('applies the 50-row default and omits the cursor when none was asked', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      Response.json(selectorPage(1)),
    );
    await createTaxonomyProductionHarness(fetchImpl, AUTHOR).request(
      `${SELECTOR_PATH}?${SELECTOR_QUERY}`,
    );
    const sent = JSON.parse(String(fetchImpl.mock.calls[0]![1]?.body)) as {
      p_request: Record<string, unknown>;
    };
    expect(sent.p_request).toMatchObject({ limit: 50 });
    expect(sent.p_request).not.toHaveProperty('cursor');
  });

  it('a curator without cms.author or cms.editor never reaches the RPC (403 before the network)', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const h = createTaxonomyProductionHarness(fetchImpl);
    const response = await h.request(`${SELECTOR_PATH}?${SELECTOR_QUERY}`);
    expect(response.status).toBe(403);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('proves the author or editor capability again on the fresh session', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    let calls = 0;
    const h = createTaxonomyProductionHarness(fetchImpl, {
      resolveCapabilities: () => (++calls === 1 ? ['cms.editor'] : []),
    });
    expect((await h.request(`${SELECTOR_PATH}?${SELECTOR_QUERY}`)).status).toBe(
      403,
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    [
      'a witness-wrapped page',
      { taxonomyId: taxonomyDefinitionId, page: selectorPage(1) },
    ],
    ['more items than the limit', selectorPage(3)],
    ['an unknown member', { ...selectorPage(1), extra: 1 }],
  ])('answers %s as a retryable 502', async (_name, value) => {
    const fetchImpl = vi.fn<typeof fetch>(async () => Response.json(value));
    const response = await createTaxonomyProductionHarness(
      fetchImpl,
      AUTHOR,
    ).request(`${SELECTOR_PATH}?${SELECTOR_QUERY}&limit=2`);
    expect(response.status).toBe(502);
  });

  it.each([
    ['capability_missing', undefined, 403, 'TAXONOMY_FORBIDDEN'],
    ['NOT_FOUND', undefined, 404, 'TAXONOMY_NOT_FOUND'],
    ['CONFLICT', undefined, 409, 'TAXONOMY_VERSION_CONFLICT'],
    ['INVALID_REQUEST', undefined, 400, 'INVALID_REQUEST'],
    ['VALIDATION_FAILED', '["/locale"]', 422, 'TAXONOMY_VALIDATION_FAILED'],
    ['VALIDATION_FAILED', '["/limit"]', 422, 'TAXONOMY_VALIDATION_FAILED'],
  ] as const)(
    'maps the raised %s %s to %i',
    async (token, detail, status, code) => {
      const fetchImpl = vi.fn<typeof fetch>(async () => raised(token, detail));
      const response = await createTaxonomyProductionHarness(
        fetchImpl,
        AUTHOR,
      ).request(`${SELECTOR_PATH}?${SELECTOR_QUERY}`);
      expect(response.status).toBe(status);
      const body = (await response.json()) as {
        code: string;
        details: { violations?: { path: string }[] };
      };
      expect(body.code).toBe(code);
      if (detail !== undefined)
        expect(body.details.violations?.[0]?.path).toBe(JSON.parse(detail)[0]);
    },
  );

  it.each(PROVIDER_FAULTS)(
    'scrubs the provider fault %s to 500',
    async (_name, status, payload) => {
      const fetchImpl = vi.fn<typeof fetch>(async () =>
        Response.json(payload, { status }),
      );
      const response = await createTaxonomyProductionHarness(
        fetchImpl,
        AUTHOR,
      ).request(`${SELECTOR_PATH}?${SELECTOR_QUERY}`);
      expect(response.status).toBe(500);
    },
  );
});
