import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BROWSER_READ_DEADLINE_MS } from '../../lib/read-deadline';
import { refreshLocaleSource } from './locale-source-refresh';
import { ENTRY_ID } from './locale-variant.test-support';

/*
 * DEC-246(1): the source refresh after a 409, an unknown outcome or a save uses the shared 8,000 ms read deadline.
 * A read that never answers is the failed read the form already offers to repeat, never a frozen save.
 */
beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const input = (fetcher: typeof fetch, signal?: AbortSignal) => ({
  entryId: ENTRY_ID,
  sourceLocale: 'en-US',
  fieldIds: [],
  fetcher,
  ...(signal === undefined ? {} : { signal }),
});

describe('refreshLocaleSource deadline', () => {
  it('fails a fetch that never settles at the shared deadline, and not before', async () => {
    const fetcher = vi.fn<typeof fetch>(
      () => new Promise<Response>(() => undefined),
    );
    let answer: unknown = 'pending';
    void refreshLocaleSource(input(fetcher)).then((value) => {
      answer = value;
    });
    await vi.advanceTimersByTimeAsync(BROWSER_READ_DEADLINE_MS - 1);
    expect(answer).toBe('pending');
    await vi.advanceTimersByTimeAsync(1);
    expect(answer).toEqual({ kind: 'failed', status: null });
    expect(fetcher.mock.calls[0]![1]?.signal?.aborted).toBe(true);
  });

  it('fails a body that never arrives at the deadline', async () => {
    const response = new Response('{}', { status: 200 });
    vi.spyOn(response, 'json').mockReturnValue(new Promise(() => undefined));
    let answer: unknown = 'pending';
    void refreshLocaleSource(
      input(vi.fn<typeof fetch>().mockResolvedValue(response)),
    ).then((value) => {
      answer = value;
    });
    await vi.advanceTimersByTimeAsync(BROWSER_READ_DEADLINE_MS);
    expect(answer).toEqual({ kind: 'failed', status: null });
  });

  it('follows the caller signal at once and leaves no timer behind', async () => {
    const caller = new AbortController();
    const fetcher = vi.fn<typeof fetch>(
      () => new Promise<Response>(() => undefined),
    );
    let answer: unknown = 'pending';
    void refreshLocaleSource(input(fetcher, caller.signal)).then((value) => {
      answer = value;
    });
    await vi.advanceTimersByTimeAsync(10);
    caller.abort();
    await vi.advanceTimersByTimeAsync(0);
    expect(answer).toEqual({ kind: 'failed', status: null });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('leaves no timer behind after an answer', async () => {
    await refreshLocaleSource(
      input(
        vi
          .fn<typeof fetch>()
          .mockResolvedValue(new Response('{}', { status: 404 })),
      ),
    );
    expect(vi.getTimerCount()).toBe(0);
  });
});
