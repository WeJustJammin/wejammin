// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { jsonResponse } from './cms-workflow-fixtures.test-support';
import { loadReviewerOptions } from './cms-workflow-reviewer-options';

/**
 * FE03 "Network and retry contract" (:1172-1173) for the reviewer grant list the assignment form
 * reads (CMS-03A-18, filtered): declared-retryable 502/503/504 are retried twice (250 ms, 750 ms);
 * a 429 is announced with its stated wait instead of being collapsed to "Reload the page".
 */
type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

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
      requestId: '0195b6f0-0000-7000-8000-000000000001',
      details,
    },
    headers,
  );
const declared = (status: number): Response =>
  failure(status, { dependencyClass: 'cms_capability', retryable: true });
const emptyPage = (): Response =>
  jsonResponse(200, { items: [], nextCursor: null });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('loadReviewerOptions retry (FE03 :1173)', () => {
  it.each([502, 503, 504])(
    'retries a declared-retryable %i after 250 ms, then 750 ms, and uses the page that answers',
    async (status) => {
      const fetcher = vi
        .fn<Fetcher>()
        .mockResolvedValueOnce(declared(status))
        .mockResolvedValueOnce(declared(status))
        .mockResolvedValueOnce(emptyPage());
      const pending = loadReviewerOptions(fetcher);
      await vi.advanceTimersByTimeAsync(249);
      expect(fetcher).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(fetcher).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(749);
      expect(fetcher).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(1);
      expect(await pending).toEqual({ kind: 'ok', options: [] });
      expect(fetcher).toHaveBeenCalledTimes(3);
    },
  );

  it('is unavailable after the second retry and does not read a fourth time', async () => {
    const fetcher = vi
      .fn<Fetcher>()
      .mockImplementation(async () => declared(503));
    const pending = loadReviewerOptions(fetcher);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await pending).toEqual({ kind: 'unavailable' });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it.each([
    ['a 500', failure(500, { retryable: true })],
    ['a 503 that does not declare a retry safe', failure(503, {})],
    ['a 403', failure(403, {})],
  ])('does not retry %s', async (_case, response) => {
    const fetcher = vi
      .fn<Fetcher>()
      .mockImplementation(async () => response.clone());
    const pending = loadReviewerOptions(fetcher);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await pending).toEqual({ kind: 'unavailable' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe('loadReviewerOptions 429 (FE03 :1172)', () => {
  it('is unavailable with the stated wait and is not retried', async () => {
    const fetcher = vi
      .fn<Fetcher>()
      .mockImplementation(async () =>
        failure(429, { retryAfterSeconds: 8 }, { 'retry-after': '8' }),
      );
    const pending = loadReviewerOptions(fetcher);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await pending).toEqual({
      kind: 'unavailable',
      rateLimit: { retryAfterSeconds: 8 },
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('is unavailable with no seconds when the wait is not stated', async () => {
    const result = await loadReviewerOptions(
      vi.fn<Fetcher>().mockResolvedValue(failure(429, {})),
    );
    expect(result).toEqual({
      kind: 'unavailable',
      rateLimit: { retryAfterSeconds: null },
    });
  });

  it('carries the wait when a later page is rate limited', async () => {
    const page = {
      items: [],
      nextCursor: 'c1',
    };
    const result = await loadReviewerOptions(
      vi
        .fn<Fetcher>()
        .mockResolvedValueOnce(jsonResponse(200, page))
        .mockResolvedValueOnce(
          failure(429, { retryAfterSeconds: 3 }, { 'retry-after': '3' }),
        ),
    );
    expect(result).toEqual({
      kind: 'unavailable',
      rateLimit: { retryAfterSeconds: 3 },
    });
  });
});
