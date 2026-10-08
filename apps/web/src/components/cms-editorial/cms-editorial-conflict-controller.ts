import { describeCmsAuthoringFields } from '../cms-editorial-fields/cms-field-descriptor';
import { validateCmsFieldValue } from '../cms-editorial-fields/cms-field-value';
import { cmsEditorialAppEntryPath } from './cms-editorial-app-routes';
import { executeCmsEditorialConflictDetailRead } from './cms-editorial-conflict-detail-transport';
import {
  executeCmsEditorialConflictResolve,
  type CmsEditorialConflictResolveRequest,
  type CmsEditorialConflictResolveTransportResult,
} from './cms-editorial-conflict-resolve';
import {
  conflictPathViewsFrom,
  retainConflictChoices,
  initialConflictState,
  type CmsEditorialConflictState,
} from './cms-editorial-conflict-state';
import { executeCmsEditorialEntryDraftDetailRead } from './cms-editorial-entry-draft-detail-transport';
import {
  newCmsEditorialIdempotencyKey,
  READ_CSRF_COOKIE_FROM_DOCUMENT,
} from './cms-editorial-entry-create-submit';
import { COPY, refusedFromViolations } from './cms-editorial-conflict-copy';
import type {
  CmsEditorialConflictController,
  CmsEditorialConflictControllerDeps,
} from './cms-editorial-conflict-controller-types';
import { cmsEditorialReasonMessage } from './cms-editorial-reason-copy';

export type {
  CmsEditorialConflictController,
  CmsEditorialConflictControllerDeps,
} from './cms-editorial-conflict-controller-types';

/**
 * The state machine of the CMS-06 resolution form (BE03b CMS-03B-02). No winner
 * is ever inferred: a path is sent only with the author's explicit choice, a
 * named choice never carries a value, and an explicit value is validated with
 * the field's own rules first. A 409 re-reads the conflict (CMS-03B-12, the only
 * source of preimages) and keeps a choice only for a field whose three
 * preimages are unchanged; a 404 means the conflict is no longer open.
 */
export const createCmsEditorialConflictController = (
  deps: CmsEditorialConflictControllerDeps,
): CmsEditorialConflictController => {
  const { init } = deps;
  const descriptors = new Map(
    describeCmsAuthoringFields(init.fields).map((descriptor) => [
      descriptor.fieldId,
      descriptor,
    ]),
  );
  const listeners = new Set<() => void>();
  let state = initialConflictState(init);
  let pending: {
    readonly request: CmsEditorialConflictResolveRequest;
    readonly key: string;
    readonly fieldIds: readonly string[];
  } | null = null;
  let inFlight = false;

  const set = (patch: Partial<CmsEditorialConflictState>): void => {
    state = { ...state, ...patch };
    for (const listener of listeners) listener();
  };
  const entryPath = cmsEditorialAppEntryPath(init.entryId) ?? '/';

  const close = async (): Promise<void> => {
    // The draft is re-read so the entry page the author returns to is canonical.
    await executeCmsEditorialEntryDraftDetailRead({
      basePath: '/api/v1/cms/entries',
      entryId: init.entryId,
      ...(deps.fetcher === undefined ? {} : { fetcher: deps.fetcher }),
    });
    pending = null;
    set({ phase: 'closed', alert: true, message: COPY.closed });
  };

  const reloadAfterConflict = async (): Promise<void> => {
    const read = await executeCmsEditorialConflictDetailRead({
      basePath: '/api/v1/cms/entries',
      entryId: init.entryId,
      conflictId: init.conflictId,
      ...(deps.fetcher === undefined ? {} : { fetcher: deps.fetcher }),
    });
    if (read.outcome === 'not-found') return close();
    if (read.outcome !== 'success' || read.resource === null) {
      set({ phase: 'idle', alert: true, message: COPY.reloadFailed });
      return;
    }
    const paths = conflictPathViewsFrom(read.resource);
    const { choices, reset } = retainConflictChoices(
      state.paths,
      paths,
      state.choices,
    );
    set({
      phase: 'idle',
      alert: false,
      paths,
      choices,
      entryVersion: read.resource.entry.version,
      baseRevision: read.resource.base.revisionNumber,
      refusedFieldIds: reset,
      summaryToken: state.summaryToken + 1,
      message: COPY.changed,
    });
  };

  const onResult = async (
    result: CmsEditorialConflictResolveTransportResult,
    sent: NonNullable<typeof pending>,
  ): Promise<void> => {
    if (result.outcome === 'success') {
      pending = null;
      set({ phase: 'resolved', alert: false, message: COPY.resolved });
      const resolved = result.resource;
      if (resolved !== null)
        deps.onResolved(entryPath, {
          kind: 'resolved',
          entryId: resolved.entryId,
          revisionNumber: resolved.revisionNumber,
          entryVersion: resolved.entryVersion,
          state: resolved.state,
          parentRevisionIds: [...resolved.parentRevisionIds],
          migrationChainId: null,
          edgeCount: null,
        });
      else deps.onResolved(entryPath, null);
      return;
    }
    if (result.outcome === 'unknown' || result.outcome === 'degraded') {
      set({ phase: 'unknown', alert: false, message: COPY.unknown });
      return;
    }
    pending = null;
    if (result.outcome === 'conflict') return reloadAfterConflict();
    if (result.outcome === 'not-found') return close();
    if (result.outcome === 'unauthenticated')
      return set({
        phase: 'unauthenticated',
        alert: true,
        message: COPY.expired,
      });
    if (result.outcome === 'forbidden')
      return set({ phase: 'denied', alert: true, message: COPY.forbidden });
    if (result.outcome === 'rate-limited')
      return set({
        phase: 'waiting',
        alert: false,
        retryAfterSeconds: result.retryAfterSeconds,
        message:
          result.retryAfterSeconds === null
            ? 'Too many attempts. Try again shortly; your choices are kept.'
            : `Too many attempts. Try again in ${result.retryAfterSeconds} seconds; your choices are kept.`,
      });
    set({
      phase: 'invalid',
      alert: false,
      refusedFieldIds: refusedFromViolations(
        result.errorDetails,
        sent.fieldIds,
      ),
      summaryToken: state.summaryToken + 1,
      message:
        cmsEditorialReasonMessage(result.reasonCode) ??
        'Check the highlighted choices. Your choices are kept.',
    });
  };

  const send = async (
    sent: NonNullable<typeof pending>,
    csrf: string,
  ): Promise<void> => {
    if (inFlight) return;
    inFlight = true;
    set({ phase: 'submitting', alert: false, message: COPY.submitting });
    try {
      const result = await executeCmsEditorialConflictResolve({
        path: `/api/v1/cms/entries/${init.entryId}/conflicts/${init.conflictId}/resolve`,
        request: sent.request,
        csrfToken: csrf,
        idempotencyKey: sent.key,
        ...(deps.fetcher === undefined ? {} : { fetcher: deps.fetcher }),
      });
      await onResult(result, sent);
    } finally {
      inFlight = false;
    }
  };

  const submit = async (): Promise<void> => {
    if (state.phase === 'closed' || state.phase === 'resolved') return;
    const csrf = deps.csrfToken?.() ?? READ_CSRF_COOKIE_FROM_DOCUMENT(document);
    if (pending !== null) {
      if (csrf !== null) await send(pending, csrf);
      return;
    }
    const refused = state.paths
      .filter((path) => {
        const entry = state.choices[path.fieldId];
        if (entry === undefined || entry.choice === null) return true;
        if (state.inputErrors[path.fieldId] !== undefined) return true;
        if (entry.choice !== 'explicit') return false;
        const descriptor = descriptors.get(path.fieldId);
        return (
          descriptor === undefined ||
          validateCmsFieldValue(descriptor, entry.explicit).length > 0
        );
      })
      .map((path) => path.fieldId);
    if (refused.length > 0) {
      set({
        phase: 'invalid',
        alert: false,
        refusedFieldIds: refused,
        summaryToken: state.summaryToken + 1,
        message: COPY.incomplete,
      });
      return;
    }
    if (csrf === null) {
      set({ phase: 'invalid', alert: true, message: COPY.csrf });
      return;
    }
    const fieldIds = state.paths.map((path) => path.fieldId);
    pending = {
      fieldIds,
      key: (deps.newKey ?? newCmsEditorialIdempotencyKey)() ?? 'fallback',
      request: {
        entryId: init.entryId,
        conflictId: init.conflictId,
        baseRevision: state.baseRevision,
        expectedVersion: state.entryVersion,
        choices: fieldIds.map((fieldId) => {
          const entry = state.choices[fieldId];
          return entry?.choice === 'explicit'
            ? {
                path: `/fields/${fieldId}`,
                choice: 'explicit' as const,
                value: entry.explicit,
              }
            : { path: `/fields/${fieldId}`, choice: entry?.choice ?? 'base' };
        }),
      },
    };
    await send(pending, csrf);
  };

  return {
    descriptors,
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    choose: (fieldId, choice) => {
      // The request in flight is fixed; a change now would not be in it.
      if (inFlight) return;
      const current = state.choices[fieldId] ?? {
        choice: null,
        explicit: null,
      };
      set({
        choices: { ...state.choices, [fieldId]: { ...current, choice } },
        refusedFieldIds: state.refusedFieldIds.filter((id) => id !== fieldId),
      });
    },
    setExplicit: (fieldId, value) => {
      if (inFlight) return;
      const current = state.choices[fieldId] ?? {
        choice: null,
        explicit: null,
      };
      set({
        choices: {
          ...state.choices,
          [fieldId]: { ...current, explicit: value },
        },
        refusedFieldIds: state.refusedFieldIds.filter((id) => id !== fieldId),
      });
    },
    setInputError: (fieldId, message) => {
      const next = { ...state.inputErrors };
      if (message === null) delete next[fieldId];
      else next[fieldId] = message;
      set({ inputErrors: next });
    },
    submit,
    retryReconcile: async () => {
      if (pending === null) return;
      const csrf =
        deps.csrfToken?.() ?? READ_CSRF_COOKIE_FROM_DOCUMENT(document);
      if (csrf !== null) await send(pending, csrf);
    },
  };
};
