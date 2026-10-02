import { describe, expect, it, vi } from 'vitest';

import { forwardCmsEditorialRevisionHistoryRead } from './cms-editorial-platform-reads';

const entryId = '123e4567-e89b-42d3-a456-426614174000';
const origin = 'https://app.example.test';
const path = `/app/cms-content-modeling/entries/${entryId}/revisions`;
const page = {
  items: [],
  nextCursor: null,
  pageVersion: '2',
  compare: null,
} as const;
const get = (search = '', headers: HeadersInit = {}) =>
  new Request(`${origin}${path}${search}`, { headers });
const binding = (response: Response) => ({
  fetch: vi.fn(async (input: Request) => {
    if (!(input instanceof Request)) throw new TypeError('expected Request');
    return response;
  }),
});
const json = (value: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(value), {
    status,
    headers: {
      'content-type': 'application/json',
      etag: '"2"',
      ...headers,
    },
  });

describe('CMS-03B-03 first-party revision-history read', () => {
  it('forwards a strict protected GET and returns only the validated page', async () => {
    const upstream = binding(json(page));
    const response = await forwardCmsEditorialRevisionHistoryRead(
      get('?limit=25&state=draft', {
        cookie: 'wj_access=session; unrelated=secret',
      }),
      upstream,
      entryId,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('etag')).toBe('"2"');
    expect(await response.json()).toEqual(page);
    expect(upstream.fetch).toHaveBeenCalledOnce();
    const forwarded = upstream.fetch.mock.calls[0]?.[0] as Request;
    expect(forwarded.url).toBe(
      `https://platform-api.internal/api/v1/cms/entries/${entryId}/revisions?limit=25&state=draft`,
    );
    expect(forwarded.headers.get('cookie')).toBe('wj_access=session');
    expect(forwarded.headers.get('if-match')).toBeNull();
  });

  it('omits empty optional filters from a native GET form', async () => {
    const upstream = binding(json(page));
    const response = await forwardCmsEditorialRevisionHistoryRead(
      get('?state=&limit=25&locale='),
      upstream,
      entryId,
    );
    expect(response.status).toBe(200);
    const forwarded = upstream.fetch.mock.calls[0]?.[0] as Request;
    expect(new URL(forwarded.url).search).toBe('?limit=25');
  });

  it('preserves a bounded opaque continuation without interpreting it', async () => {
    const upstream = binding(json(page));
    const response = await forwardCmsEditorialRevisionHistoryRead(
      get('?cursor=opaque'),
      upstream,
      entryId,
    );
    expect(response.status).toBe(200);
    const forwarded = upstream.fetch.mock.calls[0]?.[0] as Request;
    expect(new URL(forwarded.url).searchParams.get('cursor')).toBe('opaque');
  });

  it('rejects malformed addressing, query, or mutation headers before fetch', async () => {
    const upstream = binding(json(page));
    for (const [request, id, status] of [
      [get(), 'not-a-uuid', 404],
      [get('?other=1'), entryId, 400],
      [get('?limit=1&limit=2'), entryId, 400],
      [get('?state=&state=draft'), entryId, 400],
      [get('?limit=0'), entryId, 400],
      [get('?limit=51'), entryId, 400],
      [get('?state=other'), entryId, 422],
      [get('?cursor='), entryId, 400],
      [get(`?cursor=${'a'.repeat(513)}`), entryId, 400],
      [get('?compareRevisionId=not-a-uuid'), entryId, 400],
      [get('?locale=en_US'), entryId, 400],
      [get('', { 'if-match': '"1"' }), entryId, 400],
      [get('', { 'idempotency-key': 'unexpected' }), entryId, 400],
    ] as const) {
      const response = await forwardCmsEditorialRevisionHistoryRead(
        request,
        upstream,
        id,
      );
      expect(response.status).toBe(status);
    }
    expect(upstream.fetch).not.toHaveBeenCalled();
  });

  it('rejects read media and body claims instead of silently stripping them', async () => {
    const upstream = binding(json(page));
    for (const [headers, status] of [
      [{ 'content-type': 'application/json' }, 415],
      [{ 'content-length': '1' }, 400],
      [{ 'transfer-encoding': 'chunked' }, 400],
    ] as const) {
      const response = await forwardCmsEditorialRevisionHistoryRead(
        get('', headers),
        upstream,
        entryId,
      );
      expect(response.status).toBe(status);
      if (status === 415)
        expect(await response.json()).toMatchObject({
          message: 'A protected CMS read has no request media.',
        });
    }
    expect(upstream.fetch).not.toHaveBeenCalled();
  });

  it('refuses an absent binding or non-GET request', async () => {
    expect(
      (await forwardCmsEditorialRevisionHistoryRead(get(), undefined, entryId))
        .status,
    ).toBe(503);
    const upstream = binding(json(page));
    expect(
      (
        await forwardCmsEditorialRevisionHistoryRead(
          new Request(origin + path, { method: 'POST' }),
          upstream,
          entryId,
        )
      ).status,
    ).toBe(503);
    expect(upstream.fetch).not.toHaveBeenCalled();
  });

  it('refuses invalid or mismatched upstream success without leaking it', async () => {
    for (const upstreamResponse of [
      json({ ...page, secret: 'leak' }),
      json(page, 200, { etag: 'W/"2"' }),
      json(page, 200, { etag: '"3"' }),
      json(page, 200, { 'content-length': '262145' }),
    ]) {
      const response = await forwardCmsEditorialRevisionHistoryRead(
        get(),
        binding(upstreamResponse),
        entryId,
      );
      expect(response.status).toBe(502);
      expect(await response.text()).not.toContain('leak');
    }
  });

  it('fails closed when the service binding throws or returns a non-response', async () => {
    const thrown = await forwardCmsEditorialRevisionHistoryRead(
      get(),
      {
        fetch: async () => {
          throw new Error('private transport error');
        },
      },
      entryId,
    );
    expect(thrown.status).toBe(503);
    expect(await thrown.text()).not.toContain('private transport error');
    const nonResponse = await forwardCmsEditorialRevisionHistoryRead(
      get(),
      { fetch: async () => null },
      entryId,
    );
    expect(nonResponse.status).toBe(503);
  });

  it('relays a typed upstream refusal and collapses a malformed one', async () => {
    const refusal = {
      code: 'DEPENDENCY_UNAVAILABLE',
      details: {},
      message: 'The history service is unavailable.',
      requestId: '11111111-1111-4111-8111-111111111111',
    };
    const response = await forwardCmsEditorialRevisionHistoryRead(
      get(),
      binding(json(refusal, 503)),
      entryId,
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual(refusal);
    const malformed = await forwardCmsEditorialRevisionHistoryRead(
      get(),
      binding(json({ private: 'leak' }, 503)),
      entryId,
    );
    expect(malformed.status).toBe(503);
    expect(await malformed.text()).not.toContain('leak');
  });
});
