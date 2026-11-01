import { describe, expect, it } from 'vitest';

import { readCmsCompositionInstances } from './cms-composition-instances-list';
import {
  apiError,
  binding,
  entryId,
  forwardedOf,
  instanceId,
  instanceId2,
  instancesPage,
  json,
  request,
  revisionId,
  rowOf,
} from './cms-composition-instances.test-support';

/*
 * cmsCompositionInstancesRead first-party read proxy (DEC-206 as aligned to BE00; BE03c route registry, validation
 * `entryId/cursor/limit`, error matrix): a bodiless GET of the entry path, the optional opaque signed cursor and the
 * optional `limit` (1-50, default 25), relayed only as the strict `CompositionInstancePage` that honours the request.
 * No entity tag is relayed: the page carries no version.
 */
const base = `/api/v1/cms/entries/${entryId}/compositions`;
const get = (query = '', headers: Record<string, string> = {}, id = entryId) =>
  request({
    url: `/api/v1/cms/entries/${id}/compositions${query}`,
    headers,
  });
const read = (
  query: string | undefined,
  stub: ReturnType<typeof binding>,
  headers: Record<string, string> = {},
  id = entryId,
) => readCmsCompositionInstances(get(query, headers, id), stub, id);

describe('cmsCompositionInstancesRead proxy: forwarding', () => {
  it('forwards a bodiless GET with the session only and relays the page uncached, without an entity tag', async () => {
    const stub = binding(json(instancesPage(), 200, { etag: '"9"' }));
    const response = await read(undefined, stub, {
      'if-none-match': '"9"',
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(instancesPage());
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('etag')).toBeNull();
    const forwarded = forwardedOf(stub);
    expect(forwarded.method).toBe('GET');
    expect(forwarded.url).toBe(`https://platform-api.internal${base}`);
    expect(forwarded.headers.get('cookie')).toBe(
      'wj_access=protected; wj_csrf=csrf-token-123',
    );
    expect(forwarded.headers.has('if-none-match')).toBe(false);
    expect(forwarded.headers.has('idempotency-key')).toBe(false);
    expect(forwarded.body).toBeNull();
  });

  it('forwards the opaque cursor byte for byte and nothing else', async () => {
    const stub = binding(json(instancesPage()));
    const cursor = 'a+b/c=d==';
    await read(`?cursor=${encodeURIComponent(cursor)}`, stub);
    expect(new URL(forwardedOf(stub).url).searchParams.get('cursor')).toBe(
      cursor,
    );
    expect([...new URL(forwardedOf(stub).url).searchParams.keys()]).toEqual([
      'cursor',
    ]);
  });

  it('forwards limit as given and applies no default of its own', async () => {
    const stub = binding(json(instancesPage()));
    await read('?limit=50', stub);
    expect([...new URL(forwardedOf(stub).url).searchParams]).toEqual([
      ['limit', '50'],
    ]);
    const both = binding(json(instancesPage()));
    await read('?cursor=abc&limit=7', both);
    expect(
      Object.fromEntries(new URL(forwardedOf(both).url).searchParams),
    ).toEqual({ cursor: 'abc', limit: '7' });
  });

  it('relays an empty page of an entry without a draft revision', async () => {
    const empty = { revisionId: null, items: [], nextCursor: null };
    const response = await read(undefined, binding(json(empty)));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(empty);
  });
});

describe('cmsCompositionInstancesRead proxy: admission before any upstream call', () => {
  const refused: Array<[string, () => Request, number, string?]> = [
    ['a POST', () => request({ url: base, method: 'POST' }), 400],
    ['a malformed entry id', () => get('', {}, 'nope'), 400],
    ['an unknown key', () => get('?offset=5'), 400],
    ['an empty limit', () => get('?limit='), 400],
    ['a duplicated limit', () => get('?limit=5&limit=5'), 400],
    ['a zero limit', () => get('?limit=0'), 400],
    ['a negative limit', () => get('?limit=-1'), 400],
    ['a limit above 50', () => get('?limit=51'), 400],
    ['a fractional limit', () => get('?limit=2.5'), 400],
    ['an exponent limit', () => get('?limit=1e1'), 400],
    ['a padded limit', () => get('?limit=05'), 400],
    ['a non-numeric limit', () => get('?limit=abc'), 400],
    ['a revision key', () => get(`?revisionId=${revisionId}`), 400],
    ['an empty cursor', () => get('?cursor='), 400],
    ['a duplicated cursor', () => get('?cursor=a&cursor=b'), 400],
    ['an over-long cursor', () => get(`?cursor=${'a'.repeat(513)}`), 400],
    [
      'an Idempotency-Key',
      () => get('', { 'idempotency-key': 'k-0000000001' }),
      400,
    ],
    ['an If-Match', () => get('', { 'if-match': '"3"' }), 400],
    [
      'a media type',
      () => get('', { 'content-type': 'application/json' }),
      415,
    ],
    ['a foreign origin', () => get('', { origin: 'https://evil.test' }), 403],
  ];
  it.each(refused)(
    '%s is refused with %i and never reaches the Worker',
    async (_name, build, status) => {
      const stub = binding(json(instancesPage()));
      const response = await readCmsCompositionInstances(
        build(),
        stub,
        entryId,
      );
      expect(response.status).toBe(status);
      expect(stub.fetch).not.toHaveBeenCalled();
    },
  );

  it('a binding that is not the platform API is a 503', async () => {
    const response = await readCmsCompositionInstances(get(), {}, entryId);
    expect(response.status).toBe(503);
  });

  it('a path id that is not the request path entry is refused (the param and the URL must agree)', async () => {
    const stub = binding(json(instancesPage()));
    const response = await readCmsCompositionInstances(
      get(),
      stub,
      'd4000000-0000-4000-8000-0000000000ff',
    );
    expect(response.status).toBe(400);
    expect(stub.fetch).not.toHaveBeenCalled();
  });
});

describe('cmsCompositionInstancesRead proxy: pages', () => {
  it('relays a page of exactly the requested limit with its cursor', async () => {
    const page = instancesPage(
      [rowOf(instanceId, '3'), rowOf(instanceId2, '1')],
      'next-cursor',
    );
    const response = await read('?limit=2', binding(json(page)));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(page);
  });
});

describe('cmsCompositionInstancesRead proxy: answers', () => {
  it.each([
    [403, 'COMPOSITION_FORBIDDEN', { reasonCode: 'capability_missing' }],
    [404, 'COMPOSITION_NOT_FOUND', {}],
    [400, 'INVALID_REQUEST', {}],
    [401, 'UNAUTHENTICATED', { recoveryAction: 'reauthenticate' }],
  ])(
    'relays the catalog %i as its first-party refusal',
    async (status, code, details) => {
      const response = await read(
        undefined,
        binding(
          apiError(status, code, {
            reasonCode: 'capability_missing',
            extra: 'x',
          }),
        ),
      );
      expect(response.status).toBe(status);
      const body = (await response.json()) as {
        code: string;
        details: unknown;
      };
      expect(body.code).toBe(code);
      expect(body.details).toEqual(details);
    },
  );

  it('a 409 or 422 is not an answer of this read: a local 502', async () => {
    for (const [status, code] of [
      [409, 'COMPOSITION_VERSION_CONFLICT'],
      [422, 'COMPOSITION_VALIDATION_FAILED'],
    ] as const) {
      const response = await read(undefined, binding(apiError(status, code)));
      expect(response.status).toBe(502);
    }
  });

  it('a fault from the Worker or a thrown binding is a dependency failure', async () => {
    expect((await read(undefined, binding(new Error('down')))).status).toBe(
      503,
    );
    expect(
      (await read(undefined, binding(apiError(503, 'DEPENDENCY_UNAVAILABLE'))))
        .status,
    ).toBe(503);
  });

  it.each([
    [
      'a member outside the contract',
      { ...instancesPage(), pageVersion: '1' },
      undefined,
    ],
    [
      'a retired row',
      instancesPage([rowOf(instanceId, '3', { state: 'retired' })]),
      undefined,
    ],
    [
      'a row of another revision',
      instancesPage([rowOf(instanceId, '3', { revisionId: instanceId2 })]),
      undefined,
    ],
    ['a cursor on a short page', instancesPage(undefined, 'next'), undefined],
    [
      'more rows than the requested limit',
      instancesPage(undefined, null),
      '?limit=1',
    ],
    [
      'a cursor on fewer rows than the requested limit',
      instancesPage(undefined, 'next'),
      '?limit=3',
    ],
    [
      'more rows than the default page of 25',
      instancesPage(
        Array.from({ length: 26 }, (_, n) =>
          rowOf(`d4000000-0000-4000-8000-${String(200_000_000_000 + n)}`, '1', {
            path: `/main/r${n}`,
          }),
        ),
      ),
      undefined,
    ],
    [
      'a null revision for a request that carried a cursor',
      { revisionId: null, items: [], nextCursor: null },
      '?cursor=abc',
    ],
    ['a non-JSON body', new Response('nope', { status: 200 }), undefined],
  ])(
    'an answer with %s is a local 502, never relayed',
    async (_name, value, query) => {
      const upstream = value instanceof Response ? value : json(value);
      const response = await read(query, binding(upstream));
      expect(response.status).toBe(502);
      expect(response.headers.get('etag')).toBeNull();
    },
  );
});
