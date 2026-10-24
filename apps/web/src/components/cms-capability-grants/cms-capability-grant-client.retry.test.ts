// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { readGrantList } from './cms-capability-grant-client';

/**
 * FE03 "Network and retry contract" (:1172-1173) for the grant list read (CMS-03A-18): a
 * declared-retryable 502/503/504 is retried twice (250 ms, 750 ms) before the error state; a
 * 429 keeps its stated Retry-After and is not retried.
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
  new Response(
    JSON.stringify({
      code: status === 429 ? 'RATE_LIMITED' : 'DEPENDENCY_UNAVAILABLE',
      message: 'Safe message',
      requestId: '0195b6f0-0000-7000-8000-000000000001',
      details,
    }),
    {
      status,
      headers: { 'content-type': 'application/json', ...headers },
    },
  );
const declared = (status: number): Response =>
  failure(status, { dependencyClass: 'cms_capability', retryable: true });
const query = { limit: 25, sort: 'updatedAt', direction: 'desc' } as const;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('readGrantList retry (FE03 :1173)', () => {
  it.each([502, 503, 504])(
    'retries a declared-retryable %i after 250 ms, then 750 ms, then reports the error',
    async (status) => {
      const fetcher = vi
        .fn<Fetcher>()
        .mockImplementation(async () => declared(status));
      const pending = readGrantList({ query, fetcher });
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
      expect(await pending).toMatchObject({
        kind: 'error',
        status,
        retryable: true,
      });
    },
  );

  it('uses the answer of a retry that was refused', async () => {
    const fetcher = vi
      .fn<Fetcher>()
      .mockResolvedValueOnce(declared(503))
      .mockResolvedValueOnce(failure(403, {}));
    const pending = readGrantList({ query, fetcher });
    await vi.advanceTimersByTimeAsync(250);
    expect((await pending).kind).toBe('forbidden');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['a 500', failure(500, { retryable: true })],
    ['a 503 that does not declare a retry safe', failure(503, {})],
    ['a 502 with no ApiError body', new Response(null, { status: 502 })],
  ])('does not retry %s', async (_case, response) => {
    const fetcher = vi
      .fn<Fetcher>()
      .mockImplementation(async () => response.clone());
    const pending = readGrantList({ query, fetcher });
    await vi.advanceTimersByTimeAsync(10_000);
    expect((await pending).kind).toBe('error');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('does not retry a transport loss', async () => {
    const fetcher = vi.fn<Fetcher>().mockRejectedValue(new Error('offline'));
    const pending = readGrantList({ query, fetcher });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await pending).toEqual({ kind: 'degraded' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('does not retry a 429 and keeps its Retry-After', async () => {
    const fetcher = vi
      .fn<Fetcher>()
      .mockImplementation(async () =>
        failure(429, { retryable: true }, { 'retry-after': '9' }),
      );
    const pending = readGrantList({ query, fetcher });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await pending).toMatchObject({
      kind: 'error',
      status: 429,
      retryAfterSeconds: 9,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
