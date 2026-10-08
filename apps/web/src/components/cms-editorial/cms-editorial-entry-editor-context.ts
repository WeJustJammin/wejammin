import type { JsonValue } from '@wejammin/contracts';

import {
  describeCmsAuthoringFields,
  type CmsFieldDescriptor,
} from '../cms-editorial-fields/cms-field-descriptor';
import type { CmsEditorialAutosaveClock } from './cms-editorial-autosave';
import { draftValuesFromDetail } from './cms-editorial-draft-values';
import { executeCmsEditorialEntryDraftDetailRead } from './cms-editorial-entry-draft-detail-transport';
import {
  changedCmsFieldIds,
  editableCmsFieldIds,
  initialCmsEditorialEditorState,
  type CmsEditorialEditorState,
  type CmsEditorialEntryEditorInit,
} from './cms-editorial-entry-editor-state';
import type { CmsEditorialEntryRevisionRequest } from './cms-editorial-contracts';
import { cmsEditorialAutosaveStatusMessage } from './cms-editorial-runtime-dom-feedback';

type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface CmsEditorialEntryEditorDeps {
  readonly init: CmsEditorialEntryEditorInit;
  readonly fetcher?: Fetcher;
  readonly clock?: CmsEditorialAutosaveClock;
  readonly csrfToken?: () => string | null;
  readonly newKey?: () => string;
}

/** A save whose request is fixed: replayed byte-for-byte under the same key. */
export interface CmsEditorialPendingSave {
  readonly request: CmsEditorialEntryRevisionRequest;
  readonly key: string;
  readonly snapshot: Readonly<Record<string, JsonValue | null>>;
  replays: number;
}

type DraftDetail = NonNullable<
  Awaited<
    ReturnType<typeof executeCmsEditorialEntryDraftDetailRead>
  >['resource']
>;

/**
 * The shared mutable context of one editor: the state store, the flags that
 * gate sending, and the reads every flow needs. The save, reconcile and
 * conflict flows are separate modules over this one context, so no flow can
 * keep a private copy of what the author has typed or what the server holds.
 */
export interface CmsEditorialEditorContext {
  readonly deps: CmsEditorialEntryEditorDeps;
  readonly init: CmsEditorialEntryEditorInit;
  readonly descriptors: readonly CmsFieldDescriptor[];
  readonly editable: readonly string[];
  readonly byId: ReadonlyMap<string, CmsFieldDescriptor>;
  readonly canEdit: boolean;
  readonly clock: CmsEditorialAutosaveClock;
  readonly listeners: Set<() => void>;
  state: CmsEditorialEditorState;
  pending: CmsEditorialPendingSave | null;
  paused: boolean;
  /**
   * Consecutive automatic rebases begun since the last save that settled.
   * Bounded by the rebase budget so a peer that keeps changing a different
   * field cannot drive an endless re-send chain.
   */
  rebases: number;
  /** The rebase budget is spent: only an explicit Save draft resumes. */
  rebaseLimited: boolean;
  inFlight: boolean;
  disposed: boolean;
  timer: unknown;
  /** Re-arms or clears the autosave window from the current dirtiness. */
  arm: () => void;
  readonly set: (patch: Partial<CmsEditorialEditorState>) => void;
  readonly changed: () => readonly string[];
  readonly settle: (saved: boolean) => void;
  readonly clearTimer: () => void;
  readonly readCurrent: () => Promise<DraftDetail | null>;
  readonly adoptCanonical: (
    detail: DraftDetail,
    keepLocal: (fieldId: string) => boolean,
    message: string,
  ) => void;
}

export const createCmsEditorialEditorContext = (
  deps: CmsEditorialEntryEditorDeps,
): CmsEditorialEditorContext => {
  const init = deps.init;
  const descriptors = describeCmsAuthoringFields(init.fields);
  const editable = editableCmsFieldIds(descriptors, init);
  const context: CmsEditorialEditorContext = {
    deps,
    init,
    descriptors,
    editable,
    byId: new Map(
      descriptors.map((descriptor) => [descriptor.fieldId, descriptor]),
    ),
    canEdit: init.lifecycle === 'active',
    clock: deps.clock ?? {
      setTimer: (callback, ms) => setTimeout(callback, ms),
      clearTimer: (handle) =>
        clearTimeout(handle as ReturnType<typeof setTimeout>),
    },
    listeners: new Set(),
    state: initialCmsEditorialEditorState(init),
    pending: null,
    paused: false,
    rebases: 0,
    rebaseLimited: false,
    inFlight: false,
    disposed: false,
    timer: null,
    arm: () => undefined,
    set: (patch) => {
      context.state = { ...context.state, ...patch };
      for (const listener of context.listeners) listener();
    },
    changed: () =>
      changedCmsFieldIds(
        context.state.baseValues,
        context.state.values,
        editable,
      ),
    settle: (saved) => {
      const count = context.changed().length;
      context.set({
        unsentCount: count,
        phase: count > 0 ? 'dirty' : saved ? 'saved' : 'clean',
        alert: false,
        message:
          count > 0 || saved
            ? cmsEditorialAutosaveStatusMessage({
                dirty: count > 0,
                saving: false,
                outcome: saved && count === 0 ? 'success' : null,
                retryable: false,
              })
            : '',
      });
      context.arm();
    },
    clearTimer: () => {
      if (context.timer !== null) context.clock.clearTimer(context.timer);
      context.timer = null;
    },
    readCurrent: async () => {
      const read = await executeCmsEditorialEntryDraftDetailRead({
        basePath: '/api/v1/cms/entries',
        entryId: init.entryId,
        ...(deps.fetcher === undefined ? {} : { fetcher: deps.fetcher }),
      });
      return read.outcome === 'success' ? read.resource : null;
    },
    adoptCanonical: (detail, keepLocal, message) => {
      const projected = draftValuesFromDetail(detail, descriptors);
      const canonical = projected.values;
      const merged: Record<string, JsonValue | null> = { ...canonical };
      for (const fieldId of editable)
        if (keepLocal(fieldId))
          merged[fieldId] = context.state.values[fieldId] ?? null;
      const revisions = { ...context.state.fieldRevisions };
      for (const fieldId of editable)
        if (
          JSON.stringify(merged[fieldId] ?? null) !==
          JSON.stringify(context.state.values[fieldId] ?? null)
        )
          revisions[fieldId] = (revisions[fieldId] ?? 0) + 1;
      context.set({
        baseValues: canonical,
        provenance: projected.provenance,
        values: merged,
        fieldRevisions: revisions,
        baseRevision: detail.revisionNumber,
        expectedVersion: detail.entry.version,
        openConflict: detail.openConflict,
        syncConflict: null,
        adoptCount: context.state.adoptCount + 1,
        message,
      });
    },
  };
  return context;
};
