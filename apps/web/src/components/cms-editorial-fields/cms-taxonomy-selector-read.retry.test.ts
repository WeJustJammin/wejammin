import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  REQUEST_ID,
  jsonResponse,
  readSelectorWith,
  served,
} from './cms-taxonomy-selector-read.test-support';

/*
 * FE03 "Network and retry contract" (:1172-1173) for the selector read (CMS-03C-17): a 502, 503 or
 * 504 whose ApiError declares a retry safe is retried twice (250 ms, 750 ms) before the degraded
 * state; a 429 reports the wait the server stated and is never retried automatically; nothing else
 * is retried. The real shared `retryingSafeRead` runs against an intercepted `fetch`.
 */

type Fetcher = typeof fetch;

const dependency = (status: number, retryable: boolean): Response =>
  jsonResponse(
    status,
    {
      code: 'DEPENDENCY_UNAVAILABLE',
      message: 'Safe dependency message',
      requestId: REQUEST_ID,
      details: { dependencyClass: 'cms_composition', retryable },
    },
    { 'cache-control': 'no-store' },
  );

const failure = (
  status: number,
  details: Record<string, unknown>,
  headers: Record<string, string> = {},
): Response =>
  jsonResponse(
    status,
    {
      code: status === 429 ? 'RATE_LIMITED' : 'TAXONOMY_FORBIDDEN',
      message: 'Safe message',
      requestId: REQUEST_ID,
      details,
    },
    { 'cache-control': 'no-store', ...headers },
  );

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('readCmsTaxonomySelector retry (FE03 :1173)', () => {
  it.each([502, 503, 504])(
    'retries a declared-retryable %i after 250 ms then 750 ms and uses the page that answers',
    async (status) => {
      const fetcher = vi
        .fn<Fetcher>()
        .mockResolvedValueOnce(dependency(status, true))
        .mockResolvedValueOnce(dependency(status, true))
        .mockResolvedValueOnce(served());
      const pending = readSelectorWith(fetcher);
      await vi.advanceTimersByTimeAsync(249);
      expect(fetcher).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(fetcher).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(749);
      expect(fetcher).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(1);
      expect((await pending).kind).toBe('loaded');
      expect(fetcher).toHaveBeenCalledTimes(3);
    },
  );

  it('is unavailable after the second retry and never reads a fourth time', async () => {
    const fetcher = vi
      .fn<Fetcher>()
      .mockImplementation(async () => dependency(503, true));
    const pending = readSelectorWith(fetcher);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await pending).toEqual({ kind: 'unavailable' });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  const NOT_RETRYABLE: ReadonlyArray<readonly [string, () => Response]> = [
    ['a 500 that declares a retry safe', () => dependency(500, true)],
    ['a 503 that declares no retry', () => dependency(503, false)],
    ['a 502 with no details', () => failure(502, {})],
  ];

  it.each(NOT_RETRYABLE)('does not retry %s', async (_name, answer) => {
    const fetcher = vi
      .fn<Fetcher>()
      .mockImplementation(async () => answer().clone());
    const pending = readSelectorWith(fetcher);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await pending).toEqual({ kind: 'unavailable' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('does not retry a network failure', async () => {
    const fetcher = vi.fn<Fetcher>().mockRejectedValue(new Error('offline'));
    const pending = readSelectorWith(fetcher);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await pending).toEqual({ kind: 'unavailable' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('does not retry a fixed rejection', async () => {
    const fetcher = vi
      .fn<Fetcher>()
      .mockResolvedValue(failure(422, { violations: [] }));
    const pending = readSelectorWith(fetcher);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await pending).toEqual({
      kind: 'rejected',
      status: 422,
      retryAfterSeconds: null,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('propagates the abort signal to every retry', async () => {
    const controller = new AbortController();
    const fetcher = vi
      .fn<Fetcher>()
      .mockResolvedValueOnce(dependency(503, true))
      .mockResolvedValueOnce(served());
    const pending = readSelectorWith(fetcher, undefined, controller.signal);
    await vi.advanceTimersByTimeAsync(1_000);
    expect((await pending).kind).toBe('loaded');
    expect(fetcher).toHaveBeenCalledTimes(2);
    for (const invocation of fetcher.mock.calls)
      expect((invocation[1] as RequestInit).signal).toBe(controller.signal);
  });
});

describe('readCmsTaxonomySelector 429 (FE03 :1172)', () => {
  it('reports the whole seconds of Retry-After and does not retry', async () => {
    const fetcher = vi
      .fn<Fetcher>()
      .mockResolvedValue(
        failure(429, { retryable: true }, { 'retry-after': '12' }),
      );
    const pending = readSelectorWith(fetcher);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await pending).toEqual({
      kind: 'rejected',
      status: 429,
      retryAfterSeconds: 12,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('falls back to the stated details when the header is absent', async () => {
    const result = await readSelectorWith(
      vi
        .fn<Fetcher>()
        .mockResolvedValue(failure(429, { retryAfterSeconds: 4 })),
    );
    expect(result).toEqual({
      kind: 'rejected',
      status: 429,
      retryAfterSeconds: 4,
    });
  });

  it.each(['0', '86401', 'soon'])(
    'states no wait for the header %j',
    async (header) => {
      const result = await readSelectorWith(
        vi
          .fn<Fetcher>()
          .mockResolvedValue(failure(429, {}, { 'retry-after': header })),
      );
      expect(result).toEqual({
        kind: 'rejected',
        status: 429,
        retryAfterSeconds: null,
      });
    },
  );

  it('carries no wait for any other rejection', async () => {
    const result = await readSelectorWith(
      vi
        .fn<Fetcher>()
        .mockResolvedValue(failure(403, {}, { 'retry-after': '9' })),
    );
    expect(result).toEqual({
      kind: 'rejected',
      status: 403,
      retryAfterSeconds: null,
    });
  });
});
