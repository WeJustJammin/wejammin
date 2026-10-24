import { draftValuesFromDetail } from './cms-editorial-draft-values';
import type { CmsEditorialEntryRevisionRequest } from './cms-editorial-contracts';
import type { CmsEditorialEditorContext } from './cms-editorial-entry-editor-context';
import {
  SAVE_COPY,
  readWaitingMessage,
} from './cms-editorial-entry-editor-outcomes';
import {
  CMS_EDITORIAL_REBASE_BACKOFF_MS,
  divergentCmsEditorialFieldIds,
} from './cms-editorial-entry-editor-rebase';

/**
 * What the editor does with a 409 on a save: read the canonical draft, then
 * stop at a durable conflict, stop at a field both sides changed, or rebase the
 * unsent edits onto the new base and send them again. Rebasing is bounded
 * (Codex review s10-ts-2, M2): the first rebase goes out at once, the next two
 * back off, and a fourth consecutive stale base ends in an explicit state that
 * only the author's Save draft resumes. Nothing is ever overwritten.
 */
export const createCmsEditorialStaleBaseFlow = (
  ctx: CmsEditorialEditorContext,
  resend: () => Promise<unknown>,
) => {
  const stopRebaseLimited = (message: string): void => {
    ctx.paused = true;
    ctx.rebaseLimited = true;
    ctx.readWait = false;
    ctx.clearTimer();
    ctx.set({
      phase: 'sync-conflict',
      alert: true,
      unsentCount: ctx.changed().length,
      message,
    });
  };

  /**
   * FE03 :1172-1173: a 429 on the draft READ waits for `Retry-After`, says so, and
   * reads again. The save command is never re-sent for it (the base is still
   * stale): only the bounded rebase after a successful read sends it. Every
   * limited read spends one unit of the same rebase budget (M2), so a read
   * that keeps answering 429 ends in an explicit, author-resumable state.
   */
  const waitOutReadLimit = (
    request: CmsEditorialEntryRevisionRequest,
    seconds: number | null,
  ): void => {
    ctx.rebases += 1;
    if (ctx.rebases > CMS_EDITORIAL_REBASE_BACKOFF_MS.length) {
      stopRebaseLimited(SAVE_COPY.readLimit);
      return;
    }
    ctx.readWait = true;
    ctx.set({
      phase: 'waiting',
      alert: false,
      retryAfterSeconds: seconds,
      message: readWaitingMessage(seconds),
    });
    ctx.clearTimer();
    ctx.timer = ctx.clock.setTimer(
      () => {
        ctx.timer = null;
        ctx.readWait = false;
        if (ctx.disposed) return;
        // The re-read holds the send gate like a save does; the rebase it may
        // lead to releases it itself before sending.
        ctx.inFlight = true;
        void handleConflict(request).finally(() => {
          ctx.inFlight = false;
        });
      },
      (seconds ?? 5) * 1_000,
    );
  };

  const handleConflict = async (
    request: CmsEditorialEntryRevisionRequest,
  ): Promise<void> => {
    const current = await ctx.readCurrent();
    if (current.kind === 'rate-limited') {
      waitOutReadLimit(request, current.retryAfterSeconds);
      return;
    }
    if (current.kind !== 'ok') {
      ctx.paused = true;
      ctx.set({
        phase: 'sync-conflict',
        alert: true,
        message: SAVE_COPY.stale,
      });
      return;
    }
    const detail = current.detail;
    const sync = {
      expectedVersion: request.expectedVersion,
      currentVersion: detail.entry.version,
    };
    if (detail.openConflict !== null) {
      ctx.paused = true;
      ctx.set({
        phase: 'conflict',
        alert: true,
        syncConflict: sync,
        openConflict: detail.openConflict,
        message: SAVE_COPY.conflict,
      });
      return;
    }
    // No durable conflict: the base moved. A field changed on both sides is a
    // real divergence; anything else rebases cleanly and goes out again.
    const canonical = draftValuesFromDetail(detail, ctx.descriptors).values;
    const unsent = ctx.changed();
    if (
      divergentCmsEditorialFieldIds(
        unsent,
        ctx.state.baseValues,
        ctx.state.values,
        canonical,
      ).length > 0
    ) {
      ctx.paused = true;
      ctx.set({
        phase: 'sync-conflict',
        alert: true,
        syncConflict: sync,
        message: SAVE_COPY.stale,
      });
      return;
    }
    const mine = new Set(unsent);
    ctx.adoptCanonical(detail, (fieldId) => mine.has(fieldId), '');
    // The failed attempt is over; the rebased edits go out as a new save, but
    // only a bounded number of times in a row (M2): a peer that keeps changing
    // a different field must not drive an endless immediate re-send chain.
    ctx.inFlight = false;
    ctx.rebases += 1;
    const delay = CMS_EDITORIAL_REBASE_BACKOFF_MS[ctx.rebases - 1];
    if (delay === undefined) {
      stopRebaseLimited(SAVE_COPY.rebaseLimit);
      return;
    }
    if (delay === 0) {
      await resend();
      return;
    }
    ctx.set({ phase: 'waiting', alert: false, message: SAVE_COPY.rebasing });
    ctx.clearTimer();
    ctx.timer = ctx.clock.setTimer(() => {
      ctx.timer = null;
      if (!ctx.disposed) void resend();
    }, delay);
  };

  return { handleConflict };
};
