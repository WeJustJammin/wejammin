import { describe, expect, it, vi } from 'vitest';

import { readCmsLocaleVariant } from './cms-composition-platform-locale-read';

const origin = 'https://app.example.test';
const entryId = 'd1000000-0000-4000-8000-000000000001';
const fieldId = 'd1000000-0000-4000-8000-000000000005';
const noFallbackId = 'd1000000-0000-4000-8000-000000000009';
const path = `/api/v1/cms/entries/${entryId}/locales/fr-FR`;
const variant = {
  id: 'd1000000-0000-4000-8000-000000000004',
  version: '1',
  contentHash: 'b'.repeat(64),
  createdAt: '2026-09-27T12:00:00Z',
  updatedAt: '2026-09-27T12:00:00Z',
  state: 'draft',
  entryId,
  revisionId: 'd1000000-0000-4000-8000-000000000003',
  locale: 'fr-FR',
  sourceRevisionId: 'd1000000-0000-4000-8000-000000000002',
  fallbackChain: ['en-US'],
  noFallbackFieldIds: [noFallbackId],
  staleFieldIds: [],
};
const resolution = (id: string, patch: Record<string, unknown> = {}) => ({
  fieldId: id,
  locale: 'fr-FR',
  mode: 'localized',
  outcome: 'resolved',
  provenance: 'authored',
  resolvedFromLocale: null,
  stale: false,
  blocking: false,
  reasonCode: null,
  ...patch,
});
const read = {
  locale: 'fr-FR',
  activeFallbackChain: ['en-US'],
  variant,
  fields: [{ fieldId, value: 'Titre traduit' }],
  resolutions: [
    resolution(fieldId),
    resolution(noFallbackId, {
      mode: 'no_fallback',
      outcome: 'missing',
      provenance: 'missing',
      blocking: true,
      reasonCode: 'no_fallback_missing',
    }),
  ],
};
const request = (
  headers: Record<string, string> = {},
  url = `${origin}${path}`,
  method = 'GET',
) =>
  new Request(url, {
    method,
    headers: {
      origin,
      cookie:
        'wj_access=protected; wj_csrf=csrf-token-123; private=do-not-forward',
      ...headers,
    },
  });
const ok = (value: unknown, requestId?: string) =>
  new Response(JSON.stringify(value), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      ...(requestId === undefined ? {} : { 'x-request-id': requestId }),
    },
  });
const apiError = (
  status: number,
  code: string,
  details: Record<string, unknown> = {},
  headers: Record<string, string> = {},
) =>
  new Response(
    JSON.stringify({
      code,
      message: `${code}: locale operation rejected or unavailable.`,
      requestId: '10000000-0000-4000-8000-000000000006',
      details,
    }),
    { status, headers: { 'content-type': 'application/json', ...headers } },
  );
const proxy = (
  req: Request,
  binding: unknown,
  id = entryId,
  locale = 'fr-FR',
) => readCmsLocaleVariant(req, id, locale, binding);

describe('cmsLocaleVariantRead first-party proxy (DEC-205)', () => {
  it('forwards a bodiless GET with the session only and relays the read', async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      expect(input).toBeInstanceOf(Request);
      return ok(read, '10000000-0000-4000-8000-000000000006');
    });
    const response = await proxy(
      request({ 'if-none-match': '"2"', 'if-modified-since': 'x' }),
      { fetch },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(read);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('etag')).toBeNull();
    expect(response.headers.get('x-request-id')).toBe(
      '10000000-0000-4000-8000-000000000006',
    );
    expect(fetch).toHaveBeenCalledTimes(1);
    const forwarded = fetch.mock.calls[0]?.[0] as Request;
    expect(forwarded.method).toBe('GET');
    expect(forwarded.url).toBe(`https://platform-api.internal${path}`);
    expect(forwarded.headers.get('cookie')).toBe(
      'wj_access=protected; wj_csrf=csrf-token-123',
    );
    expect(forwarded.headers.has('if-none-match')).toBe(false);
    expect(forwarded.headers.has('if-modified-since')).toBe(false);
    expect(forwarded.headers.has('idempotency-key')).toBe(false);
    expect(forwarded.body).toBeNull();
  });

  it('relays an explicit null variant', async () => {
    const none = { ...read, variant: null, fields: [] };
    const response = await proxy(request(), { fetch: async () => ok(none) });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(none);
  });

  it('puts only the validated locale tag in the upstream path', async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      expect(input).toBeInstanceOf(Request);
      return ok({
        ...read,
        locale: 'zh-Hant-TW',
        variant: null,
        fields: [],
        resolutions: [],
      });
    });
    await proxy(
      request({}, `${origin}/api/v1/cms/entries/${entryId}/locales/zh-Hant-TW`),
      { fetch },
      entryId,
      'zh-Hant-TW',
    );
    expect((fetch.mock.calls[0]?.[0] as unknown as Request).url).toBe(
      `https://platform-api.internal/api/v1/cms/entries/${entryId}/locales/zh-Hant-TW`,
    );
  });

  it('refuses before any upstream call: a method, a query, request media, a precondition, a path, a foreign origin, a missing binding', async () => {
    const fetch = vi.fn(async () => ok(read));
    const cases: Array<[Promise<Response>, number]> = [
      [proxy(request({}, `${origin}${path}`, 'POST'), { fetch }), 400],
      [proxy(request({}, `${origin}${path}?limit=1`), { fetch }), 400],
      [proxy(request({}, `${origin}${path}?`), { fetch }), 400],
      [proxy(request({ 'content-type': 'application/json' }), { fetch }), 415],
      [
        proxy(request({ 'idempotency-key': 'locale-read-0001' }), { fetch }),
        400,
      ],
      [proxy(request({ 'if-match': '"1"' }), { fetch }), 400],
      [proxy(request(), { fetch }, 'not-a-uuid'), 400],
      [proxy(request(), { fetch }, null as unknown as string), 400],
      [proxy(request(), { fetch }, entryId, 'fr_FR'), 400],
      [proxy(request(), { fetch }, entryId, ''), 400],
      [proxy(request(), { fetch }, entryId, null as unknown as string), 400],
      [proxy(request({ origin: 'https://evil.example.test' }), { fetch }), 403],
      [proxy(request(), undefined), 503],
      [proxy(request(), {}), 503],
    ];
    for (const [pending, status] of cases)
      expect((await pending).status).toBe(status);
    expect(fetch).not.toHaveBeenCalled();
  });

  const relayed: ReadonlyArray<
    [number, string, Record<string, unknown>, Record<string, unknown>]
  > = [
    [
      401,
      'UNAUTHENTICATED',
      { recoveryAction: 'reauthenticate' },
      { recoveryAction: 'reauthenticate' },
    ],
    [
      403,
      'LOCALE_FORBIDDEN',
      { reasonCode: 'capability_missing', policy: 'x' },
      { reasonCode: 'capability_missing' },
    ],
    [403, 'LOCALE_FORBIDDEN', { reasonCode: 'locale_limit_reached' }, {}],
    [404, 'LOCALE_SOURCE_NOT_FOUND', { leaked: 'title' }, {}],
    [400, 'INVALID_REQUEST', {}, {}],
    [500, 'INTERNAL_ERROR', { cause: 'sql' }, {}],
  ];
  for (const [status, code, details, expected] of relayed)
    it(`relays ${status} ${code} with rebuilt details only`, async () => {
      const response = await proxy(request(), {
        fetch: async () => apiError(status, code, details),
      });
      expect(response.status).toBe(status);
      const body = (await response.json()) as {
        code: string;
        details: unknown;
        requestId: string;
      };
      expect(body.code).toBe(code);
      expect(body.details).toEqual(expected);
      expect(body.requestId).toBe('10000000-0000-4000-8000-000000000006');
      expect(response.headers.get('cache-control')).toBe('no-store');
    });

  it('relays 429 with its bounded wait and Retry-After', async () => {
    const response = await proxy(request(), {
      fetch: async () =>
        apiError(
          429,
          'RATE_LIMITED',
          { retryAfterSeconds: 30, limit: 300, resetAt: '31', extra: 'x' },
          { 'retry-after': '30' },
        ),
    });
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('30');
    expect(
      ((await response.json()) as { details: Record<string, unknown> }).details,
    ).toMatchObject({ retryAfterSeconds: 30, limit: 300 });
  });

  it('relays dependency statuses as the retryable composition dependency error', async () => {
    for (const status of [502, 503, 504] as const) {
      const response = await proxy(request(), {
        fetch: async () =>
          apiError(
            status,
            'DEPENDENCY_UNAVAILABLE',
            { dependencyClass: 'x' },
            { 'retry-after': '15' },
          ),
      });
      expect(response.status).toBe(status);
      expect(
        ((await response.json()) as { details: Record<string, unknown> })
          .details,
      ).toMatchObject({ dependencyClass: 'cms_composition', retryable: true });
    }
  });

  it('turns an undeclared status (409, 422, 201, 204, 304) or a mismatched code into a 502', async () => {
    const answers: Response[] = [
      apiError(409, 'LOCALE_VERSION_CONFLICT', { currentVersion: '3' }),
      apiError(422, 'LOCALE_VALIDATION_FAILED'),
      apiError(404, 'LOCALE_FORBIDDEN'),
      new Response(JSON.stringify(read), { status: 201 }),
      new Response(null, { status: 204 }),
      new Response(null, { status: 304 }),
      new Response('not json', { status: 503 }),
    ];
    for (const answer of answers) {
      const response = await proxy(request(), {
        fetch: async () => answer.clone(),
      });
      expect(response.status, String(answer.status)).toBe(502);
    }
  });

  it('refuses to relay an answer that is not the strict read of THIS entry and locale', async () => {
    const other = '50000000-0000-4000-8000-000000000005';
    const answers: unknown[] = [
      variant,
      {},
      { ...read, extra: true },
      { ...read, locale: 'de-DE' },
      { ...read, variant: { ...variant, entryId: other } },
      { ...read, variant: { ...variant, state: 'untranslated' } },
      { ...read, variant: { ...variant, ownerId: other } },
      { ...read, variant: null },
      { ...read, resolutions: [{ ...resolution(fieldId), text: 'x' }] },
      { ...read, fields: [read.fields[0], read.fields[0]] },
      'text',
    ];
    for (const value of answers) {
      const response = await proxy(request(), { fetch: async () => ok(value) });
      expect(response.status, JSON.stringify(value)).toBe(502);
    }
  });

  it('is a 503 when the Worker cannot be reached or answers nothing', async () => {
    const thrown = await proxy(request(), {
      fetch: async () => {
        throw new Error('down');
      },
    });
    expect(thrown.status).toBe(503);
    const nothing = await proxy(request(), { fetch: async () => undefined });
    expect(nothing.status).toBe(503);
  });
});
