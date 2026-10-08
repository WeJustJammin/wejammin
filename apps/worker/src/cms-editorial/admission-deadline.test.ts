import { describe, expect, it, vi } from 'vitest';

import {
  dependencyDeadline,
  dependencyTimedOut,
  dependencyUnavailable,
} from './admission-deadline';

/*
 * BE00 deadline propagation: a dependency call races the route deadline and the
 * caller's own cancellation. A breach or cancellation is a typed 504 that keeps
 * the scrubbed dependency class, a transport throw is a typed 503, and no
 * timer or listener outlives the call.
 */

const value = { ok: true as const, value: 'done' };

describe('dependency deadline', () => {
  it('passes a timely result through and releases its parent listener', async () => {
    const parent = new AbortController();
    const remove = vi.spyOn(parent.signal, 'removeEventListener');
    const result = await dependencyDeadline(
      async () => value,
      1_000,
      parent.signal,
    );
    expect(result).toBe(value);
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
  });

  it('runs without a parent signal', async () => {
    expect(await dependencyDeadline(async () => value, 1_000)).toBe(value);
  });

  it('maps a transport throw to the typed 503 without a leaked message', async () => {
    const result = await dependencyDeadline(async () => {
      throw new Error('socket hang up at 10.0.0.7');
    }, 1_000);
    expect(result).toEqual(dependencyUnavailable());
    expect(JSON.stringify(result)).not.toContain('10.0.0.7');
  });

  it('maps a deadline breach to the typed 504 and aborts the dependency', async () => {
    let observed: AbortSignal | undefined;
    const result = await dependencyDeadline((signal) => {
      observed = signal;
      return new Promise(() => undefined);
    }, 5);
    expect(result).toEqual(dependencyTimedOut());
    expect(observed?.aborted).toBe(true);
  });

  it('does not call the dependency when the caller already cancelled', async () => {
    const invoke = vi.fn(async () => value);
    const result = await dependencyDeadline(
      invoke,
      1_000,
      AbortSignal.abort('client closed'),
    );
    expect(result).toEqual(dependencyTimedOut());
    expect(invoke).not.toHaveBeenCalled();
  });

  it('cancels an in-flight dependency when the caller aborts', async () => {
    const parent = new AbortController();
    let observed: AbortSignal | undefined;
    const pending = dependencyDeadline(
      (signal) => {
        observed = signal;
        return new Promise(() => undefined);
      },
      60_000,
      parent.signal,
    );
    parent.abort('client closed');
    expect(await pending).toEqual(dependencyTimedOut());
    expect(observed?.aborted).toBe(true);
    expect(observed?.reason).toBe('client closed');
  });
});
