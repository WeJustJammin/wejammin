import { describe, expect, it } from 'vitest';

import {
  jsonContinuation,
  wantsJsonResponse,
} from './content-schema-registry-mutation-outcome';

/**
 * A browser `fetch` with `redirect: 'manual'` receives an opaque redirect
 * (status 0, no Location), so the island can never read a 303. A JSON client
 * is answered with the facade's own success body plus a same-origin Location;
 * a native form post keeps the 303.
 */
describe('registry mutation continuation for fetch clients', () => {
  it.each([
    ['application/json', true],
    ['application/json, text/html', true],
    ['text/html,application/xhtml+xml', false],
    ['*/*', false],
    [null, false],
  ] as const)('reads Accept %s as wants-JSON=%s', (accept, expected) => {
    const request = new Request('https://app.test/app/cms-content-modeling', {
      method: 'POST',
      headers: accept === null ? {} : { accept },
    });
    expect(wantsJsonResponse(request)).toBe(expected);
  });

  it('keeps the facade status and JSON body and adds the continuation Location', async () => {
    const upstream = Response.json(
      { id: '00000002-0002-4000-8000-e3461fc40002' },
      { status: 201, headers: { etag: '"1"', 'x-request-id': 'req-1' } },
    );
    const next = jsonContinuation(
      upstream,
      '/app/cms-content-modeling/schema-reviews/abc',
    );
    expect(next.status).toBe(201);
    expect(next.headers.get('location')).toBe(
      '/app/cms-content-modeling/schema-reviews/abc',
    );
    expect(next.headers.get('content-type')).toMatch(/^application\/json/u);
    expect(next.headers.get('etag')).toBe('"1"');
    expect(await next.json()).toEqual({
      id: '00000002-0002-4000-8000-e3461fc40002',
    });
  });

  it.each(['https://evil.example/', '//evil.example/', 'app/relative', ''])(
    'refuses the non-path continuation %j',
    (location) => {
      expect(() => jsonContinuation(Response.json({}), location)).toThrow(
        /continuation/iu,
      );
    },
  );
});
