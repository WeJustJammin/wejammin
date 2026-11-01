// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  REVIEW_ID,
  apiError,
  governedDetailFixture,
  jsonResponse,
} from '../../server/cms-governed-review-fixtures.test-support';
import { readCanonicalGovernedReview } from './governed-review-canonical-read';

/**
 * FE03 "Network and retry contract" (:1172-1173) for the governed canonical read (CMS-03C-10): a
 * 502/503/504 whose ApiError declares the retry safe is read again at most twice (250 ms, 750 ms)
 * and then degrades; a 429 is answered at once as a rate limit with the stated wait.
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
      ...apiError(status === 429 ? 'RATE_LIMITED' : 'DEPENDENCY_UNAVAILABLE'),
      details,
    },
    headers,
  );
const declared = (status: number): Response =>
  failure(status, { dependencyClass: 'cms_editorial', retryable: true });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('governed canonical read: dependency retry', () => {
  it.each([502, 503, 504])(
    'retries a declared-retryable %i after 250 ms, then 750 ms, then degrades with the request id',
    async (status) => {
      const fetcher = vi
        .fn<Fetcher>()
        .mockImplementation(async () => declared(status));
      const pending = readCanonicalGovernedReview(REVIEW_ID, fetcher);
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

  it('uses the verified review of a retry that succeeded', async () => {
    const fetcher = vi
      .fn<Fetcher>()
      .mockResolvedValueOnce(declared(503))
      .mockResolvedValueOnce(
        jsonResponse(200, governedDetailFixture(), { etag: '"2"' }),
      );
    const pending = readCanonicalGovernedReview(REVIEW_ID, fetcher);
    await vi.advanceTimersByTimeAsync(250);
    expect((await pending).kind).toBe('ok');
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
    const pending = readCanonicalGovernedReview(REVIEW_ID, fetcher);
    await vi.advanceTimersByTimeAsync(10_000);
    expect((await pending).kind).toBe('degraded');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('does not retry a transport loss', async () => {
    const fetcher = vi.fn<Fetcher>().mockRejectedValue(new Error('offline'));
    const pending = readCanonicalGovernedReview(REVIEW_ID, fetcher);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await pending).toEqual({ kind: 'degraded', requestId: null });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe('governed canonical read: 429', () => {
  it('answers degraded with the stated wait and does not retry', async () => {
    const fetcher = vi
      .fn<Fetcher>()
      .mockImplementation(async () =>
        failure(429, { retryAfterSeconds: 7 }, { 'retry-after': '7' }),
      );
    const pending = readCanonicalGovernedReview(REVIEW_ID, fetcher);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await pending).toEqual({
      kind: 'degraded',
      requestId: REQUEST_ID,
      rateLimit: { retryAfterSeconds: 7 },
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('reads the wait from the body when the header is absent', async () => {
    const result = await readCanonicalGovernedReview(
      REVIEW_ID,
      vi
        .fn<Fetcher>()
        .mockResolvedValue(failure(429, { retryAfterSeconds: 12 })),
    );
    expect(result).toMatchObject({ rateLimit: { retryAfterSeconds: 12 } });
  });

  it('answers a rate limit with no seconds when none is usable', async () => {
    const result = await readCanonicalGovernedReview(
      REVIEW_ID,
      vi
        .fn<Fetcher>()
        .mockResolvedValue(failure(429, {}, { 'retry-after': '0' })),
    );
    expect(result).toMatchObject({
      kind: 'degraded',
      rateLimit: { retryAfterSeconds: null },
    });
  });

  it('answers a 500 as plain degraded with no rate limit member', async () => {
    const result = await readCanonicalGovernedReview(
      REVIEW_ID,
      vi.fn<Fetcher>().mockResolvedValue(failure(500, {})),
    );
    expect(result).toEqual({ kind: 'degraded', requestId: REQUEST_ID });
    expect('rateLimit' in result).toBe(false);
  });
});
