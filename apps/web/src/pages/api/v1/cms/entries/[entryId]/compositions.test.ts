import { describe, expect, it, vi } from 'vitest';

const fetchMock = vi.hoisted(() => vi.fn());
vi.mock('cloudflare:workers', () => ({
  env: { PLATFORM_API: { fetch: fetchMock } },
}));

import * as route from './compositions';
import {
  entryId,
  instancesPage,
  json,
  request,
} from '../../../../../../server/cms-composition-instances.test-support';

/*
 * The first-party endpoint of the composition instance list (cmsCompositionInstancesRead, DEC-206) stays dynamic,
 * addressed by the entry param, and reaches the Worker only through the private PLATFORM_API binding. The proxy itself
 * is proved in `server/cms-composition-instances-list.test.ts`; this file proves the wiring.
 */
const call = (context: unknown): Promise<Response> =>
  Promise.resolve(route.GET(context as never) as Response);

describe('first-party composition instance list endpoint', () => {
  it('serves the read as a dynamic GET addressed by the entry param, through the binding', async () => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(json(instancesPage()));
    const response = await call({
      request: request({ url: `/api/v1/cms/entries/${entryId}/compositions` }),
      params: { entryId },
    });
    expect(route.prerender).toBe(false);
    expect(response.status).toBe(200);
    expect((fetchMock.mock.calls[0]?.[0] as Request).url).toBe(
      `https://platform-api.internal/api/v1/cms/entries/${entryId}/compositions`,
    );
    expect(Object.keys(route).sort()).toEqual(['GET', 'prerender']);
  });

  it('refuses a missing entry param before the Worker call', async () => {
    fetchMock.mockReset();
    const response = await call({
      request: request({ url: `/api/v1/cms/entries/${entryId}/compositions` }),
      params: {},
    });
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses a write method: the module exports only GET', () => {
    expect(Object.keys(route)).not.toContain('POST');
  });
});
