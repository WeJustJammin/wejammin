import { describe, expect, it, vi } from 'vitest';

import { readCmsPatternNestable } from './cms-pattern-nestable';
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
 * cmsPatternNestableRead first-party read proxy (DEC-196; BE03c 184, 413; FE03 CmsPatternVersionDesigner, P2-S12-AC-105): a bodiless
 * GET of the allowlisted query with `contentTypeId` repeated 1-64 times, relayed only as the strict `PatternSelectorPage` that
 * honours the request.
 */
const base = '/api/v1/cms/patterns/nestable';
const second = 'd4000000-0000-4000-8000-0000000000b2';
const both = `contentTypeId=${contentTypeId}&contentTypeId=${second}`;
const get = (query = both, headers: Record<string, string> = {}) =>
  request({ url: `${base}?${query}`, headers });
const types = (count: number): string =>
  Array.from(
    { length: count },
    (_unused, index) =>
      `contentTypeId=d4000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  ).join('&');

describe('nestable proxy: forwarding', () => {
  it('forwards a bodiless GET with every type in request order and the session only, and relays the page with its ETag', async () => {
    const stub = binding(json(selectorPage(), 200, { etag: '"7"' }));
    const response = await readCmsPatternNestable(
      get(`limit=10&${both}&cursor=abc`, { 'if-none-match': '"7"' }),
      stub,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(selectorPage());
    expect(response.headers.get('etag')).toBe('"7"');
    expect(response.headers.get('cache-control')).toBe('no-store');
    const forwarded = forwardedOf(stub);
    expect(forwarded.method).toBe('GET');
    expect(forwarded.url).toBe(
      `https://platform-api.internal${base}?contentTypeId=${contentTypeId}&contentTypeId=${second}&cursor=abc&limit=10`,
    );
    expect(forwarded.headers.get('cookie')).toBe(
      'wj_access=protected; wj_csrf=csrf-token-123',
    );
    expect(forwarded.headers.has('if-none-match')).toBe(false);
    expect(forwarded.headers.has('idempotency-key')).toBe(false);
    expect(forwarded.body).toBeNull();
  });

  it('applies the default limit of 25 and forwards 64 types', async () => {
    const stub = binding(json(selectorPage(), 200, { etag: '"7"' }));
    await readCmsPatternNestable(get(types(64)), stub);
    const url = forwardedOf(stub).url;
    expect(url).toContain('&limit=25');
    expect(url.match(/contentTypeId=/gu)).toHaveLength(64);
  });
});

describe('nestable proxy: admission before any upstream call', () => {
  const refused: Array<[string, () => Request, number]> = [
    ['a POST', () => request({ url: `${base}?${both}`, method: 'POST' }), 400],
    ['no query', () => get(''), 400],
    ['a missing contentTypeId', () => get('limit=5'), 400],
    ['a malformed contentTypeId', () => get('contentTypeId=nope'), 400],
    [
      'one bad id among good ones',
      () => get(`${both}&contentTypeId=nope`),
      400,
    ],
    [
      'a duplicated contentTypeId',
      () => get(`${both}&contentTypeId=${contentTypeId}`),
      400,
    ],
    ['an unknown key', () => get(`${both}&q=x`), 400],
    ['a duplicated cursor', () => get(`${both}&cursor=a&cursor=b`), 400],
    ['an empty cursor', () => get(`${both}&cursor=`), 400],
    [
      'an over-long cursor',
      () => get(`${both}&cursor=${'a'.repeat(513)}`),
      400,
    ],
    ['a non-integer limit', () => get(`${both}&limit=1.5`), 400],
    ['a limit above 50', () => get(`${both}&limit=51`), 422],
    ['a limit of zero', () => get(`${both}&limit=0`), 422],
    ['65 types', () => get(types(65)), 422],
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
    const response = await readCmsPatternNestable(build(), { fetch });
    expect(response.status).toBe(status);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('names the member of a bounds violation', async () => {
    const limit = await readCmsPatternNestable(get(`${both}&limit=0`), {
      fetch: vi.fn(),
    });
    expect(((await limit.json()) as { details: unknown }).details).toEqual({
      violations: [
        { path: '/limit', code: 'invalid', message: 'The value is invalid.' },
      ],
    });
    const count = await readCmsPatternNestable(get(types(65)), {
      fetch: vi.fn(),
    });
    expect(((await count.json()) as { details: unknown }).details).toEqual({
      violations: [
        {
          path: '/contentTypeId',
          code: 'invalid',
          message: 'The value is invalid.',
        },
      ],
    });
  });

  it('is unavailable without a platform binding', async () => {
    expect((await readCmsPatternNestable(get(), undefined)).status).toBe(503);
  });
});

describe('nestable proxy: the answer is verified before it is relayed', () => {
  const run = async (upstream: Response) =>
    readCmsPatternNestable(get(), binding(upstream));

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
    ['a 204', new Response(null, { status: 204 })],
  ])('answers 502 for %s', async (_name, upstream) => {
    expect((await run(upstream)).status).toBe(502);
  });
});

describe('nestable proxy: refusals', () => {
  const run = async (upstream: Response) =>
    readCmsPatternNestable(get(), binding(upstream));

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

  it('relays a 404 and a 401 recovery action, and answers an undeclared 409 (matrix: not applicable, DEC-232) with a local 502', async () => {
    expect((await run(apiError(404, 'COMPOSITION_NOT_FOUND'))).status).toBe(
      404,
    );
    expect(
      (await run(apiError(409, 'COMPOSITION_VERSION_CONFLICT'))).status,
    ).toBe(502);
    const unauthenticated = await run(apiError(401, 'UNAUTHENTICATED'));
    expect(unauthenticated.status).toBe(401);
    expect(
      ((await unauthenticated.json()) as { details: unknown }).details,
    ).toEqual({ recoveryAction: 'reauthenticate' });
  });

  it('relays a 429 with its bounded wait and a dependency failure as retryable', async () => {
    const limited = await run(
      apiError(
        429,
        'RATE_LIMITED',
        { retryAfterSeconds: 12, limit: 300, secret: 'x' },
        { 'retry-after': '12' },
      ),
    );
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toBe('12');
    expect(((await limited.json()) as { details: unknown }).details).toEqual({
      retryAfterSeconds: 12,
      limit: 300,
    });
    const relayed = await run(
      apiError(504, 'DEPENDENCY_UNAVAILABLE', { raw: 'db down' }),
    );
    expect(relayed.status).toBe(504);
    expect(((await relayed.json()) as { details: unknown }).details).toEqual({
      dependencyClass: 'cms_composition',
      retryable: true,
    });
  });

  it('answers a thrown binding with 503 and a refusal that is not the catalog answer of its status with a local 502', async () => {
    expect(
      (await readCmsPatternNestable(get(), binding(new Error('down')))).status,
    ).toBe(503);
    expect((await run(apiError(403, 'SOMETHING_ELSE'))).status).toBe(502);
  });
});
