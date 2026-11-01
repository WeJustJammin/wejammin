import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BROWSER_READ_DEADLINE_MS } from '../../lib/read-deadline';
import { readLatestPatternVersion } from './pattern-latest-fetch';

/*
 * DEC-246(1): readLatestPatternVersion has the shared 8,000 ms read deadline. A read that never answers is `unavailable` (the island's failed
 * cell with its control to repeat it); a settled read leaves no timer behind (caller aborts are pinned by the cancellation suites).
 */
beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const call = (fetcher: typeof fetch, signal?: AbortSignal) =>
  readLatestPatternVersion(
    'profile-hero',
    fetcher,
    signal === undefined ? {} : { signal },
  );

describe('readLatestPatternVersion: the read deadline', () => {
  it('passes an abort signal and answers unavailable at the deadline for a fetch that never settles, and not before', async () => {
    const fetcher = vi.fn<typeof fetch>(
      () => new Promise<Response>(() => undefined),
    );
    let answer: unknown = 'pending';
    void call(fetcher).then((value) => {
      answer = value;
    });
    await vi.advanceTimersByTimeAsync(BROWSER_READ_DEADLINE_MS - 1);
    expect(answer).toBe('pending');
    expect(fetcher.mock.calls[0]![1]?.signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(answer).toEqual({ kind: 'unavailable' });
    expect(fetcher.mock.calls[0]![1]?.signal?.aborted).toBe(true);
  });

  it('answers unavailable when the body never arrives', async () => {
    const response = new Response('{}', { status: 200 });
    vi.spyOn(response, 'json').mockReturnValue(new Promise(() => undefined));
    let answer: unknown = 'pending';
    void call(vi.fn<typeof fetch>().mockResolvedValue(response)).then(
      (value) => {
        answer = value;
      },
    );
    await vi.advanceTimersByTimeAsync(BROWSER_READ_DEADLINE_MS);
    expect(answer).toEqual({ kind: 'unavailable' });
  });

  it('leaves no timer behind after an answer', async () => {
    await call(
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json({ code: 'X' }, { status: 404 })),
    );
    expect(vi.getTimerCount()).toBe(0);
  });
});
