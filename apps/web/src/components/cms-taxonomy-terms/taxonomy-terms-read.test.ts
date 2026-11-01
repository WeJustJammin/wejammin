import { describe, expect, it, vi } from 'vitest';

import {
  SURVIVOR_ID,
  TAXONOMY_ID,
  jsonResponse,
  termsPageFixture,
} from '../../server/cms-taxonomy-platform.test-support';
import { readTaxonomyTerms, verifiedTermsPage } from './taxonomy-terms-fetch';

const page = () => termsPageFixture();
interface Plain {
  items: Array<Record<string, unknown>>;
  nextCursor?: unknown;
  pageVersion?: unknown;
  [key: string]: unknown;
}
const mutate = (change: (copy: Plain) => void): unknown => {
  const copy = structuredClone(page()) as unknown as Plain;
  change(copy);
  return copy;
};
const at = (copy: Plain, index: number): Record<string, unknown> =>
  copy.items[index] as Record<string, unknown>;

describe('verifiedTermsPage', () => {
  it('keeps exactly the members the term form uses', () => {
    const verified = verifiedTermsPage(page(), '"7"');
    expect(verified?.pageVersion).toBe('7');
    expect(verified?.nextCursor).toBeNull();
    expect(verified?.items.map((item) => item.termKey)).toEqual([
      'guitar',
      'organ',
    ]);
    expect(Object.keys(verified?.items[0] ?? {}).sort()).toEqual(
      [
        'aliases',
        'labels',
        'lifecycle',
        'parentId',
        'successorId',
        'termId',
        'termKey',
        'version',
      ].sort(),
    );
  });

  it('accepts a merged term with its successor, an empty page and a continuation cursor', () => {
    const merged = mutate((p) => {
      Object.assign(at(p, 0), {
        lifecycle: 'merged',
        successorId: SURVIVOR_ID,
      });
      p.nextCursor = 'abc.def';
    });
    const verified = verifiedTermsPage(merged, '"7"');
    expect(verified?.items[0]?.successorId).toBe(SURVIVOR_ID);
    expect(verified?.nextCursor).toBe('abc.def');
    expect(
      verifiedTermsPage(
        { items: [], nextCursor: null, pageVersion: '1' },
        '"1"',
      )?.items,
    ).toEqual([]);
  });

  const refused: ReadonlyArray<readonly [string, unknown, string | null]> = [
    ['a wrong ETag', page(), '"8"'],
    ['a missing ETag', page(), null],
    ['a weak ETag', page(), 'W/"7"'],
    ['a non-object', 'x', '"7"'],
    ['an extra top-level member', mutate((p) => (p.owner = 'x')), '"7"'],
    ['a missing cursor member', mutate((p) => delete p.nextCursor), '"7"'],
    [
      'a cursor over 512 characters',
      mutate((p) => (p.nextCursor = 'a'.repeat(513))),
      '"7"',
    ],
    ['a non-string cursor', mutate((p) => (p.nextCursor = 4)), '"7"'],
    ['a malformed page version', mutate((p) => (p.pageVersion = '0')), '"0"'],
    [
      'more than 50 rows',
      {
        items: Array.from({ length: 51 }, (_, i) => ({
          ...(page().items[0] as object),
          termId: `50000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
          termKey: `key-${i}`,
        })),
        nextCursor: null,
        pageVersion: '7',
      },
      '"7"',
    ],
    ['a repeated term id', mutate((p) => (p.items[1] = at(p, 0))), '"7"'],
    ['an extra member of a term', mutate((p) => (at(p, 0).owner = 'x')), '"7"'],
    ['a malformed term id', mutate((p) => (at(p, 0).termId = 'x')), '"7"'],
    ['a malformed key', mutate((p) => (at(p, 0).termKey = 'Bad')), '"7"'],
    [
      'an unknown lifecycle',
      mutate((p) => (at(p, 0).lifecycle = 'gone')),
      '"7"',
    ],
    ['a malformed version', mutate((p) => (at(p, 0).version = '0')), '"7"'],
    ['a malformed parent', mutate((p) => (at(p, 0).parentId = 'x')), '"7"'],
    [
      'a successor on an active term',
      mutate((p) => (at(p, 0).successorId = SURVIVOR_ID)),
      '"7"',
    ],
    [
      'a merged term without a successor',
      mutate((p) => (at(p, 0).lifecycle = 'merged')),
      '"7"',
    ],
    [
      'a malformed successor',
      mutate((p) =>
        Object.assign(at(p, 0), { lifecycle: 'merged', successorId: 'x' }),
      ),
      '"7"',
    ],
    [
      'a label that is not NFC',
      mutate((p) => (at(p, 0).labels = [{ locale: 'en', label: 'é' }])),
      '"7"',
    ],
    [
      'a label with an extra member',
      mutate((p) => (at(p, 0).labels = [{ locale: 'en', label: 'A', x: 1 }])),
      '"7"',
    ],
    [
      'a malformed locale',
      mutate((p) => (at(p, 0).labels = [{ locale: 'e', label: 'A' }])),
      '"7"',
    ],
    [
      'more than 64 labels',
      mutate(
        (p) =>
          (at(p, 0).labels = Array.from({ length: 65 }, () => ({
            locale: 'en',
            label: 'A',
          }))),
      ),
      '"7"',
    ],
    ['an empty alias', mutate((p) => (at(p, 0).aliases = [''])), '"7"'],
    [
      'more than 64 aliases',
      mutate((p) => (at(p, 0).aliases = Array.from({ length: 65 }, () => 'a'))),
      '"7"',
    ],
    [
      'aliases that are not a list',
      mutate((p) => (at(p, 0).aliases = 'x')),
      '"7"',
    ],
  ];
  it.each(refused)('refuses %s', (_name, candidate, etag) => {
    expect(verifiedTermsPage(candidate, etag)).toBeNull();
  });
});

describe('readTaxonomyTerms', () => {
  const read = async (
    response: Response | Error,
    query: Parameters<typeof readTaxonomyTerms>[1] = {},
    id = TAXONOMY_ID,
  ) => {
    const fetcher = vi.fn(async () => {
      if (response instanceof Error) throw response;
      return response;
    });
    const result = await readTaxonomyTerms(
      id,
      query,
      fetcher as unknown as typeof fetch,
    );
    return { result, fetcher };
  };
  const served = jsonResponse(200, page(), { etag: '"7"' });

  it('reads the terms path with no query by default and no mutation header', async () => {
    const { result, fetcher } = await read(served);
    expect(result.kind).toBe('loaded');
    const [url, init] = fetcher.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(`/api/v1/cms/taxonomies/${TAXONOMY_ID}/terms`);
    expect(init).toMatchObject({
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
    });
    expect(init.headers).toBeUndefined();
  });

  it('puts the filter, the signed cursor and the limit in the query, encoded', async () => {
    const { fetcher } = await read(served, {
      lifecycle: 'deprecated',
      cursor: 'a b+c/d=',
      limit: 10,
    });
    const [url] = fetcher.mock.calls[0] as unknown as [string];
    expect(url).toBe(
      `/api/v1/cms/taxonomies/${TAXONOMY_ID}/terms?lifecycle=deprecated&cursor=a+b%2Bc%2Fd%3D&limit=10`,
    );
  });

  it.each([401, 403, 404, 409, 429])(
    'reports a %i as rejected',
    async (status) => {
      expect((await read(new Response('{}', { status }))).result).toEqual({
        kind: 'rejected',
        status,
      });
    },
  );

  it.each([
    ['a 500', new Response('{}', { status: 500 })],
    ['a network failure', new Error('offline')],
    [
      'an unverifiable body',
      jsonResponse(200, { items: 'x' }, { etag: '"7"' }),
    ],
    [
      'a non-JSON body',
      new Response('x', { status: 200, headers: { etag: '"7"' } }),
    ],
    ['a wrong ETag', jsonResponse(200, page(), { etag: '"9"' })],
  ])('is unavailable for %s', async (_name, response) => {
    expect((await read(response)).result).toEqual({ kind: 'unavailable' });
  });

  it('never fetches for a malformed vocabulary id', async () => {
    const { result, fetcher } = await read(served, {}, 'new');
    expect(result).toEqual({ kind: 'unavailable' });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
