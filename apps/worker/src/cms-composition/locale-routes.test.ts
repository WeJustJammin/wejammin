import { describe, expect, it, vi } from 'vitest';
import type { LocaleVariantResource } from '@wejammin/contracts';

import {
  createCmsLocaleApp,
  type CmsLocaleDependencies,
  type CmsLocaleError,
} from './locale-routes';

const entryId = 'd1000000-0000-4000-8000-000000000001';
const sourceRevisionId = 'd1000000-0000-4000-8000-000000000002';
const revisionId = 'd1000000-0000-4000-8000-000000000003';
const variantId = 'd1000000-0000-4000-8000-000000000004';
const fieldId = 'd1000000-0000-4000-8000-000000000005';
const origin = 'https://cms.example.test';
const path = `/api/v1/cms/entries/${entryId}/locales/fr-FR/variants`;
const body = {
  entryId,
  locale: 'fr-FR',
  sourceRevisionId,
  fields: [{ fieldId, value: 'Titre traduit' }],
  fallbackChain: ['en-US'],
  noFallbackFieldIds: [],
  sourceHash: 'a'.repeat(64),
  expectedVersion: '1',
};
const resource: LocaleVariantResource = {
  id: variantId,
  version: '1',
  contentHash: 'b'.repeat(64),
  createdAt: '2026-09-27T12:00:00.000Z',
  updatedAt: '2026-09-27T12:00:00.000Z',
  state: 'draft',
  entryId,
  revisionId,
  locale: 'fr-FR',
  sourceRevisionId,
  fallbackChain: ['en-US'],
  noFallbackFieldIds: [],
};

const request = (
  overrides: {
    path?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
) =>
  new Request(`https://api.example.test${overrides.path ?? path}`, {
    method: 'POST',
    headers: {
      origin,
      'content-type': 'application/json',
      'idempotency-key': 'locale-command-0001',
      'if-match': '"1"',
      ...overrides.headers,
    },
    body: JSON.stringify(overrides.body ?? body),
  });

const deps = (
  overrides: Partial<CmsLocaleDependencies> = {},
): CmsLocaleDependencies => ({
  humanOrigins: [origin],
  now: () => 1_000,
  resolveSession: async () => ({
    ok: true,
    value: {
      userId: 'd1000000-0000-4000-8000-000000000006',
      actingPartyId: 'd1000000-0000-4000-8000-000000000007',
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
  authorLocale: async () => ({ ok: true, value: resource }),
  telemetry: () => undefined,
  ...overrides,
});
const portError = (
  status: CmsLocaleError['status'],
  details?: Readonly<Record<string, unknown>>,
  retryAfterSeconds?: number,
): CmsLocaleError => ({
  ok: false,
  status,
  code: 'UNTRUSTED',
  message: 'private provider text must not escape',
  ...(details === undefined ? {} : { details }),
  ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
});

describe('CMS-03C-04 locale authoring route', () => {
  it('returns a strict draft resource and aggregate ETag after two rate buckets', async () => {
    const rateLimit = vi.fn(deps().rateLimit);
    const authorLocale = vi.fn(deps().authorLocale);
    const response = await createCmsLocaleApp(
      deps({ rateLimit, authorLocale }),
    ).request(request());
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(resource);
    expect(response.headers.get('etag')).toBe('"2"');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(rateLimit).toHaveBeenCalledTimes(2);
    expect(
      rateLimit.mock.calls.map(([input]) => [input.rateScope, input.limit]),
    ).toEqual([
      ['user', 60],
      ['party', 120],
    ]);
    expect(authorLocale).toHaveBeenCalledWith(
      expect.objectContaining({
        operationId: 'CMS-03C-04',
        body,
        path: { entryId, locale: 'fr-FR' },
        ifMatch: '1',
      }),
      expect.any(AbortSignal),
    );
  });

  it('rejects path/body mismatch before identity or persistence', async () => {
    const resolveSession = vi.fn(deps().resolveSession);
    const response = await createCmsLocaleApp(deps({ resolveSession })).request(
      request({ body: { ...body, locale: 'de-DE' } }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'INVALID_REQUEST' });
    expect(resolveSession).not.toHaveBeenCalled();
  });

  it('rejects stale/missing If-Match and non-JSON payloads', async () => {
    const app = createCmsLocaleApp(deps());
    expect(
      (await app.request(request({ headers: { 'if-match': '"2"' } }))).status,
    ).toBe(400);
    expect(
      (
        await app.request(
          request({ headers: { 'content-type': 'text/plain' } }),
        )
      ).status,
    ).toBe(415);
  });

  it('requires assignment-capable human context and valid origin', async () => {
    const authorLocale = vi.fn(deps().authorLocale);
    const app = createCmsLocaleApp(
      deps({
        authorLocale,
        resolveSession: async () => ({
          ok: true,
          value: {
            userId: 'd1000000-0000-4000-8000-000000000006',
            actingPartyId: 'd1000000-0000-4000-8000-000000000007',
            capabilities: [],
            mfaFresh: true,
          },
        }),
      }),
    );
    const denied = await app.request(request());
    expect(denied.status).toBe(403);
    expect(await denied.json()).toMatchObject({ code: 'LOCALE_FORBIDDEN' });
    expect(authorLocale).not.toHaveBeenCalled();
    expect(
      (await app.request(request({ headers: { origin: 'https://bad.test' } })))
        .status,
    ).toBe(403);
  });

  it('does not accept malformed dependency success or leak provider errors', async () => {
    const app = createCmsLocaleApp(
      deps({
        authorLocale: async () => ({
          ok: true,
          value: { ...resource, ownerId: entryId } as never,
        }),
      }),
    );
    const response = await app.request(request());
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      code: 'DEPENDENCY_INVALID_RESPONSE',
    });
  });

  it('enforces CORS preflight without revealing a hidden route', async () => {
    const app = createCmsLocaleApp(deps());
    const accepted = await app.request(path, {
      method: 'OPTIONS',
      headers: { origin, 'x-request-id': entryId },
    });
    expect(accepted.status).toBe(204);
    expect(accepted.headers.get('access-control-allow-methods')).toBe(
      'POST, OPTIONS',
    );
    for (const headers of [{}, { origin: 'https://bad.test' }]) {
      const denied = await app.request(path, { method: 'OPTIONS', headers });
      expect(denied.status).toBe(403);
      expect(denied.headers.get('access-control-allow-origin')).toBeNull();
    }
  });

  it('rejects malformed path, query, headers, body and cookie CSRF before session', async () => {
    const resolveSession = vi.fn(deps().resolveSession);
    const app = createCmsLocaleApp(deps({ resolveSession }));
    const invalidRequests = [
      request({
        path: '/api/v1/cms/entries/not-a-uuid/locales/fr-FR/variants',
      }),
      request({ path: `${path}?probe=1` }),
      request({ headers: { 'idempotency-key': 'short' } }),
      request({ headers: { 'if-match': 'W/"1"' } }),
      request({ headers: { cookie: 'wj_session_ref=abc' } }),
      request({ body: { ...body, unknown: true } }),
      request({ body: { ...body, entryId: sourceRevisionId } }),
    ];
    for (const candidate of invalidRequests) {
      const response = await app.request(candidate);
      expect(response.status).toBeGreaterThanOrEqual(400);
    }
    const brokenJson = new Request(`https://api.example.test${path}`, {
      method: 'POST',
      headers: {
        origin,
        'content-type': 'application/json',
        'idempotency-key': 'locale-command-0001',
        'if-match': '"1"',
      },
      body: '{',
    });
    expect((await app.request(brokenJson)).status).toBe(400);
    for (const headerName of ['idempotency-key', 'if-match'] as const) {
      const missing = request();
      missing.headers.delete(headerName);
      expect((await app.request(missing)).status).toBe(400);
    }
    expect(resolveSession).not.toHaveBeenCalled();
  });

  it('fails closed on invalid session envelopes and resolver outages', async () => {
    const results: Array<{
      resolveSession: CmsLocaleDependencies['resolveSession'];
      status: number;
    }> = [
      {
        resolveSession: async () => {
          throw new Error('provider secret');
        },
        status: 503,
      },
      { resolveSession: async () => null as never, status: 502 },
      { resolveSession: async () => [] as never, status: 502 },
      { resolveSession: async () => ({ ok: true }) as never, status: 502 },
      { resolveSession: async () => ({ ok: false }) as never, status: 502 },
      { resolveSession: async () => portError(401), status: 401 },
      {
        resolveSession: async () => ({ ok: true, value: {} as never }),
        status: 401,
      },
      {
        resolveSession: async () => ({
          ok: true,
          value: {
            ...(
              (await deps().resolveSession(
                request(),
                new AbortController().signal,
              )) as {
                ok: true;
                value: {
                  userId: string;
                  actingPartyId: string;
                  capabilities: string[];
                  mfaFresh: boolean;
                };
              }
            ).value,
            userId: 'bad',
          },
        }),
        status: 401,
      },
    ];
    for (const item of results) {
      const response = await createCmsLocaleApp(
        deps({ resolveSession: item.resolveSession }),
      ).request(request());
      expect(response.status).toBe(item.status);
      expect(JSON.stringify(await response.json())).not.toContain(
        'provider secret',
      );
    }
    const noParty = await createCmsLocaleApp(
      deps({
        resolveSession: async () => ({
          ok: true,
          value: {
            userId: entryId,
            actingPartyId: null,
            capabilities: ['cms.editor'],
            mfaFresh: true,
          },
        }),
      }),
    ).request(request());
    expect(noParty.status).toBe(403);
  });

  it('checks both rate buckets, validates decisions, and returns Retry-After', async () => {
    const invalidDecisions = [
      null,
      [],
      {},
      { allowed: 'yes', limit: 60, remaining: 1, resetAt: 2000 },
      { allowed: true, limit: 59, remaining: 1, resetAt: 2000 },
      { allowed: true, limit: 60, remaining: -1, resetAt: 2000 },
      { allowed: true, limit: 60, remaining: 61, resetAt: 2000 },
      { allowed: true, limit: 60, remaining: 1.5, resetAt: 2000 },
      { allowed: true, limit: 60, remaining: 1, resetAt: -1 },
      { allowed: true, limit: 60, remaining: 1, resetAt: 1.5 },
    ];
    for (const value of invalidDecisions) {
      const response = await createCmsLocaleApp(
        deps({
          rateLimit: async () => ({ ok: true, value }) as never,
        }),
      ).request(request());
      expect(response.status).toBe(502);
    }
    const dependencyCases: Array<CmsLocaleDependencies['rateLimit']> = [
      async () => {
        throw new Error('rate provider');
      },
      async () => null as never,
      async () => portError(503, {}, 5),
    ];
    for (const rateLimit of dependencyCases) {
      const response = await createCmsLocaleApp(deps({ rateLimit })).request(
        request(),
      );
      expect(response.status).toBeGreaterThanOrEqual(502);
    }
    const denied = await createCmsLocaleApp(
      deps({
        rateLimit: async (input) => ({
          ok: true,
          value: {
            allowed: input.rateScope === 'user',
            limit: input.limit,
            remaining: 0,
            resetAt: 2,
          },
        }),
      }),
    ).request(request());
    expect(denied.status).toBe(429);
    expect(denied.headers.get('retry-after')).toBe('1');
    expect(denied.headers.get('ratelimit-limit')).toBe('120');
    expect(await denied.json()).toMatchObject({
      code: 'RATE_LIMITED',
      details: {
        limit: 120,
        retryAfterSeconds: 1,
        resetAt: '2',
      },
    });
    const editorOnly = await createCmsLocaleApp(
      deps({
        resolveSession: async () => ({
          ok: true,
          value: {
            userId: 'd1000000-0000-4000-8000-000000000006',
            actingPartyId: 'd1000000-0000-4000-8000-000000000007',
            capabilities: ['cms.editor'],
            mfaFresh: true,
          },
        }),
      }),
    ).request(request());
    expect(editorOnly.status).toBe(201);
  });

  it('scrubs all provider status codes and unsafe details', async () => {
    const statuses: CmsLocaleError['status'][] = [
      400, 401, 403, 404, 409, 415, 422, 429, 500, 502, 503, 504,
    ];
    for (const status of statuses) {
      const response = await createCmsLocaleApp(
        deps({
          authorLocale: async () =>
            portError(
              status,
              {
                secret: 'never-leak',
                reasonCode: 'CAPABILITY_REQUIRED',
                expectedVersion: '1',
                currentVersion: '2',
                limit: 60,
                retryAfterSeconds: 4,
                resetAt: 2000,
              },
              status === 429 || status === 503 ? 4 : undefined,
            ),
        }),
      ).request(request());
      expect(response.status).toBe(status);
      const payload = await response.json();
      expect(JSON.stringify(payload)).not.toContain('never-leak');
      if (status === 409)
        expect(payload).toMatchObject({
          details: {
            expectedVersion: '1',
            currentVersion: '2',
          },
        });
      if (status === 401)
        expect(payload).toMatchObject({
          details: { recoveryAction: 'reauthenticate' },
        });
      if (status === 403)
        expect(payload).toMatchObject({
          details: { reasonCode: 'CAPABILITY_REQUIRED' },
        });
      if (status === 503) expect(response.headers.get('retry-after')).toBe('4');
    }
    for (const details of [
      null,
      [],
      { reasonCode: 'NOT_ALLOWED' },
      { expectedVersion: '0', currentVersion: 'bad' },
      { limit: -1, retryAfterSeconds: 'secret', resetAt: 1.5 },
    ]) {
      const response = await createCmsLocaleApp(
        deps({
          authorLocale: async () => portError(409, details as never),
        }),
      ).request(request());
      expect(JSON.stringify(await response.json())).not.toContain('secret');
    }
    const invalidRateDetail = await createCmsLocaleApp(
      deps({
        authorLocale: async () =>
          portError(
            429,
            {
              retryAfterSeconds: -1,
              limit: 1.5,
              resetAt: 'bad',
            },
            0,
          ),
      }),
    ).request(request());
    expect(invalidRateDetail.status).toBe(429);
    expect(invalidRateDetail.headers.get('retry-after')).toBeNull();
    expect(await invalidRateDetail.json()).toMatchObject({ details: {} });
  });

  it('returns the active chain on a fallback-chain mismatch and nothing else', async () => {
    const respond = async (details: Readonly<Record<string, unknown>>) => {
      const response = await createCmsLocaleApp(
        deps({ authorLocale: async () => portError(409, details) }),
      ).request(request());
      expect(response.status).toBe(409);
      const payload = (await response.json()) as {
        code: string;
        details: Record<string, unknown>;
      };
      expect(payload.code).toBe('LOCALE_VERSION_CONFLICT');
      return payload.details;
    };
    expect(
      await respond({
        reasonCode: 'FALLBACK_CHAIN_MISMATCH',
        activeFallbackChain: ['fr-FR', 'en-US'],
        expectedVersion: '1',
        currentVersion: '2',
        secret: 'never-leak',
      }),
    ).toEqual({
      reasonCode: 'FALLBACK_CHAIN_MISMATCH',
      activeFallbackChain: ['fr-FR', 'en-US'],
      expectedVersion: '1',
      currentVersion: '2',
    });
    expect(
      await respond({
        reasonCode: 'FALLBACK_CHAIN_MISMATCH',
        activeFallbackChain: [],
      }),
    ).toEqual({
      reasonCode: 'FALLBACK_CHAIN_MISMATCH',
      activeFallbackChain: [],
    });
    for (const unsafe of [
      { reasonCode: 'FALLBACK_CHAIN_MISMATCH' },
      { reasonCode: 'FALLBACK_CHAIN_MISMATCH', activeFallbackChain: 'en-US' },
      {
        reasonCode: 'FALLBACK_CHAIN_MISMATCH',
        activeFallbackChain: Array.from({ length: 17 }, () => 'fr'),
      },
      { reasonCode: 'FALLBACK_CHAIN_MISMATCH', activeFallbackChain: ['en_US'] },
      { reasonCode: 'FALLBACK_CHAIN_MISMATCH', activeFallbackChain: ['en-us'] },
      { reasonCode: 'FALLBACK_CHAIN_MISMATCH', activeFallbackChain: [7] },
      { reasonCode: 'SOMETHING_ELSE', activeFallbackChain: ['en-US'] },
      { activeFallbackChain: ['en-US'] },
    ])
      expect(await respond(unsafe)).toEqual({});
  });

  it('never returns the active chain on a non-409 status', async () => {
    for (const status of [400, 403, 404, 422, 503] as const) {
      const response = await createCmsLocaleApp(
        deps({
          authorLocale: async () =>
            portError(status, {
              reasonCode: 'FALLBACK_CHAIN_MISMATCH',
              activeFallbackChain: ['en-US'],
            }),
        }),
      ).request(request());
      expect(JSON.stringify(await response.json())).not.toContain(
        'activeFallbackChain',
      );
    }
  });

  it('publishes the BE00 429 contract with second-granularity reset and matching headers', async () => {
    const response = await createCmsLocaleApp(
      deps({
        now: () => 1_000,
        rateLimit: async (input) => ({
          ok: true,
          value: {
            allowed: input.rateScope === 'user',
            limit: input.limit,
            remaining: 0,
            resetAt: 2,
          },
        }),
      }),
    ).request(request());
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('1');
    expect(response.headers.get('ratelimit-limit')).toBe('120');
    expect(response.headers.get('ratelimit-remaining')).toBe('0');
    expect(response.headers.get('ratelimit-reset')).toBe('2');
    expect(await response.json()).toMatchObject({
      code: 'RATE_LIMITED',
      details: { limit: 120, retryAfterSeconds: 1, resetAt: '2' },
    });
  });

  it('does not accept success for another state, entry, locale, source or fallback', async () => {
    const wrong = [
      { ...resource, state: 'approved' },
      { ...resource, entryId: sourceRevisionId },
      { ...resource, locale: 'de-DE' },
      { ...resource, sourceRevisionId: revisionId },
      { ...resource, fallbackChain: [] },
      { ...resource, noFallbackFieldIds: [fieldId] },
    ];
    for (const value of wrong) {
      const response = await createCmsLocaleApp(
        deps({
          authorLocale: async () => ({ ok: true, value: value as never }),
        }),
      ).request(request());
      expect(response.status).toBe(502);
    }
  });

  it('fences rejected ports, thrown ports, and a deadline without provider prose', async () => {
    for (const authorLocale of [
      async () => {
        throw new Error('private provider prose');
      },
      async () => null as never,
      async () => ({ ok: false, status: 599 }) as never,
      async () => ({ ok: true }) as never,
    ]) {
      const response = await createCmsLocaleApp(deps({ authorLocale })).request(
        request(),
      );
      expect(response.status).toBeGreaterThanOrEqual(500);
      expect(JSON.stringify(await response.json())).not.toContain(
        'private provider prose',
      );
    }
    vi.useFakeTimers();
    try {
      const pending = createCmsLocaleApp(
        deps({
          resolveSession: async () => new Promise(() => undefined),
        }),
      ).request(request());
      await vi.advanceTimersByTimeAsync(15_000);
      const response = await pending;
      expect(response.status).toBe(504);
    } finally {
      vi.useRealTimers();
    }
  });

  it('handles an abort between rate buckets and telemetry failures after response', async () => {
    vi.useFakeTimers();
    try {
      const pending = createCmsLocaleApp(
        deps({
          rateLimit: async (input) => {
            await new Promise((resolve) => setTimeout(resolve, 15_001));
            return {
              ok: true,
              value: {
                allowed: true,
                limit: input.limit,
                remaining: input.limit - 1,
                resetAt: 20_000,
              },
            };
          },
        }),
      ).request(request());
      await vi.advanceTimersByTimeAsync(15_001);
      expect((await pending).status).toBe(504);
    } finally {
      vi.useRealTimers();
    }
    const telemetry = vi.fn(async () => {
      throw new Error('telemetry is down');
    });
    const response = await createCmsLocaleApp(deps({ telemetry })).request(
      request(),
    );
    expect(response.status).toBe(201);
    expect(telemetry).toHaveBeenCalledOnce();
    const throwingTelemetry = await createCmsLocaleApp(
      deps({
        telemetry: () => {
          throw new Error('sync telemetry');
        },
      }),
    ).request(request());
    expect(throwingTelemetry.status).toBe(201);
  });

  it('normalizes unexpected execution exceptions to a scrubbed 500', async () => {
    const response = await createCmsLocaleApp(
      deps({
        resolveSession: async () => ({
          ok: true,
          value: {
            userId: entryId,
            actingPartyId: sourceRevisionId,
            get capabilities(): readonly string[] {
              throw new Error('private session value');
            },
            mfaFresh: true,
          },
        }),
      }),
    ).request(request());
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain(
      'private session value',
    );
  });
});
