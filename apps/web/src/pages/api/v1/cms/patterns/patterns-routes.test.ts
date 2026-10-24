import { describe, expect, it, vi } from 'vitest';

const fetchMock = vi.hoisted(() => vi.fn());
vi.mock('cloudflare:workers', () => ({
  env: { PLATFORM_API: { fetch: fetchMock } },
}));

import {
  CSRF,
  jsonResponse,
  latestRequest,
  patternDetailFixture,
  patternResourceFixture,
  writeRequest,
} from '../../../../../server/cms-pattern-platform.test-support';
import { GET, prerender as latestPrerender } from './[patternKey]';
import { POST, prerender as writePrerender } from './versions';

describe('first-party CMS-03C-12 endpoint', () => {
  it('is dynamic and forwards a valid write to the server binding', async () => {
    expect(writePrerender).toBe(false);
    fetchMock.mockResolvedValueOnce(
      jsonResponse(201, patternResourceFixture(), { etag: '"1"' }),
    );
    const response = await POST({ request: writeRequest() } as Parameters<
      typeof POST
    >[0]);
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(patternResourceFixture());
    const sent = fetchMock.mock.calls.at(-1)?.[0] as Request;
    expect(sent.url).toBe(
      'https://platform-api.internal/api/v1/cms/patterns/versions',
    );
    expect(sent.headers.get('x-csrf-token')).toBe(CSRF);
  });

  it('rejects non-JSON before using the binding', async () => {
    fetchMock.mockClear();
    const response = await POST({
      request: writeRequest({ headers: { 'content-type': 'text/plain' } }),
    } as Parameters<typeof POST>[0]);
    expect(response.status).toBe(415);
    expect(await response.json()).toMatchObject({
      code: 'UNSUPPORTED_MEDIA_TYPE',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('exports no other method', async () => {
    const module = await import('./versions');
    expect(Object.keys(module).sort()).toEqual(['POST', 'prerender']);
  });
});

describe('first-party cmsPatternLatestRead endpoint', () => {
  const call = (request: Request, patternKey: string | undefined) =>
    GET({ request, params: { patternKey } } as unknown as Parameters<
      typeof GET
    >[0]);

  it('is dynamic and returns the validated latest version with its ETag', async () => {
    expect(latestPrerender).toBe(false);
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, patternDetailFixture(), { etag: '"1"' }),
    );
    const response = await call(latestRequest(), 'profile-hero');
    expect(response.status).toBe(200);
    expect(response.headers.get('etag')).toBe('"1"');
    expect(await response.json()).toEqual(patternDetailFixture());
    const sent = fetchMock.mock.calls.at(-1)?.[0] as Request;
    expect(sent.url).toBe(
      'https://platform-api.internal/api/v1/cms/patterns/profile-hero',
    );
  });

  it.each(['selector', 'context', 'versions', 'new', 'Bad_Key'])(
    'answers the key %s with a 400 and never reaches the binding',
    async (key) => {
      fetchMock.mockClear();
      const response = await call(latestRequest(key), key);
      expect(response.status).toBe(400);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('exports no other method', async () => {
    const module = await import('./[patternKey]');
    expect(Object.keys(module).sort()).toEqual(['GET', 'prerender']);
  });
});
