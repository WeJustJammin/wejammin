// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ENTRY_ID,
  REVIEW_ID,
  jsonResponse,
} from './cms-workflow-fixtures.test-support';
import {
  readCanonicalReview,
  readCanonicalWorkflow,
  type CanonicalReadResult,
} from './cms-workflow-canonical-read';

/**
 * FE03 "Network and retry contract" (:1172-1173) for the canonical workflow and review reads
 * (CMS-03B-15, CMS-03B-16): a 502/503/504 that the ApiError declares retryable is retried at most
 * twice (250 ms, 750 ms) and then degrades; a 429 waits for Retry-After and keeps the surface.
 */
type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

const REQUEST_ID = '0195b6f0-0000-7000-8000-000000000001';
const failure = (
  status: number,
  details: Record<string, unknown>,
  headers: Record<string, string> = {},
): Response =>
  jsonResponse(
    status,
    {
      code: status === 429 ? 'RATE_LIMITED' : 'DEPENDENCY_UNAVAILABLE',
      message: 'Safe message',
      requestId: REQUEST_ID,
      details,
    },
    headers,
  );
const declared = (status: number): Response =>
  failure(status, { dependencyClass: 'cms_editorial', retryable: true });

const reads: ReadonlyArray<
  readonly [string, (fetcher: Fetcher) => Promise<CanonicalReadResult<unknown>>]
> = [
  [
    'workflow (CMS-03B-15)',
    (fetcher) => readCanonicalWorkflow(ENTRY_ID, null, fetcher),
  ],
  ['review (CMS-03B-16)', (fetcher) => readCanonicalReview(REVIEW_ID, fetcher)],
];

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe.each(reads)('canonical %s read', (_name, read) => {
  it.each([502, 503, 504])(
    'retries a declared-retryable %i after 250 ms, then 750 ms, then degrades with the request id',
    async (status) => {
      const fetcher = vi
        .fn<Fetcher>()
        .mockImplementation(async () => declared(status));
      const pending = read(fetcher);
      await vi.advanceTimersByTimeAsync(249);
      expect(fetcher).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(fetcher).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(749);
      expect(fetcher).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(1);
      expect(fetcher).toHaveBeenCalledTimes(3);
      await vi.advanceTimersByTimeAsync(10_000);
      expect(fetcher).toHaveBeenCalledTimes(3);
      expect(await pending).toEqual({
        kind: 'degraded',
        requestId: REQUEST_ID,
      });
    },
  );

  it('uses the answer of a retry that succeeded', async () => {
    const fetcher = vi
      .fn<Fetcher>()
      .mockResolvedValueOnce(declared(503))
      .mockResolvedValueOnce(new Response('x', { status: 404 }));
    const pending = read(fetcher);
    await vi.advanceTimersByTimeAsync(250);
    expect(await pending).toEqual({ kind: 'gone' });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['a 500', failure(500, { retryable: true })],
    ['a 503 that does not declare a retry safe', failure(503, {})],
    ['a 502 that declares retryable false', failure(502, { retryable: false })],
    ['a 504 with no ApiError body', new Response('down', { status: 504 })],
  ])('does not retry %s', async (_case, response) => {
    const fetcher = vi
      .fn<Fetcher>()
      .mockImplementation(async () => response.clone());
    const pending = read(fetcher);
    await vi.advanceTimersByTimeAsync(10_000);
    expect((await pending).kind).toBe('degraded');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('does not retry a transport loss', async () => {
    const fetcher = vi.fn<Fetcher>().mockRejectedValue(new Error('offline'));
    const pending = read(fetcher);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await pending).toEqual({ kind: 'degraded', requestId: null });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('answers a 429 as degraded with the stated wait and does not retry it', async () => {
    const fetcher = vi
      .fn<Fetcher>()
      .mockImplementation(async () =>
        failure(429, { retryAfterSeconds: 7 }, { 'retry-after': '7' }),
      );
    const pending = read(fetcher);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await pending).toEqual({
      kind: 'degraded',
      requestId: REQUEST_ID,
      rateLimit: { retryAfterSeconds: 7 },
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('answers a 429 without a usable wait as a rate limit with no seconds', async () => {
    const result = await read(
      vi
        .fn<Fetcher>()
        .mockResolvedValue(failure(429, {}, { 'retry-after': '0' })),
    );
    expect(result).toMatchObject({
      kind: 'degraded',
      rateLimit: { retryAfterSeconds: null },
    });
  });
});

describe('the unrelated reads stay exact', () => {
  it('a 500 is plain degraded with no rate limit member', async () => {
    const result = await readCanonicalWorkflow(
      ENTRY_ID,
      null,
      vi.fn<Fetcher>().mockResolvedValue(failure(500, {})),
    );
    expect(result).toEqual({ kind: 'degraded', requestId: REQUEST_ID });
    expect('rateLimit' in result).toBe(false);
  });
});
