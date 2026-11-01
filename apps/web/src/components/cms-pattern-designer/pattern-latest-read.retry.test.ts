import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  jsonResponse,
  patternDetailFixture,
} from '../../server/cms-pattern-platform.test-support';
import { readLatestPatternVersion } from './pattern-latest-read';

/**
 * FE03 "Network and retry contract" (:1172-1173) for the latest-version read
 * (`cmsPatternLatestRead`): a declared-retryable 502/503/504 is retried twice (250 ms, 750 ms)
 * before the read is reported unavailable; a 429 reports the wait the server stated.
 */
type Fetcher = typeof fetch;

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
  failure(status, { dependencyClass: 'cms_composition', retryable: true });
const served = (): Response =>
  jsonResponse(200, patternDetailFixture(), { etag: '"1"' });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('readLatestPatternVersion retry (FE03 :1173)', () => {
  it.each([502, 503, 504])(
    'retries a declared-retryable %i after 250 ms, then 750 ms, and uses the version that answers',
    async (status) => {
      const fetcher = vi
        .fn<Fetcher>()
        .mockResolvedValueOnce(declared(status))
        .mockResolvedValueOnce(declared(status))
        .mockResolvedValueOnce(served());
      const pending = readLatestPatternVersion('profile-hero', fetcher);
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
      .mockImplementation(async () => declared(503));
    const pending = readLatestPatternVersion('profile-hero', fetcher);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await pending).toEqual({ kind: 'unavailable' });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it.each([
    ['a 500', failure(500, { retryable: true })],
    ['a 503 that does not declare a retry safe', failure(503, {})],
    ['a 502 that declares retryable false', failure(502, { retryable: false })],
  ])('does not retry %s', async (_case, response) => {
    const fetcher = vi
      .fn<Fetcher>()
      .mockImplementation(async () => response.clone());
    const pending = readLatestPatternVersion('profile-hero', fetcher);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await pending).toEqual({ kind: 'unavailable' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('does not retry a network failure', async () => {
    const fetcher = vi.fn<Fetcher>().mockRejectedValue(new Error('offline'));
    const pending = readLatestPatternVersion('profile-hero', fetcher);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await pending).toEqual({ kind: 'unavailable' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe('readLatestPatternVersion 429 (FE03 :1172)', () => {
  it('reports the whole seconds of Retry-After and does not retry', async () => {
    const fetcher = vi
      .fn<Fetcher>()
      .mockImplementation(async () =>
        failure(429, { retryable: true }, { 'retry-after': '12' }),
      );
    const pending = readLatestPatternVersion('profile-hero', fetcher);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await pending).toEqual({
      kind: 'rejected',
      status: 429,
      retryAfterSeconds: 12,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('falls back to the stated details when the header is absent', async () => {
    const result = await readLatestPatternVersion(
      'profile-hero',
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
      const result = await readLatestPatternVersion(
        'profile-hero',
        vi
          .fn<Fetcher>()
          .mockResolvedValue(failure(429, {}, { 'retry-after': header })),
      );
      expect(result).toEqual({ kind: 'rejected', status: 429 });
    },
  );

  it('carries no wait for any other rejection', async () => {
    const result = await readLatestPatternVersion(
      'profile-hero',
      vi
        .fn<Fetcher>()
        .mockResolvedValue(failure(403, {}, { 'retry-after': '9' })),
    );
    expect(result).toEqual({ kind: 'rejected', status: 403 });
  });
});
