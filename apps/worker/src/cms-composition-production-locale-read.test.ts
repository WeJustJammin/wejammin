import { describe, expect, it, vi } from 'vitest';

import { createProductionCmsLocaleDependencies } from './cms-composition-production-locale';
import {
  READ_PATH,
  readRequest,
  translatedRead,
  untranslatedRead,
} from './cms-composition/locale-read.test-support';
import {
  createCmsLocaleApp,
  type CmsLocaleReadInput,
} from './cms-composition/locale-routes';
import {
  environment,
  PARTY_ID,
  REQUEST_ID,
  USER_ID,
} from './cms-editorial-production.test-support';

const RPC = 'https://supabase.example.test/rest/v1/rpc/cms_get_locale_variant';
const entryId = 'd1000000-0000-4000-8000-000000000001';

const input = (
  overrides: Partial<CmsLocaleReadInput> = {},
): CmsLocaleReadInput => ({
  operationId: 'cmsLocaleVariantRead',
  request: new Request(`https://api.example.test${READ_PATH}`, {
    headers: { 'x-correlation-id': REQUEST_ID },
  }),
  requestId: REQUEST_ID,
  session: {
    userId: USER_ID,
    actingPartyId: PARTY_ID,
    capabilities: ['cms.author'],
    mfaFresh: false,
  },
  path: { entryId, locale: 'fr-FR' },
  ...overrides,
});
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
const raised = (message: string, details: string | null = null, status = 400) =>
  json({ code: 'P0001', message, details, hint: null }, status);
const create = (fetchImpl: typeof fetch, extra: object = {}) =>
  createProductionCmsLocaleDependencies({
    environment,
    fetchImpl,
    humanOrigins: ['https://cms.example.test'],
    now: () => 1_000,
    resolveSession: async () => ({ ok: true, value: input().session }),
    rateLimit: async (limitInput) => ({
      ok: true,
      value: {
        allowed: true,
        limit: limitInput.limit,
        remaining: limitInput.limit - 1,
        resetAt: 2_000,
      },
    }),
    ...extra,
  });
const signal = () => new AbortController().signal;
const readAs = (
  fetchImpl: typeof fetch,
  overrides: Partial<CmsLocaleReadInput> = {},
) => create(fetchImpl).readLocaleVariant(input(overrides), signal());

describe('cmsLocaleVariantRead production adapter (DEC-205)', () => {
  it('calls only the named read RPC with the server-bound context, entry and locale', async () => {
    const fetchImpl = vi.fn(async () => json(translatedRead()));
    const result = await readAs(fetchImpl as typeof fetch);
    expect(result).toEqual({ ok: true, value: translatedRead() });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(RPC);
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers['X-Operation-Id']).toBe('cmsLocaleVariantRead');
    expect(headers['Accept-Profile']).toBe('platform_api');
    expect(headers['Content-Profile']).toBe('platform_api');
    expect(headers).not.toHaveProperty('X-Idempotency-Key');
    expect(headers).not.toHaveProperty('If-Match');
    const sent = JSON.parse(String(init.body)) as {
      p_request: Record<string, unknown>;
    };
    expect(Object.keys(sent)).toEqual(['p_request']);
    expect(Object.keys(sent.p_request).sort()).toEqual([
      'context',
      'correlationId',
      'entryId',
      'locale',
    ]);
    expect(sent.p_request).toMatchObject({
      entryId,
      locale: 'fr-FR',
      context: { authUserId: USER_ID, actingPartyId: PARTY_ID },
    });
  });

  it('answers an explicit null variant and sends the canonical lower-case entry id', async () => {
    const fetchImpl = vi.fn(async () => json(untranslatedRead()));
    const result = await readAs(fetchImpl as typeof fetch, {
      path: { entryId: entryId.toUpperCase(), locale: 'fr-FR' },
    });
    expect(result).toEqual({ ok: true, value: untranslatedRead() });
    const sent = JSON.parse(
      String(
        (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body,
      ),
    ) as { p_request: { entryId: string } };
    expect(sent.p_request.entryId).toBe(entryId);
  });

  it('serves an editor-only session', async () => {
    const base = input();
    const result = await readAs(
      (async () => json(translatedRead())) as typeof fetch,
      { session: { ...base.session, capabilities: ['cms.editor'] } },
    );
    expect(result).toMatchObject({ ok: true });
  });

  it('rejects a wrong operation, path, authority or context before any transport', async () => {
    const fetchImpl = vi.fn(async () => json(translatedRead()));
    const base = input();
    const bad: Array<[Partial<CmsLocaleReadInput>, number]> = [
      [{ operationId: 'CMS-03C-04' as never }, 400],
      [{ path: { entryId: 'invalid', locale: 'fr-FR' } }, 400],
      [{ path: { entryId, locale: 'fr_FR' } }, 400],
      [{ session: { ...base.session, actingPartyId: null } }, 403],
      [{ session: { ...base.session, capabilities: ['cms.reader'] } }, 403],
      [{ session: { ...base.session, capabilities: [] } }, 403],
    ];
    for (const [overrides, status] of bad) {
      const result = await readAs(fetchImpl as typeof fetch, overrides);
      expect(result, JSON.stringify(overrides)).toMatchObject({
        ok: false,
        status,
      });
    }
    expect(fetchImpl).not.toHaveBeenCalled();
    const forbidden = await readAs(fetchImpl as typeof fetch, {
      session: { ...base.session, capabilities: [] },
    });
    expect(forbidden).toMatchObject({
      details: { reasonCode: 'capability_missing' },
    });
  });

  it("refuses an answer that is malformed, another entry's, another locale's or outside the contract (502)", async () => {
    const other = '20000000-0000-4000-8000-000000000009';
    const good = translatedRead();
    const answers: unknown[] = [
      good.variant,
      {},
      { ...good, extra: true },
      { ...good, locale: 'de-DE' },
      { ...good, variant: { ...good.variant, entryId: other } },
      { ...good, variant: { ...good.variant, state: 'untranslated' } },
      { ...good, variant: null, fields: good.fields },
      { ...good, resolutions: [{ ...good.resolutions[0], text: 'x' }] },
      { ...good, fields: [good.fields[0], good.fields[0]] },
      'not an object',
      [],
    ];
    for (const value of answers) {
      const result = await readAs((async () => json(value)) as typeof fetch);
      expect(result, JSON.stringify(value)).toMatchObject({
        ok: false,
        status: 502,
      });
    }
  });

  it("maps the read's tokens: 403 capability_missing, 404, 400, 401, 429", async () => {
    const forbidden = await readAs((async () =>
      raised('FORBIDDEN')) as typeof fetch);
    expect(forbidden).toMatchObject({
      ok: false,
      status: 403,
      details: { reasonCode: 'capability_missing' },
    });
    const table: Array<[string, number]> = [
      ['NOT_FOUND', 404],
      ['INVALID_REQUEST', 400],
      ['UNAUTHENTICATED', 401],
      ['RATE_LIMITED', 429],
    ];
    for (const [token, status] of table) {
      const result = await readAs((async () => raised(token)) as typeof fetch);
      expect(result, token).toMatchObject({ ok: false, status });
    }
  });

  it('maps a missing active schema version to a dependency failure, not a 404', async () => {
    const result = await readAs((async () =>
      raised('DEPENDENCY_UNAVAILABLE')) as typeof fetch);
    expect(result).toMatchObject({ ok: false });
    expect([502, 503]).toContain((result as { status: number }).status);
  });

  it('scrubs a token the read cannot publish, a write-only status and a provider fault into a 500', async () => {
    const faults: Array<[string, () => Response]> = [
      [
        'locale limit',
        () =>
          raised('VERSION_MISMATCH', '{"reasonCode":"locale_limit_reached"}'),
      ],
      [
        'chain mismatch',
        () =>
          raised(
            'VERSION_MISMATCH',
            '{"reasonCode":"FALLBACK_CHAIN_MISMATCH","activeFallbackChain":["en-US"]}',
          ),
      ],
      ['transition', () => raised('INVALID_TRANSITION')],
      ['idempotency', () => raised('IDEMPOTENCY_MISMATCH')],
      ['validation', () => raised('VALIDATION_FAILED', '["/locale"]')],
      ['other domain', () => raised('pattern_cycle')],
      ['unregistered', () => raised('not_a_registered_token')],
      ['internal', () => raised('INTERNAL_ERROR')],
      ['PostgREST', () => json({ code: 'PGRST202', message: 'missing' }, 404)],
      ['sqlstate', () => json({ code: '42702', message: 'ambiguous' }, 400)],
      ['non object', () => json('not an object', 400)],
    ];
    for (const [name, fault] of faults) {
      const result = await readAs((async () => fault()) as typeof fetch);
      expect(result, name).toMatchObject({ ok: false, status: 500 });
      expect(JSON.stringify(result), name).not.toContain('PGRST202');
      expect(JSON.stringify(result), name).not.toContain('locale_limit');
    }
  });

  it('maps provider outages and deadlines to 503 and 504', async () => {
    expect(
      await readAs((async () =>
        json({ message: 'down' }, 503)) as typeof fetch),
    ).toMatchObject({ ok: false, status: 503 });
    expect(
      await readAs((async () => {
        throw new Error('connect ECONNREFUSED');
      }) as typeof fetch),
    ).toMatchObject({ ok: false, status: 503 });
    expect(
      await readAs((async () => {
        throw new DOMException('aborted', 'AbortError');
      }) as typeof fetch),
    ).toMatchObject({ ok: false, status: 504 });
  });

  it('refuses an oversized RPC answer instead of buffering it', async () => {
    const result = await create(
      (async () => json(translatedRead())) as typeof fetch,
      {
        maxResponseBytes: 64,
      },
    ).readLocaleVariant(input(), signal());
    expect(result).toMatchObject({ ok: false });
    expect((result as { status: number }).status).toBeGreaterThanOrEqual(500);
  });

  it('serves the whole route: a translated entry is a 200 read; no variant is a null variant', async () => {
    const translated = await createCmsLocaleApp(
      create((async () => json(translatedRead())) as typeof fetch),
    ).request(readRequest());
    expect(translated.status).toBe(200);
    expect(await translated.json()).toEqual(translatedRead());
    const none = await createCmsLocaleApp(
      create((async () => json(untranslatedRead())) as typeof fetch),
    ).request(readRequest());
    expect(none.status).toBe(200);
    expect(await none.json()).toEqual(untranslatedRead());
  });

  it('serves the whole route: a visible entry without edit is the typed 403; hidden or unsupported is 404', async () => {
    const denied = await createCmsLocaleApp(
      create((async () => raised('FORBIDDEN')) as typeof fetch),
    ).request(readRequest());
    expect(denied.status).toBe(403);
    expect(await denied.json()).toMatchObject({
      code: 'LOCALE_FORBIDDEN',
      details: { reasonCode: 'capability_missing' },
    });
    const hidden = await createCmsLocaleApp(
      create((async () => raised('NOT_FOUND')) as typeof fetch),
    ).request(readRequest());
    expect(hidden.status).toBe(404);
    expect(await hidden.json()).toMatchObject({
      code: 'LOCALE_SOURCE_NOT_FOUND',
      details: {},
    });
  });

  it('emits the read telemetry under its own operation name', async () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const response = await createCmsLocaleApp(
      create((async () => json(translatedRead())) as typeof fetch, { logger }),
    ).request(readRequest());
    expect(response.status).toBe(200);
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.info.mock.calls[0]?.[0]).toMatchObject({
      operation: 'cms.composition.locale.read',
      outcome: 'success',
    });
  });
});
