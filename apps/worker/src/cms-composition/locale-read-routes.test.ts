import { ApiErrorSchema, LocaleVariantReadSchema } from '@wejammin/contracts';
import { describe, expect, it, vi } from 'vitest';

import {
  entryId,
  READ_PATH,
  readDeps,
  readRequest,
  REQUEST_ID,
  translatedRead,
  untranslatedRead,
} from './locale-read.test-support';
import {
  createCmsLocaleApp,
  type CmsLocaleDependencies,
} from './locale-routes';

const serving = (value = translatedRead()) =>
  vi.fn<CmsLocaleDependencies['readLocaleVariant']>(async () => ({
    ok: true,
    value,
  }));

describe('cmsLocaleVariantRead route (DEC-205)', () => {
  it('answers 200 with the strict read, no-store, the request id and the allowed origin', async () => {
    const response = await createCmsLocaleApp(
      readDeps({ readLocaleVariant: serving() }),
    ).request(readRequest());
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe(
      'application/json; charset=UTF-8',
    );
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-request-id')).toBe(REQUEST_ID);
    expect(response.headers.get('access-control-allow-origin')).toBe(
      'https://cms.example.test',
    );
    expect(response.headers.get('etag')).toBeNull();
    expect(LocaleVariantReadSchema.parse(await response.json())).toEqual(
      translatedRead(),
    );
  });

  it('answers 200 with an explicit null variant for an untranslated locale', async () => {
    const response = await createCmsLocaleApp(
      readDeps({
        readLocaleVariant: async () => ({
          ok: true,
          value: untranslatedRead(),
        }),
      }),
    ).request(readRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(untranslatedRead());
  });

  it('hands the port the operation, the verified session, the request id and the path only', async () => {
    const read = serving();
    await createCmsLocaleApp(readDeps({ readLocaleVariant: read })).request(
      readRequest(),
    );
    expect(read).toHaveBeenCalledTimes(1);
    const input = read.mock.calls[0]?.[0];
    expect(input?.operationId).toBe('cmsLocaleVariantRead');
    expect(input?.requestId).toBe(REQUEST_ID);
    expect(input?.path).toEqual({ entryId, locale: 'fr-FR' });
    expect(input?.session).toMatchObject({
      actingPartyId: 'd1000000-0000-4000-8000-000000000007',
    });
    expect(Object.keys(input ?? {}).sort()).toEqual([
      'operationId',
      'path',
      'request',
      'requestId',
      'session',
    ]);
  });

  it('charges the user bucket (300) then the party bucket (600) of the read class before the port', async () => {
    const order: string[] = [];
    const rateLimit = vi.fn(
      async (input: { rateScope: string; limit: number }) => {
        order.push(`rate:${input.rateScope}`);
        return {
          ok: true as const,
          value: {
            allowed: true,
            limit: input.limit,
            remaining: input.limit - 1,
            resetAt: 2_000,
          },
        };
      },
    );
    await createCmsLocaleApp(
      readDeps({
        rateLimit,
        readLocaleVariant: async () => {
          order.push('port');
          return { ok: true, value: translatedRead() };
        },
      }),
    ).request(readRequest());
    expect(order).toEqual(['rate:user', 'rate:party', 'port']);
    expect(rateLimit.mock.calls[0]?.[0]).toMatchObject({
      operationId: 'cmsLocaleVariantRead',
      rateClass: 'cms-locale-read',
      rateScope: 'user',
      actorId: 'd1000000-0000-4000-8000-000000000006',
      actingPartyId: 'd1000000-0000-4000-8000-000000000007',
      principalClass: 'human',
      limit: 300,
      windowSeconds: 60,
    });
    expect(rateLimit.mock.calls[1]?.[0]).toMatchObject({
      rateScope: 'party',
      actorId: 'd1000000-0000-4000-8000-000000000007',
      limit: 600,
      rateClass: 'cms-locale-read',
    });
  });

  it('answers 429 with Retry-After from either bucket and never reaches the port', async () => {
    for (const denied of ['user', 'party'] as const) {
      const read = serving();
      const response = await createCmsLocaleApp(
        readDeps({
          readLocaleVariant: read,
          rateLimit: async (input) => ({
            ok: true,
            value: {
              allowed: input.rateScope !== denied,
              limit: input.limit,
              remaining: input.rateScope === denied ? 0 : input.limit - 1,
              resetAt: 31,
            },
          }),
        }),
      ).request(readRequest());
      expect(response.status, denied).toBe(429);
      expect(response.headers.get('retry-after')).toBe('30');
      expect(response.headers.get('ratelimit-limit')).toBe(
        denied === 'user' ? '300' : '600',
      );
      const error = ApiErrorSchema.parse(await response.json());
      expect(error.code).toBe('RATE_LIMITED');
      expect(error.details).toEqual({
        retryAfterSeconds: 30,
        limit: denied === 'user' ? 300 : 600,
        resetAt: '31',
      });
      expect(read).not.toHaveBeenCalled();
    }
  });

  it('refuses a decision whose limit is not the bucket limit as a dependency failure', async () => {
    const read = serving();
    const response = await createCmsLocaleApp(
      readDeps({
        readLocaleVariant: read,
        rateLimit: async () => ({
          ok: true,
          value: { allowed: true, limit: 60, remaining: 59, resetAt: 2_000 },
        }),
      }),
    ).request(readRequest());
    expect(response.status).toBe(502);
    expect(read).not.toHaveBeenCalled();
  });

  it('answers the preflight for GET on the read path for an allowed origin only', async () => {
    const app = createCmsLocaleApp(readDeps());
    const allowed = await app.request(READ_PATH, {
      method: 'OPTIONS',
      headers: { origin: 'https://cms.example.test' },
    });
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get('access-control-allow-methods')).toBe(
      'GET, OPTIONS',
    );
    expect(allowed.headers.get('access-control-allow-headers')).toBe(
      'X-Request-Id',
    );
    const refused = await app.request(READ_PATH, {
      method: 'OPTIONS',
      headers: { origin: 'https://evil.example.test' },
    });
    expect(refused.status).toBe(403);
  });

  it('keeps the write path preflight POST-only', async () => {
    const allowed = await createCmsLocaleApp(readDeps()).request(
      `${READ_PATH}/variants`,
      { method: 'OPTIONS', headers: { origin: 'https://cms.example.test' } },
    );
    expect(allowed.headers.get('access-control-allow-methods')).toBe(
      'POST, OPTIONS',
    );
  });

  it('serves no other method on the read path', async () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE'])
      expect(
        (
          await createCmsLocaleApp(readDeps()).request(READ_PATH, {
            method,
            headers: { origin: 'https://cms.example.test' },
          })
        ).status,
        method,
      ).toBe(404);
  });

  it('emits one telemetry event named for the read with its outcome', async () => {
    const telemetry = vi.fn();
    await createCmsLocaleApp(
      readDeps({ telemetry, readLocaleVariant: serving() }),
    ).request(readRequest());
    expect(telemetry).toHaveBeenCalledTimes(1);
    expect(telemetry.mock.calls[0]?.[0]).toMatchObject({
      operationId: 'cmsLocaleVariantRead',
      requestId: REQUEST_ID,
      status: 200,
      outcome: 'success',
      actorClass: 'human',
    });
  });

  it('survives a telemetry failure unchanged', async () => {
    for (const telemetry of [
      () => {
        throw new Error('sink');
      },
      async () => {
        throw new Error('sink');
      },
    ]) {
      const response = await createCmsLocaleApp(
        readDeps({ telemetry, readLocaleVariant: serving() }),
      ).request(readRequest());
      expect(response.status).toBe(200);
    }
  });

  it('echoes the entry in the path to the port exactly, whatever the locale case', async () => {
    const read = serving(translatedRead({ locale: 'fr-fr' }));
    const response = await createCmsLocaleApp(
      readDeps({ readLocaleVariant: read }),
    ).request(readRequest({}, `/api/v1/cms/entries/${entryId}/locales/fr-fr`));
    expect(read.mock.calls[0]?.[0].path).toEqual({
      entryId,
      locale: 'fr-fr',
    });
    expect(response.status).toBe(200);
  });
});
