import { describe, expect, it } from 'vitest';
import { readCmsTaxonomyTerms } from './cms-taxonomy-platform-read';
import {
  SURVIVOR_ID,
  TAXONOMY_ID,
  TERMS_PATH,
  TERM_ID,
  bindingFor,
  jsonResponse,
  readRequest,
  taxonomyApiError,
  termsPageFixture,
} from './cms-taxonomy-platform.test-support';

const errorOf = async (response: Response) =>
  (await response.json()) as { code: string; details: Record<string, unknown> };

describe('cmsTaxonomyTermsRead proxy', () => {
  const run = (
    request: Request,
    id: string | undefined,
    ...queue: (Response | Error)[]
  ) => {
    const binding = bindingFor(...queue);
    return { binding, done: readCmsTaxonomyTerms(request, binding, id) };
  };
  const served = (
    overrides: Readonly<Record<string, unknown>> = {},
    etag = '"7"',
  ) => jsonResponse(200, termsPageFixture(overrides), { etag });

  it('forwards a bare GET and returns the verified page', async () => {
    const { binding, done } = run(
      readRequest(TERMS_PATH),
      TAXONOMY_ID,
      served(),
    );
    const response = await done;
    expect(response.status).toBe(200);
    expect(response.headers.get('etag')).toBe('"7"');
    expect(await response.json()).toEqual(termsPageFixture());
    expect((binding.requests()[0] as Request).url).toBe(
      `https://platform-api.internal${TERMS_PATH}`,
    );
  });

  it('forwards the filter, the signed cursor and the limit in one fixed order', async () => {
    const { binding, done } = run(
      readRequest(
        TERMS_PATH,
        {},
        '?limit=10&cursor=abc.DEF-123_%3D&lifecycle=deprecated',
      ),
      TAXONOMY_ID,
      served({ items: [] }),
    );
    expect((await done).status).toBe(200);
    expect((binding.requests()[0] as Request).url).toBe(
      `https://platform-api.internal${TERMS_PATH}?lifecycle=deprecated&cursor=abc.DEF-123_%3D&limit=10`,
    );
  });

  const badQuery: ReadonlyArray<readonly [string, string]> = [
    ['an unknown key', '?x=1'],
    ['a duplicate key', '?limit=1&limit=2'],
    ['an empty key', '?lifecycle='],
    ['an unknown lifecycle', '?lifecycle=gone'],
    ['a limit of zero', '?limit=0'],
    ['a limit above 50', '?limit=51'],
    ['a signed limit', '?limit=%2B5'],
    ['a fractional limit', '?limit=1.5'],
    ['a padded limit', '?limit=05'],
    ['an empty cursor', '?cursor='],
    ['a cursor over 512 characters', `?cursor=${'a'.repeat(513)}`],
  ];
  it.each(badQuery)('refuses %s before the Worker', async (_name, search) => {
    const { binding, done } = run(
      readRequest(TERMS_PATH, {}, search),
      TAXONOMY_ID,
    );
    const response = await done;
    expect(response.status).toBe(400);
    expect(binding.fetch).not.toHaveBeenCalled();
  });

  it('refuses a malformed id, an If-Match and a media type before the Worker', async () => {
    for (const [request, id, status] of [
      [readRequest(TERMS_PATH), 'x', 400],
      [readRequest(TERMS_PATH, { 'if-match': '"1"' }), TAXONOMY_ID, 400],
      [
        readRequest(TERMS_PATH, { 'content-type': 'text/plain' }),
        TAXONOMY_ID,
        415,
      ],
    ] as const) {
      const { binding, done } = run(request, id);
      expect((await done).status).toBe(status);
      expect(binding.fetch).not.toHaveBeenCalled();
    }
  });

  it('relays a cursor conflict as 409 with no detail and never a 422', async () => {
    const conflict = await run(
      readRequest(TERMS_PATH, {}, '?cursor=x'),
      TAXONOMY_ID,
      jsonResponse(
        409,
        taxonomyApiError('cmsTaxonomyTermsRead', 409, { currentVersion: '3' }),
      ),
    ).done;
    expect(conflict.status).toBe(409);
    expect((await errorOf(conflict)).details).toEqual({});
    const invalid = await run(
      readRequest(TERMS_PATH),
      TAXONOMY_ID,
      jsonResponse(422, taxonomyApiError('cmsTaxonomyTermsRead', 422)),
    ).done;
    expect(invalid.status).toBe(502);
  });

  const second = termsPageFixture().items[1] as Record<string, unknown>;
  const unverifiable: ReadonlyArray<readonly [string, string, Response]> = [
    ['an ETag that is not the page version', '', served({}, '"8"')],
    ['a missing ETag', '', jsonResponse(200, termsPageFixture())],
    ['more rows than the limit', '?limit=1', served()],
    [
      'more rows than the default limit',
      '',
      served({
        items: Array.from({ length: 26 }, (_, index) => ({
          ...second,
          termId: `50000000-0000-4000-8000-0000000001${String(index).padStart(2, '0')}`,
          termKey: `key-${String(index).padStart(2, '0')}`,
        })),
      }),
    ],
    [
      'a row outside the requested lifecycle',
      '?lifecycle=deprecated',
      served(),
    ],
    [
      'a repeated term',
      '',
      served({
        items: [termsPageFixture().items[0], termsPageFixture().items[0]],
      }),
    ],
    [
      'an extra member',
      '',
      jsonResponse(200, { ...termsPageFixture(), owner: 'x' }, { etag: '"7"' }),
    ],
    [
      'a body that is not JSON',
      '',
      new Response('nope', { status: 200, headers: { etag: '"7"' } }),
    ],
  ];
  it.each(unverifiable)(
    'answers a local 502 for %s',
    async (_name, search, upstream) => {
      const response = await run(
        readRequest(TERMS_PATH, {}, search),
        TAXONOMY_ID,
        upstream,
      ).done;
      expect(response.status).toBe(502);
    },
  );

  it('accepts rows of the requested lifecycle, merged rows with their successor, and a full page', async () => {
    const merged = {
      ...second,
      termId: TERM_ID,
      lifecycle: 'merged',
      successorId: SURVIVOR_ID,
    };
    const response = await run(
      readRequest(TERMS_PATH, {}, '?lifecycle=merged&limit=1'),
      TAXONOMY_ID,
      served({ items: [merged], nextCursor: 'next.cursor' }),
    ).done;
    expect(response.status).toBe(200);
    expect(((await response.json()) as { nextCursor: string }).nextCursor).toBe(
      'next.cursor',
    );
  });
});
