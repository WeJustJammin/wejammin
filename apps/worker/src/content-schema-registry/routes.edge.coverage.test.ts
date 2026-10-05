import { afterEach, describe, expect, it, vi } from 'vitest';

const API_ORIGIN = 'https://api.example.test';
const CMS_ORIGIN = 'https://cms-console.example.test';
const REQUEST_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const session = {
  userId: '10000000-0000-4000-8000-000000000001',
  actingPartyId: null,
  capabilities: ['cms.schema_designer'],
  mfaFresh: true,
} as const;

const body = {
  typeKey: 'article',
  label: 'Article',
  ownerCapability: 'cms.schema_designer',
  sourceLocale: 'en-US',
  defaultLocale: 'en-US',
  supportedLocales: ['en-US'],
  fallbackChains: {},
  workflowKey: 'cms.standard',
  workflowVersion: '1',
  defaultTemplateVersionId: null,
  fields: [],
  relations: [],
  templateBindings: [],
  capabilityBindings: [],
};

const dependencies = () => ({
  ports: {} as never,
  resolveSession: vi.fn(async () => ({ ok: true as const, value: session })),
  verifyRelease: vi.fn(),
  rateLimit: vi.fn(async () => ({
    ok: true as const,
    value: { allowed: true, limit: 1, remaining: 0, resetAt: 1 },
  })),
  humanOrigins: [CMS_ORIGIN],
  releaseOrigins: [],
});

const request = () =>
  new Request(`${API_ORIGIN}/api/v1/cms/content-types`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: CMS_ORIGIN,
      'idempotency-key': 'edge-coverage-key',
      'x-request-id': REQUEST_ID,
    },
    body: JSON.stringify(body),
  });

afterEach(() => {
  vi.doUnmock('./domain');
  vi.resetModules();
});

describe('content schema registry route edge coverage', () => {
  it('handles a successful primitive result without an ETag', async () => {
    vi.doMock('./domain', () => ({
      createContentSchemaRegistryDomain: () => ({
        execute: async () => ({ ok: true, value: 'accepted' }),
      }),
    }));
    const { createContentSchemaRegistryApp } = await import('./routes');
    const response = await createContentSchemaRegistryApp(
      dependencies() as never,
    ).request(request());
    expect(response.status).toBe(201);
    expect(await response.json()).toBe('accepted');
    expect(response.headers.get('etag')).toBeNull();
  });

  it('normalizes a thrown domain error to the internal error response', async () => {
    vi.doMock('./domain', () => ({
      createContentSchemaRegistryDomain: () => ({
        execute: async () => {
          throw new Error('private implementation detail');
        },
      }),
    }));
    const { createContentSchemaRegistryApp } = await import('./routes');
    const response = await createContentSchemaRegistryApp(
      dependencies() as never,
    ).request(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
      requestId: REQUEST_ID,
      details: {},
    });
  });
});
