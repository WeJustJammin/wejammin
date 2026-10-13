import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CLOCK_START,
  cleanInput,
  checkerInput,
  manualClock,
  steppingClock,
} from './a11y-structural.test-support';
import {
  evaluateAccessibilityGate,
  type AccessibilityLoadResult,
} from './gate';

/** The deadline paths: timer, cooperative stop, parent abort. */

const iso = (ms: number): string => new Date(ms).toISOString();
const ok = (input: unknown): AccessibilityLoadResult => ({ ok: true, input });
const hang = (): Promise<AccessibilityLoadResult> =>
  new Promise(() => undefined);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(CLOCK_START);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('timer deadline', () => {
  it('abandons a load that ignores its signal at 2,000 ms by default', async () => {
    let seen: AbortSignal | undefined;
    const load = (signal: AbortSignal): Promise<AccessibilityLoadResult> => {
      seen = signal;
      return hang();
    };
    let settled = false;
    const pending = evaluateAccessibilityGate({ load }).then((gate) => {
      settled = true;
      return gate;
    });
    await vi.advanceTimersByTimeAsync(1_999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toEqual({
      state: 'failed',
      failureCode: 'CHECKER_TIMEOUT',
      durationMs: 2_000,
      evaluatedAt: iso(CLOCK_START + 2_000),
    });
    expect(seen?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('honours a shorter timeoutMs', async () => {
    const pending = evaluateAccessibilityGate({ load: hang, timeoutMs: 100 });
    await vi.advanceTimersByTimeAsync(100);
    expect(await pending).toMatchObject({
      state: 'failed',
      failureCode: 'CHECKER_TIMEOUT',
      durationMs: 100,
    });
  });

  it('reports a timeout, not a dependency failure, when the load rejects on abort', async () => {
    const load = (signal: AbortSignal): Promise<AccessibilityLoadResult> =>
      new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), {
          once: true,
        });
      });
    const pending = evaluateAccessibilityGate({ load, timeoutMs: 300 });
    await vi.advanceTimersByTimeAsync(300);
    expect(await pending).toMatchObject({
      state: 'failed',
      failureCode: 'CHECKER_TIMEOUT',
    });
  });

  it('uses the real clock and leaves no timer armed after a normal run', async () => {
    const gate = await evaluateAccessibilityGate({
      load: async () => ok(cleanInput()),
    });
    expect(gate).toMatchObject({
      state: 'healthy',
      durationMs: 0,
      evaluatedAt: iso(CLOCK_START),
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('retries with the real default sleep inside the budget', async () => {
    const results = [
      { ok: false, retryable: true, reason: 'dependency_unavailable' } as const,
      ok(cleanInput()),
    ];
    const load = vi.fn(async () => results.shift() as AccessibilityLoadResult);
    const pending = evaluateAccessibilityGate({ load });
    await vi.advanceTimersByTimeAsync(250);
    expect(await pending).toMatchObject({ state: 'healthy', durationMs: 250 });
    expect(load).toHaveBeenCalledTimes(2);
  });
});

describe('cooperative deadline', () => {
  it('stops evaluation between nodes once the budget is spent', async () => {
    const gate = await evaluateAccessibilityGate({
      load: async () => ok(cleanInput()),
      now: steppingClock(700),
    });
    // Readings: start 0, polls 700 and 1400, the third poll 2100 stops, finish 2800.
    expect(gate).toEqual({
      state: 'failed',
      failureCode: 'CHECKER_TIMEOUT',
      durationMs: 2_800,
      evaluatedAt: iso(CLOCK_START + 2_800),
    });
  });

  it('stops when the load itself consumed the budget', async () => {
    const clock = manualClock();
    const gate = await evaluateAccessibilityGate({
      load: async () => {
        clock.advance(3_000);
        return ok(cleanInput());
      },
      now: clock.now,
    });
    expect(gate).toMatchObject({
      state: 'failed',
      failureCode: 'CHECKER_TIMEOUT',
      durationMs: 3_000,
    });
  });

  it('treats a run that finishes at the deadline as timed out even when no node was polled', async () => {
    const gate = await evaluateAccessibilityGate({
      load: async () => ok(checkerInput([])),
      now: steppingClock(2_000),
    });
    expect(gate).toMatchObject({
      state: 'failed',
      failureCode: 'CHECKER_TIMEOUT',
      durationMs: 2_000,
    });
  });

  it('still completes one millisecond before the deadline', async () => {
    const gate = await evaluateAccessibilityGate({
      load: async () => ok(checkerInput([])),
      now: steppingClock(1_999),
    });
    expect(gate).toMatchObject({ state: 'healthy', durationMs: 1_999 });
  });

  it('reports a late load failure as a timeout', async () => {
    const clock = manualClock();
    const gate = await evaluateAccessibilityGate({
      load: async () => {
        clock.advance(2_500);
        return {
          ok: false,
          retryable: false,
          reason: 'dependency_unavailable',
        };
      },
      now: clock.now,
    });
    expect(gate).toMatchObject({
      state: 'failed',
      failureCode: 'CHECKER_TIMEOUT',
    });
  });
});

describe('parent abort', () => {
  it('does not even load when the parent is already aborted', async () => {
    const parent = new AbortController();
    parent.abort();
    const load = vi.fn(async () => ok(cleanInput()));
    const gate = await evaluateAccessibilityGate({
      load,
      signal: parent.signal,
    });
    expect(gate).toMatchObject({
      state: 'failed',
      failureCode: 'CHECKER_TIMEOUT',
    });
    expect(load).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('abandons a hung load when the parent aborts', async () => {
    const parent = new AbortController();
    const pending = evaluateAccessibilityGate({
      load: hang,
      signal: parent.signal,
    });
    await vi.advanceTimersByTimeAsync(10);
    parent.abort();
    expect(await pending).toMatchObject({
      state: 'failed',
      failureCode: 'CHECKER_TIMEOUT',
      durationMs: 10,
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('abandons the retry pause when the parent aborts during it', async () => {
    const parent = new AbortController();
    const load = vi.fn(async (): Promise<AccessibilityLoadResult> => ({
      ok: false,
      retryable: true,
      reason: 'dependency_unavailable',
    }));
    const sleep = (_ms: number, signal: AbortSignal): Promise<void> =>
      new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), {
          once: true,
        });
        parent.abort();
      });
    const gate = await evaluateAccessibilityGate({
      load,
      sleep,
      signal: parent.signal,
    });
    expect(gate).toMatchObject({
      state: 'failed',
      failureCode: 'CHECKER_TIMEOUT',
    });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('does not reload after a pause that ended with the abort', async () => {
    const parent = new AbortController();
    const load = vi.fn(async (): Promise<AccessibilityLoadResult> => ({
      ok: false,
      retryable: true,
      reason: 'dependency_unavailable',
    }));
    const sleep = async (): Promise<void> => parent.abort();
    const gate = await evaluateAccessibilityGate({
      load,
      sleep,
      signal: parent.signal,
    });
    expect(gate).toMatchObject({
      state: 'failed',
      failureCode: 'CHECKER_TIMEOUT',
    });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('is unaffected by a parent that never aborts', async () => {
    const parent = new AbortController();
    const gate = await evaluateAccessibilityGate({
      load: async () => ok(cleanInput()),
      signal: parent.signal,
    });
    expect(gate.state).toBe('healthy');
  });
});
