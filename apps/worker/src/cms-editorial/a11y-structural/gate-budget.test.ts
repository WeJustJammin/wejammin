import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { defaultGateSleep, openGateBudget } from './gate-budget';

/** The wall-clock budget and the default retry sleep of the gate call. */

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('defaultGateSleep', () => {
  it('resolves after the delay and leaves no timer behind', async () => {
    const controller = new AbortController();
    let settled = false;
    const sleeping = defaultGateSleep(250, controller.signal).then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(249);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await sleeping;
    expect(settled).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects with the abort reason and clears its timer when aborted while sleeping', async () => {
    const controller = new AbortController();
    const sleeping = defaultGateSleep(250, controller.signal);
    const reason = new Error('request cancelled');
    const assertion = expect(sleeping).rejects.toBe(reason);
    controller.abort(reason);
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects at once for a signal that is already aborted', async () => {
    const controller = new AbortController();
    controller.abort(new Error('gone'));
    await expect(defaultGateSleep(250, controller.signal)).rejects.toThrow(
      'gone',
    );
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('openGateBudget', () => {
  it('aborts its signal and resolves expired when the budget elapses', async () => {
    const budget = openGateBudget(500, undefined);
    expect(budget.signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(499);
    expect(budget.signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(budget.signal.aborted).toBe(true);
    await expect(budget.expired).resolves.toBe('expired');
    budget.close();
  });

  it('close() clears the timer so a finished gate leaves nothing armed', () => {
    const budget = openGateBudget(500, undefined);
    expect(vi.getTimerCount()).toBe(1);
    budget.close();
    expect(vi.getTimerCount()).toBe(0);
    expect(budget.signal.aborted).toBe(false);
  });

  it('aborts when the parent signal aborts, and stops listening after close()', async () => {
    const parent = new AbortController();
    const removed = vi.spyOn(parent.signal, 'removeEventListener');
    const budget = openGateBudget(500, parent.signal);
    parent.abort();
    expect(budget.signal.aborted).toBe(true);
    await expect(budget.expired).resolves.toBe('expired');
    budget.close();
    expect(removed).toHaveBeenCalledWith('abort', expect.any(Function));
    expect(vi.getTimerCount()).toBe(0);
  });

  it('is expired from the start when the parent is already aborted', async () => {
    const parent = new AbortController();
    parent.abort();
    const budget = openGateBudget(500, parent.signal);
    expect(budget.signal.aborted).toBe(true);
    await expect(budget.expired).resolves.toBe('expired');
    budget.close();
  });
});
