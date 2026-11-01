import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { startReadDeadline } from './read-deadline';
import { withinDeadline } from './read-within-deadline';

/*
 * A fetch or a body read that ignores its abort signal must still not hold a protected read past the deadline
 * (review V20 m1, DEC-246(1)).
 */
beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('withinDeadline', () => {
  it('passes the value of work that settles first, and rejects with its error', async () => {
    const deadline = startReadDeadline();
    await expect(withinDeadline(deadline, Promise.resolve(7))).resolves.toBe(7);
    await expect(
      withinDeadline(deadline, Promise.reject(new Error('net'))),
    ).rejects.toThrow('net');
    deadline.clear();
  });

  it('rejects when the deadline expires on work that never settles', async () => {
    const deadline = startReadDeadline(undefined, 100);
    const outcome = withinDeadline(
      deadline,
      new Promise<never>(() => undefined),
    ).catch((error: unknown) => (error as Error).message);
    await vi.advanceTimersByTimeAsync(100);
    await expect(outcome).resolves.toBe('read deadline');
    expect(deadline.expired()).toBe(true);
  });

  it('rejects when the caller aborts, which is not an expiry', async () => {
    const parent = new AbortController();
    const deadline = startReadDeadline(parent.signal);
    const outcome = withinDeadline(
      deadline,
      new Promise<never>(() => undefined),
    ).catch((error: unknown) => (error as Error).message);
    parent.abort();
    await expect(outcome).resolves.toBe('read deadline');
    expect(deadline.expired()).toBe(false);
    deadline.clear();
  });

  it('rejects at once when the signal is already aborted', async () => {
    const parent = new AbortController();
    parent.abort();
    const deadline = startReadDeadline(parent.signal);
    await expect(
      withinDeadline(deadline, new Promise<never>(() => undefined)),
    ).rejects.toThrow('read deadline');
    deadline.clear();
  });
});
