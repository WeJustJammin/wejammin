import { describe, expect, it, vi } from 'vitest';

import {
  CLOCK_START,
  blockNode,
  blockingInput,
  cleanInput,
  checkerInput,
  fieldIdOf,
  fieldNode,
  manualClock,
  richText,
} from './a11y-structural.test-support';
import {
  ACCESSIBILITY_GATE_RETRY_DELAY_MS,
  evaluateAccessibilityGate,
  type AccessibilityLoadResult,
} from './gate';

/** quality_gate_evaluate: load, validate, evaluate inside one budget; always fresh. */

const iso = (ms: number): string => new Date(ms).toISOString();
const ok = (input: unknown): AccessibilityLoadResult => ({ ok: true, input });
const fail = (
  reason: 'dependency_unavailable' | 'target_unreadable',
  retryable = false,
): AccessibilityLoadResult => ({ ok: false, retryable, reason });

describe('evaluateAccessibilityGate: outcomes', () => {
  it('returns a healthy run with the checker result, the input and the timing', async () => {
    const clock = manualClock();
    const input = cleanInput();
    const gate = await evaluateAccessibilityGate({
      load: async () => {
        clock.advance(40);
        return ok(input);
      },
      now: clock.now,
    });
    expect(gate).toMatchObject({
      state: 'healthy',
      result: { state: 'healthy', blockingCount: 0 },
      input,
      durationMs: 40,
      evaluatedAt: iso(CLOCK_START + 40),
    });
    expect(Object.keys(gate)).toEqual([
      'state',
      'result',
      'input',
      'durationMs',
      'evaluatedAt',
    ]);
  });

  it('returns a blocked run when a blocking finding exists', async () => {
    const gate = await evaluateAccessibilityGate({
      load: async () => ok(blockingInput()),
      now: manualClock().now,
    });
    expect(gate).toMatchObject({
      state: 'blocked',
      result: { state: 'blocked', blockingCount: 1 },
    });
  });

  it('hands the load a live abort signal', async () => {
    const seen: AbortSignal[] = [];
    await evaluateAccessibilityGate({
      load: async (signal) => {
        seen.push(signal);
        expect(signal.aborted).toBe(false);
        return ok(cleanInput());
      },
      now: manualClock().now,
    });
    expect(seen).toHaveLength(1);
  });

  it('runs fresh on every call and keeps no state between calls', async () => {
    const clock = manualClock();
    const load = vi.fn(async () => ok(cleanInput()));
    const first = await evaluateAccessibilityGate({ load, now: clock.now });
    clock.advance(5_000);
    const second = await evaluateAccessibilityGate({ load, now: clock.now });
    expect(load).toHaveBeenCalledTimes(2);
    expect(first).not.toBe(second);
    expect(second).toMatchObject({ evaluatedAt: iso(CLOCK_START + 5_000) });
    if (first.state !== 'healthy' || second.state !== 'healthy')
      throw new Error('expected two healthy runs');
    expect(second.result.inputHash).toBe(first.result.inputHash);
  });
});

describe('evaluateAccessibilityGate: load failures', () => {
  const failed = (code: string, clock = manualClock()) => ({
    state: 'failed',
    failureCode: code,
    durationMs: expect.any(Number) as number,
    evaluatedAt: iso(clock.now()),
  });

  it.each([
    ['dependency_unavailable', 'CHECKER_DEPENDENCY_UNAVAILABLE'],
    ['target_unreadable', 'TARGET_UNREADABLE'],
  ] as const)(
    'maps a non-retryable %s to %s without retrying',
    async (reason, code) => {
      const load = vi.fn(async () => fail(reason));
      const sleep = vi.fn(async () => undefined);
      const clock = manualClock();
      expect(
        await evaluateAccessibilityGate({ load, sleep, now: clock.now }),
      ).toEqual(failed(code, clock));
      expect(load).toHaveBeenCalledTimes(1);
      expect(sleep).not.toHaveBeenCalled();
    },
  );

  it('retries once after 250 ms when the load says retryable, then succeeds', async () => {
    const results = [fail('dependency_unavailable', true), ok(cleanInput())];
    const load = vi.fn(async () => results.shift() as AccessibilityLoadResult);
    const sleep = vi.fn(async () => undefined);
    const gate = await evaluateAccessibilityGate({
      load,
      sleep,
      now: manualClock().now,
    });
    expect(gate.state).toBe('healthy');
    expect(load).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledExactlyOnceWith(
      ACCESSIBILITY_GATE_RETRY_DELAY_MS,
      expect.any(AbortSignal),
    );
    expect(ACCESSIBILITY_GATE_RETRY_DELAY_MS).toBe(250);
  });

  it('retries only once: a second failure is final whatever it says about retrying', async () => {
    const results = [
      fail('dependency_unavailable', true),
      fail('target_unreadable', true),
      ok(cleanInput()),
    ];
    const load = vi.fn(async () => results.shift() as AccessibilityLoadResult);
    const sleep = vi.fn(async () => undefined);
    const clock = manualClock();
    expect(
      await evaluateAccessibilityGate({ load, sleep, now: clock.now }),
    ).toEqual(failed('TARGET_UNREADABLE', clock));
    expect(load).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it('does not retry when 250 ms no longer fit inside the budget', async () => {
    const clock = manualClock();
    const load = vi.fn(async () => {
      clock.advance(150);
      return fail('dependency_unavailable', true);
    });
    const sleep = vi.fn(async () => undefined);
    const gate = await evaluateAccessibilityGate({
      load,
      sleep,
      now: clock.now,
      timeoutMs: 400,
    });
    expect(gate).toMatchObject({
      state: 'failed',
      failureCode: 'CHECKER_DEPENDENCY_UNAVAILABLE',
    });
    expect(load).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('still retries when the pause fits one millisecond inside the budget', async () => {
    const clock = manualClock();
    const results = [fail('dependency_unavailable', true), ok(cleanInput())];
    const load = vi.fn(async () => {
      if (results.length === 2) clock.advance(149);
      return results.shift() as AccessibilityLoadResult;
    });
    const sleep = vi.fn(async (ms: number) => clock.advance(ms));
    const gate = await evaluateAccessibilityGate({
      load,
      sleep,
      now: clock.now,
      timeoutMs: 400,
    });
    expect(gate).toMatchObject({ state: 'healthy', durationMs: 399 });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('treats a throwing load as dependency_unavailable and never propagates', async () => {
    const load = vi.fn(async (): Promise<AccessibilityLoadResult> => {
      throw new Error('socket hang up');
    });
    const sleep = vi.fn(async () => undefined);
    const gate = await evaluateAccessibilityGate({
      load,
      sleep,
      now: manualClock().now,
    });
    expect(gate).toMatchObject({
      state: 'failed',
      failureCode: 'CHECKER_DEPENDENCY_UNAVAILABLE',
    });
    expect(load).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('treats a throwing retry load as dependency_unavailable', async () => {
    const results: (AccessibilityLoadResult | Error)[] = [
      fail('target_unreadable', true),
      new Error('boom'),
    ];
    const load = vi.fn(async (): Promise<AccessibilityLoadResult> => {
      const next = results.shift();
      if (next instanceof Error) throw next;
      return next as AccessibilityLoadResult;
    });
    const gate = await evaluateAccessibilityGate({
      load,
      sleep: async () => undefined,
      now: manualClock().now,
    });
    expect(gate).toMatchObject({
      state: 'failed',
      failureCode: 'CHECKER_DEPENDENCY_UNAVAILABLE',
    });
  });

  it('treats a throwing sleep as dependency_unavailable and does not reload', async () => {
    const load = vi.fn(async () => fail('dependency_unavailable', true));
    const sleep = vi.fn(async (): Promise<void> => {
      throw 'not an error object';
    });
    const gate = await evaluateAccessibilityGate({
      load,
      sleep,
      now: manualClock().now,
    });
    expect(gate).toMatchObject({
      state: 'failed',
      failureCode: 'CHECKER_DEPENDENCY_UNAVAILABLE',
    });
    expect(load).toHaveBeenCalledTimes(1);
  });
});

describe('evaluateAccessibilityGate: unreadable targets', () => {
  const duplicated = fieldNode(1, richText());
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'revision'],
    ['an empty object', {}],
    ['an unknown member', { ...checkerInput([]), extra: true }],
    [
      'a media node',
      checkerInput([{ kind: 'media', assetId: fieldIdOf(9) } as never]),
    ],
    ['a duplicated field id', checkerInput([duplicated, duplicated])],
    ['a bad locale', { ...checkerInput([]), locale: 'en_US' }],
    [
      'a block with a bad pointer',
      checkerInput([blockNode(1, { pointer: 'composition' })]),
    ],
  ])('reports %s as TARGET_UNREADABLE', async (_name, input) => {
    const load = vi.fn(async () => ok(input));
    const gate = await evaluateAccessibilityGate({
      load,
      now: manualClock().now,
    });
    expect(gate).toMatchObject({
      state: 'failed',
      failureCode: 'TARGET_UNREADABLE',
    });
    expect(load).toHaveBeenCalledTimes(1);
  });
});

describe('evaluateAccessibilityGate: arguments', () => {
  it.each([99, 2_001, 150.5, Number.NaN, 0, -1, Number.POSITIVE_INFINITY])(
    'refuses a timeoutMs of %s before loading anything',
    async (timeoutMs) => {
      const load = vi.fn(async () => ok(cleanInput()));
      await expect(
        evaluateAccessibilityGate({ load, timeoutMs }),
      ).rejects.toThrow(RangeError);
      expect(load).not.toHaveBeenCalled();
    },
  );

  it.each([100, 150, 2_000])('accepts a timeoutMs of %i', async (timeoutMs) => {
    const gate = await evaluateAccessibilityGate({
      load: async () => ok(cleanInput()),
      timeoutMs,
      now: manualClock().now,
    });
    expect(gate.state).toBe('healthy');
  });
});
