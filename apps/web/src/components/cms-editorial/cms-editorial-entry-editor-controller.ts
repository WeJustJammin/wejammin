import type { JsonValue } from '@wejammin/contracts';

import type { CmsFieldDescriptor } from '../cms-editorial-fields/cms-field-descriptor';
import { createCmsEditorialAutosaveScheduler } from './cms-editorial-autosave';
import {
  createCmsEditorialEditorContext,
  type CmsEditorialEntryEditorDeps,
} from './cms-editorial-entry-editor-context';
import { createCmsEditorialSaveFlow } from './cms-editorial-entry-editor-save';
import type { CmsEditorialEditorState } from './cms-editorial-entry-editor-state';
import { cmsEditorialAutosaveStatusMessage } from './cms-editorial-runtime-dom-feedback';

export type { CmsEditorialEntryEditorDeps } from './cms-editorial-entry-editor-context';
export { CMS_EDITORIAL_RECONCILE_DELAY_MS } from './cms-editorial-entry-editor-save';

export interface CmsEditorialEntryEditorController {
  readonly descriptors: readonly CmsFieldDescriptor[];
  readonly getState: () => CmsEditorialEditorState;
  readonly subscribe: (listener: () => void) => () => void;
  readonly setValue: (fieldId: string, value: JsonValue | null) => void;
  readonly setInputError: (fieldId: string, message: string | null) => void;
  /** The explicit Save draft action: saves now, or replays an unknown save. */
  readonly saveNow: () => Promise<void>;
  /** Replays the save whose outcome is unknown, under the same key. */
  readonly retryReconcile: () => Promise<void>;
  /**
   * After a divergence the author chose to leave: read the current draft and
   * replace the form with it. This is the one place unsent edits are dropped,
   * and only on an explicit action.
   */
  readonly discardUnsentAndLoadCurrent: () => Promise<void>;
  /**
   * True while the author holds work the server has not confirmed: edited
   * values newer than the base, a request in flight, a save whose outcome is
   * unknown, or one waiting to be sent again. Leaving the page loses it.
   */
  readonly hasUnsentWork: () => boolean;
  readonly dispose: () => void;
}

/**
 * The state machine of the CMS-05 draft editor (BE03b CMS-03B-01). It owns the
 * canonical base and the author's unsent values apart from each other, so a
 * refusal, a lost response, a conflict or a lost session can never discard
 * unsent work or adopt a value the server did not confirm. Reads are never
 * optimistic: the next `baseRevision` / `If-Match` come only from a verified
 * response (the committed `entryVersion`) or from a refetched draft.
 */
export const createCmsEditorialEntryEditorController = (
  deps: CmsEditorialEntryEditorDeps,
): CmsEditorialEntryEditorController => {
  const ctx = createCmsEditorialEditorContext(deps);
  // The scheduler and the save flow need each other: the scheduler saves, and a
  // finished save re-arms or resumes the scheduler.
  const scheduler = createCmsEditorialAutosaveScheduler({
    clock: ctx.clock,
    isDirty: () => ctx.changed().length > 0 || ctx.pending !== null,
    canSave: () => ctx.canEdit && !ctx.paused,
    onSave: async () => {
      const outcome = await flow.attempt();
      if (outcome === 'unknown') throw new Error('save outcome unknown');
    },
    onFailure: () => flow.reconcile(),
  });
  const flow = createCmsEditorialSaveFlow(ctx, scheduler);
  ctx.arm = () => {
    if (ctx.changed().length > 0) scheduler.markDirty();
    else scheduler.markClean();
  };

  return {
    descriptors: ctx.descriptors,
    getState: () => ctx.state,
    subscribe: (listener) => {
      ctx.listeners.add(listener);
      return () => ctx.listeners.delete(listener);
    },
    setValue: (fieldId, value) => {
      if (!ctx.canEdit || !ctx.editable.includes(fieldId)) return;
      ctx.state = {
        ...ctx.state,
        values: { ...ctx.state.values, [fieldId]: value },
        refusedFieldIds: ctx.state.refusedFieldIds.filter(
          (id) => id !== fieldId,
        ),
      };
      const count = ctx.changed().length;
      const frozen =
        ctx.paused ||
        ctx.state.phase === 'unknown' ||
        ctx.state.phase === 'saving' ||
        ctx.state.phase === 'waiting';
      ctx.set({
        unsentCount: count,
        ...(frozen
          ? {}
          : {
              phase: count > 0 ? 'dirty' : 'clean',
              alert: false,
              message:
                count > 0
                  ? cmsEditorialAutosaveStatusMessage({
                      dirty: true,
                      saving: false,
                      outcome: null,
                      retryable: false,
                    })
                  : '',
            }),
      });
      if (!ctx.paused) ctx.arm();
    },
    setInputError: (fieldId, message) => {
      const next = { ...ctx.state.inputErrors };
      if (message === null) delete next[fieldId];
      else next[fieldId] = message;
      ctx.set({ inputErrors: next });
    },
    saveNow: async () => {
      if (ctx.rebaseLimited) {
        // The explicit Save draft is the one thing that resumes after the
        // automatic rebase budget was spent: a fresh budget, a fresh base.
        ctx.rebaseLimited = false;
        ctx.paused = false;
        ctx.rebases = 0;
        ctx.set({ syncConflict: null, alert: false });
      }
      if (ctx.state.phase === 'unauthenticated') {
        // The author signed in again (in another tab, so nothing was lost): the
        // explicit Save draft tries the unsent values with the new session.
        ctx.paused = false;
        ctx.set({ phase: 'dirty', alert: false, message: '' });
      }
      if (ctx.pending !== null) return flow.replayPending();
      const outcome = await flow.attempt();
      if (outcome === 'unknown') flow.reconcile();
    },
    retryReconcile: async () => {
      if (ctx.pending === null) return;
      ctx.pending.replays = 0;
      ctx.set({ needsManualRetry: false });
      await flow.replayPending();
    },
    discardUnsentAndLoadCurrent: async () => {
      const detail = await ctx.readCurrent();
      if (detail === null) {
        ctx.set({
          alert: true,
          message:
            'The current version could not be loaded. Your unsent changes are kept; try again.',
        });
        return;
      }
      ctx.paused = false;
      ctx.rebaseLimited = false;
      ctx.rebases = 0;
      ctx.pending = null;
      ctx.adoptCanonical(detail, () => false, '');
      ctx.settle(false);
    },
    hasUnsentWork: () =>
      ctx.changed().length > 0 ||
      ctx.pending !== null ||
      ctx.state.phase === 'saving' ||
      ctx.state.phase === 'unknown' ||
      ctx.state.phase === 'waiting',
    dispose: () => {
      ctx.disposed = true;
      ctx.clearTimer();
      scheduler.dispose();
      ctx.listeners.clear();
    },
  };
};
