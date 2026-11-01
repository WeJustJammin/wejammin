import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BROWSER_READ_DEADLINE_MS, startReadDeadline } from './read-deadline';

/*
 * A protected browser read that has not answered within the deadline is abandoned so the island
 * can leave its loading state for its degraded one (FE03 "Network and retry contract": every
 * state is deterministic; review V20 m1/m10: a hung read froze the send with no way out).
 */
beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('startReadDeadline', () => {
  it('is the 8,000 ms the CMS reads already used', () => {
    expect(BROWSER_READ_DEADLINE_MS).toBe(8_000);
  });

  it('aborts its signal at the deadline and not one millisecond before', () => {
    const deadline = startReadDeadline();
    vi.advanceTimersByTime(BROWSER_READ_DEADLINE_MS - 1);
    expect(deadline.signal.aborted).toBe(false);
    expect(deadline.expired()).toBe(false);
    vi.advanceTimersByTime(1);
    expect(deadline.signal.aborted).toBe(true);
    expect(deadline.expired()).toBe(true);
  });

  it('follows an abort of the caller signal at once, which is not an expiry', () => {
    const parent = new AbortController();
    const deadline = startReadDeadline(parent.signal);
    parent.abort();
    expect(deadline.signal.aborted).toBe(true);
    expect(deadline.expired()).toBe(false);
  });

  it('starts aborted when the caller signal already is', () => {
    const parent = new AbortController();
    parent.abort();
    expect(startReadDeadline(parent.signal).signal.aborted).toBe(true);
  });

  it('clear stops the timer and detaches from the caller signal', () => {
    const parent = new AbortController();
    const remove = vi.spyOn(parent.signal, 'removeEventListener');
    const deadline = startReadDeadline(parent.signal);
    deadline.clear();
    vi.advanceTimersByTime(BROWSER_READ_DEADLINE_MS * 2);
    expect(deadline.signal.aborted).toBe(false);
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
    expect(vi.getTimerCount()).toBe(0);
  });

  it('takes a shorter deadline for a caller that needs one', () => {
    const deadline = startReadDeadline(undefined, 100);
    vi.advanceTimersByTime(100);
    expect(deadline.expired()).toBe(true);
  });
});
