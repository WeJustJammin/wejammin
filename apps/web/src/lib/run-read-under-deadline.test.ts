import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BROWSER_READ_DEADLINE_MS } from './read-deadline';
import { runReadUnderDeadline } from './run-read-under-deadline';

/*
 * The one wrapper every browser read of the CMS islands uses to end (review V20 m10, DEC-246 ruling 1): the answer of the
 * read, or the failed value at the shared deadline, on a caller abort or on a throw, whether or not the fetch honours its
 * signal.
 */
beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const never = (): Promise<string> => new Promise<string>(() => undefined);

describe('runReadUnderDeadline', () => {
  it('answers what the read answered, and leaves no timer', async () => {
    expect(await runReadUnderDeadline(async () => 'ok', 'ended')).toBe('ok');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('answers the failure value at the deadline when the read never settles, aborts the signal it gave and leaves no timer', async () => {
    let seen: AbortSignal | undefined;
    const answer = runReadUnderDeadline((signal) => {
      seen = signal;
      return never();
    }, 'ended');
    let settled: string | null = null;
    void answer.then((value) => (settled = value));
    await vi.advanceTimersByTimeAsync(BROWSER_READ_DEADLINE_MS - 1);
    expect(settled).toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toBe('ended');
    expect(seen?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('answers the failure value at once when the caller aborts', async () => {
    const caller = new AbortController();
    const answer = runReadUnderDeadline(never, 'ended', caller.signal);
    caller.abort();
    expect(await answer).toBe('ended');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('answers the failure value for a read that throws', async () => {
    expect(
      await runReadUnderDeadline(async () => {
        throw new Error('offline');
      }, 'ended'),
    ).toBe('ended');
  });
});
