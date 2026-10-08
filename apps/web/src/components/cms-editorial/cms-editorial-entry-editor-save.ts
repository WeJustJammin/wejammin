import type { JsonValue } from '@wejammin/contracts';

import type { CmsFieldDescriptor } from '../cms-editorial-fields/cms-field-descriptor';
import { validateCmsFieldValue } from '../cms-editorial-fields/cms-field-value';
import { draftValuesFromDetail } from './cms-editorial-draft-values';
import {
  newCmsEditorialIdempotencyKey,
  READ_CSRF_COOKIE_FROM_DOCUMENT,
} from './cms-editorial-entry-create-submit';
import type {
  CmsEditorialEditorContext,
  CmsEditorialPendingSave,
} from './cms-editorial-entry-editor-context';
import {
  SAVE_COPY,
  refusalPatch,
  waitingMessage,
} from './cms-editorial-entry-editor-outcomes';
import { divergentCmsEditorialFieldIds } from './cms-editorial-entry-editor-rebase';
import { savedProvenance } from './cms-editorial-provenance-copy';
import { createCmsEditorialStaleBaseFlow } from './cms-editorial-entry-editor-stale-base';
import { cmsEditorialPointersFor } from './cms-editorial-entry-editor-state';
import {
  executeCmsEditorialRevisionMutation,
  type CmsEditorialMutationResult,
} from './cms-editorial-runtime';

export type CmsEditorialSaveOutcome = 'saved' | 'unknown' | 'stopped' | 'noop';

/** How long to wait before replaying a save whose outcome is unknown. */
export const CMS_EDITORIAL_RECONCILE_DELAY_MS = 2_000;
const RECONCILE_AUTOMATIC_REPLAYS = 3;

/**
 * The save flows over one editor context: build the exact request from the
 * canonical base and the changed fields, send it, and turn the verified outcome
 * into state. Only a verified 201 moves the base; an unknown outcome pins the
 * request and its key so the identical bytes are replayed.
 */
export const createCmsEditorialSaveFlow = (
  ctx: CmsEditorialEditorContext,
  scheduler: { readonly resumeAfterReconciliation: () => void },
) => {
  const staleBase = createCmsEditorialStaleBaseFlow(ctx, () => attempt());

  const onSuccess = async (
    resource: NonNullable<CmsEditorialMutationResult['resource']>,
    sent: CmsEditorialPendingSave,
  ): Promise<CmsEditorialSaveOutcome> => {
    ctx.pending = null;
    ctx.set({
      baseValues: { ...ctx.state.baseValues, ...sent.snapshot },
      provenance: savedProvenance(ctx.state.provenance, sent.snapshot),
      baseRevision: resource.revisionNumber,
      expectedVersion: resource.entryVersion,
      refusedFieldIds: [],
      needsManualRetry: false,
    });
    // Two parents: the server merged another session's changes into this
    // revision, so the canonical draft holds fields the browser has not seen.
    if (resource.parentRevisionIds.length === 2) {
      const detail = await ctx.readCurrent();
      if (detail !== null) {
        // Every dirty-at-dispatch field was in the request, and its value is now
        // the base. What differs from the base NOW was therefore edited after
        // dispatch (during the save, the canonical read, or an unknown-outcome
        // wait): unsent work that canonical values must never replace (H1).
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
          // Another session also changed a field edited after dispatch: neither
          // side may win silently, so nothing is adopted and the author decides.
          ctx.paused = true;
          ctx.set({
            phase: 'sync-conflict',
            alert: true,
            unsentCount: unsent.length,
            syncConflict: {
              expectedVersion: sent.request.expectedVersion,
              currentVersion: detail.entry.version,
            },
            message: SAVE_COPY.stale,
          });
          return 'saved';
        }
        const edited = new Set(unsent);
        ctx.adoptCanonical(
          detail,
          (fieldId) => edited.has(fieldId),
          SAVE_COPY.merged,
        );
        const count = ctx.changed().length;
        ctx.set({ unsentCount: count, phase: count > 0 ? 'dirty' : 'saved' });
        ctx.arm();
        return 'saved';
      }
    }
    ctx.settle(true);
    return 'saved';
  };

  const onResult = async (
    result: CmsEditorialMutationResult,
    sent: CmsEditorialPendingSave,
  ): Promise<CmsEditorialSaveOutcome> => {
    if (
      result.outcome !== 'conflict' &&
      result.outcome !== 'unknown' &&
      result.outcome !== 'degraded' &&
      result.outcome !== 'rate-limited'
    )
      ctx.rebases = 0;
    if (result.outcome === 'success' && result.resource !== null)
      return onSuccess(result.resource, sent);
    if (result.outcome === 'unknown' || result.outcome === 'degraded') {
      ctx.set({ phase: 'unknown', alert: false, message: SAVE_COPY.unknown });
      return 'unknown';
    }
    ctx.pending = null;
    if (result.outcome === 'rate-limited') {
      ctx.set({
        phase: 'waiting',
        alert: false,
        retryAfterSeconds: result.retryAfterSeconds,
        message: waitingMessage(result.retryAfterSeconds),
      });
      ctx.clearTimer();
      ctx.timer = ctx.clock.setTimer(
        () => {
          ctx.timer = null;
          if (!ctx.disposed) void attempt();
        },
        (result.retryAfterSeconds ?? 5) * 1_000,
      );
      return 'stopped';
    }
    if (result.outcome === 'conflict') {
      await staleBase.handleConflict(sent.request);
      return 'stopped';
    }
    const patch = refusalPatch(result, ctx.state.summaryToken);
    if (patch?.phase === 'unauthenticated' || patch?.phase === 'denied')
      ctx.paused = true;
    ctx.set(
      patch ?? {
        phase: 'invalid',
        message: SAVE_COPY.invalidLocal,
        summaryToken: ctx.state.summaryToken + 1,
      },
    );
    return 'stopped';
  };

  const send = async (
    sent: CmsEditorialPendingSave,
    csrf: string,
  ): Promise<CmsEditorialSaveOutcome> => {
    ctx.inFlight = true;
    ctx.set({ phase: 'saving', alert: false, message: SAVE_COPY.saving });
    try {
      const result = await executeCmsEditorialRevisionMutation({
        path: `/api/v1/cms/entries/${ctx.init.entryId}/revisions`,
        request: sent.request,
        csrfToken: csrf,
        idempotencyKey: sent.key,
        ...(ctx.deps.fetcher === undefined
          ? {}
          : { fetcher: ctx.deps.fetcher }),
      });
      return await onResult(result, sent);
    } finally {
      ctx.inFlight = false;
    }
  };

  const attempt = async (): Promise<CmsEditorialSaveOutcome> => {
    if (ctx.inFlight || ctx.disposed || !ctx.canEdit || ctx.paused)
      return 'noop';
    const csrf =
      ctx.deps.csrfToken?.() ?? READ_CSRF_COOKIE_FROM_DOCUMENT(document);
    if (ctx.pending !== null) {
      if (csrf === null) return 'noop';
      ctx.pending.replays += 1;
      return send(ctx.pending, csrf);
    }
    const fieldIds = ctx.changed();
    if (fieldIds.length === 0) {
      ctx.settle(ctx.state.phase === 'saved');
      return 'noop';
    }
    const refused = fieldIds.filter(
      (fieldId) =>
        validateCmsFieldValue(
          ctx.byId.get(fieldId) as CmsFieldDescriptor,
          ctx.state.values[fieldId] ?? null,
        ).length > 0 || ctx.state.inputErrors[fieldId] !== undefined,
    );
    if (refused.length > 0 || Object.keys(ctx.state.inputErrors).length > 0) {
      ctx.set({
        phase: 'invalid',
        alert: false,
        refusedFieldIds: refused,
        summaryToken: ctx.state.summaryToken + 1,
        message: SAVE_COPY.invalidLocal,
      });
      return 'stopped';
    }
    if (csrf === null) {
      ctx.set({ phase: 'invalid', alert: true, message: SAVE_COPY.csrf });
      return 'stopped';
    }
    const snapshot = Object.fromEntries(
      fieldIds.map((fieldId) => [fieldId, ctx.state.values[fieldId] ?? null]),
    );
    ctx.pending = {
      request: {
        entryId: ctx.init.entryId,
        baseRevision: ctx.state.baseRevision,
        changedPaths: cmsEditorialPointersFor(fieldIds) as string[],
        values: snapshot as Record<string, JsonValue>,
        locale: ctx.init.locale,
        expectedVersion: ctx.state.expectedVersion,
      },
      key: (ctx.deps.newKey ?? newCmsEditorialIdempotencyKey)() ?? 'fallback',
      snapshot,
      replays: 0,
    };
    return send(ctx.pending, csrf);
  };

  const reconcile = (): void => {
    ctx.clearTimer();
    if (ctx.pending === null || ctx.disposed) return;
    if (ctx.pending.replays >= RECONCILE_AUTOMATIC_REPLAYS) {
      ctx.set({ needsManualRetry: true, message: SAVE_COPY.manualRetry });
      return;
    }
    ctx.timer = ctx.clock.setTimer(() => {
      ctx.timer = null;
      void replayPending();
    }, CMS_EDITORIAL_RECONCILE_DELAY_MS);
  };

  const replayPending = async (): Promise<void> => {
    const outcome = await attempt();
    if (outcome === 'unknown') reconcile();
    else if (outcome !== 'noop') scheduler.resumeAfterReconciliation();
  };

  return { attempt, reconcile, replayPending };
};
