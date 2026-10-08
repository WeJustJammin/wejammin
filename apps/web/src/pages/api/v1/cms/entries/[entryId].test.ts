import { describe, expect, it, vi } from 'vitest';

const fetchMock = vi.hoisted(() => vi.fn());
vi.mock('cloudflare:workers', () => ({
  env: { PLATFORM_API: { fetch: fetchMock } },
}));

import { GET, prerender } from './[entryId]';
import {
  draftDetailEtag,
  draftDetailWith,
  uuid,
} from '../../../../../server/cms-editorial-platform-proxies-hardening-test-support';

const origin = 'https://app.example.test';
const request = (
  path = `/api/v1/cms/entries/${uuid}`,
  headers: Record<string, string> = {},
  signal?: AbortSignal,
): Request =>
  new Request(`${origin}${path}`, {
    method: 'GET',
    headers: { cookie: 'wj_access=protected', ...headers },
    ...(signal === undefined ? {} : { signal }),
  });
const get = (input: Request = request(), entryId: string | undefined = uuid) =>
  GET({ request: input, params: { entryId } } as unknown as Parameters<
    typeof GET
  >[0]);

describe('first-party CMS draft-detail endpoint (CMS-03B-11)', () => {
  it('[P2-S10-AC-068] is server-rendered and serves the draft for editor refetch with its strong ETag and no-store', async () => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(draftDetailWith('Hello')), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'cache-control': 'no-store',
          etag: draftDetailEtag,
        },
      }),
    );
    expect(prerender).toBe(false);
    const response = await get();
    expect(response.status).toBe(200);
    expect(response.headers.get('etag')).toBe(draftDetailEtag);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual(draftDetailWith('Hello'));
    const forwarded = fetchMock.mock.calls[0]?.[0] as Request;
    expect(forwarded.method).toBe('GET');
    expect(forwarded.url).toBe(
      `https://platform-api.internal/api/v1/cms/entries/${uuid}`,
    );
    expect(forwarded.headers.get('cookie')).toBe('wj_access=protected');
    expect(forwarded.body).toBeNull();
  });

  it('forwards the optional locale and the client cancellation signal', async () => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(draftDetailWith('Hello')), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          etag: draftDetailEtag,
        },
      }),
    );
    const controller = new AbortController();
    await get(
      request(
        `/api/v1/cms/entries/${uuid}?locale=en-US`,
        {},
        controller.signal,
      ),
    );
    const forwarded = fetchMock.mock.calls[0]?.[0] as Request;
    expect(new URL(forwarded.url).search).toBe('?locale=en-US');
    controller.abort('client closed');
    expect(forwarded.signal.aborted).toBe(true);
  });

  it('answers a malformed id 400 and an unknown query key 400 without reaching the Worker', async () => {
    fetchMock.mockReset();
    expect(
      (await get(request('/api/v1/cms/entries/nope'), 'nope')).status,
    ).toBe(400);
    expect(
      (await get(request(`/api/v1/cms/entries/${uuid}?ownerId=x`))).status,
    ).toBe(400);
    expect((await get(request(undefined, { 'if-match': '"1"' }))).status).toBe(
      400,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('relays a concealed entry as the same empty 404 with a canonical message', async () => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(
      Response.json(
        {
          code: 'NOT_FOUND',
          message: 'entry 123 belongs to tenant acme-secret',
          details: { ownerId: 'acme-secret' },
          requestId: '123e4567-e89b-42d3-a456-426614174099',
        },
        { status: 404 },
      ),
    );
    const response = await get();
    expect(response.status).toBe(404);
    const text = await response.text();
    expect(text).not.toContain('acme-secret');
    expect(JSON.parse(text)).toMatchObject({ code: 'NOT_FOUND', details: {} });
  });
});
