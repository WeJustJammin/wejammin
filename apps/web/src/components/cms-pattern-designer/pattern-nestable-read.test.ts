import { describe, expect, it, vi } from 'vitest';

import {
  NESTABLE_PAGE_LIMIT,
  readNestablePatterns,
  verifiedNestablePage,
} from './pattern-nestable-read';
import {
  PATTERN_ID,
  TYPE_ID,
} from '../../server/cms-pattern-platform.test-support';
import { TYPE_B } from './pattern-designer.test-support';

/**
 * The browser's read of cmsPatternNestableRead (DEC-196): the same-origin proxy has parsed the strict page; the browser repeats
 * the structural checks zod-free (FE03 AC261) and the ETag binding, and sorts every failure into what the picker shows.
 */
const item = (index: number, overrides: Record<string, unknown> = {}) => ({
  patternId: `20000000-0000-4000-8000-${String(100 + index).padStart(12, '0')}`,
  patternVersionId: `20000000-0000-4000-8000-${String(200 + index).padStart(12, '0')}`,
  patternKey: `pattern-${String(index).padStart(3, '0')}`,
  patternVersion: 2,
  nodeCount: 3,
  blockRegistryDigest: 'a'.repeat(64),
  ...overrides,
});
const page = (count = 2, overrides: Record<string, unknown> = {}) => ({
  items: Array.from({ length: count }, (_unused, index) => item(index + 1)),
  nextCursor: null,
  pageVersion: '1790000000000000',
  ...overrides,
});
const answer = (
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      ...(status === 200
        ? { etag: `"${(body as { pageVersion?: string }).pageVersion}"` }
        : {}),
      ...headers,
    },
  });
const urlOf = (fetcher: { mock: { calls: unknown[][] } }, index = 0): URL =>
  new URL(String(fetcher.mock.calls[index]?.[0]), 'https://app.example.test');

describe('readNestablePatterns: the request', () => {
  it('repeats contentTypeId for every type, in order, with the page limit and no cursor on the first page', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => answer(page()));
    const result = await readNestablePatterns([TYPE_ID, TYPE_B], null, fetcher);
    expect(result.kind).toBe('page');
    const url = urlOf(fetcher);
    expect(url.pathname).toBe('/api/v1/cms/patterns/nestable');
    expect(url.searchParams.getAll('contentTypeId')).toEqual([TYPE_ID, TYPE_B]);
    expect(url.searchParams.get('limit')).toBe(String(NESTABLE_PAGE_LIMIT));
    expect(url.searchParams.has('cursor')).toBe(false);
    const init = fetcher.mock.calls[0]?.[1] as RequestInit;
    expect(init).toMatchObject({
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
    });
  });

  it('sends the cursor of a later page byte for byte', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => answer(page()));
    await readNestablePatterns([TYPE_ID], 'abc+/=.def', fetcher);
    expect(urlOf(fetcher).searchParams.get('cursor')).toBe('abc+/=.def');
  });

  it('asks nothing for an empty or oversize type set', async () => {
    const fetcher = vi.fn();
    expect(await readNestablePatterns([], null, fetcher)).toEqual({
      kind: 'unavailable',
    });
    const sixtyFive = Array.from(
      { length: 65 },
      (_unused, index) =>
        `30000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    );
    expect(await readNestablePatterns(sixtyFive, null, fetcher)).toEqual({
      kind: 'unavailable',
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('readNestablePatterns: the answer', () => {
  it('returns the verified page', async () => {
    const body = page(NESTABLE_PAGE_LIMIT, { nextCursor: 'next.sig' });
    const result = await readNestablePatterns(
      [TYPE_ID],
      null,
      vi.fn<typeof fetch>(async () => answer(body)),
    );
    expect(result).toEqual({ kind: 'page', page: body });
  });

  it.each([
    ['a missing ETag', () => answer(page(), 200, { etag: '' })],
    [
      'an ETag that is not the page version',
      () => answer(page(), 200, { etag: '"8"' }),
    ],
    [
      'a body that is not JSON',
      () =>
        new Response('nope', {
          status: 200,
          headers: { etag: '"1790000000000000"' },
        }),
    ],
    [
      'an unexpected member on an item',
      () => answer(page(1, { items: [{ ...item(1), extra: 1 }] })),
    ],
    [
      'a state member on an item',
      () => answer(page(1, { items: [{ ...item(1), state: 'active' }] })),
    ],
    [
      'a malformed digest',
      () =>
        answer(
          page(1, {
            items: [item(1, { blockRegistryDigest: 'A'.repeat(64) })],
          }),
        ),
    ],
    [
      'a node count of 0',
      () => answer(page(1, { items: [item(1, { nodeCount: 0 })] })),
    ],
    [
      'a node count of 513',
      () => answer(page(1, { items: [item(1, { nodeCount: 513 })] })),
    ],
    [
      'a version of 0',
      () => answer(page(1, { items: [item(1, { patternVersion: 0 })] })),
    ],
    [
      'a malformed pattern key',
      () => answer(page(1, { items: [item(1, { patternKey: 'Bad_Key' })] })),
    ],
    [
      'a malformed lineage id',
      () => answer(page(1, { items: [item(1, { patternId: 'x' })] })),
    ],
    [
      'a page version that is not decimal',
      () => answer(page(1, { pageVersion: 'v1' })),
    ],
    ['an empty cursor', () => answer(page(1, { nextCursor: '' }))],
    [
      'a cursor of 513 characters',
      () => answer(page(1, { nextCursor: 'c'.repeat(513) })),
    ],
    ['more items than the limit', () => answer(page(NESTABLE_PAGE_LIMIT + 1))],
    [
      'rows out of keyset order',
      () => answer(page(0, { items: [item(2), item(1)] })),
    ],
    [
      'a repeated version row',
      () => answer(page(0, { items: [item(1), item(1)] })),
    ],
  ])('is unavailable for %s', async (_name, build) => {
    expect(
      await readNestablePatterns(
        [TYPE_ID],
        null,
        vi.fn<typeof fetch>(async () => build()),
      ),
    ).toEqual({
      kind: 'unavailable',
    });
  });

  it('accepts several versions of one key in descending version order and an empty page', () => {
    expect(
      verifiedNestablePage({
        items: [
          item(1, { patternVersion: 5 }),
          item(1, { patternVersion: 4, patternVersionId: PATTERN_ID }),
        ],
        nextCursor: null,
        pageVersion: '1',
      }),
    ).not.toBeNull();
    expect(
      verifiedNestablePage({ items: [], nextCursor: null, pageVersion: '1' }),
    ).not.toBeNull();
  });
});

describe('readNestablePatterns: refusals', () => {
  it.each([401, 403, 404, 422])('names the %s refusal', async (status) => {
    expect(
      await readNestablePatterns(
        [TYPE_ID],
        null,
        vi.fn<typeof fetch>(async () => answer({ code: 'x' }, status)),
      ),
    ).toEqual({ kind: 'rejected', status });
  });

  it('treats a 400 as a rejected cursor so the caller can restart the listing', async () => {
    expect(
      await readNestablePatterns(
        [TYPE_ID],
        'stale',
        vi.fn<typeof fetch>(async () => answer({}, 400)),
      ),
    ).toEqual({ kind: 'rejected', status: 400 });
  });

  it('carries the stated wait of a 429', async () => {
    const result = await readNestablePatterns(
      [TYPE_ID],
      null,
      vi.fn<typeof fetch>(async () =>
        answer({ details: { retryAfterSeconds: 12 } }, 429, {
          'retry-after': '12',
        }),
      ),
    );
    expect(result).toEqual({
      kind: 'rejected',
      status: 429,
      retryAfterSeconds: 12,
    });
    const unstated = await readNestablePatterns(
      [TYPE_ID],
      null,
      vi.fn<typeof fetch>(async () => answer({}, 429)),
    );
    expect(unstated).toEqual({ kind: 'rejected', status: 429 });
  });

  it('retries a declared-retryable dependency failure twice, then reports it unavailable', async () => {
    const failing = () => answer({ details: { retryable: true } }, 503);
    const fetcher = vi.fn<typeof fetch>(async () => failing());
    vi.useFakeTimers();
    const pending = readNestablePatterns([TYPE_ID], null, fetcher);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(await pending).toEqual({ kind: 'unavailable' });
    vi.useRealTimers();
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('is unavailable for a 500, a thrown fetch and a non-Response answer', async () => {
    expect(
      await readNestablePatterns(
        [TYPE_ID],
        null,
        vi.fn<typeof fetch>(async () => answer({}, 500)),
      ),
    ).toEqual({ kind: 'unavailable' });
    expect(
      await readNestablePatterns(
        [TYPE_ID],
        null,
        vi.fn<typeof fetch>(async () => {
          throw new Error('offline');
        }),
      ),
    ).toEqual({ kind: 'unavailable' });
    expect(
      await readNestablePatterns(
        [TYPE_ID],
        null,
        vi.fn<typeof fetch>(async () => 5 as unknown as Response),
      ),
    ).toEqual({ kind: 'unavailable' });
  });

  it('is unavailable, and issues no further request, once canceled', async () => {
    const controller = new AbortController();
    const fetcher = vi.fn<typeof fetch>(async () => answer(page()));
    controller.abort();
    expect(
      await readNestablePatterns([TYPE_ID], null, fetcher, {
        signal: controller.signal,
      }),
    ).toEqual({ kind: 'unavailable' });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
