import type { CmsEditorialAutosaveClock } from './cms-editorial-autosave';

/**
 * A deterministic clock for the autosave scheduler and the editor controller:
 * time moves only when a test advances it, and every timer that is due fires in
 * order, so 3 s idle / 30 s hard-maximum behavior is asserted exactly.
 */
export interface FakeClock extends CmsEditorialAutosaveClock {
  readonly advance: (milliseconds: number) => Promise<void>;
  readonly pending: () => number;
}

/**
 * Lets an awaited save flow run to completion: microtasks first, then a few
 * macrotask turns, because reading a Response body spans more than microtasks.
 */
export const settleAsyncWork = async (): Promise<void> => {
  for (let turn = 0; turn < 4; turn += 1) {
    for (let tick = 0; tick < 25; tick += 1) await Promise.resolve();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
};

export const createFakeClock = (): FakeClock => {
  let now = 0;
  let next = 1;
  const timers = new Map<number, { at: number; callback: () => void }>();
  return {
    setTimer: (callback, milliseconds) => {
      const id = next++;
      timers.set(id, { at: now + milliseconds, callback });
      return id;
    },
    clearTimer: (handle) => {
      timers.delete(handle as number);
    },
    pending: () => timers.size,
    advance: async (milliseconds) => {
      const target = now + milliseconds;
      for (;;) {
        const due = [...timers.entries()]
          .filter(([, timer]) => timer.at <= target)
          .sort((left, right) => left[1].at - right[1].at)[0];
        if (due === undefined) break;
        timers.delete(due[0]);
        now = due[1].at;
        due[1].callback();
        await settleAsyncWork();
      }
      now = target;
    },
  };
};
