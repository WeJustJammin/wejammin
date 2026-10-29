import { describe, expect, it, vi } from 'vitest';

const fetchMock = vi.hoisted(() => vi.fn());
vi.mock('cloudflare:workers', () => ({
  env: { PLATFORM_API: { fetch: fetchMock } },
}));

import {
  binding,
  contentTypeId,
  json,
  request,
  selectorPage,
} from '../../../../../server/cms-composition-instances.test-support';
import { GET, prerender } from './nestable';

describe('first-party cmsPatternNestableRead endpoint', () => {
  const call = (incoming: Request) =>
    GET({ request: incoming } as unknown as Parameters<typeof GET>[0]);

  it('is dynamic and forwards the repeated query to the server binding, relaying the verified page', async () => {
    expect(prerender).toBe(false);
    const stub = binding(json(selectorPage(), 200, { etag: '"7"' }));
    fetchMock.mockImplementationOnce(stub.fetch);
    const response = await call(
      request({
        url: `/api/v1/cms/patterns/nestable?contentTypeId=${contentTypeId}`,
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(selectorPage());
    const sent = fetchMock.mock.calls.at(-1)?.[0] as Request;
    expect(sent.url).toBe(
      `https://platform-api.internal/api/v1/cms/patterns/nestable?contentTypeId=${contentTypeId}&limit=25`,
    );
  });

  it('refuses a malformed query before the binding is used', async () => {
    fetchMock.mockClear();
    const response = await call(
      request({ url: '/api/v1/cms/patterns/nestable?contentTypeId=nope' }),
    );
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('exports no other method', async () => {
    const module = await import('./nestable');
    expect(Object.keys(module).sort()).toEqual(['GET', 'prerender']);
  });
});
