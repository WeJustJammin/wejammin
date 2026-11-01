import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiErrorSchema } from '@wejammin/contracts';
import { Hono } from 'hono';
import { registerCmsTaxonomyDefinitionRoutes } from './taxonomy-definition-routes';
import { failure } from './taxonomy-definition-shared';
import {
  createTaxonomyRouteHarness,
  createTaxonomyProductionHarness,
  taxonomyDefinitionVersionsPath,
  taxonomyDefinitionId,
  taxonomyResource,
  taxonomyPageAtBytes,
  taxonomyDefinitionWriteRequest,
  taxonomyDefinitionRequestId,
  taxonomyDefinitionOrigin,
} from './taxonomy-definition.test-support';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe('taxonomy versions isolated boundary', () => {
  it('bounds a schema-valid 50-violation final error under a tighter 1024-byte budget', async () => {
    const h = createTaxonomyRouteHarness();
    const refusal = failure(422, {
      violations: Array.from({ length: 50 }, () => ({
        path: '/taxonomyKey',
        code: 'invalid',
        message: 'The value is invalid.',
      })),
    });
    const { code, message, details } = refusal;
    const error = ApiErrorSchema.parse({
      code,
      message,
      details,
      requestId: taxonomyDefinitionRequestId,
    });
    expect(
      new TextEncoder().encode(JSON.stringify(error)).byteLength,
    ).toBeGreaterThan(1024);
    const app = new Hono();
    registerCmsTaxonomyDefinitionRoutes(app, {
      ...h.dependencies,
      maxResponseBytes: 1024,
      createVersion: async () => refusal,
    });
    const response = await app.request(
      '/api/v1/cms/taxonomies/versions',
      taxonomyDefinitionWriteRequest(),
    );
    const body = await response.text();
    expect(response.status).toBe(502);
    expect(new TextEncoder().encode(body).byteLength).toBeLessThanOrEqual(1024);
    expect(ApiErrorSchema.parse(JSON.parse(body))).toEqual({
      code: 'DEPENDENCY_UNAVAILABLE',
      message:
        'DEPENDENCY_UNAVAILABLE: taxonomy operation rejected or unavailable.',
      requestId: taxonomyDefinitionRequestId,
      details: {},
    });
    expect(response.headers.get('etag')).toBeNull();
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('access-control-allow-origin')).toBe(
      taxonomyDefinitionOrigin,
    );
  });
  it('rejects a registrar budget too small for the typed error envelope', () => {
    const h = createTaxonomyRouteHarness();
    expect(() =>
      registerCmsTaxonomyDefinitionRoutes(new Hono(), {
        ...h.dependencies,
        maxResponseBytes: 1,
      }),
    ).toThrow();
  });
  it.each([262144, 262145])(
    'bounds schema-valid final serialized page at %i bytes',
    async (bytes) => {
      const { page } = taxonomyPageAtBytes(bytes);
      expect(new TextEncoder().encode(JSON.stringify(page)).byteLength).toBe(
        bytes,
      );
      const h = createTaxonomyRouteHarness();
      h.readVersions.mockResolvedValue({ ok: true, value: page });
      const response = await h.request(taxonomyDefinitionVersionsPath());
      expect(response.status).toBe(bytes === 262144 ? 200 : 502);
      expect((await response.arrayBuffer()).byteLength).toBeLessThanOrEqual(
        262144,
      );
    },
  );
  it.each([262144, 262145])(
    'bounds schema-valid actual private RPC page at %i bytes with larger options clamped',
    async (bytes) => {
      const { value, page } = taxonomyPageAtBytes(bytes, true);
      const wire = JSON.stringify(value);
      expect(new TextEncoder().encode(wire).byteLength).toBe(bytes);
      const fetchImpl = vi.fn<typeof fetch>(
        async () =>
          new Response(wire, {
            headers: {
              'content-type': 'application/json',
              'content-length': '1',
            },
          }),
      );
      const h = createTaxonomyProductionHarness(fetchImpl, {
        maxResponseBytes: 1048576,
      });
      const response = await h.request(taxonomyDefinitionVersionsPath());
      expect(response.status).toBe(bytes === 262144 ? 200 : 502);
      if (response.status === 200) expect(await response.json()).toEqual(page);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    },
  );
  it.each([
    [
      {
        taxonomyId: taxonomyDefinitionId,
        page: { items: [], pageVersion: '9' },
      },
      200,
    ],
    [
      {
        taxonomyId: '66666666-6666-4666-8666-666666666666',
        page: { items: [], pageVersion: '9' },
      },
      502,
    ],
    [{ items: [], pageVersion: '9' }, 502],
  ])(
    'requires a private existence witness before unwrapping an empty page %#',
    async (payload, status) => {
      const fetchImpl = vi.fn<typeof fetch>(async () => Response.json(payload));
      const h = createTaxonomyProductionHarness(fetchImpl);
      const response = await h.request(taxonomyDefinitionVersionsPath());
      expect(response.status).toBe(status);
      if (status === 200) {
        expect(await response.json()).toEqual({ items: [], pageVersion: '9' });
        expect(response.headers.get('etag')).toBe('"9"');
      }
      expect(fetchImpl.mock.calls[0]?.[0]).toBe(
        'https://supabase.example.test/rest/v1/rpc/cms_list_taxonomy_versions',
      );
    },
  );
  it('returns newest-first versions and a page-version strong ETag without MFA', async () => {
    const h = createTaxonomyRouteHarness();
    const items = [
      taxonomyResource(3),
      taxonomyResource(2),
      taxonomyResource(1),
    ];
    h.readVersions.mockResolvedValue({
      ok: true,
      value: { items, pageVersion: '12' },
    });
    const response = await h.request(taxonomyDefinitionVersionsPath());
    expect(response.status).toBe(200);
    expect(response.headers.get('etag')).toBe('"12"');
    expect(await response.json()).toEqual({ items, pageVersion: '12' });
    expect(h.rateLimit.mock.calls.map(([input]) => input.limit)).toEqual([
      60, 60,
    ]);
  });
  it.each([
    [taxonomyResource(1), taxonomyResource(2)],
    [taxonomyResource(2), taxonomyResource(2)],
    [
      {
        ...taxonomyResource(),
        taxonomyId: '66666666-6666-4666-8666-666666666666',
      },
    ],
    [{ ...taxonomyResource(), version: '99' }],
    Array.from({ length: 51 }, (_, i) => taxonomyResource(51 - i)),
    [{ ...taxonomyResource(), actorPersonId: 'private' }],
  ])('fails closed for invalid page rows %#', async (...items) => {
    const h = createTaxonomyRouteHarness();
    h.readVersions.mockResolvedValue({
      ok: true,
      value: {
        items: items as ReturnType<typeof taxonomyResource>[],
        pageVersion: '1',
      },
    });
    const response = await h.request(taxonomyDefinitionVersionsPath());
    expect(response.status).toBe(502);
    expect(response.headers.get('etag')).toBeNull();
    expect(await response.text()).not.toContain('private');
  });
  it.each(['?ownerId=private', '?limit=50', '?cursor=opaque'])(
    'rejects query %s',
    async (query) => {
      const h = createTaxonomyRouteHarness();
      expect(
        (await h.request(taxonomyDefinitionVersionsPath() + query)).status,
      ).toBe(400);
      expect(h.readVersions).not.toHaveBeenCalled();
    },
  );
  it.each(['if-match', 'idempotency-key', 'transfer-encoding'])(
    'rejects write/body header %s',
    async (name) => {
      const h = createTaxonomyRouteHarness();
      expect(
        (
          await h.request(taxonomyDefinitionVersionsPath(), {
            headers: { [name]: 'forbidden' },
          })
        ).status,
      ).toBe(400);
      expect(h.readVersions).not.toHaveBeenCalled();
    },
  );
  it('rejects invalid lineage path and content type', async () => {
    const h = createTaxonomyRouteHarness();
    expect(
      (await h.request('/api/v1/cms/taxonomies/invalid/versions')).status,
    ).toBe(400);
    expect(
      (
        await h.request(taxonomyDefinitionVersionsPath(), {
          headers: { 'content-type': 'application/json' },
        })
      ).status,
    ).toBe(415);
    expect(h.readVersions).not.toHaveBeenCalled();
  });
});
