import { EntryListPageSchema } from '@wejammin/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CANDIDATE_PAGE_LIMIT,
  candidatesFromPage,
  fetchCandidatePage,
  isPinnable,
  mergeCandidates,
  verifiedCandidatePage,
  type RelatedCandidate,
} from './related-candidates';

const SOURCE = '018f0c45-73fe-7dc2-9c09-68f7ecf132dc';
const id = (n: number): string =>
  `018f0c45-73fe-7dc2-9c09-${String(n).padStart(12, '0')}`;
const item = (n: number, extra: Record<string, unknown> = {}) => ({
  id: `028f0c45-73fe-7dc2-9c09-${String(n).padStart(12, '0')}`,
  revisionNumber: '2',
  locale: 'en-US',
  state: 'draft',
  contentHash: 'a'.repeat(64),
  createdAt: '2026-10-15T10:00:00Z',
  authorClass: 'author',
  entryId: id(n),
  entryLifecycle: 'active',
  entryUpdatedAt: '2026-10-15T11:00:00Z',
  ...extra,
});
const page = (items: unknown[], nextCursor: string | null = null) => ({
  items,
  nextCursor,
  pageVersion: '7',
});
const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

describe('candidatesFromPage (server side, strict)', () => {
  it('keeps only the facts the picker shows and drops the source entry', () => {
    const parsed = EntryListPageSchema.parse(
      page([item(1), item(2), item(3, { entryId: SOURCE })], 'next'),
    );
    expect(candidatesFromPage(parsed, SOURCE)).toEqual({
      items: [
        {
          entryId: id(1),
          lifecycle: 'active',
          locale: 'en-US',
          state: 'draft',
          updatedAt: '2026-10-15T11:00:00Z',
        },
        {
          entryId: id(2),
          lifecycle: 'active',
          locale: 'en-US',
          state: 'draft',
          updatedAt: '2026-10-15T11:00:00Z',
        },
      ],
      nextCursor: 'next',
    });
  });
});

describe('verifiedCandidatePage (browser side, zod-free)', () => {
  it('reads a well-formed page and drops the source entry and duplicates', () => {
    const verified = verifiedCandidatePage(
      page([item(1), item(1), item(2, { entryId: SOURCE })], 'c1'),
      SOURCE,
    );
    expect(verified?.items.map((entry) => entry.entryId)).toEqual([id(1)]);
    expect(verified?.nextCursor).toBe('c1');
  });

  it.each([
    ['a non-object', 'x'],
    ['no items', { nextCursor: null }],
    ['more than 50 items', page(Array.from({ length: 51 }, (_, n) => item(n)))],
    ['an item without an entry id', page([item(1, { entryId: 'nope' })])],
    ['an unknown lifecycle', page([item(1, { entryLifecycle: 'gone' })])],
    ['a non-string locale', page([item(1, { locale: 5 })])],
    ['an empty state', page([item(1, { state: '' })])],
    ['a bad cursor type', page([item(1)], 5 as never)],
    ['an over-long cursor', page([item(1)], 'x'.repeat(513))],
  ])('refuses %s', (_name, body) => {
    expect(verifiedCandidatePage(body, SOURCE)).toBeNull();
  });

  it('refuses an item that carries an owner or assignee member', () => {
    expect(
      verifiedCandidatePage(page([item(1, { ownerId: id(9) })]), SOURCE),
    ).toBeNull();
  });
});

describe('isPinnable', () => {
  const base: RelatedCandidate = {
    entryId: id(1),
    lifecycle: 'active',
    locale: 'en-US',
    state: 'draft',
    updatedAt: '2026-10-15T11:00:00Z',
  };
  it('offers a pin only for an active entry (BE03c 1417 b)', () => {
    expect(isPinnable(base)).toBe(true);
    for (const lifecycle of ['archived', 'deletion_pending', 'held'] as const)
      expect(isPinnable({ ...base, lifecycle }), lifecycle).toBe(false);
  });
});

describe('mergeCandidates', () => {
  it('appends new entries and never lists one twice', () => {
    const a =
      verifiedCandidatePage(page([item(1), item(2)]), SOURCE)?.items ?? [];
    const b =
      verifiedCandidatePage(page([item(2), item(3)]), SOURCE)?.items ?? [];
    expect(mergeCandidates(a, b).map((entry) => entry.entryId)).toEqual([
      id(1),
      id(2),
      id(3),
    ]);
  });
});

describe('fetchCandidatePage', () => {
  it('asks the same-origin entry list for one bounded page, with the cursor when given', async () => {
    const fetcher = vi.fn(async () => json(200, page([item(1)], 'c2')));
    const first = await fetchCandidatePage(
      null,
      SOURCE,
      fetcher as unknown as typeof fetch,
    );
    expect(first.kind).toBe('page');
    expect(fetcher).toHaveBeenLastCalledWith(
      `/api/v1/cms/entries?limit=${CANDIDATE_PAGE_LIMIT}`,
      expect.objectContaining({
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        redirect: 'error',
      }),
    );
    await fetchCandidatePage(
      'c 2/+',
      SOURCE,
      fetcher as unknown as typeof fetch,
    );
    expect(fetcher).toHaveBeenLastCalledWith(
      `/api/v1/cms/entries?limit=${CANDIDATE_PAGE_LIMIT}&cursor=c+2%2F%2B`,
      expect.anything(),
    );
  });

  it('maps 401 to sign-in, 409 to a restart from the first page, and the rest to failed', async () => {
    const answer = (status: number) =>
      fetchCandidatePage('c', SOURCE, (async () =>
        json(status, {})) as unknown as typeof fetch);
    expect(await answer(401)).toEqual({ kind: 'signin' });
    expect(await answer(409)).toEqual({ kind: 'restart' });
    for (const status of [400, 403, 404, 500, 503])
      expect(await answer(status), String(status)).toEqual({ kind: 'failed' });
  });

  it('fails closed on a success status other than 200, even with a valid page', async () => {
    for (const status of [201, 203, 206]) {
      expect(
        await fetchCandidatePage(
          null,
          SOURCE,
          (async () =>
            new Response(JSON.stringify(page([item(1)])), {
              status,
            })) as unknown as typeof fetch,
        ),
        String(status),
      ).toEqual({ kind: 'failed' });
    }
  });

  it('fails closed on a 200 that is not the strict page, a non-JSON body and a thrown fetch', async () => {
    expect(
      await fetchCandidatePage(null, SOURCE, (async () =>
        json(200, { items: 3 })) as unknown as typeof fetch),
    ).toEqual({ kind: 'failed' });
    expect(
      await fetchCandidatePage(
        null,
        SOURCE,
        (async () =>
          new Response('x', { status: 200 })) as unknown as typeof fetch,
      ),
    ).toEqual({ kind: 'failed' });
    expect(
      await fetchCandidatePage(null, SOURCE, (async () => {
        throw new TypeError('offline');
      }) as unknown as typeof fetch),
    ).toEqual({ kind: 'failed' });
  });
});

describe('fetchCandidatePage deadline (DEC-246 ruling 1)', () => {
  afterEach(() => vi.useRealTimers());

  it('answers failed at the shared 8,000 ms deadline when the list never answers, and aborts the fetch', async () => {
    vi.useFakeTimers();
    const signals: AbortSignal[] = [];
    const fetcher = vi.fn((_url: string, init?: RequestInit) => {
      signals.push(init?.signal as AbortSignal);
      return new Promise<Response>(() => undefined);
    });
    const answer = fetchCandidatePage(
      null,
      SOURCE,
      fetcher as unknown as typeof fetch,
    );
    let settled: unknown = null;
    void answer.then((value) => (settled = value));
    await vi.advanceTimersByTimeAsync(7_999);
    expect(settled).toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toEqual({ kind: 'failed' });
    expect(signals[0]?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
