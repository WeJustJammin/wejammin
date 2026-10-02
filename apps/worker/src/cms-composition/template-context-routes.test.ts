import { describe, expect, it, vi } from 'vitest';

import {
  createCmsTemplateApp,
  type CmsTemplateDependencies,
} from './template-routes';

const context = {
  contentTypes: [
    {
      id: '30000000-0000-4000-8000-000000000003',
      typeKey: 'profile',
      activeVersionId: '40000000-0000-4000-8000-000000000004',
      activeVersion: 1,
      sourceLocale: 'en-US',
    },
  ],
  registeredBlocks: [{ blockKey: 'profile.header', blockVersion: 1 }],
};
const session = {
  userId: '10000000-0000-4000-8000-000000000001',
  actingPartyId: '20000000-0000-4000-8000-000000000002',
  capabilities: ['cms.template_designer'],
  mfaFresh: false,
};

const harness = (overrides: Partial<CmsTemplateDependencies> = {}) => {
  const readContext = vi.fn(async () => ({
    ok: true as const,
    value: context,
  }));
  const dependencies = {
    humanOrigins: ['https://app.example.test'],
    now: () => 0,
    resolveSession: async () => ({ ok: true as const, value: session }),
    rateLimit: async (input: { limit: number }) => ({
      ok: true as const,
      value: {
        allowed: true,
        limit: input.limit,
        remaining: input.limit - 1,
        resetAt: 60000,
      },
    }),
    readContext,
    defineTemplate: async () => ({ ok: true as const, value: {} as never }),
    telemetry: () => undefined,
    ...overrides,
  } as CmsTemplateDependencies;
  return { app: createCmsTemplateApp(dependencies), readContext };
};

describe('CMS-11 protected template context read', () => {
  it('answers only allowlisted context preflight origins', async () => {
    const { app } = harness();
    const path = '/api/v1/cms/templates/context';
    expect((await app.request(path, { method: 'OPTIONS' })).status).toBe(403);
    expect(
      (
        await app.request(path, {
          method: 'OPTIONS',
          headers: { origin: 'https://other.test' },
        })
      ).status,
    ).toBe(403);
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
  });

  it('returns only validated owner-scoped selectors with no-store', async () => {
    const { app, readContext } = harness();
    const response = await app.request('/api/v1/cms/templates/context');
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual(context);
    expect(readContext).toHaveBeenCalledTimes(1);
  });

  it('denies missing designer authority before invoking the RPC', async () => {
    const { app, readContext } = harness({
      resolveSession: async () => ({
        ok: true,
        value: { ...session, capabilities: [] },
      }),
    });
    const response = await app.request('/api/v1/cms/templates/context');
    expect(response.status).toBe(403);
    expect(readContext).not.toHaveBeenCalled();
  });

  it('fails closed on malformed provider data', async () => {
    const { app } = harness({
      readContext: async () => ({
        ok: true,
        value: { ...context, ownerId: session.actingPartyId },
      }),
    });
    const response = await app.request('/api/v1/cms/templates/context');
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      code: 'DEPENDENCY_INVALID_RESPONSE',
    });
  });

  it.each([
    {
      name: 'bad origin',
      path: '/api/v1/cms/templates/context',
      headers: { origin: 'https://other.test' },
      status: 403,
    },
    {
      name: 'query selector',
      path: '/api/v1/cms/templates/context?ownerId=private',
      headers: {},
      status: 400,
    },
  ])('rejects $name before the session', async ({ path, headers, status }) => {
    const resolveSession = vi.fn(async () => ({
      ok: true as const,
      value: session,
    }));
    const { app } = harness({ resolveSession });
    expect((await app.request(path, { headers })).status).toBe(status);
    expect(resolveSession).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: 'idempotency key',
      headers: { 'idempotency-key': 'create-only' },
      status: 400,
      code: 'INVALID_REQUEST',
    },
    {
      name: 'write precondition',
      headers: { 'if-match': '"2"' },
      status: 400,
      code: 'INVALID_REQUEST',
    },
    {
      name: 'request media',
      headers: { 'content-type': 'application/json' },
      status: 415,
      code: 'UNSUPPORTED_MEDIA_TYPE',
    },
    {
      name: 'nonempty body claim',
      headers: { 'content-length': '1' },
      status: 400,
      code: 'INVALID_REQUEST',
    },
    {
      name: 'transfer encoding',
      headers: { 'transfer-encoding': 'chunked' },
      status: 400,
      code: 'INVALID_REQUEST',
    },
  ])(
    'rejects $name on a read before session or RPC',
    async ({ headers, status, code }) => {
      const resolveSession = vi.fn(async () => ({
        ok: true as const,
        value: session,
      }));
      const { app, readContext } = harness({ resolveSession });
      const response = await app.request('/api/v1/cms/templates/context', {
        headers,
      });
      expect(response.status).toBe(status);
      expect(await response.json()).toMatchObject({ code });
      expect(resolveSession).not.toHaveBeenCalled();
      expect(readContext).not.toHaveBeenCalled();
    },
  );

  it.each([
    {
      name: 'throw',
      resolveSession: async () => {
        throw new Error('private');
      },
      status: 503,
    },
    {
      name: 'malformed envelope',
      resolveSession: async () => ({}) as never,
      status: 502,
    },
    {
      name: 'unauthenticated',
      resolveSession: async () => ({
        ok: false as const,
        status: 401 as const,
        code: 'UNAUTHENTICATED',
        message: 'private',
      }),
      status: 401,
    },
    {
      name: 'malformed human',
      resolveSession: async () => ({
        ok: true as const,
        value: { ...session, userId: 'invalid' },
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
  ])('fails closed for $name session', async ({ resolveSession, status }) => {
    const { app, readContext } = harness({ resolveSession });
    expect((await app.request('/api/v1/cms/templates/context')).status).toBe(
      status,
    );
    expect(readContext).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: 'throw',
      rateLimit: async () => {
        throw new Error('private');
      },
      status: 503,
    },
    {
      name: 'malformed envelope',
      rateLimit: async () => ({}) as never,
      status: 502,
    },
    {
      name: 'dependency error',
      rateLimit: async () => ({
        ok: false as const,
        status: 503 as const,
        code: 'UNAVAILABLE',
        message: 'private',
      }),
      status: 503,
    },
    {
      name: 'invalid decision',
      rateLimit: async () => ({
        ok: true as const,
        value: { allowed: true, limit: 30, remaining: 1, resetAt: 60000 },
      }),
      status: 502,
    },
    {
      name: 'denied decision',
      rateLimit: async () => ({
        ok: true as const,
        value: { allowed: false, limit: 60, remaining: 0, resetAt: 60000 },
      }),
      status: 429,
    },
  ])('fails closed for $name quota', async ({ rateLimit, status }) => {
    const { app, readContext } = harness({ rateLimit });
    expect((await app.request('/api/v1/cms/templates/context')).status).toBe(
      status,
    );
    expect(readContext).not.toHaveBeenCalled();
  });

  it('publishes the BE00 429 details and RateLimit headers on the context route', async () => {
    const { app, readContext } = harness({
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
    const response = await app.request('/api/v1/cms/templates/context');
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
    expect(readContext).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: 'throw',
      readContext: async () => {
        throw new Error('private');
      },
      status: 503,
    },
    {
      name: 'malformed envelope',
      readContext: async () => ({}) as never,
      status: 502,
    },
    {
      name: 'provider denial',
      readContext: async () => ({
        ok: false as const,
        status: 403 as const,
        code: 'FORBIDDEN',
        message: 'private',
      }),
      status: 403,
    },
  ])(
    'fails closed for $name context provider',
    async ({ readContext, status }) => {
      const { app } = harness({ readContext });
      const response = await app.request('/api/v1/cms/templates/context');
      expect(response.status).toBe(status);
      expect(JSON.stringify(await response.json())).not.toContain('private');
    },
  );

  it('enforces a total deadline and catches unexpected execution failures', async () => {
    vi.useFakeTimers();
    try {
      const { app } = harness({
        resolveSession: async () => new Promise(() => undefined),
      });
      const pending = app.request('/api/v1/cms/templates/context');
      await vi.advanceTimersByTimeAsync(15000);
      expect((await pending).status).toBe(504);
    } finally {
      vi.useRealTimers();
    }
    const malformed = new Proxy(
      { ok: true, value: session },
      {
        get(target, key) {
          if (key === 'ok') throw new Error('private');
          return Reflect.get(target, key);
        },
      },
    );
    const { app } = harness({ resolveSession: async () => malformed as never });
    expect((await app.request('/api/v1/cms/templates/context')).status).toBe(
      500,
    );
  });

  it('keeps telemetry failure out of the response', async () => {
    const { app } = harness({
      telemetry: () => {
        throw new Error('private');
      },
    });
    expect((await app.request('/api/v1/cms/templates/context')).status).toBe(
      200,
    );
    const rejected = harness({
      telemetry: async () => {
        throw new Error('private');
      },
    });
    expect(
      (await rejected.app.request('/api/v1/cms/templates/context')).status,
    ).toBe(200);
  });
});
