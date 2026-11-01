import { describe, expect, it, vi } from 'vitest';

import {
  TAXONOMY_ID,
  jsonResponse,
  versionsPageFixture,
} from '../../server/cms-taxonomy-platform.test-support';
import {
  readTaxonomyVersions,
  verifiedVersionsPage,
} from './taxonomy-versions-read';

const page = (): ReturnType<typeof versionsPageFixture> =>
  versionsPageFixture();
interface Plain {
  items: Array<Record<string, unknown>>;
  pageVersion?: unknown;
  [key: string]: unknown;
}
const mutate = (change: (copy: Plain) => void): unknown => {
  const copy = structuredClone(page()) as unknown as Plain;
  change(copy);
  return copy;
};
/** The member bag of version `index` of a plain copy. */
const at = (copy: Plain, index: number): Record<string, unknown> =>
  copy.items[index] as Record<string, unknown>;

describe('verifiedVersionsPage', () => {
  it('keeps exactly the members the pages use, newest first', () => {
    const verified = verifiedVersionsPage(page(), TAXONOMY_ID, '"3"');
    expect(verified?.pageVersion).toBe('3');
    expect(verified?.items.map((item) => [item.version, item.state])).toEqual([
      ['3', 'draft'],
      ['2', 'active'],
      ['1', 'superseded'],
    ]);
    expect(Object.keys(verified?.items[0] ?? {}).sort()).toEqual(
      [
        'allowedFieldKeys',
        'allowedTypeKeys',
        'canonicalOverlapDomains',
        'contentHash',
        'id',
        'shape',
        'state',
        'taxonomyId',
        'taxonomyKey',
        'taxonomyVersion',
        'version',
      ].sort(),
    );
  });

  it('accepts an empty page for a vocabulary with no version yet', () => {
    expect(
      verifiedVersionsPage({ items: [], pageVersion: '1' }, TAXONOMY_ID, '"1"')
        ?.items,
    ).toEqual([]);
  });

  const refused: ReadonlyArray<readonly [string, unknown, string | null]> = [
    ['an ETag that is not the page version', page(), '"4"'],
    ['a missing ETag', page(), null],
    ['a weak ETag', page(), 'W/"3"'],
    ['a non-object', 'x', '"3"'],
    ['an extra top-level member', mutate((p) => (p.owner = 'x')), '"3"'],
    ['a missing page version', mutate((p) => delete p.pageVersion), '"3"'],
    ['a malformed page version', mutate((p) => (p.pageVersion = '0')), '"0"'],
    [
      'more than 50 versions',
      {
        items: Array.from({ length: 51 }, () => page().items[0]),
        pageVersion: '3',
      },
      '"3"',
    ],
    [
      'another vocabulary',
      mutate(
        (p) => (at(p, 1).taxonomyId = '90000000-0000-4000-8000-000000000099'),
      ),
      '"3"',
    ],
    ['versions not newest first', mutate((p) => p.items.reverse()), '"3"'],
    ['a repeated version', mutate((p) => (p.items[1] = at(p, 0))), '"3"'],
    [
      'a version that is not its number',
      mutate((p) => (at(p, 0).taxonomyVersion = 4)),
      '"3"',
    ],
    ['an unknown lifecycle', mutate((p) => (at(p, 0).state = 'weird')), '"3"'],
    ['an unknown shape', mutate((p) => (at(p, 0).shape = 'graph')), '"3"'],
    ['a malformed key', mutate((p) => (at(p, 0).taxonomyKey = 'Bad')), '"3"'],
    ['a malformed id', mutate((p) => (at(p, 0).id = 'x')), '"3"'],
    ['a malformed hash', mutate((p) => (at(p, 0).contentHash = 'x')), '"3"'],
    ['no type key', mutate((p) => (at(p, 0).allowedTypeKeys = [])), '"3"'],
    [
      'a duplicate type key',
      mutate((p) => (at(p, 0).allowedTypeKeys = ['aa', 'aa'])),
      '"3"',
    ],
    [
      'a malformed field key',
      mutate((p) => (at(p, 0).allowedFieldKeys = ['Bad'])),
      '"3"',
    ],
    [
      'an unknown domain',
      mutate((p) => (at(p, 0).canonicalOverlapDomains = ['planet'])),
      '"3"',
    ],
    [
      'a duplicate domain',
      mutate((p) => (at(p, 0).canonicalOverlapDomains = ['role', 'role'])),
      '"3"',
    ],
    [
      'an extra member of a version',
      mutate((p) => (at(p, 0).owner = 'x')),
      '"3"',
    ],
  ];
  it.each(refused)('refuses %s', (_name, candidate, etag) => {
    expect(verifiedVersionsPage(candidate, TAXONOMY_ID, etag)).toBeNull();
  });
});

describe('readTaxonomyVersions', () => {
  const read = async (response: Response | Error, id = TAXONOMY_ID) => {
    const fetcher = vi.fn(async () => {
      if (response instanceof Error) throw response;
      return response;
    });
    const result = await readTaxonomyVersions(
      id,
      fetcher as unknown as typeof fetch,
    );
    return { result, fetcher };
  };

  it('reads the vocabulary versions path with no mutation header', async () => {
    const { result, fetcher } = await read(
      jsonResponse(200, page(), { etag: '"3"' }),
    );
    expect(result.kind).toBe('loaded');
    const [url, init] = fetcher.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(`/api/v1/cms/taxonomies/${TAXONOMY_ID}/versions`);
    expect(init).toMatchObject({
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
    });
    expect(init.headers).toBeUndefined();
  });

  it.each([401, 403, 404, 429])('reports a %i as rejected', async (status) => {
    expect((await read(new Response('{}', { status }))).result).toEqual({
      kind: 'rejected',
      status,
    });
  });

  it.each([
    ['a 500', new Response('{}', { status: 500 })],
    ['a 502', new Response('{}', { status: 502 })],
    ['a network failure', new Error('offline')],
    [
      'an unverifiable body',
      jsonResponse(200, { items: 'x' }, { etag: '"3"' }),
    ],
    [
      'a non-JSON body',
      new Response('x', { status: 200, headers: { etag: '"3"' } }),
    ],
    ['a page with a wrong ETag', jsonResponse(200, page(), { etag: '"9"' })],
  ])('is unavailable for %s', async (_name, response) => {
    expect((await read(response)).result).toEqual({ kind: 'unavailable' });
  });

  it('is unavailable for a malformed id and never fetches', async () => {
    const { result, fetcher } = await read(jsonResponse(200, page()), 'new');
    expect(result).toEqual({ kind: 'unavailable' });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
