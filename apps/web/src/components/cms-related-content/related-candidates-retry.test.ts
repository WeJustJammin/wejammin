import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchCandidatePage } from './related-candidates';

/*
 * FE03 "Network and retry contract" (:1172-1175) for the candidate "Load more" read: a 502, 503 or 504
 * whose ApiError declares `retryable: true` is retried at most twice, after 250 ms and 750 ms; a 429
 * waits for `Retry-After` instead; anything else is the caller's answer at once.
 */
const SOURCE = '018f0c45-73fe-7dc2-9c09-68f7ecf132dc';
const PAGE = {
  items: [
    {
      id: '028f0c45-73fe-7dc2-9c09-000000000001',
      revisionNumber: '2',
      locale: 'en-US',
      state: 'draft',
      contentHash: 'a'.repeat(64),
      createdAt: '2026-10-15T10:00:00Z',
      authorClass: 'author',
      entryId: '018f0c45-73fe-7dc2-9c09-000000000001',
      entryLifecycle: 'active',
      entryUpdatedAt: '2026-10-15T11:00:00Z',
    },
  ],
  nextCursor: null,
  pageVersion: '7',
};
const ok = (): Response =>
  new Response(JSON.stringify(PAGE), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
const apiError = (
  status: number,
  details: Record<string, unknown>,
  headers: Record<string, string> = {},
): Response =>
  new Response(
    JSON.stringify({
      code: 'DEPENDENCY_UNAVAILABLE',
      message: 'x',
      requestId: '50000000-0000-4000-8000-000000000005',
      details,
    }),
    { status, headers: { 'content-type': 'application/json', ...headers } },
  );
const retryable = (status = 503): Response =>
  apiError(status, { dependencyClass: 'cms_composition', retryable: true });
const sequence = (...answers: (() => Response)[]) => {
  let call = 0;
  return vi.fn(async () => (answers[call++] ?? answers.at(-1)!)());
};
const load = (fetcher: ReturnType<typeof sequence>) =>
  fetchCandidatePage('c1', SOURCE, fetcher as unknown as typeof fetch);

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('a retryable dependency answer', () => {
  it.each([502, 503, 504])(
    'is retried after 250 ms and then 750 ms on a %i, and the third answer is used',
    async (status) => {
      const fetcher = sequence(
        () => retryable(status),
        () => retryable(status),
        ok,
      );
      const result = load(fetcher);
      await vi.advanceTimersByTimeAsync(0);
      expect(fetcher).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(249);
      expect(fetcher).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(fetcher).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(749);
      expect(fetcher).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(1);
      expect(await result).toMatchObject({ kind: 'page' });
      expect(fetcher).toHaveBeenCalledTimes(3);
    },
  );

  it('is retried at most twice, then degrades to failed', async () => {
    const fetcher = sequence(() => retryable());
    const result = load(fetcher);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(await result).toEqual({ kind: 'failed' });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('is not retried when the answer does not declare a retry safe, or is another status', async () => {
    for (const answer of [
      () => apiError(503, { dependencyClass: 'x', retryable: false }),
      () => apiError(503, {}),
      () => apiError(500, { retryable: true }),
      () => apiError(404, {}),
    ]) {
      const fetcher = sequence(answer);
      expect(await load(fetcher)).toEqual({ kind: 'failed' });
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
  });

  it('is not retried after a network failure', async () => {
    const fetcher = vi.fn(async () => {
      throw new TypeError('offline');
    });
    expect(
      await fetchCandidatePage(
        'c1',
        SOURCE,
        fetcher as unknown as typeof fetch,
      ),
    ).toEqual({ kind: 'failed' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('keeps a 401 and a 409 as the first answer, without retrying', async () => {
    for (const [status, kind] of [
      [401, 'signin'],
      [409, 'restart'],
    ] as const) {
      const fetcher = sequence(() => apiError(status, {}));
      expect(await load(fetcher)).toEqual({ kind });
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
  });
});

describe('a 429', () => {
  const limited = (headers: Record<string, string>, details = {}) =>
    sequence(() => apiError(429, details, headers));

  it('is never retried by the read and reports the Retry-After wait', async () => {
    const fetcher = limited({ 'retry-after': '7' });
    expect(await load(fetcher)).toEqual({
      kind: 'rate_limited',
      retryAfterSeconds: 7,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('reports the wait stated in the body when the header is absent', async () => {
    expect(await load(limited({}, { retryAfterSeconds: 12 }))).toEqual({
      kind: 'rate_limited',
      retryAfterSeconds: 12,
    });
  });

  it('reports no wait when none is stated, is not believed or disagrees', async () => {
    for (const fetcher of [
      limited({}),
      limited({ 'retry-after': 'soon' }),
      limited({ 'retry-after': '0' }),
      limited({ 'retry-after': '86401' }),
      limited({ 'retry-after': '7' }, { retryAfterSeconds: 9 }),
    ])
      expect(await load(fetcher)).toEqual({
        kind: 'rate_limited',
        retryAfterSeconds: null,
      });
  });
});
