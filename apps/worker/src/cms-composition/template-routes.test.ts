import { describe, expect, it, vi } from 'vitest';
import type { TemplateVersionResource } from '@wejammin/contracts';

import {
  createCmsTemplateApp,
  commonHeaders,
  errorResponse,
  failure,
  type CmsTemplateDependencies,
} from './template-routes';
import {
  httpAdapter,
  httpFresh,
  httpRequest,
  registerOrderTests,
  standardMutationSteps,
  type HttpState,
} from '../be00-order.test-support';

const path = '/api/v1/cms/templates/versions';
const origin = 'https://cms-console.example.test';
const actorId = '10000000-0000-4000-8000-000000000001';
const partyId = '20000000-0000-4000-8000-000000000002';
const typeId = '30000000-0000-4000-8000-000000000003';
const templateId = '40000000-0000-4000-8000-000000000004';
const requestId = '50000000-0000-4000-8000-000000000005';
const digest = 'a'.repeat(64);
const body = {
  templateKey: 'profile-header',
  compatibleTypeIds: [typeId],
  slots: [
    {
      key: 'header',
      required: true,
      allowedBlocks: [{ blockKey: 'profile.header', blockVersion: 1 }],
      maxCount: 1,
    },
  ],
  reservedRegions: ['header', 'now', 'record', 'detail', 'provenance'],
  bindings: { title: { projection: 'profile.title', required: true } },
  locale: 'en-US',
  audience: 'public',
  blockRegistryDigest: digest,
  expectedVersion: null,
} as const;
const resource: TemplateVersionResource = {
  id: templateId,
  version: '1',
  contentHash: digest,
  createdAt: '2026-09-27T12:00:00Z',
  updatedAt: '2026-09-27T12:00:00Z',
  state: 'draft',
  templateKey: 'profile-header',
  templateVersion: 1,
  compatibleTypeIds: [typeId],
  reservedRegions: ['header', 'now', 'record', 'detail', 'provenance'],
  blockRegistryDigest: digest,
};

const harness = (overrides: Partial<CmsTemplateDependencies> = {}) => {
  const defineTemplate = vi.fn(
    async (_input: unknown, _signal: AbortSignal) => {
      void _input;
      void _signal;
      return { ok: true as const, value: resource };
    },
  );
  const rateLimit = vi.fn(async (input: { limit: number }) => ({
    ok: true as const,
    value: {
      allowed: true,
      limit: input.limit,
      remaining: input.limit - 1,
      resetAt: 60_000,
    },
  }));
  const telemetry = vi.fn(async () => undefined);
  const dependencies = {
    humanOrigins: [origin],
    now: () => 0,
    resolveSession: async () => ({
      ok: true as const,
      value: {
        userId: actorId,
        actingPartyId: partyId,
        capabilities: ['cms.template_designer'],
        mfaFresh: false,
      },
    }),
    rateLimit,
    defineTemplate,
    telemetry,
    ...overrides,
  } as CmsTemplateDependencies;
  return {
    app: createCmsTemplateApp(dependencies),
    defineTemplate,
    rateLimit,
    telemetry,
  };
};

const post = (
  app: ReturnType<typeof createCmsTemplateApp>,
  value: unknown = body,
  headers: Record<string, string> = {},
): Promise<Response> =>
  Promise.resolve(
    app.request(path, {
      method: 'POST',
      headers: {
        origin,
        'content-type': 'application/json',
        'idempotency-key': 'template-create-0001',
        'x-request-id': requestId,
        ...headers,
      },
      body: JSON.stringify(value),
    }),
  );

const expectError = async (
  response: Response,
  status: number,
  code: string,
) => {
  expect(response.status).toBe(status);
  expect(response.headers.get('content-type')).toContain('application/json');
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(response.headers.get('x-request-id')).toBe(requestId);
  expect(await response.json()).toMatchObject({
    code,
    message: `${code}: template operation rejected or unavailable.`,
    requestId,
    details: expect.any(Object),
  });
};

describe('CMS-03C-01 protected template-version route', () => {
  it('creates one draft with exact resource, server-bound context, two quotas and no-store', async () => {
    const { app, defineTemplate, rateLimit, telemetry } = harness();
    const response = await post(app);
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(resource);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('etag')).toBe('"1"');
    expect(response.headers.get('x-request-id')).toBe(requestId);
    expect(defineTemplate).toHaveBeenCalledTimes(1);
    expect(defineTemplate.mock.calls[0]?.[0]).toMatchObject({
      operationId: 'CMS-03C-01',
      requestId,
      body,
      idempotencyKey: 'template-create-0001',
      ifMatch: null,
      session: { userId: actorId, actingPartyId: partyId },
    });
    expect(rateLimit.mock.calls.map(([input]) => input)).toMatchObject([
      {
        operationId: 'CMS-03C-01',
        rateScope: 'user',
        actorId,
        limit: 30,
        windowSeconds: 60,
      },
      {
        operationId: 'CMS-03C-01',
        rateScope: 'party',
        actorId: partyId,
        limit: 60,
        windowSeconds: 60,
      },
    ]);
    expect(telemetry).toHaveBeenCalledWith({
      operationId: 'CMS-03C-01',
      requestId,
      status: 201,
      outcome: 'success',
      actorClass: 'human',
      durationMs: 0,
    });
  });

  it('requires a matching strong If-Match only for a successor version', async () => {
    const next = { ...body, expectedVersion: '1' };
    const define = vi.fn(async (_input: unknown, _signal: AbortSignal) => {
      void _input;
      void _signal;
      return {
        ok: true as const,
        value: { ...resource, version: '2', templateVersion: 2 },
      };
    });
    const { app, defineTemplate } = harness({
      defineTemplate: define,
    });
    const response = await post(app, next, { 'if-match': '"1"' });
    expect(response.status).toBe(201);
    expect(response.headers.get('etag')).toBe('"2"');
    expect(define).toHaveBeenCalledTimes(1);
    expect(define.mock.calls[0]?.[0]).toMatchObject({ ifMatch: '1' });
    await expectError(await post(app, next), 400, 'INVALID_REQUEST');
    await expectError(
      await post(app, next, { 'if-match': 'W/"1"' }),
      400,
      'INVALID_REQUEST',
    );
    await expectError(
      await post(app, next, { 'if-match': '"2"' }),
      400,
      'INVALID_REQUEST',
    );
    await expectError(
      await post(app, body, { 'if-match': '"1"' }),
      400,
      'INVALID_REQUEST',
    );
    expect(define).toHaveBeenCalledTimes(1);
    expect(defineTemplate).not.toHaveBeenCalled();
  });

  it('rejects invalid media, headers, unknown authority and protected-region movement before mutation', async () => {
    const { app, defineTemplate } = harness();
    await expectError(
      await post(app, body, { 'content-type': 'text/plain' }),
      415,
      'UNSUPPORTED_MEDIA_TYPE',
    );
    await expectError(
      await post(app, body, { 'idempotency-key': 'short' }),
      400,
      'INVALID_REQUEST',
    );
    await expectError(
      await post(app, { ...body, ownerId: partyId }),
      422,
      'TEMPLATE_VALIDATION_FAILED',
    );
    const moved = await post(app, {
      ...body,
      reservedRegions: ['now', 'header', 'record', 'detail', 'provenance'],
    });
    await expectError(moved, 422, 'TEMPLATE_VALIDATION_FAILED');
    expect(defineTemplate).not.toHaveBeenCalled();
  });

  it('fails closed on missing identity, wrong capability and absent acting party', async () => {
    const denied = async (value: {
      userId: string;
      actingPartyId: string | null;
      capabilities: readonly string[];
      mfaFresh: boolean;
    }) => ({
      ok: true as const,
      value,
    });
    const unauthenticated = await post(
      harness({
        resolveSession: async () => ({
          ok: false,
          status: 401,
          code: 'UNAUTHENTICATED',
          message: 'secret',
        }),
      }).app,
    );
    expect(
      ((await unauthenticated.clone().json()) as { details: unknown }).details,
    ).toEqual({ recoveryAction: 'reauthenticate' });
    await expectError(unauthenticated, 401, 'UNAUTHENTICATED');
    await expectError(
      await post(
        harness({
          resolveSession: async () =>
            denied({
              userId: actorId,
              actingPartyId: partyId,
              capabilities: ['cms.viewer'],
              mfaFresh: false,
            }),
        }).app,
      ),
      403,
      'TEMPLATE_FORBIDDEN',
    );
    await expectError(
      await post(
        harness({
          resolveSession: async () =>
            denied({
              userId: actorId,
              actingPartyId: null,
              capabilities: ['cms.template_designer'],
              mfaFresh: false,
            }),
        }).app,
      ),
      403,
      'TEMPLATE_FORBIDDEN',
    );
  });

  it('admits only an allowlisted preflight and enforces cookie CSRF', async () => {
    const { app, defineTemplate } = harness();
    const allowed = await app.request(path, {
      method: 'OPTIONS',
      headers: { origin },
    });
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get('access-control-allow-origin')).toBe(origin);
    expect(allowed.headers.get('access-control-allow-headers')).toContain(
      'If-Match',
    );
    expect((await app.request(path, { method: 'OPTIONS' })).status).toBe(403);
    await expectError(
      await post(app, body, { origin: 'https://evil.example.test' }),
      403,
      'TEMPLATE_FORBIDDEN',
    );
    await expectError(
      await post(app, body, { cookie: 'wj_session_ref=s; wj_csrf=t' }),
      403,
      'TEMPLATE_FORBIDDEN',
    );
    expect(defineTemplate).not.toHaveBeenCalled();
  });

  it('enforces both rate scopes and emits a safe retry envelope', async () => {
    const rateLimit = vi.fn(
      async (input: { limit: number; rateScope: string }) => ({
        ok: true as const,
        value: {
          allowed: input.rateScope !== 'party',
          limit: input.limit,
          remaining: 0,
          resetAt: 4_000,
        },
      }),
    );
    const { app, defineTemplate } = harness({ rateLimit });
    const response = await post(app);
    const payload = (await response.clone().json()) as {
      code: string;
      details: {
        retryAfterSeconds: number;
        limit: number;
        resetAt: string;
      };
    };
    await expectError(response, 429, 'RATE_LIMITED');
    expect(payload.code).toBe('RATE_LIMITED');
    expect(payload.details).toEqual({
      retryAfterSeconds: 4000,
      limit: 60,
      resetAt: '4000',
    });
    expect(response.headers.get('retry-after')).toBe('4000');
    expect(response.headers.get('ratelimit-limit')).toBe('60');
    expect(response.headers.get('ratelimit-remaining')).toBe('0');
    expect(response.headers.get('ratelimit-reset')).toBe('4000');
    expect(rateLimit).toHaveBeenCalledTimes(2);
    expect(defineTemplate).not.toHaveBeenCalled();
  });

  it.each([
    [404, 'TEMPLATE_NOT_FOUND'],
    [409, 'TEMPLATE_VERSION_CONFLICT'],
    [422, 'TEMPLATE_VALIDATION_FAILED'],
    [502, 'DEPENDENCY_INVALID_RESPONSE'],
    [503, 'DEPENDENCY_UNAVAILABLE'],
    [504, 'DEPENDENCY_DEADLINE_EXCEEDED'],
    [500, 'INTERNAL_ERROR'],
  ] as const)(
    'normalizes a %i port failure to %s without leaking dependency prose',
    async (status, code) => {
      const { app } = harness({
        defineTemplate: async () => ({
          ok: false,
          status,
          code: 'PRIVATE_SQL',
          message: 'secret template body',
          details: { privateData: 'secret' },
        }),
      });
      const response = await post(app);
      const raw = await response.clone().text();
      await expectError(response, status, code);
      expect(raw).not.toContain('secret');
    },
  );

  it('refuses a malformed success resource, including client-digest substitution', async () => {
    const { app } = harness({
      defineTemplate: async () => ({
        ok: true,
        value: { ...resource, blockRegistryDigest: 'b'.repeat(64) },
      }),
    });
    await expectError(await post(app), 502, 'DEPENDENCY_INVALID_RESPONSE');
  });

  it('reports safe field violations and authorized version metadata but discards foreign details', async () => {
    const validation = await post(
      harness({
        defineTemplate: async () => ({
          ok: false,
          status: 422,
          code: 'VALIDATION_FAILED',
          message: 'private',
          details: {
            violations: [
              null,
              {
                path: '/slots/0',
                code: 'slot_key_invalid',
                privateValue: 'secret',
              },
              { path: 3, code: 'secret', message: 'secret' },
            ],
          },
        }),
      }).app,
    );
    expect(
      ((await validation.clone().json()) as { details: unknown }).details,
    ).toEqual({
      violations: [
        {
          path: '/slots/0',
          code: 'slot_key_invalid',
          message: 'The value is invalid.',
        },
        { path: '/', code: 'invalid', message: 'The value is invalid.' },
      ],
    });
    await expectError(validation, 422, 'TEMPLATE_VALIDATION_FAILED');

    const conflict = await post(
      harness({
        defineTemplate: async () => ({
          ok: false,
          status: 409,
          code: 'CONFLICT',
          message: 'private',
          details: {
            expectedVersion: '1',
            currentVersion: '2',
            secret: 'private',
          },
        }),
      }).app,
    );
    expect(
      ((await conflict.clone().json()) as { details: unknown }).details,
    ).toEqual({
      expectedVersion: '1',
      currentVersion: '2',
    });
    await expectError(conflict, 409, 'TEMPLATE_VERSION_CONFLICT');
  });

  it('rejects malformed sessions, rate decisions, and dependency throws before a write', async () => {
    const badSession = await post(
      harness({
        resolveSession: async () => ({
          ok: true,
          value: {
            userId: 'not-a-uuid',
            actingPartyId: partyId,
            capabilities: ['cms.template_designer'],
            mfaFresh: false,
          },
        }),
      }).app,
    );
    await expectError(badSession, 401, 'UNAUTHENTICATED');
    await expectError(
      await post(
        harness({
          resolveSession: async () => {
            throw new Error('private');
          },
        }).app,
      ),
      503,
      'DEPENDENCY_UNAVAILABLE',
    );
    await expectError(
      await post(
        harness({
          rateLimit: async () => ({
            ok: false,
            status: 503,
            code: 'PRIVATE',
            message: 'private',
          }),
        }).app,
      ),
      503,
      'DEPENDENCY_UNAVAILABLE',
    );
    await expectError(
      await post(
        harness({
          rateLimit: async () => {
            throw new Error('private');
          },
        }).app,
      ),
      503,
      'DEPENDENCY_UNAVAILABLE',
    );
    await expectError(
      await post(
        harness({
          rateLimit: async () => ({
            ok: true,
            value: {
              allowed: true,
              limit: 31,
              remaining: 31,
              resetAt: 60_000,
            },
          }),
        }).app,
      ),
      502,
      'DEPENDENCY_INVALID_RESPONSE',
    );
    await expectError(
      await post(
        harness({
          defineTemplate: async () => {
            throw new Error('private');
          },
        }).app,
      ),
      503,
      'DEPENDENCY_UNAVAILABLE',
    );
  });

  it('treats malformed dependency envelopes as 502 instead of an internal error', async () => {
    const invalid = null as never;
    await expectError(
      await post(
        harness({
          resolveSession: async () => invalid,
        }).app,
      ),
      502,
      'DEPENDENCY_INVALID_RESPONSE',
    );
    await expectError(
      await post(
        harness({
          rateLimit: async () => invalid,
        }).app,
      ),
      502,
      'DEPENDENCY_INVALID_RESPONSE',
    );
    await expectError(
      await post(
        harness({
          rateLimit: async () => ({ ok: true, value: null as never }),
        }).app,
      ),
      502,
      'DEPENDENCY_INVALID_RESPONSE',
    );
    await expectError(
      await post(
        harness({
          defineTemplate: async () => invalid,
        }).app,
      ),
      502,
      'DEPENDENCY_INVALID_RESPONSE',
    );
  });

  it('refuses mismatched or malformed success resources without forwarding them', async () => {
    const candidates = [
      { ...resource, ownerId: partyId },
      { ...resource, state: 'active' },
      { ...resource, templateKey: 'different-template' },
      { ...resource, version: '2' },
      { ...resource, compatibleTypeIds: [templateId] },
      { ...resource, reservedRegions: ['other'] },
    ];
    for (const candidate of candidates) {
      const response = await post(
        harness({
          defineTemplate: async () => ({
            ok: true,
            value: candidate as TemplateVersionResource,
          }),
        }).app,
      );
      await expectError(response, 502, 'DEPENDENCY_INVALID_RESPONSE');
    }
  });

  it('keeps the response stable when telemetry fails', async () => {
    const response = await post(
      harness({
        telemetry: () => {
          throw new Error('private telemetry');
        },
      }).app,
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(resource);
    const rejected = await post(
      harness({
        telemetry: async () => {
          throw new Error('private telemetry');
        },
      }).app,
    );
    expect(rejected.status).toBe(201);
    expect(await rejected.json()).toEqual(resource);
  });

  it('uses generated request IDs for absent IDs and rejects missing idempotency', async () => {
    const { app, defineTemplate } = harness();
    const response = await app.request(path, {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    expect(response.status).toBe(400);
    const payload = (await response.json()) as {
      requestId: string;
      code: string;
    };
    expect(payload.code).toBe('INVALID_REQUEST');
    expect(payload.requestId).toMatch(/^[0-9a-f-]{36}$/u);
    expect(response.headers.get('x-request-id')).toBe(payload.requestId);
    expect(defineTemplate).not.toHaveBeenCalled();
  });

  it('collapses an undeclared port status and rejects unsafe rate metadata', async () => {
    const unknown = await post(
      harness({
        defineTemplate: async () => ({
          ok: false,
          status: 418 as 500,
          code: 'PRIVATE',
          message: 'private',
        }),
      }).app,
    );
    await expectError(unknown, 500, 'INTERNAL_ERROR');
    const rate = await post(
      harness({
        defineTemplate: async () => ({
          ok: false,
          status: 429,
          code: 'RATE_LIMITED',
          message: 'private',
          details: { retryAfterSeconds: -1, limit: 'secret', resetAt: 1.5 },
        }),
      }).app,
    );
    expect(
      ((await rate.clone().json()) as { details: unknown }).details,
    ).toEqual({});
    await expectError(rate, 429, 'RATE_LIMITED');
  });

  it('times out a stalled session and prevents its late continuation from consuming quota', async () => {
    vi.useFakeTimers();
    try {
      let release!: (
        value: Awaited<ReturnType<CmsTemplateDependencies['resolveSession']>>,
      ) => void;
      const session = new Promise<
        Awaited<ReturnType<CmsTemplateDependencies['resolveSession']>>
      >((resolve) => {
        release = resolve;
      });
      const rateLimit = vi.fn(async (input: { limit: number }) => ({
        ok: true as const,
        value: {
          allowed: true,
          limit: input.limit,
          remaining: input.limit - 1,
          resetAt: 60_000,
        },
      }));
      const { app, defineTemplate } = harness({
        resolveSession: async () => session,
        rateLimit,
      });
      const pending = post(app);
      await vi.advanceTimersByTimeAsync(15_000);
      const response = await pending;
      await expectError(response, 504, 'DEPENDENCY_DEADLINE_EXCEEDED');
      expect(response.headers.get('retry-after')).toBe('15');
      release({
        ok: true,
        value: {
          userId: actorId,
          actingPartyId: partyId,
          capabilities: ['cms.template_designer'],
          mfaFresh: false,
        },
      });
      await vi.advanceTimersByTimeAsync(0);
      expect(rateLimit).not.toHaveBeenCalled();
      expect(defineTemplate).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not start the write when the second quota returns after the deadline', async () => {
    vi.useFakeTimers();
    try {
      let release!: (
        value: Awaited<ReturnType<CmsTemplateDependencies['rateLimit']>>,
      ) => void;
      const pendingRate = new Promise<
        Awaited<ReturnType<CmsTemplateDependencies['rateLimit']>>
      >((resolve) => {
        release = resolve;
      });
      const rateLimit = vi.fn(
        async (input: { limit: number; rateScope: string }) =>
          input.rateScope === 'party'
            ? pendingRate
            : {
                ok: true as const,
                value: {
                  allowed: true,
                  limit: input.limit,
                  remaining: input.limit - 1,
                  resetAt: 60_000,
                },
              },
      );
      const { app, defineTemplate } = harness({ rateLimit });
      const pending = post(app);
      await vi.advanceTimersByTimeAsync(15_000);
      await expectError(await pending, 504, 'DEPENDENCY_DEADLINE_EXCEEDED');
      release({
        ok: true,
        value: { allowed: true, limit: 60, remaining: 59, resetAt: 60_000 },
      });
      await vi.advanceTimersByTimeAsync(0);
      expect(rateLimit).toHaveBeenCalledTimes(2);
      expect(defineTemplate).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('scrubs an unexpected route exception as INTERNAL_ERROR', async () => {
    let calls = 0;
    const response = await post(
      harness({
        now: () => {
          calls += 1;
          if (calls > 1) throw new Error('private clock');
          return 0;
        },
        rateLimit: async (input) => ({
          ok: true,
          value: {
            allowed: false,
            limit: input.limit,
            remaining: 0,
            resetAt: 4_000,
          },
        }),
      }).app,
    );
    await expectError(response, 500, 'INTERNAL_ERROR');
  });

  it('merges additional headers into an error response without dropping 429 metadata', () => {
    const request = new Request('https://worker.example.test' + path, {
      method: 'POST',
      headers: { origin },
    });
    const dependencies = {
      humanOrigins: [origin],
      now: () => 0,
      resolveSession: async () => ({
        ok: true as const,
        value: {
          userId: actorId,
          actingPartyId: partyId,
          capabilities: ['cms.template_designer'],
          mfaFresh: false,
        },
      }),
      rateLimit: async (input: { limit: number }) => ({
        ok: true as const,
        value: {
          allowed: true,
          limit: input.limit,
          remaining: input.limit - 1,
          resetAt: 60_000,
        },
      }),
      defineTemplate: async () => ({ ok: true as const, value: resource }),
      readContext: async () => ({
        ok: true as const,
        value: { contentTypes: [], registeredBlocks: [] },
      }),
      readLatest: async () => ({
        ok: true as const,
        value: {
          id: templateId,
          version: '1',
          contentHash: digest,
          createdAt: '2026-09-27T12:00:00Z',
          updatedAt: '2026-09-27T12:00:00Z',
          state: 'draft',
          templateKey: 'profile-header',
          compatibleTypeIds: [typeId],
          reservedRegions: ['header'],
          blockRegistryDigest: digest,
          slots: [],
          bindings: {},
          locale: 'en-US',
          audience: 'public',
          templateVersion: 1,
        },
      }),
      telemetry: () => undefined,
    } satisfies CmsTemplateDependencies;
    const additional = new Headers({ 'x-tenant-id': 'tenant-42' });
    const response = errorResponse(
      request,
      dependencies,
      requestId,
      failure(429, { retryAfterSeconds: 15, limit: 60, resetAt: '60000' }, 15),
      additional,
    );
    expect(response.status).toBe(429);
    expect(response.headers.get('x-tenant-id')).toBe('tenant-42');
    expect(response.headers.get('retry-after')).toBe('15');
    expect(response.headers.get('ratelimit-limit')).toBe('60');
    expect(response.headers.get('ratelimit-reset')).toBe('60000');
    expect(response.headers.get('ratelimit-remaining')).toBe('0');
    expect(commonHeaders(request, dependencies, requestId).get('vary')).toBe(
      'Origin',
    );
  });
});

describe('BE00 middleware order on the CMS template version route', () => {
  const overridesFor = (
    state: HttpState,
  ): Partial<CmsTemplateDependencies> => ({
    ...(state.unauthenticated
      ? {
          resolveSession: async () => ({
            ok: false as const,
            status: 401 as const,
            code: 'UNAUTHENTICATED',
            message: 'No session.',
          }),
        }
      : {}),
    ...(state.capabilityDropped && !state.unauthenticated
      ? {
          resolveSession: async () => ({
            ok: true as const,
            value: {
              userId: actorId,
              actingPartyId: partyId,
              capabilities: [],
              mfaFresh: false,
            },
          }),
        }
      : {}),
    ...(state.rateExhausted
      ? {
          rateLimit: async (input: { limit: number }) => ({
            ok: true as const,
            value: {
              allowed: false,
              limit: input.limit,
              remaining: 0,
              resetAt: 60_000,
            },
          }),
        }
      : {}),
  });
  registerOrderTests<HttpState>({
    family: 'cms-template-version',
    fresh: () =>
      httpFresh(path, body, {
        origin,
        'content-type': 'application/json',
        'idempotency-key': 'template-create-0001',
        'x-request-id': requestId,
      }),
    // The template command route registers no query member and ignores a query
    // string today, so the strict-query step does not apply to it.
    steps: standardMutationSteps(
      httpAdapter({
        codes: {
          forbidden: 'TEMPLATE_FORBIDDEN',
          badRequest: 'INVALID_REQUEST',
          unauthenticated: 'UNAUTHENTICATED',
          validation: 'TEMPLATE_VALIDATION_FAILED',
          rateLimited: 'RATE_LIMITED',
        },
        oversize: { status: 400, code: 'INVALID_REQUEST' },
        badPath: null,
        badBody: {},
      }),
    ).filter((step) => step.name !== 'strict query validation'),
    send: (state) =>
      Promise.resolve(
        harness(overridesFor(state)).app.request(
          httpRequest(state, 'https://api.example.test'),
        ),
      ),
    accepted: (response) => expect(response.status).toBe(201),
  });
});

describe('BE00 step 2 body ceiling on the CMS template version route', () => {
  it('refuses a streamed body over the ceiling that declared no length', async () => {
    const { app, defineTemplate } = harness();
    const response = await post(app, {
      ...body,
      pad: 'x'.repeat(300_000),
    });
    expect(response.status).toBe(400);
    expect(defineTemplate).not.toHaveBeenCalled();
  });
});
