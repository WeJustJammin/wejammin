import { describe, expect, it, vi } from 'vitest';

const fetchMock = vi.hoisted(() => vi.fn());
vi.mock('cloudflare:workers', () => ({
  env: { PLATFORM_API: { fetch: fetchMock } },
}));

import { GET, prerender } from './[templateKey]';

const detail = {
  id: '40000000-0000-4000-8000-000000000004',
  version: '2',
  contentHash: 'a'.repeat(64),
  createdAt: '2026-09-27T12:00:00Z',
  updatedAt: '2026-09-27T12:00:00Z',
  state: 'draft',
  templateKey: 'profile-header',
  templateVersion: 2,
  compatibleTypeIds: ['30000000-0000-4000-8000-000000000003'],
  reservedRegions: ['header', 'now', 'record', 'detail', 'provenance'],
  blockRegistryDigest: 'b'.repeat(64),
  slots: [],
  bindings: {},
  locale: 'en-US',
  audience: 'public',
};
const request = (
  url = 'https://app.example.test/api/v1/cms/templates/profile-header',
) =>
  new Request(url, {
    headers: { cookie: 'wj_access=opaque; unrelated=secret' },
  });
const call = (url?: string, templateKey = 'profile-header') =>
  GET({
    request: request(url),
    params: { templateKey },
  } as unknown as Parameters<typeof GET>[0]);

describe('same-origin current-template detail proxy', () => {
  it('forwards only approved identity material and exact validated definition', async () => {
    expect(prerender).toBe(false);
    fetchMock.mockResolvedValueOnce(
      Response.json(detail, { headers: { etag: '"2"' } }),
    );
    const response = await call();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('etag')).toBe('"2"');
    expect(await response.json()).toEqual(detail);
    const sent = fetchMock.mock.calls.at(-1)?.[0] as Request;
    expect(sent.url).toBe(
      'https://platform-api.internal/api/v1/cms/templates/profile-header',
    );
    expect(sent.headers.get('cookie')).toBe('wj_access=opaque');
  });

  it('rejects invalid path or query selectors before transport', async () => {
    fetchMock.mockClear();
    expect((await call(undefined, 'Bad_Key')).status).toBe(400);
    expect(
      (
        await call(
          'https://app.example.test/api/v1/cms/templates/profile-header?ownerId=x',
        )
      ).status,
    ).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed on mismatched or private provider fields', async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json(
        { ...detail, ownerId: 'private' },
        { headers: { etag: '"2"' } },
      ),
    );
    expect((await call()).status).toBe(502);
    fetchMock.mockResolvedValueOnce(
      Response.json(
        { ...detail, templateKey: 'other-template' },
        { headers: { etag: '"2"' } },
      ),
    );
    expect((await call()).status).toBe(502);
  });
});
