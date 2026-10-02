import { describe, expect, it, vi } from 'vitest';

import { forwardCmsLocaleVariantMutation } from './cms-composition-platform-locale';

const origin = 'https://app.example.test';
const entryId = 'd1000000-0000-4000-8000-000000000001';
const sourceRevisionId = 'd1000000-0000-4000-8000-000000000002';
const revisionId = 'd1000000-0000-4000-8000-000000000003';
const variantId = 'd1000000-0000-4000-8000-000000000004';
const fieldId = 'd1000000-0000-4000-8000-000000000005';
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
const resource = {
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
  payload: unknown = body,
  headers: Record<string, string> = {},
  url = `${origin}${path}`,
) =>
  new Request(url, {
    method: 'POST',
    headers: {
      origin,
      cookie:
        'wj_access=protected; wj_csrf=csrf-token-123; private=do-not-forward',
      'x-csrf-token': 'csrf-token-123',
      'content-type': 'application/json',
      'idempotency-key': 'locale-command-0001',
      'if-match': '"1"',
      ...headers,
    },
    body: JSON.stringify(payload),
  });
const success = (value: unknown = resource, etag = '"2"') =>
  new Response(JSON.stringify(value), {
    status: 201,
    headers: { 'content-type': 'application/json', etag },
  });

describe('CMS-03C-04 first-party locale authoring proxy', () => {
  it('forwards a bounded command and returns only the bound draft resource', async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      expect(input).toBeInstanceOf(Request);
      return success();
    });
    const response = await forwardCmsLocaleVariantMutation(
      request(),
      entryId,
      'fr-FR',
      { fetch },
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(resource);
    expect(response.headers.get('etag')).toBe('"2"');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(fetch).toHaveBeenCalledTimes(1);
    const forwarded = fetch.mock.calls[0]?.[0] as Request;
    expect(forwarded.url).toBe(`https://platform-api.internal${path}`);
    expect(forwarded.headers.get('cookie')).toBe(
      'wj_access=protected; wj_csrf=csrf-token-123',
    );
    expect(forwarded.headers.get('x-csrf-token')).toBe('csrf-token-123');
    expect(forwarded.headers.get('idempotency-key')).toBe(
      'locale-command-0001',
    );
    expect(forwarded.headers.get('if-match')).toBe('"1"');
    expect(await forwarded.json()).toEqual(body);
  });

  it('refuses cross-origin, CSRF mismatch, and invalid path before forwarding', async () => {
    const fetch = vi.fn(async () => success());
    for (const [input, id, locale, status] of [
      [
        request(body, { origin: 'https://evil.example.test' }),
        entryId,
        'fr-FR',
        403,
      ],
      [request(body, { 'x-csrf-token': 'wrong' }), entryId, 'fr-FR', 403],
      [request(), 'not-a-uuid', 'fr-FR', 400],
      [request(), entryId, 'bad_locale', 400],
    ] as const) {
      const response = await forwardCmsLocaleVariantMutation(
        input,
        id,
        locale,
        { fetch },
      );
      expect(response.status).toBe(status);
      expect(await response.json()).toMatchObject({
        code: status === 403 ? 'LOCALE_FORBIDDEN' : 'INVALID_REQUEST',
      });
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects mismatched body, mutation precondition, and query before forwarding', async () => {
    const fetch = vi.fn(async () => success());
    const invalid = [
      request({ ...body, locale: 'de-DE' }),
      request({ ...body, sourceHash: 'wrong' }),
      request(body, { 'if-match': '"2"' }),
      request(body, {}, `${origin}${path}?ownerId=${entryId}`),
    ];
    for (const input of invalid) {
      const response = await forwardCmsLocaleVariantMutation(
        input,
        entryId,
        'fr-FR',
        { fetch },
      );
      expect([400, 422]).toContain(response.status);
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects invalid media and oversized input without forwarding', async () => {
    const fetch = vi.fn(async () => success());
    const media = await forwardCmsLocaleVariantMutation(
      request(body, { 'content-type': 'text/plain' }),
      entryId,
      'fr-FR',
      { fetch },
    );
    expect(media.status).toBe(415);
    expect(await media.json()).toMatchObject({
      code: 'UNSUPPORTED_MEDIA_TYPE',
    });
    const oversized = await forwardCmsLocaleVariantMutation(
      request({ ...body, fields: [{ fieldId, value: 'x'.repeat(262_145) }] }),
      entryId,
      'fr-FR',
      { fetch },
    );
    expect(oversized.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('fails closed on forged upstream resource, ETag, or excess response bytes', async () => {
    const values = [
      success({ ...resource, entryId: sourceRevisionId }),
      success({ ...resource, locale: 'de-DE' }),
      success({ ...resource, privateText: 'must not escape' }),
      success(resource, '"3"'),
      success({ ...resource, padding: 'x'.repeat(262_145) }),
    ];
    for (const upstream of values) {
      const fetch = vi.fn(async () => upstream);
      const response = await forwardCmsLocaleVariantMutation(
        request(),
        entryId,
        'fr-FR',
        { fetch },
      );
      expect(response.status).toBe(502);
      expect(await response.json()).toMatchObject({
        code: 'DEPENDENCY_INVALID_RESPONSE',
      });
      expect(fetch).toHaveBeenCalledTimes(1);
    }
  });

  it('refuses a next aggregate version outside the wire contract', async () => {
    const maximum = '9223372036854775807';
    const fetch = vi.fn(async () => success(resource, '"9223372036854775808"'));
    const response = await forwardCmsLocaleVariantMutation(
      request(
        { ...body, expectedVersion: maximum },
        { 'if-match': `"${maximum}"` },
      ),
      entryId,
      'fr-FR',
      { fetch },
    );
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      code: 'DEPENDENCY_INVALID_RESPONSE',
    });
  });

  it('sanitizes provider errors and preserves only bounded reconciliation fields', async () => {
    const fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            code: 'LOCALE_VERSION_CONFLICT',
            message: 'private provider text',
            requestId: 'd1000000-0000-4000-8000-000000000006',
            details: {
              expectedVersion: '1',
              currentVersion: '2',
              secret: 'do-not-disclose',
            },
          }),
          { status: 409, headers: { 'content-type': 'application/json' } },
        ),
    );
    const response = await forwardCmsLocaleVariantMutation(
      request(),
      entryId,
      'fr-FR',
      { fetch },
    );
    expect(response.status).toBe(409);
    const error = await response.json();
    expect(error).toMatchObject({
      code: 'LOCALE_VERSION_CONFLICT',
      details: { expectedVersion: '1', currentVersion: '2' },
    });
    expect(JSON.stringify(error)).not.toContain('private provider text');
    expect(JSON.stringify(error)).not.toContain('do-not-disclose');
  });
});
