import { afterEach, describe, expect, it, vi } from 'vitest';

const baseRoute = {
  operationId: 'CMS-03A-01',
  method: 'POST',
  path: '/api/v1/cms/coverage',
  requestSchema: 'ContentTypeDraftRequestSchema',
  successSchema: 'ContentTypeVersionResourceSchema',
  successStatus: 201,
  auth: 'schema_designer',
  capability: 'cms.schema_designer',
  audience: 'browser',
  cors: 'cms-console',
  csrf: 'required',
  stepUp: 'none',
  rawBodySignature: 'none',
  idempotency: 'none',
  ifMatch: 'none',
  rateClass: 'cms-definition-write',
  rateLimit: 1,
  partyRateLimit: 1,
  rateWindowSeconds: 60,
  rateScope: 'user',
  timeoutMs: 15_000,
  cacheControl: 'no-store',
  slo: {
    tier: 2,
    commandP95Ms: 1_200,
    protectedRpcP95Ms: 300,
    acceptanceP99Ms: 1_000,
  },
  errors: {},
} as const;

afterEach(() => {
  vi.doUnmock('./routes.ts');
  vi.resetModules();
});

describe('content schema registry OpenAPI defensive branches', () => {
  it('rejects a route that references an absent schema contract', async () => {
    vi.doMock('./routes.ts', () => ({
      contentSchemaRegistryRoutePolicies: [
        { ...baseRoute, requestSchema: 'MissingSchema' },
      ],
    }));
    await expect(import('./openapi.ts')).rejects.toThrow(
      /schema MissingSchema is absent/u,
    );
  });

  it('rejects duplicate method/path OpenAPI entries', async () => {
    vi.doMock('./routes.ts', () => ({
      contentSchemaRegistryRoutePolicies: [
        baseRoute,
        { ...baseRoute, operationId: 'CMS-03A-02' },
      ],
    }));
    await expect(import('./openapi.ts')).rejects.toThrow(
      /Duplicate content schema registry OpenAPI route/u,
    );
  });

  it('supports POST routes without mutation precondition headers', async () => {
    vi.doMock('./routes.ts', () => ({
      contentSchemaRegistryRoutePolicies: [baseRoute],
    }));
    const openapi = await import('./openapi.ts');
    const document = openapi.buildContentSchemaRegistryOpenApiDocument();
    expect(document.paths['/api/v1/cms/coverage']?.post).toBeDefined();
    expect(
      (
        document.paths['/api/v1/cms/coverage']?.post as {
          parameters?: unknown[];
        }
      ).parameters,
    ).toEqual([]);
  });
});
