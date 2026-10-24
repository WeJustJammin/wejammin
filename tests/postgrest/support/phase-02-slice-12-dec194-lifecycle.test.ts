import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CLAIMED,
  createUnitHarness,
  flush,
  tick,
  WORLD,
  type UnitHarness,
} from './phase-02-slice-12-dec194-unit-test-support';

vi.mock('node:child_process', () => ({ execFileSync: vi.fn() }));
let harness: UnitHarness;
beforeEach(() => {
  vi.useFakeTimers({
    toFake: [
      'Date',
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
    ],
  });
  vi.setSystemTime(new Date('2026-10-16T12:00:00Z'));
  harness = createUnitHarness();
});
afterEach(async () => {
  // Even a RED assertion must release fake fetches and drain real Worker retries
  // before restoring globals. This cleanup never executes a host command.
  await harness?.drain();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('DEC194 isolation harness owned producer lifetime', () => {
  it('LIFE-001 closes a real continuation retry pause before probe deletion; no late retry', async () => {
    harness.mode('retry');
    const work = harness.watch(harness.worker.continuation(CLAIMED));
    await flush();
    expect(harness.calls.map((call) => call.operation)).toEqual([
      'cms_run_taxonomy_merge_converge',
    ]);
    expect(work.settled).toBe(false);
    await tick(14_999); // Below every actual production jittered first retry.
    expect(harness.calls).toHaveLength(1);
    const closing = harness.finish();
    await closing.done;
    expect(
      work.settled,
      'teardown must await the cancelled producer, not just DROP',
    ).toBe(true);
    expect(work.value).toMatchObject({
      state: 'failed',
      errorCode: 'DEPENDENCY_UNAVAILABLE',
    });
    await tick(200_000);
    expect(harness.calls).toHaveLength(1);
    expect(harness.dropped).toEqual([
      { restoredFetch: true, activeFetches: 0, activeWork: 0 },
    ]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('LIFE-002 aborts a held continuation and awaits cancellation acknowledgment before DROP', async () => {
    const work = harness.watch(harness.worker.continuation(CLAIMED));
    await flush();
    expect(harness.calls).toHaveLength(1);
    const closing = harness.finish();
    await flush();
    expect(
      harness.calls[0]!.aborted,
      'owned cancellation reaches actual production fetch',
    ).toBe(true);
    expect(closing.settled).toBe(false);
    expect(harness.dropped).toEqual([]);
    harness.calls[0]!.acknowledge();
    await closing.done;
    await work.done;
    expect(work.value).toMatchObject({
      state: 'failed',
      errorCode: 'DEPENDENCY_UNAVAILABLE',
    });
    expect(harness.dropped).toEqual([
      { restoredFetch: true, activeFetches: 0, activeWork: 0 },
    ]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('LIFE-003 awaits recovery finally restoring global fetch before probe DROP', async () => {
    const work = harness.watch(harness.worker.recovery());
    await flush();
    expect(harness.calls.map((call) => call.operation)).toEqual([
      'cms_reconcile_taxonomy_merge_converge',
    ]);
    expect(globalThis.fetch).not.toBe(harness.fetchBoundary);
    const closing = harness.finish();
    await flush();
    expect(harness.calls[0]!.aborted).toBe(true);
    expect(closing.settled).toBe(false);
    expect(harness.dropped).toEqual([]);
    harness.calls[0]!.acknowledge();
    await closing.done;
    await work.done;
    expect(globalThis.fetch).toBe(harness.fetchBoundary);
    expect(harness.dropped).toEqual([
      { restoredFetch: true, activeFetches: 0, activeWork: 0 },
    ]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('LIFE-004 drains ALL simultaneous ordinary/continuation/recovery work, not only the first acknowledgment', async () => {
    const ordinary = harness.watch(harness.worker.ordinary());
    const continuation = harness.watch(harness.worker.continuation(CLAIMED));
    const recovery = harness.watch(harness.worker.recovery());
    await flush();
    expect(harness.calls.map((call) => call.operation).sort()).toEqual([
      'cms_act_taxonomy_term',
      'cms_reconcile_taxonomy_merge_converge',
      'cms_run_taxonomy_merge_converge',
    ]);
    const closing = harness.finish();
    await flush();
    expect(harness.calls.every((call) => call.aborted)).toBe(true);
    for (const call of harness.calls.filter(
      (call) => call.operation !== 'cms_reconcile_taxonomy_merge_converge',
    ))
      call.acknowledge();
    await flush();
    expect(closing.settled).toBe(false);
    expect(harness.dropped).toEqual([]);
    harness.calls
      .find(
        (call) => call.operation === 'cms_reconcile_taxonomy_merge_converge',
      )!
      .acknowledge();
    await closing.done;
    expect([ordinary.settled, continuation.settled, recovery.settled]).toEqual([
      true,
      true,
      true,
    ]);
    expect(harness.dropped).toEqual([
      { restoredFetch: true, activeFetches: 0, activeWork: 0 },
    ]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('LIFE-005 preserves the real 15000ms deadline but drains its still-pending forwarding fetch before DROP', async () => {
    const work = harness.watch(harness.worker.recovery());
    await flush();
    expect(harness.calls).toHaveLength(1);
    await tick(14_999);
    expect(work.settled).toBe(false);
    expect(harness.calls[0]!.aborted).toBe(false);
    await tick(1);
    expect(work.settled).toBe(true);
    expect(work.error).toBeInstanceOf(Error);
    expect(harness.calls[0]!.aborted).toBe(true);
    expect(harness.calls[0]!.settled).toBe(false);
    expect(globalThis.fetch).toBe(harness.fetchBoundary);
    const closing = harness.finish();
    await flush();
    expect(
      closing.settled,
      'outer RPC deadline does not make its underlying fetch quiescent',
    ).toBe(false);
    expect(harness.dropped).toEqual([]);
    harness.calls[0]!.acknowledge();
    await closing.done;
    expect(harness.dropped).toEqual([
      { restoredFetch: true, activeFetches: 0, activeWork: 0 },
    ]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([
    'ordinary',
    'continuation',
    'recovery',
    'checkCanonicalUpstream',
    'readCanonical',
    'claim',
    'settle',
  ] as const)(
    'LIFE-006 closed admission refuses %s before network or SQL',
    async (operation) => {
      harness.mode('success');
      await harness.finish().done;
      const beforeSql = harness.statements.length;
      const start = () => {
        switch (operation) {
          case 'ordinary':
            return harness.worker.ordinary();
          case 'continuation':
            return harness.worker.continuation(CLAIMED);
          case 'recovery':
            return harness.worker.recovery();
          case 'checkCanonicalUpstream':
            return harness.worker.checkCanonicalUpstream();
          case 'readCanonical':
            return harness.worker.readCanonical(WORLD.upstreamJobId);
          case 'claim':
            return harness.worker.claim(CLAIMED.job.id);
          case 'settle':
            return harness.worker.settle(CLAIMED, 'failed', null);
        }
      };
      const outcome = harness.watch(Promise.resolve().then<unknown>(start));
      await flush();
      expect(harness.calls, 'no admitted RPC after teardown starts').toEqual(
        [],
      );
      expect(harness.statements).toHaveLength(beforeSql);
      expect(outcome.settled).toBe(true);
      expect(outcome.error).toBeInstanceOf(Error);
      expect((outcome.error as Error).message).toMatch(/clos|dispos|abort/iu);
      expect(globalThis.fetch).toBe(harness.fetchBoundary);
    },
  );

  it('CONTROL completed real Worker adapters retain their successful outputs and clean owned probe normally', async () => {
    harness.mode('success');
    const ordinary = harness.watch(harness.worker.ordinary());
    const continuation = harness.watch(harness.worker.continuation(CLAIMED));
    const recovery = harness.watch(harness.worker.recovery());
    await flush();
    await Promise.all([ordinary.done, continuation.done, recovery.done]);
    expect((ordinary.value as Response).status).toBe(200);
    expect(await (ordinary.value as Response).json()).toMatchObject({
      id: WORLD.sourceId,
      lifecycle: 'merged',
      successorId: WORLD.survivorId,
    });
    expect(continuation.value).toEqual({
      state: 'succeeded',
      errorCode: null,
      resultRef: { type: CLAIMED.job.type, id: CLAIMED.job.id },
    });
    expect(recovery.error).toBeUndefined();
    expect(globalThis.fetch).toBe(harness.fetchBoundary);
    await harness.finish().done;
    expect(harness.dropped).toEqual([
      { restoredFetch: true, activeFetches: 0, activeWork: 0 },
    ]);
    expect(harness.triggers.has(`${harness.stack.schema}_jobs`)).toBe(false);
    expect(harness.schemas.has(harness.stack.schema)).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('LIFE-007 overlapping actual sweeps finishing A then B restore the original fetch before DROP', async () => {
    const originalFetch = globalThis.fetch;
    expect(originalFetch).toBe(harness.fetchBoundary);
    const first = harness.watch(harness.worker.recovery());
    await flush();
    expect(harness.calls).toHaveLength(1);
    const second = harness.watch(harness.worker.recovery());
    await flush();
    expect(harness.calls.map((call) => call.operation)).toEqual([
      'cms_reconcile_taxonomy_merge_converge',
      'cms_reconcile_taxonomy_merge_converge',
    ]);
    expect([first.settled, second.settled]).toEqual([false, false]);
    harness.calls[0]!.acknowledge();
    await flush();
    await first.done;
    expect(first.error).toBeUndefined();
    expect(second.settled).toBe(false);
    harness.calls[1]!.acknowledge();
    await flush();
    await second.done;
    expect(second.error).toBeUndefined();
    await harness.finish().done;
    expect(
      globalThis.fetch,
      'the last completion must not restore an obsolete owner wrapper',
    ).toBe(originalFetch);
    expect(harness.dropped).toEqual([
      { restoredFetch: true, activeFetches: 0, activeWork: 0 },
    ]);
    expect(harness.calls.every((call) => call.settled)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    await tick(60_000);
    expect(harness.calls).toHaveLength(2);
    expect(globalThis.fetch).toBe(originalFetch);
  });
});
