import { describe, expect, it, vi } from 'vitest';

const fetchMock = vi.hoisted(() => vi.fn());
vi.mock('cloudflare:workers', () => ({
  env: { PLATFORM_API: { fetch: fetchMock } },
}));

import {
  acceptBody,
  diffResource,
  instanceId,
  json,
  request,
  rowOf,
  selectorPage,
  contentTypeId,
} from '../../../../../server/cms-composition-instances.test-support';
import * as diffRoute from './instances/[instanceId]/update-diff';
import * as updatesRoute from './pattern-updates';
import * as selectorRoute from '../patterns/selector';

/*
 * The three first-party endpoints of the composition page (CMS-03C-13, -14, -15) stay dynamic and reach the Worker
 * only through the private PLATFORM_API binding. The proxies themselves are proved in
 * `server/cms-composition-instances-*.test.ts`; this file proves the wiring.
 */
const call = <T extends (...args: never[]) => unknown>(
  handler: T,
  context: unknown,
): Promise<Response> => Promise.resolve(handler(context as never) as Response);

describe('first-party composition endpoints', () => {
  it('serves CMS-03C-13 as a dynamic GET through the binding', async () => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(json(selectorPage(), 200, { etag: '"7"' }));
    const response = await call(selectorRoute.GET, {
      request: request({
        url: `/api/v1/cms/patterns/selector?contentTypeId=${contentTypeId}`,
      }),
    });
    expect(selectorRoute.prerender).toBe(false);
    expect(response.status).toBe(200);
    expect((fetchMock.mock.calls[0]?.[0] as Request).url).toContain(
      'https://platform-api.internal/api/v1/cms/patterns/selector?contentTypeId=',
    );
    expect(Object.keys(selectorRoute).sort()).toEqual(['GET', 'prerender']);
  });

  it('serves CMS-03C-14 as a dynamic GET addressed by the instance param', async () => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(json(diffResource(), 200, { etag: '"3"' }));
    const response = await call(diffRoute.GET, {
      request: request({
        url: `/api/v1/cms/compositions/instances/${instanceId}/update-diff`,
      }),
      params: { instanceId },
    });
    expect(diffRoute.prerender).toBe(false);
    expect(response.status).toBe(200);
    expect(Object.keys(diffRoute).sort()).toEqual(['GET', 'prerender']);
  });

  it('serves CMS-03C-15 as a dynamic POST and refuses a foreign origin before the Worker call', async () => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(
      json({ items: [rowOf(instanceId, '4')] }, 200, { etag: '"10"' }),
    );
    const ok = await call(updatesRoute.POST, {
      request: request({
        url: '/api/v1/cms/compositions/pattern-updates',
        method: 'POST',
        body: acceptBody,
      }),
    });
    expect(updatesRoute.prerender).toBe(false);
    expect(ok.status).toBe(200);
    fetchMock.mockReset();
    const foreign = await call(updatesRoute.POST, {
      request: request({
        url: '/api/v1/cms/compositions/pattern-updates',
        method: 'POST',
        headers: { origin: 'https://evil.test' },
      }),
    });
    expect(foreign.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(Object.keys(updatesRoute).sort()).toEqual(['POST', 'prerender']);
  });
});
