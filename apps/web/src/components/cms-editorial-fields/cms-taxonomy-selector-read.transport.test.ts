import { describe, expect, it, vi } from 'vitest';

import { readCmsTaxonomySelector } from './cms-taxonomy-selector-read';

import {
  PARENT_ID,
  SELECTOR_PATH,
  SELECTOR_QUERY,
  jsonResponse,
  rawPage,
  readSelector,
  readSelectorWith,
  selectorPage,
  selectorTerm,
  served,
} from './cms-taxonomy-selector-read.test-support';

/*
 * The transport of `readCmsTaxonomySelector` (CMS-03C-17): an exact same-origin `GET` of the
 * selector path, the allowlisted query only, a strict query validated before dispatch, and a 200
 * accepted only as a strict, `no-store` page of THIS request whose quoted ETag is its version.
 * Only `fetch` is replaced; no request body or mutation header is ever sent.
 */

const pathOf = (url: string): string => {
  const index = url.indexOf('?');
  return index === -1 ? url : url.slice(0, index);
};

const searchOf = (url: string): Record<string, string> => {
  const index = url.indexOf('?');
  return Object.fromEntries(
    new URLSearchParams(index === -1 ? '' : url.slice(index + 1)),
  );
};

const call = (
  fetcher: { readonly mock: { readonly calls: readonly unknown[][] } },
  index = 0,
): [string, RequestInit] =>
  fetcher.mock.calls[index] as unknown as [string, RequestInit];

describe('readCmsTaxonomySelector transport', () => {
  it('reads the same-origin selector path with the allowlisted query and no mutation header', async () => {
    const { result, fetcher } = await readSelector(served());
    const [url, init] = call(fetcher);
    expect(pathOf(url)).toBe(SELECTOR_PATH);
    expect(searchOf(url)).toEqual({
      typeKey: 'article',
      fieldKey: 'instruments',
      locale: 'en-US',
      limit: '50',
    });
    expect(init).toMatchObject({
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
    });
    expect(init.headers).toBeUndefined();
    expect(init.body).toBeUndefined();
    // The read's own deadline signal (DEC-246(1)); it follows a caller's abort (next test).
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(result).toEqual({ kind: 'loaded', page: selectorPage() });
  });

  it('encodes the signed cursor and carries the requested limit', async () => {
    const { result, fetcher } = await readSelector(served(), {
      ...SELECTOR_QUERY,
      cursor: 'a b+c/d=',
      limit: 10,
    });
    const [url] = call(fetcher);
    expect(searchOf(url)).toEqual({
      typeKey: 'article',
      fieldKey: 'instruments',
      locale: 'en-US',
      cursor: 'a b+c/d=',
      limit: '10',
    });
    expect(url).toContain('cursor=a+b%2Bc%2Fd%3D');
    expect(result.kind).toBe('loaded');
  });

  it('treats a null cursor as no cursor', async () => {
    const { fetcher } = await readSelector(served(), {
      ...SELECTOR_QUERY,
      cursor: null,
    });
    expect(searchOf(call(fetcher)[0])).toEqual({
      typeKey: 'article',
      fieldKey: 'instruments',
      locale: 'en-US',
      limit: '50',
    });
  });

  it.each([1, 100])('accepts the limit boundary %i', async (limit) => {
    const { result, fetcher } = await readSelector(served(), {
      ...SELECTOR_QUERY,
      limit,
    });
    expect(result.kind).toBe('loaded');
    expect(searchOf(call(fetcher)[0]).limit).toBe(String(limit));
  });

  it('accepts a cursor at the 512-character limit', async () => {
    const cursor = 'a'.repeat(512);
    const { result, fetcher } = await readSelector(served(), {
      ...SELECTOR_QUERY,
      cursor,
    });
    expect(result.kind).toBe('loaded');
    expect(searchOf(call(fetcher)[0]).cursor).toBe(cursor);
  });

  it('propagates the caller abort to the signal of the fetch, and answers unavailable', async () => {
    const controller = new AbortController();
    let sentAborted: boolean | null = null;
    const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
      controller.abort();
      sentAborted = init?.signal?.aborted ?? null;
      return served();
    });
    const result = await readCmsTaxonomySelector(
      SELECTOR_QUERY,
      fetcher as unknown as typeof fetch,
      controller.signal,
    );
    // The fetch gets the read's own deadline signal (DEC-246(1)); it follows the caller's abort.
    expect(sentAborted).toBe(true);
    expect(result).toEqual({ kind: 'unavailable' });
  });

  it.each([400, 401, 403, 404, 409, 415, 422])(
    'relays a %i as a fixed rejection',
    async (status) => {
      const { result } = await readSelector(new Response('{}', { status }));
      expect(result).toEqual({
        kind: 'rejected',
        status,
        retryAfterSeconds: null,
      });
    },
  );

  const REFUSED_QUERIES: ReadonlyArray<
    readonly [string, Readonly<Record<string, unknown>>, number]
  > = [
    ['a missing field key', { typeKey: 'article', locale: 'en-US' }, 400],
    ['a missing locale', { typeKey: 'article', fieldKey: 'instruments' }, 400],
    ['a missing type key', { fieldKey: 'instruments', locale: 'en-US' }, 400],
    ['an unknown member', { ...SELECTOR_QUERY, owner: 'x' }, 400],
    ['an empty cursor', { ...SELECTOR_QUERY, cursor: '' }, 400],
    [
      'a cursor over 512 characters',
      { ...SELECTOR_QUERY, cursor: 'a'.repeat(513) },
      400,
    ],
    [
      'a type key outside the grammar',
      { ...SELECTOR_QUERY, typeKey: 'Article' },
      422,
    ],
    [
      'a type key that starts with a digit',
      { ...SELECTOR_QUERY, typeKey: '1article' },
      422,
    ],
    [
      'a field key outside the grammar',
      { ...SELECTOR_QUERY, fieldKey: 'has space' },
      422,
    ],
    [
      'a field key over 64 characters',
      { ...SELECTOR_QUERY, fieldKey: `f${'a'.repeat(64)}` },
      422,
    ],
    ['a locale outside the grammar', { ...SELECTOR_QUERY, locale: 'e' }, 422],
    [
      'a locale with an underscore',
      { ...SELECTOR_QUERY, locale: 'en_US' },
      422,
    ],
    ['a limit of zero', { ...SELECTOR_QUERY, limit: 0 }, 422],
    ['a limit over a hundred', { ...SELECTOR_QUERY, limit: 101 }, 422],
    ['a limit far over a hundred', { ...SELECTOR_QUERY, limit: 999_999 }, 422],
  ];

  it.each(REFUSED_QUERIES)(
    'rejects %s before the proxy with a %i',
    async (_name, query, status) => {
      const { result, fetcher } = await readSelector(served(), query);
      expect(result).toEqual({
        kind: 'rejected',
        status,
        retryAfterSeconds: null,
      });
      expect(fetcher).not.toHaveBeenCalled();
    },
  );

  const UNUSABLE_LIMITS: ReadonlyArray<readonly [string, unknown]> = [
    ['a fractional limit', 1.5],
    ['a limit that is not a number', Number.NaN],
    ['a limit that is not a number at all', '10'],
  ];

  it.each(UNUSABLE_LIMITS)(
    'rejects %s before the proxy',
    async (_name, limit) => {
      const { result, fetcher } = await readSelector(served(), {
        ...SELECTOR_QUERY,
        limit,
      });
      expect(result.kind).toBe('rejected');
      expect(fetcher).not.toHaveBeenCalled();
    },
  );

  it('accepts a 200 that declares no-store', async () => {
    const { result } = await readSelector(served());
    expect(result.kind).toBe('loaded');
  });

  it('refuses a 200 that does not declare no-store', async () => {
    const { result } = await readSelector(
      jsonResponse(200, selectorPage(), { etag: '"7"' }),
    );
    expect(result).toEqual({ kind: 'unavailable' });
  });

  it('refuses a 200 whose cache directive is not no-store', async () => {
    const { result } = await readSelector(
      jsonResponse(200, selectorPage(), {
        etag: '"7"',
        'cache-control': 'private, max-age=60',
      }),
    );
    expect(result).toEqual({ kind: 'unavailable' });
  });

  const UNAVAILABLE: ReadonlyArray<readonly [string, Response | Error]> = [
    ['a 500', new Response('{}', { status: 500 })],
    ['an unexpected 418', new Response('{}', { status: 418 })],
    ['a redirect response', new Response('{}', { status: 302 })],
    ['a redirect error', new Error('redirect')],
    ['a network failure', new Error('offline')],
    [
      'a body that is not JSON',
      new Response('x', {
        status: 200,
        headers: { etag: '"7"', 'cache-control': 'no-store' },
      }),
    ],
    [
      'a body that is not the page',
      jsonResponse(
        200,
        { items: 'x' },
        { etag: '"7"', 'cache-control': 'no-store' },
      ),
    ],
    [
      'a missing ETag',
      jsonResponse(200, selectorPage(), { 'cache-control': 'no-store' }),
    ],
    ['a wrong ETag', served({}, '"9"')],
    ['a weak ETag', served({}, 'W/"7"')],
    [
      'a page that leaks a member',
      jsonResponse(
        200,
        { ...selectorPage(), owner: 'x' },
        { etag: '"7"', 'cache-control': 'no-store' },
      ),
    ],
    [
      'a flat term with a parent',
      jsonResponse(
        200,
        rawPage({
          items: [selectorTerm({ shape: 'flat', parentId: PARENT_ID })],
        }),
        { etag: '"7"', 'cache-control': 'no-store' },
      ),
    ],
  ];

  it.each(UNAVAILABLE)('is unavailable for %s', async (_name, answer) => {
    const { result } = await readSelector(answer);
    expect(result).toEqual({ kind: 'unavailable' });
  });

  it('is unavailable when the answer is not a Response', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue({} as Response);
    expect(await readSelectorWith(fetcher)).toEqual({ kind: 'unavailable' });
  });
});
