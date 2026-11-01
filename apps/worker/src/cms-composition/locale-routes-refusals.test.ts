import { describe, expect, it } from 'vitest';
import { platformRegistrySet } from '@wejammin/contracts';
import {
  createCmsLocaleApp,
  type CmsLocaleDependencies,
  type CmsLocaleError,
} from './locale-routes';
import {
  entryId,
  fieldId,
  request,
  deps,
  portError,
} from './locale-routes.test-support';

describe('CMS-03C-04 locale authoring route', () => {
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
                reasonCode: 'capability_missing',
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
          details: { reasonCode: 'capability_missing' },
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

  it('[P2-S12-AC-236] returns locale_limit_reached on the 409 of a 33rd locale variant and nothing else', async () => {
    const respond = async (
      status: 400 | 403 | 404 | 409 | 422 | 503,
      details: Readonly<Record<string, unknown>>,
    ) => {
      const response = await createCmsLocaleApp(
        deps({ authorLocale: async () => portError(status, details) }),
      ).request(request());
      expect(response.status).toBe(status);
      return ((await response.json()) as { details: Record<string, unknown> })
        .details;
    };
    expect(
      await respond(409, {
        reasonCode: 'locale_limit_reached',
        expectedVersion: '3',
        secret: 'never-leak',
      }),
    ).toEqual({ reasonCode: 'locale_limit_reached', expectedVersion: '3' });
    expect(await respond(409, { reasonCode: 'locale_limit_exceeded' })).toEqual(
      {},
    );
    for (const status of [400, 403, 404, 422, 503] as const)
      expect(
        await respond(status, { reasonCode: 'locale_limit_reached' }),
      ).not.toHaveProperty('reasonCode');
  });

  it('[P2-S12-AC-150] keeps the CMS-03C-20 resolver out of the browser route inventory and the locale app', async () => {
    const operations = platformRegistrySet.routes.map(
      ({ operationId }) => operationId,
    );
    expect(operations).toContain('CMS-03C-04');
    for (const internal of [
      'CMS-03C-18',
      'CMS-03C-19',
      'CMS-03C-20',
      'CMS-03C-21',
    ])
      expect(operations).not.toContain(internal);
    expect(
      platformRegistrySet.routes
        .filter(({ path: routePath }) => routePath.includes('/locales/'))
        .map(({ method, path: routePath }) => `${method} ${routePath}`),
    ).toEqual([
      'POST /api/v1/cms/entries/{entryId}/locales/{locale}/variants',
      // DEC-205 (BE03c route registry): the protected variant read is the one served GET; the resolver itself has no route.
      'GET /api/v1/cms/entries/{entryId}/locales/{locale}',
    ]);
    const app = createCmsLocaleApp(deps());
    for (const probe of [
      '/api/v1/cms/locale-resolutions',
      `/api/v1/cms/entries/${entryId}/locales/fr-FR/resolutions`,
      `/api/v1/cms/entries/${entryId}/locales/fr-FR/fields/${fieldId}`,
    ]) {
      expect((await app.request(probe)).status).toBe(404);
      expect(
        (await app.request(probe, { method: 'POST', body: '{}' })).status,
      ).toBe(404);
    }
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
});
