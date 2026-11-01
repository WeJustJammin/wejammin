import { describe, expect, it, vi } from 'vitest';

import { readCmsPatternSelector } from './cms-composition-instances-selector';
import {
  apiError,
  binding,
  contentTypeId,
  forwardedOf,
  json,
  request,
  selectorItem,
  selectorPage,
} from './cms-composition-instances.test-support';

/*
 * CMS-03C-13 first-party read proxy (FE03 886, 1508; BE03c 175; P2-S12-AC-111): a bodiless GET of the allowlisted query,
 * relayed only as the strict `PatternSelectorPage` that honours the request.
 */
const base = '/api/v1/cms/patterns/selector';
const url = (query = `contentTypeId=${contentTypeId}`) => `${base}?${query}`;
const get = (query?: string, headers: Record<string, string> = {}) =>
  request({ url: url(query), headers });

describe('CMS-03C-13 selector proxy: forwarding', () => {
  it('forwards a bodiless GET of the canonical query with the session only and relays the page with its ETag', async () => {
    const stub = binding(json(selectorPage(), 200, { etag: '"7"' }));
    const response = await readCmsPatternSelector(
      get(`limit=10&contentTypeId=${contentTypeId}&cursor=abc`, {
        'if-none-match': '"7"',
      }),
      stub,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(selectorPage());
    expect(response.headers.get('etag')).toBe('"7"');
    expect(response.headers.get('cache-control')).toBe('no-store');
    const forwarded = forwardedOf(stub);
    expect(forwarded.method).toBe('GET');
    expect(forwarded.url).toBe(
      `https://platform-api.internal${base}?contentTypeId=${contentTypeId}&cursor=abc&limit=10`,
    );
    expect(forwarded.headers.get('cookie')).toBe(
      'wj_access=protected; wj_csrf=csrf-token-123',
    );
    expect(forwarded.headers.has('if-none-match')).toBe(false);
    expect(forwarded.headers.has('idempotency-key')).toBe(false);
    expect(forwarded.body).toBeNull();
  });

  it('applies the default limit of 25 so every page of one listing is bound to one size', async () => {
    const stub = binding(json(selectorPage(), 200, { etag: '"7"' }));
    await readCmsPatternSelector(get(), stub);
    expect(forwardedOf(stub).url).toContain('&limit=25');
  });
});

describe('CMS-03C-13 selector proxy: admission before any upstream call', () => {
  const refused: Array<[string, () => Request, number]> = [
    ['a POST', () => request({ url: url(), method: 'POST' }), 400],
    ['a missing contentTypeId', () => get('limit=5'), 400],
    ['a malformed contentTypeId', () => get('contentTypeId=nope'), 400],
    ['an unknown key', () => get(`contentTypeId=${contentTypeId}&q=x`), 400],
    [
      'a duplicated key',
      () =>
        get(`contentTypeId=${contentTypeId}&contentTypeId=${contentTypeId}`),
      400,
    ],
    [
      'an empty cursor',
      () => get(`contentTypeId=${contentTypeId}&cursor=`),
      400,
    ],
    [
      'an over-long cursor',
      () => get(`contentTypeId=${contentTypeId}&cursor=${'a'.repeat(513)}`),
      400,
    ],
    [
      'a non-integer limit',
      () => get(`contentTypeId=${contentTypeId}&limit=1.5`),
      400,
    ],
    [
      'a limit above 50',
      () => get(`contentTypeId=${contentTypeId}&limit=51`),
      422,
    ],
    [
      'a limit of zero',
      () => get(`contentTypeId=${contentTypeId}&limit=0`),
      422,
    ],
    [
      'an Idempotency-Key',
      () => get(undefined, { 'idempotency-key': 'composition-key-0001' }),
      400,
    ],
    ['an If-Match', () => get(undefined, { 'if-match': '"1"' }), 400],
    [
      'request media',
      () => get(undefined, { 'content-type': 'application/json' }),
      415,
    ],
    [
      'a foreign origin',
      () => get(undefined, { origin: 'https://evil.test' }),
      403,
    ],
  ];

  it.each(refused)('refuses %s', async (_name, build, status) => {
    const fetch = vi.fn();
    const response = await readCmsPatternSelector(build(), { fetch });
    expect(response.status).toBe(status);
    expect(fetch).not.toHaveBeenCalled();
    const body = (await response.json()) as { details: unknown };
    if (status === 422)
      expect(body.details).toEqual({
        violations: [
          { path: '/limit', code: 'invalid', message: 'The value is invalid.' },
        ],
      });
  });

  it('is unavailable without a platform binding', async () => {
    const response = await readCmsPatternSelector(get(), undefined);
    expect(response.status).toBe(503);
  });
});

describe('CMS-03C-13 selector proxy: the answer is verified before it is relayed', () => {
  const run = async (upstream: Response) =>
    readCmsPatternSelector(get(), binding(upstream));

  it.each([
    [
      'a body that is not the strict page',
      json({ items: [], extra: 1 }, 200, { etag: '"7"' }),
    ],
    [
      'an ETag that is not the page version',
      json(selectorPage(), 200, { etag: '"8"' }),
    ],
    ['a missing ETag', json(selectorPage())],
    [
      'more items than the limit',
      json(
        selectorPage(
          Array.from({ length: 26 }, (_, i) =>
            selectorItem(`p${String(i).padStart(2, '0')}-key`, 1),
          ),
        ),
        200,
        { etag: '"7"' },
      ),
    ],
    [
      'a repeated version row',
      json(selectorPage([selectorItem(), selectorItem()]), 200, {
        etag: '"7"',
      }),
    ],
    [
      'one version id on two rows',
      json(
        selectorPage([
          selectorItem('a-key', 1),
          {
            ...selectorItem('b-key', 1),
            patternVersionId: selectorItem('a-key', 1).patternVersionId,
          },
        ]),
        200,
        { etag: '"7"' },
      ),
    ],
    [
      'rows out of keyset order',
      json(
        selectorPage([selectorItem('b-key', 1), selectorItem('a-key', 1)]),
        200,
        { etag: '"7"' },
      ),
    ],
    [
      'a cursor after a short page',
      json(selectorPage([selectorItem()], 'next'), 200, { etag: '"7"' }),
    ],
    ['an undeclared 409', apiError(409, 'COMPOSITION_VERSION_CONFLICT')],
    ['a 204', new Response(null, { status: 204 })],
  ])('answers 502 for %s', async (_name, upstream) => {
    expect((await run(upstream)).status).toBe(502);
  });

  it('accepts a full page with a cursor and the version-descending order within a key', async () => {
    const items = Array.from({ length: 2 }, (_, i) =>
      selectorItem('hero-block', 5 - i),
    );
    const stub = binding(
      json(selectorPage(items, 'next'), 200, { etag: '"7"' }),
    );
    const response = await readCmsPatternSelector(
      get(`contentTypeId=${contentTypeId}&limit=2`),
      stub,
    );
    expect(response.status).toBe(200);
  });
});

describe('CMS-03C-13 selector proxy: refusals', () => {
  const run = async (upstream: Response) =>
    readCmsPatternSelector(get(), binding(upstream));

  it('relays a 403 with the capability token alone and drops a token of another operation', async () => {
    const typed = await run(
      apiError(403, 'COMPOSITION_FORBIDDEN', {
        reasonCode: 'capability_missing',
      }),
    );
    expect(typed.status).toBe(403);
    expect(((await typed.json()) as { details: unknown }).details).toEqual({
      reasonCode: 'capability_missing',
    });
    const other = await run(
      apiError(403, 'COMPOSITION_FORBIDDEN', {
        reasonCode: 'separation_of_duties',
      }),
    );
    expect(((await other.json()) as { details: unknown }).details).toEqual({});
  });

  it('relays a 404 and a 401 recovery action', async () => {
    expect((await run(apiError(404, 'COMPOSITION_NOT_FOUND'))).status).toBe(
      404,
    );
    const unauthenticated = await run(apiError(401, 'UNAUTHENTICATED'));
    expect(unauthenticated.status).toBe(401);
    expect(
      ((await unauthenticated.json()) as { details: unknown }).details,
    ).toEqual({
      recoveryAction: 'reauthenticate',
    });
  });

  it('relays a 429 with its bounded wait', async () => {
    const response = await run(
      apiError(
        429,
        'RATE_LIMITED',
        { retryAfterSeconds: 12, limit: 300, secret: 'x' },
        { 'retry-after': '12' },
      ),
    );
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('12');
    expect(((await response.json()) as { details: unknown }).details).toEqual({
      retryAfterSeconds: 12,
      limit: 300,
    });
  });

  it('relays a dependency failure as retryable and a thrown binding as 503', async () => {
    const relayed = await run(
      apiError(504, 'DEPENDENCY_UNAVAILABLE', { raw: 'db down' }),
    );
    expect(relayed.status).toBe(504);
    expect(((await relayed.json()) as { details: unknown }).details).toEqual({
      dependencyClass: 'cms_composition',
      retryable: true,
    });
    const thrown = await readCmsPatternSelector(
      get(),
      binding(new Error('down')),
    );
    expect(thrown.status).toBe(503);
  });

  it('turns a refusal whose code is not the catalog code of its status into a local 502', async () => {
    expect((await run(apiError(403, 'SOMETHING_ELSE'))).status).toBe(502);
  });
});
