import { describe, expect, it, vi } from 'vitest';
import {
  createCmsLocaleApp,
  type CmsLocaleDependencies,
} from './locale-routes';
import {
  entryId,
  sourceRevisionId,
  origin,
  path,
  body,
  resource,
  request,
  deps,
  portError,
} from './locale-routes.test-support';

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

  it('rejects path/body mismatch after authentication and before authorization or persistence', async () => {
    const authorLocale = vi.fn(deps().authorLocale);
    const rateLimit = vi.fn(deps().rateLimit);
    const response = await createCmsLocaleApp(
      deps({ authorLocale, rateLimit }),
    ).request(request({ body: { ...body, locale: 'de-DE' } }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'INVALID_REQUEST' });
    expect(rateLimit).not.toHaveBeenCalled();
    expect(authorLocale).not.toHaveBeenCalled();
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
      code: 'DEPENDENCY_UNAVAILABLE',
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

  it('rejects malformed path, query, headers, body and cookie CSRF before persistence', async () => {
    const resolveSession = vi.fn(deps().resolveSession);
    const authorLocale = vi.fn(deps().authorLocale);
    const app = createCmsLocaleApp(deps({ resolveSession, authorLocale }));
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
    // Only the cookie-CSRF request (BE00 step 2) never reaches the session.
    expect(resolveSession).toHaveBeenCalledTimes(9);
    expect(authorLocale).not.toHaveBeenCalled();
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
});
