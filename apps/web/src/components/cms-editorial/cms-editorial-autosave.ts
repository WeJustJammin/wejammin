/**
 * Bounded autosave cadence, verbatim from BE03b:741 —
 * "Autosave is advisory and bounded: default 3 seconds idle, hard maximum 30
 * seconds while dirty. Presence is a 2-minute lease renewed every 30 seconds
 * and cannot block another editor. Local unsent values remain client-side when
 * server authority changes."
 */
export const CMS_EDITORIAL_AUTOSAVE_IDLE_MS = 3_000;
export const CMS_EDITORIAL_AUTOSAVE_MAX_MS = 30_000;

/** Advisory presence lease; no HTTP presence endpoint exists in 03b. */
export const CMS_EDITORIAL_PRESENCE_LEASE_MS = 120_000;
export const CMS_EDITORIAL_PRESENCE_RENEW_MS = 30_000;

export type CmsEditorialAutosaveReason = 'idle' | 'max-interval';

export interface CmsEditorialAutosaveClock {
  readonly setTimer: (callback: () => void, milliseconds: number) => unknown;
  readonly clearTimer: (handle: unknown) => void;
}

export interface CmsEditorialAutosaveSchedulerOptions {
  /** True while local edits are newer than the last accepted revision. */
  readonly isDirty: () => boolean;
  /** False when assignment/capability/lifecycle forbids a commit. */
  readonly canSave: () => boolean;
  readonly onSave: (reason: CmsEditorialAutosaveReason) => void | Promise<void>;
  /** Notify the owning editor without exposing an unverified mutation result. */
  readonly onFailure?: () => void;
  readonly clock?: CmsEditorialAutosaveClock;
}

export interface CmsEditorialAutosaveScheduler {
  /** Record a local edit; starts a new window only when previously clean. */
  readonly markDirty: () => void;
  /** The draft matched the server; cancels pending saves. */
  readonly markClean: () => void;
  readonly isDirty: () => boolean;
  /** A lost/failed response must be reconciled before another mutation. */
  readonly needsReconciliation: () => boolean;
  readonly resumeAfterReconciliation: () => void;
  /** Why the last automatic save ran; null when none has run. */
  readonly lastReason: () => CmsEditorialAutosaveReason | null;
  readonly dispose: () => void;
}

const defaultClock: CmsEditorialAutosaveClock = {
  setTimer: (callback, milliseconds) => setTimeout(callback, milliseconds),
  clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/**
 * Trailing-edge debounce of 3 s, hard-capped at 30 s from the first dirty
 * edit. Continuous typing therefore commits at least every 30 s while dirty,
 * and a pause commits 3 s after the last keystroke.
 */
export const createCmsEditorialAutosaveScheduler = (
  options: CmsEditorialAutosaveSchedulerOptions,
): CmsEditorialAutosaveScheduler => {
  const clock = options.clock ?? defaultClock;
  let idleTimer: unknown = null;
  let maxTimer: unknown = null;
  let saving = false;
  let unresolved = false;
  let disposed = false;
  let reason: CmsEditorialAutosaveReason | null = null;
  // A save requested while another save is in flight. It is coalesced and
  // re-armed on settle so a still-dirty draft is never silently dropped.
  let rerun = false;
  // The hard maximum is anchored to the start of the current unsaved burst.
  // It cannot be derived from isDirty() because the caller reports the new
  // value before calling markDirty, so the draft is already dirty on the very
  // first edit and the 30 s cap would never arm.
  let windowOpen = false;

  const clearTimers = (): void => {
    if (idleTimer !== null) {
      clock.clearTimer(idleTimer);
      idleTimer = null;
    }
    if (maxTimer !== null) {
      clock.clearTimer(maxTimer);
      maxTimer = null;
    }
  };

  const run = async (nextReason: CmsEditorialAutosaveReason): Promise<void> => {
    clearTimers();
    // The in-flight save captures every change up to this moment; the next
    // local edit opens a fresh 30 s window.
    windowOpen = false;
    if (disposed || unresolved) return;
    if (saving) {
      rerun = true;
      return;
    }
    if (!options.isDirty() || !options.canSave()) return;
    saving = true;
    reason = nextReason;
    try {
      await options.onSave(nextReason);
    } catch {
      // A failed transport may have committed. Do not replay it just because
      // another edit arrived; keep the local draft dirty until the caller has
      // reconciled the canonical revision and idempotency outcome.
      unresolved = true;
      rerun = false;
      clearTimers();
      try {
        options.onFailure?.();
      } catch {
        // An observer failure must not turn this fire-and-forget timer into
        // an unhandled rejection or remove the reconciliation requirement.
      }
    } finally {
      saving = false;
    }
    if (disposed || unresolved) return;
    if (rerun) {
      rerun = false;
      if (options.isDirty() && options.canSave()) {
        windowOpen = true;
        armMax();
        armIdle();
      }
    }
  };

  const armIdle = (): void => {
    if (idleTimer !== null) clock.clearTimer(idleTimer);
    idleTimer = clock.setTimer(() => {
      idleTimer = null;
      void run('idle');
    }, CMS_EDITORIAL_AUTOSAVE_IDLE_MS);
  };

  const armMax = (): void => {
    if (maxTimer !== null) return;
    maxTimer = clock.setTimer(() => {
      maxTimer = null;
      void run('max-interval');
    }, CMS_EDITORIAL_AUTOSAVE_MAX_MS);
  };

  return {
    markDirty: () => {
      if (disposed || unresolved) return;
      if (!windowOpen) {
        windowOpen = true;
        reason = null;
        armMax();
      }
      armIdle();
    },
    markClean: () => {
      windowOpen = false;
      rerun = false;
      unresolved = false;
      clearTimers();
    },
    isDirty: () => options.isDirty(),
    needsReconciliation: () => unresolved,
    resumeAfterReconciliation: () => {
      if (disposed || saving || !unresolved) return;
      unresolved = false;
      if (options.isDirty() && options.canSave()) {
        windowOpen = true;
        reason = null;
        armMax();
        armIdle();
      }
    },
    lastReason: () => reason,
    dispose: () => {
      disposed = true;
      windowOpen = false;
      rerun = false;
      clearTimers();
    },
  };
};
