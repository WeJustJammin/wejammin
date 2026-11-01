import { describe, expect, it, vi } from 'vitest';

const fetchMock = vi.hoisted(() => vi.fn());
vi.mock('cloudflare:workers', () => ({
  env: { PLATFORM_API: { fetch: fetchMock } },
}));

import { GET, prerender } from './[locale]';

const origin = 'https://app.example.test';
const entryId = 'd1000000-0000-4000-8000-000000000001';
const path = `/api/v1/cms/entries/${entryId}/locales/fr-FR`;
const read = {
  locale: 'fr-FR',
  activeFallbackChain: ['en-US'],
  variant: null,
  fields: [],
  resolutions: [],
};
const request = (url = `${origin}${path}`) =>
  new Request(url, {
    method: 'GET',
    headers: { origin, cookie: 'wj_access=protected; wj_csrf=csrf-token-123' },
  });
const call = (req: Request, locale = 'fr-FR') =>
  GET({
    request: req,
    params: { entryId, locale },
  } as unknown as Parameters<typeof GET>[0]);

describe('cmsLocaleVariantRead page route (DEC-205)', () => {
  it('is a dynamic first-party GET route that forwards to the protected Worker', async () => {
    expect(prerender).toBe(false);
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(read), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const response = await call(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(read);
    const forwarded = fetchMock.mock.calls[0]?.[0] as Request;
    expect(forwarded.method).toBe('GET');
    expect(forwarded.url).toBe(`https://platform-api.internal${path}`);
  });

  it('fails closed without forwarding on a query or a malformed tag', async () => {
    fetchMock.mockClear();
    expect((await call(request(`${origin}${path}?x=1`))).status).toBe(400);
    expect((await call(request(), 'fr_FR')).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
