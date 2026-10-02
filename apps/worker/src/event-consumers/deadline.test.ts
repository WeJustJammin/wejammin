import { afterEach, describe, expect, it, vi } from 'vitest';

import { runWithDeadline } from './deadline';
import { CONSUMER_DEADLINE_MS } from './types';

afterEach(() => {
  vi.useRealTimers();
});

describe('consumer deadline', () => {
  it('returns the step result and leaves no timer behind', async () => {
    vi.useFakeTimers();
    await expect(runWithDeadline(async () => 'done')).resolves.toBe('done');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('aborts the signal at the 15 second protected-command deadline', async () => {
    vi.useFakeTimers();
    let aborted = false;
    const pending = runWithDeadline(
      (signal) =>
        new Promise<string>((resolve) => {
          signal.addEventListener('abort', () => {
            aborted = true;
            resolve('aborted');
          });
        }),
    );
    await vi.advanceTimersByTimeAsync(CONSUMER_DEADLINE_MS - 1);
    expect(aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toBe('aborted');
    expect(CONSUMER_DEADLINE_MS).toBe(15_000);
  });

  it('clears the timer when the step throws', async () => {
    vi.useFakeTimers();
    await expect(
      runWithDeadline(async () => {
        throw new Error('step failed');
      }),
    ).rejects.toThrow('step failed');
    expect(vi.getTimerCount()).toBe(0);
  });
});
