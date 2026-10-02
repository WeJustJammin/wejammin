import { describe, expect, it, vi } from 'vitest';

const fetchMock = vi.hoisted(() => vi.fn());
vi.mock('cloudflare:workers', () => ({
  env: { PLATFORM_API: { fetch: fetchMock } },
}));

import { GET, prerender } from './context';

const value = {
  contentTypes: [
    {
      id: '30000000-0000-4000-8000-000000000003',
      typeKey: 'profile',
      activeVersionId: '40000000-0000-4000-8000-000000000004',
      activeVersion: 1,
      sourceLocale: 'en-US',
    },
  ],
  registeredBlocks: [],
};
const request = (
  url = 'https://app.example.test/api/v1/cms/templates/context',
) =>
  new Request(url, {
    headers: { cookie: 'wj_access=opaque; unrelated=secret' },
  });

describe('same-origin template context read', () => {
  it('is dynamic, forwards only approved cookies, and validates its body', async () => {
    expect(prerender).toBe(false);
    fetchMock.mockResolvedValueOnce(Response.json(value));
    const response = await GET({ request: request() } as Parameters<
      typeof GET
    >[0]);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual(value);
    const sent = fetchMock.mock.calls.at(-1)?.[0] as Request;
    expect(sent.url).toBe(
      'https://platform-api.internal/api/v1/cms/templates/context',
    );
    expect(sent.headers.get('cookie')).toBe('wj_access=opaque');
  });

  it('rejects query authority and malformed provider data', async () => {
    fetchMock.mockClear();
    const query = await GET({
      request: request(
        'https://app.example.test/api/v1/cms/templates/context?ownerId=x',
      ),
    } as Parameters<typeof GET>[0]);
    expect(query.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockResolvedValueOnce(
      Response.json({ ...value, ownerId: 'private' }),
    );
    const malformed = await GET({ request: request() } as Parameters<
      typeof GET
    >[0]);
    expect(malformed.status).toBe(502);
    expect(JSON.stringify(await malformed.json())).not.toContain('private');
  });
});
