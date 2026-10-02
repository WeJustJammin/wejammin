import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CMS_EDITORIAL_AUTOSAVE_IDLE_MS,
  CMS_EDITORIAL_AUTOSAVE_MAX_MS,
  CMS_EDITORIAL_PRESENCE_LEASE_MS,
  CMS_EDITORIAL_PRESENCE_RENEW_MS,
  createCmsEditorialAutosaveScheduler,
  type CmsEditorialAutosaveClock,
  type CmsEditorialAutosaveReason,
} from './cms-editorial-autosave';

type Pending = { readonly callback: () => void; readonly delay: number };

/** A manual clock so the 3 s / 30 s cadence is asserted without real waiting. */
const manualClock = () => {
  const pending = new Map<number, Pending>();
  const history: number[] = [];
  let nextHandle = 1;
  const clock: CmsEditorialAutosaveClock = {
    setTimer: (callback, delay) => {
      const handle = nextHandle;
      nextHandle += 1;
      history.push(delay);
      pending.set(handle, { callback, delay });
      return handle;
    },
    clearTimer: (handle) => {
      pending.delete(handle as number);
    },
  };
  const fireDelay = (delay: number): void => {
    const matches = [...pending.entries()].filter(
      ([, entry]) => entry.delay === delay,
    );
    for (const [handle, entry] of matches) {
      pending.delete(handle);
      entry.callback();
    }
  };
  return {
    clock,
    fireDelay,
    history: (): readonly number[] => [...history],
    delays: (): readonly number[] =>
      [...pending.values()].map((entry) => entry.delay).sort((a, b) => a - b),
    size: (): number => pending.size,
  };
};

const schedulerFor = (input: {
  readonly dirty?: () => boolean;
  readonly canSave?: () => boolean;
  readonly onSave?: (
    reason: CmsEditorialAutosaveReason,
  ) => void | Promise<void>;
  readonly onFailure?: () => void;
  readonly clock: CmsEditorialAutosaveClock;
}) => {
  const saves: CmsEditorialAutosaveReason[] = [];
  let failures = 0;
  const scheduler = createCmsEditorialAutosaveScheduler({
    isDirty: input.dirty ?? (() => true),
    canSave: input.canSave ?? (() => true),
    onSave: (reason) => {
      saves.push(reason);
      return input.onSave?.(reason);
    },
    onFailure: () => {
      failures += 1;
      input.onFailure?.();
    },
    clock: input.clock,
  });
  return { scheduler, saves, failures: () => failures };
};

afterEach(() => {
  vi.useRealTimers();
});

describe('cms editorial autosave cadence', () => {
  it('matches the locked BE03b cadence and presence lease', () => {
    expect(CMS_EDITORIAL_AUTOSAVE_IDLE_MS).toBe(3_000);
    expect(CMS_EDITORIAL_AUTOSAVE_MAX_MS).toBe(30_000);
    expect(CMS_EDITORIAL_PRESENCE_LEASE_MS).toBe(120_000);
    expect(CMS_EDITORIAL_PRESENCE_RENEW_MS).toBe(30_000);
  });

  it('arms a 3 s idle save and a 30 s hard maximum on the first edit', () => {
    const manual = manualClock();
    const { scheduler } = schedulerFor({ clock: manual.clock });
    scheduler.markDirty();
    expect(manual.delays()).toEqual([3_000, 30_000]);
  });

  it('saves 3 seconds after the last keystroke', () => {
    const manual = manualClock();
    const { scheduler, saves } = schedulerFor({ clock: manual.clock });
    scheduler.markDirty();
    scheduler.markDirty();
    scheduler.markDirty();
    manual.fireDelay(3_000);
    expect(saves).toEqual(['idle']);
    expect(scheduler.lastReason()).toBe('idle');
  });

  it('resets the idle debounce on each keystroke but keeps one 30 s maximum', () => {
    const manual = manualClock();
    const { scheduler } = schedulerFor({ clock: manual.clock });
    scheduler.markDirty();
    scheduler.markDirty();
    scheduler.markDirty();
    expect(manual.delays()).toEqual([3_000, 30_000]);
    expect(manual.history().filter((delay) => delay === 30_000)).toHaveLength(
      1,
    );
    expect(manual.history().filter((delay) => delay === 3_000)).toHaveLength(3);
  });

  it('anchors a fresh 30 s maximum to the first edit after a save', () => {
    const manual = manualClock();
    const { scheduler, saves } = schedulerFor({ clock: manual.clock });
    scheduler.markDirty();
    manual.fireDelay(3_000);
    expect(saves).toEqual(['idle']);
    scheduler.markDirty();
    expect(manual.delays()).toEqual([3_000, 30_000]);
  });

  it('commits at 30 s even while the editor keeps typing', async () => {
    const manual = manualClock();
    const { scheduler, saves } = schedulerFor({ clock: manual.clock });
    scheduler.markDirty();
    manual.fireDelay(3_000);
    await Promise.resolve();
    scheduler.markDirty();
    manual.fireDelay(3_000);
    await Promise.resolve();
    scheduler.markDirty();
    manual.fireDelay(30_000);
    expect(saves).toEqual(['idle', 'idle', 'max-interval']);
    expect(scheduler.lastReason()).toBe('max-interval');
  });

  it('skips the automatic save when the draft is clean', () => {
    const manual = manualClock();
    const { scheduler, saves } = schedulerFor({
      dirty: () => false,
      clock: manual.clock,
    });
    scheduler.markDirty();
    manual.fireDelay(3_000);
    manual.fireDelay(30_000);
    expect(saves).toEqual([]);
  });

  it('skips the automatic save when capability or assignment forbids it', () => {
    const manual = manualClock();
    const { scheduler, saves } = schedulerFor({
      canSave: () => false,
      clock: manual.clock,
    });
    scheduler.markDirty();
    manual.fireDelay(3_000);
    manual.fireDelay(30_000);
    expect(saves).toEqual([]);
  });

  it('never overlaps in-flight saves', async () => {
    const manual = manualClock();
    let release: () => void = () => undefined;
    const blocker = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { scheduler, saves } = schedulerFor({
      clock: manual.clock,
      onSave: () => blocker,
    });
    scheduler.markDirty();
    manual.fireDelay(3_000);
    expect(saves).toEqual(['idle']);
    scheduler.markDirty();
    manual.fireDelay(3_000);
    expect(saves).toEqual(['idle']);
    release();
    await blocker;
    await Promise.resolve();
    await Promise.resolve();
    expect(saves).toEqual(['idle']);
  });

  it('re-arms a coalesced save after an in-flight save settles', async () => {
    const manual = manualClock();
    let release: () => void = () => undefined;
    const blocker = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { scheduler, saves } = schedulerFor({
      clock: manual.clock,
      onSave: () => blocker,
    });
    scheduler.markDirty();
    manual.fireDelay(3_000);
    scheduler.markDirty();
    manual.fireDelay(3_000);
    release();
    await blocker;
    await Promise.resolve();
    await Promise.resolve();
    expect(manual.delays()).toEqual([3_000, 30_000]);
    manual.fireDelay(3_000);
    await Promise.resolve();
    expect(saves).toEqual(['idle', 'idle']);
  });

  it('holds a failed save for reconciliation without losing the dirty draft or replaying it', async () => {
    const manual = manualClock();
    let attempts = 0;
    const { scheduler, saves, failures } = schedulerFor({
      clock: manual.clock,
      onSave: () => {
        attempts += 1;
        if (attempts === 1) return Promise.reject(new Error('lost response'));
      },
    });
    scheduler.markDirty();
    manual.fireDelay(3_000);
    await Promise.resolve();
    await Promise.resolve();
    expect(scheduler.needsReconciliation()).toBe(true);
    expect(scheduler.isDirty()).toBe(true);
    expect(failures()).toBe(1);
    expect(manual.size()).toBe(0);
    scheduler.markDirty();
    expect(manual.size()).toBe(0);
    expect(saves).toEqual(['idle']);

    scheduler.resumeAfterReconciliation();
    expect(scheduler.needsReconciliation()).toBe(false);
    expect(manual.delays()).toEqual([3_000, 30_000]);
    manual.fireDelay(3_000);
    await Promise.resolve();
    expect(saves).toEqual(['idle', 'idle']);
  });

  it('does not re-arm an in-flight save after disposal', async () => {
    const manual = manualClock();
    let release: () => void = () => undefined;
    const blocker = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { scheduler, saves } = schedulerFor({
      clock: manual.clock,
      onSave: () => blocker,
    });
    scheduler.markDirty();
    manual.fireDelay(3_000);
    scheduler.markDirty();
    scheduler.dispose();
    release();
    await blocker;
    await Promise.resolve();
    await Promise.resolve();
    expect(manual.size()).toBe(0);
    scheduler.markDirty();
    expect(manual.size()).toBe(0);
    expect(saves).toEqual(['idle']);
  });

  it('cancels pending saves once the draft matches the server', () => {
    const manual = manualClock();
    const { scheduler, saves } = schedulerFor({ clock: manual.clock });
    scheduler.markDirty();
    scheduler.markClean();
    expect(manual.size()).toBe(0);
    manual.fireDelay(3_000);
    manual.fireDelay(30_000);
    expect(saves).toEqual([]);
  });

  it('reports dirty state from the owning draft and drops it on dispose', () => {
    const manual = manualClock();
    let dirty = true;
    const { scheduler, saves } = schedulerFor({
      dirty: () => dirty,
      clock: manual.clock,
    });
    expect(scheduler.isDirty()).toBe(true);
    scheduler.markDirty();
    expect(scheduler.lastReason()).toBeNull();
    dirty = false;
    scheduler.dispose();
    expect(manual.size()).toBe(0);
    manual.fireDelay(3_000);
    expect(saves).toEqual([]);
  });

  it('uses real timers when no clock is injected', async () => {
    vi.useFakeTimers();
    const saves: CmsEditorialAutosaveReason[] = [];
    const scheduler = createCmsEditorialAutosaveScheduler({
      isDirty: () => true,
      canSave: () => true,
      onSave: (reason) => {
        saves.push(reason);
      },
    });
    scheduler.markDirty();
    await vi.advanceTimersByTimeAsync(3_000);
    expect(saves).toEqual(['idle']);
    scheduler.dispose();
  });
});
