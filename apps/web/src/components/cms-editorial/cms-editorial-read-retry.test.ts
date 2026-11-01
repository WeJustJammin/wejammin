// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { executeCmsEditorialConflictDetailRead } from './cms-editorial-conflict-detail-transport';
import { executeCmsEditorialEntryDraftDetailRead } from './cms-editorial-entry-draft-detail-transport';

/**
 * FE03 "Network and retry contract" (:1173) for the two protected editorial reads the entry
 * editor refetches with: a 502, 503 or 504 whose ApiError declares `retryable: true` is retried
 * at most twice, after 250 ms and 750 ms, then answered as degraded.
 */

const ENTRY_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132da';
const CONFLICT_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132db';
const REQUEST_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132df';
const BASE_PATH = '/api/v1/cms/entries';

type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

const apiError = (
  status: number,
  details: Record<string, unknown> = {},
  headers: Record<string, string> = {},
): Response =>
  new Response(
    JSON.stringify({
      code: status === 429 ? 'RATE_LIMITED' : 'DEPENDENCY_UNAVAILABLE',
      message: 'Safe message',
      requestId: REQUEST_ID,
      details,
    }),
    {
      status,
      headers: { 'content-type': 'application/json', ...headers },
    },
  );
const declared = (status: number): Response =>
  apiError(status, { dependencyClass: 'cms_editorial', retryable: true });
const notFound = (): Response => apiError(404);

interface Case {
  readonly name: string;
  readonly run: (fetcher: Fetcher) => Promise<{
    readonly outcome: string;
    readonly retryAfterSeconds: number | null;
  }>;
}
const cases: readonly Case[] = [
  {
    name: 'draft detail (CMS-03B-11)',
    run: (fetcher) =>
      executeCmsEditorialEntryDraftDetailRead({
        basePath: BASE_PATH,
        entryId: ENTRY_ID,
        fetcher,
      }),
  },
  {
    name: 'conflict detail (CMS-03B-12)',
    run: (fetcher) =>
      executeCmsEditorialConflictDetailRead({
        basePath: BASE_PATH,
        entryId: ENTRY_ID,
        conflictId: CONFLICT_ID,
        fetcher,
      }),
  },
];

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe.each(cases)('$name read retry (FE03 :1173)', ({ run }) => {
  it.each([502, 503, 504])(
    'retries a declared-retryable %i after 250 ms, then 750 ms',
    async (status) => {
      const fetcher = vi
        .fn<Fetcher>()
        .mockResolvedValueOnce(declared(status))
        .mockResolvedValueOnce(declared(status))
        .mockResolvedValueOnce(notFound());
      const pending = run(fetcher);
      await vi.advanceTimersByTimeAsync(0);
      expect(fetcher).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(249);
      expect(fetcher).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(fetcher).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(749);
      expect(fetcher).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(1);
      expect(fetcher).toHaveBeenCalledTimes(3);
      expect((await pending).outcome).toBe('not-found');
    },
  );

  it('retries exactly twice, then answers degraded', async () => {
    const fetcher = vi
      .fn<Fetcher>()
      .mockImplementation(async () => declared(503));
    const pending = run(fetcher);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect((await pending).outcome).toBe('degraded');
  });

  it.each([
    ['a 500', apiError(500, { retryable: true })],
    ['a 429', apiError(429, { retryable: true }, { 'retry-after': '3' })],
    ['a 503 that does not declare a retry safe', apiError(503)],
    [
      'a 502 that declares retryable false',
      apiError(502, { retryable: false }),
    ],
    ['a 504 with no ApiError body', new Response('down', { status: 504 })],
  ])('does not retry %s', async (_name, response) => {
    const fetcher = vi
      .fn<Fetcher>()
      .mockImplementation(async () => response.clone());
    const pending = run(fetcher);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await pending;
  });

  it('does not retry a network failure', async () => {
    const fetcher = vi.fn<Fetcher>().mockRejectedValue(new Error('offline'));
    const pending = run(fetcher);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect((await pending).outcome).toBe('degraded');
  });
});

describe.each(cases)('$name 429 wait (FE03 :1172)', ({ run }) => {
  const limited = async (
    headers: Record<string, string>,
    details: Record<string, unknown> = {},
  ) => run(async () => apiError(429, details, headers));

  it('reports the whole seconds of Retry-After', async () => {
    const result = await limited({ 'retry-after': '7' });
    expect(result.outcome).toBe('rate-limited');
    expect(result.retryAfterSeconds).toBe(7);
  });

  it('falls back to the stated details when the header is absent', async () => {
    expect(
      (await limited({}, { retryAfterSeconds: 4 })).retryAfterSeconds,
    ).toBe(4);
  });

  it.each(['0', '-2', '1.5', '86401', 'soon'])(
    'does not believe the header %j',
    async (header) => {
      expect(
        (await limited({ 'retry-after': header })).retryAfterSeconds,
      ).toBeNull();
    },
  );
});
