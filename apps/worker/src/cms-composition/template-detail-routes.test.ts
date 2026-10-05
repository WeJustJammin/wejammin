import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import type { TemplateVersionDetail } from '@wejammin/contracts';

import type { CmsTemplateDependencies } from './template-routes';
import { registerCmsTemplateDetailRoutes } from './template-detail-routes';

const path = '/api/v1/cms/templates/profile-header';
const session = {
  userId: '10000000-0000-4000-8000-000000000001',
  actingPartyId: '20000000-0000-4000-8000-000000000002',
  capabilities: ['cms.template_designer'],
  mfaFresh: false,
};
const detail: TemplateVersionDetail = {
  id: '30000000-0000-4000-8000-000000000003',
  version: '2',
  contentHash: 'a'.repeat(64),
  createdAt: '2026-09-27T12:00:00Z',
  updatedAt: '2026-09-27T12:00:00Z',
  state: 'draft',
  templateKey: 'profile-header',
  templateVersion: 2,
  compatibleTypeIds: ['40000000-0000-4000-8000-000000000004'],
  reservedRegions: ['header', 'now', 'record', 'detail', 'provenance'],
  blockRegistryDigest: 'b'.repeat(64),
  slots: [],
  bindings: {},
  locale: 'en-US',
  audience: 'public',
};

const harness = (overrides: Partial<CmsTemplateDependencies> = {}) => {
  const readLatest = vi.fn(async () => ({ ok: true as const, value: detail }));
  const resolveSession = vi.fn(async () => ({
    ok: true as const,
    value: session,
  }));
  const dependencies = {
    humanOrigins: ['https://app.example.test'],
    now: () => 0,
    resolveSession,
    rateLimit: async (input: { limit: number }) => ({
      ok: true as const,
      value: {
        allowed: true,
        limit: input.limit,
        remaining: input.limit - 1,
        resetAt: 60000,
      },
    }),
    defineTemplate: async () => ({ ok: true as const, value: {} as never }),
    readContext: async () => ({
      ok: true as const,
      value: { contentTypes: [], registeredBlocks: [] },
    }),
    readLatest,
    telemetry: () => undefined,
    ...overrides,
  } as CmsTemplateDependencies;
  const app = new Hono();
  registerCmsTemplateDetailRoutes(app, dependencies);
  return { app, readLatest, resolveSession };
};

describe('CMS-11 protected current-template detail HTTP route', () => {
  it('limits preflight to valid keys and approved origins', async () => {
    const { app } = harness();
    expect((await app.request(path, { method: 'OPTIONS' })).status).toBe(403);
    expect(
      (
        await app.request(path, {
          method: 'OPTIONS',
          headers: { origin: 'https://other.test' },
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await app.request('/api/v1/cms/templates/Bad_Key', {
          method: 'OPTIONS',
          headers: { origin: 'https://app.example.test' },
        })
      ).status,
    ).toBe(400);
    const response = await app.request(path, {
      method: 'OPTIONS',
      headers: {
        origin: 'https://app.example.test',
        'x-request-id': '50000000-0000-4000-8000-000000000005',
      },
    });
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-methods')).toBe(
      'GET, OPTIONS',
    );
    expect(response.headers.get('access-control-allow-origin')).toBe(
      'https://app.example.test',
    );
  });
  it('reads only the validated latest definition with a strong ETag and no-store', async () => {
    const { app, readLatest } = harness();
    const response = await app.request(path);
    expect(response.status).toBe(200);
    expect(response.headers.get('etag')).toBe('"2"');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual(detail);
    expect(readLatest).toHaveBeenCalledWith(
      expect.objectContaining({ templateKey: 'profile-header' }),
      expect.any(AbortSignal),
    );
  });

  it('rejects invalid selectors after authentication and before authorization or the read', async () => {
    const { app, resolveSession } = harness();
    expect((await app.request('/api/v1/cms/templates/Bad_Key')).status).toBe(
      400,
    );
    expect((await app.request(`${path}?ownerId=private`)).status).toBe(400);
    expect(
      (await app.request(path, { headers: { origin: 'https://other.test' } }))
        .status,
    ).toBe(403);
    // Two selector failures (BE00 step 6) resolve the session; the foreign
    // origin (step 2) never does.
    expect(resolveSession).toHaveBeenCalledTimes(2);
  });

  it.each([
    {
      name: 'idempotency key',
      sessionCalls: 1,
      headers: { 'idempotency-key': 'create-only' },
      status: 400,
      code: 'INVALID_REQUEST',
    },
    {
      name: 'write precondition',
      sessionCalls: 1,
      headers: { 'if-match': '"2"' },
      status: 400,
      code: 'INVALID_REQUEST',
    },
    {
      name: 'request media',
      sessionCalls: 0,
      headers: { 'content-type': 'application/json' },
      status: 415,
      code: 'UNSUPPORTED_MEDIA_TYPE',
    },
    {
      name: 'nonempty body claim',
      sessionCalls: 1,
      headers: { 'content-length': '1' },
      status: 400,
      code: 'INVALID_REQUEST',
    },
    {
      name: 'transfer encoding',
      sessionCalls: 1,
      headers: { 'transfer-encoding': 'chunked' },
      status: 400,
      code: 'INVALID_REQUEST',
    },
  ])(
    'rejects $name on a detail read before authorization or the RPC',
    async ({ headers, status, code, sessionCalls }) => {
      const { app, readLatest, resolveSession } = harness();
      const response = await app.request(path, { headers });
      expect(response.status).toBe(status);
      expect(await response.json()).toMatchObject({ code });
      expect(resolveSession).toHaveBeenCalledTimes(sessionCalls);
      expect(readLatest).not.toHaveBeenCalled();
    },
  );

  it('answers request media on a read with 415 and an empty allowlist (BE00)', async () => {
    const { app } = harness();
    const response = await app.request(path, {
      headers: { 'content-type': 'application/json' },
    });
    expect(response.status).toBe(415);
    expect(((await response.json()) as { details: unknown }).details).toEqual({
      allowedMediaTypes: [],
    });
  });

  it('requires the live designer capability before reading', async () => {
    const { app, readLatest } = harness({
      resolveSession: async () => ({
        ok: true,
        value: { ...session, capabilities: [] },
      }),
    });
    expect((await app.request(path)).status).toBe(403);
    expect(readLatest).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: 'session dependency throws',
      resolveSession: async () => {
        throw new Error('private');
      },
      status: 503,
    },
    {
      name: 'malformed session envelope',
      resolveSession: async () => ({ bad: true }) as never,
      status: 502,
    },
    {
      name: 'unauthenticated',
      resolveSession: async () => ({
        ok: false as const,
        status: 401 as const,
        code: 'UNAUTHENTICATED',
        message: 'none',
      }),
      status: 401,
    },
    {
      name: 'malformed identity',
      resolveSession: async () => ({
        ok: true as const,
        value: { ...session, userId: '' },
      }),
      status: 401,
    },
    {
      name: 'no acting party',
      resolveSession: async () => ({
        ok: true as const,
        value: { ...session, actingPartyId: null },
      }),
      status: 403,
    },
  ])('fails closed when $name', async ({ resolveSession, status }) => {
    const { app, readLatest } = harness({ resolveSession });
    expect((await app.request(path)).status).toBe(status);
    expect(readLatest).not.toHaveBeenCalled();
  });

  it('preserves concealed not-found and rejects malformed dependency data', async () => {
    const concealed = harness({
      readLatest: async () => ({
        ok: false,
        status: 404,
        code: 'NOT_FOUND',
        message: 'none',
      }),
    });
    expect((await concealed.app.request(path)).status).toBe(404);
    const malformed = harness({
      readLatest: async () => ({
        ok: true,
        value: { ...detail, ownerId: session.actingPartyId },
      }),
    });
    const response = await malformed.app.request(path);
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      code: 'DEPENDENCY_INVALID_RESPONSE',
    });
  });

  it('uses the existing read-rate class for both actor and party', async () => {
    const scopes: string[] = [];
    const { app } = harness({
      rateLimit: async (input) => {
        scopes.push(input.rateScope);
        return {
          ok: true,
          value: {
            allowed: true,
            limit: input.limit,
            remaining: 1,
            resetAt: 60000,
          },
        };
      },
    });
    expect((await app.request(path)).status).toBe(200);
    expect(scopes).toEqual(['user', 'party']);
  });

  it('publishes the BE00 429 details and RateLimit headers on the detail route', async () => {
    const { app, readLatest } = harness({
      rateLimit: async (input) => ({
        ok: true as const,
        value: {
          allowed: false,
          limit: input.limit,
          remaining: 0,
          resetAt: 60000,
        },
      }),
    });
    const response = await app.request(path);
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('60000');
    expect(response.headers.get('ratelimit-limit')).toBe('60');
    expect(response.headers.get('ratelimit-remaining')).toBe('0');
    expect(response.headers.get('ratelimit-reset')).toBe('60000');
    expect(await response.json()).toMatchObject({
      code: 'RATE_LIMITED',
      details: {
        retryAfterSeconds: 60000,
        limit: 60,
        resetAt: '60000',
      },
    });
    expect(readLatest).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: 'rate dependency throws',
      rateLimit: async () => {
        throw new Error('private');
      },
      status: 503,
    },
    {
      name: 'malformed rate envelope',
      rateLimit: async () => ({ bad: true }) as never,
      status: 502,
    },
    {
      name: 'rate dependency rejection',
      rateLimit: async () => ({
        ok: false as const,
        status: 503 as const,
        code: 'UNAVAILABLE',
        message: 'none',
      }),
      status: 503,
    },
    {
      name: 'invalid rate decision',
      rateLimit: async () => ({
        ok: true as const,
        value: { allowed: true, limit: 12, remaining: 1, resetAt: 60000 },
      }),
      status: 502,
    },
    {
      name: 'rate limited',
      rateLimit: async () => ({
        ok: true as const,
        value: { allowed: false, limit: 60, remaining: 0, resetAt: 60000 },
      }),
      status: 429,
    },
  ])('fails closed when $name', async ({ rateLimit, status }) => {
    const { app, readLatest } = harness({ rateLimit });
    expect((await app.request(path)).status).toBe(status);
    expect(readLatest).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: 'detail dependency throws',
      readLatest: async () => {
        throw new Error('private');
      },
      status: 503,
    },
    {
      name: 'malformed detail envelope',
      readLatest: async () => ({ bad: true }) as never,
      status: 502,
    },
    {
      name: 'wrong current key',
      readLatest: async () => ({
        ok: true as const,
        value: { ...detail, templateKey: 'other-template' },
      }),
      status: 502,
    },
    {
      name: 'inconsistent version',
      readLatest: async () => ({
        ok: true as const,
        value: { ...detail, version: '1' },
      }),
      status: 502,
    },
  ])('does not expose $name', async ({ readLatest, status }) => {
    const { app } = harness({ readLatest });
    expect((await app.request(path)).status).toBe(status);
  });

  it('does not let telemetry rejection or synchronous failure alter the response', async () => {
    const rejected = harness({
      telemetry: async () => {
        throw new Error('telemetry');
      },
    });
    expect((await rejected.app.request(path)).status).toBe(200);
    const thrown = harness({
      telemetry: () => {
        throw new Error('telemetry');
      },
    });
    expect((await thrown.app.request(path)).status).toBe(200);
  });

  it('returns the deadline even when a session dependency never resolves', async () => {
    vi.useFakeTimers();
    try {
      let release!: (value: unknown) => void;
      const { app } = harness({
        resolveSession: () =>
          new Promise((resolve) => {
            release = resolve as (value: unknown) => void;
          }),
      });
      const pending = app.request(path);
      await vi.advanceTimersByTimeAsync(15_000);
      expect((await pending).status).toBe(504);
      release({ ok: true, value: session });
      await Promise.resolve();
    } finally {
      vi.useRealTimers();
    }
  });

  it('contains an unexpected execution error in the generic 500 envelope', async () => {
    let calls = 0;
    const { app } = harness({
      now: () => {
        calls += 1;
        if (calls > 1) throw new Error('private');
        return 0;
      },
      rateLimit: async () => ({
        ok: true,
        value: { allowed: false, limit: 60, remaining: 0, resetAt: 60000 },
      }),
    });
    expect((await app.request(path)).status).toBe(500);
  });
});
