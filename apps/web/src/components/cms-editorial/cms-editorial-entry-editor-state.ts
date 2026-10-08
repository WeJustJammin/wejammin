import type { AuthoringContextField, JsonValue } from '@wejammin/contracts';

import {
  isCmsUnavailableDescriptor,
  type CmsFieldDescriptor,
} from '../cms-editorial-fields/cms-field-descriptor';
import type { CmsEditorialFieldProvenance } from './cms-editorial-draft-values';
import { cmsEditorialFieldPointer } from './cms-editorial-entry-draft';

/**
 * What the draft-editing island is given: the verified CMS-03B-11 draft plus the
 * author-safe field definitions of its schema version (CMS-03B-14). It is
 * JSON-serializable (it crosses the Astro island boundary) and carries no
 * owner, assignee, acting-party or capability identifier.
 */
export interface CmsEditorialEntryEditorInit {
  readonly entryId: string;
  /** `entry.version`: the only valid `If-Match` / `expectedVersion`. */
  readonly entryVersion: string;
  /** The server-derived draft `revisionNumber`: the request `baseRevision`. */
  readonly baseRevision: string;
  readonly locale: string;
  readonly schemaVersionId: string;
  readonly lifecycle: string;
  readonly state: string;
  readonly validationState: string;
  readonly openConflict: {
    readonly conflictId: string;
    readonly version: string;
  } | null;
  readonly fields: readonly AuthoringContextField[];
  /** Stored values by stable field id; a field with no value is absent or null. */
  readonly values: Readonly<Record<string, JsonValue | null>>;
  /** Where each field's stored value came from, as the server reported it. */
  readonly provenance: Readonly<Record<string, CmsEditorialFieldProvenance>>;
  /** Fields whose current value cannot be edited here, with the reason. */
  readonly readOnlyNotices: Readonly<Record<string, string>>;
}

export type CmsEditorialEditorPhase =
  | 'clean'
  | 'dirty'
  | 'saving'
  | 'saved'
  | 'invalid'
  | 'unknown'
  | 'waiting'
  | 'conflict'
  | 'sync-conflict'
  | 'unauthenticated'
  | 'denied';

export interface CmsEditorialSyncConflictState {
  readonly expectedVersion: string;
  readonly currentVersion: string;
}

export interface CmsEditorialEditorState {
  readonly phase: CmsEditorialEditorPhase;
  readonly message: string;
  /** True for the states that must interrupt (conflict, denial, expiry). */
  readonly alert: boolean;
  readonly values: Readonly<Record<string, JsonValue | null>>;
  readonly baseValues: Readonly<Record<string, JsonValue | null>>;
  readonly baseRevision: string;
  readonly expectedVersion: string;
  /** Provenance of the canonical draft this editor holds (not of unsent edits). */
  readonly provenance: Readonly<Record<string, CmsEditorialFieldProvenance>>;
  readonly openConflict: CmsEditorialEntryEditorInit['openConflict'];
  readonly syncConflict: CmsEditorialSyncConflictState | null;
  readonly inputErrors: Readonly<Record<string, string>>;
  /** Fields the server (or local validation at send time) refused. */
  readonly refusedFieldIds: readonly string[];
  /** Bumped each time the summary must take focus. */
  readonly summaryToken: number;
  /** Bumped when canonical values replace local ones. */
  readonly adoptCount: number;
  /**
   * Per field, bumped only when adoption changed THAT field's value, so only
   * that editor remounts (an editor that kept the author's value keeps focus).
   */
  readonly fieldRevisions: Readonly<Record<string, number>>;
  readonly unsentCount: number;
  readonly retryAfterSeconds: number | null;
  /** The automatic replay gave up; the author may retry by hand. */
  readonly needsManualRetry: boolean;
}

/** Fields the editor can change: a definition with a producer and no notice. */
export const editableCmsFieldIds = (
  descriptors: readonly CmsFieldDescriptor[],
  init: Pick<CmsEditorialEntryEditorInit, 'readOnlyNotices'>,
): readonly string[] =>
  descriptors
    .filter(
      (descriptor) =>
        !isCmsUnavailableDescriptor(descriptor) &&
        init.readOnlyNotices[descriptor.fieldId] === undefined,
    )
    .map((descriptor) => descriptor.fieldId);

/** Equality of two field values, independent of object key order. */
export const sameCmsEditorialValue = (
  left: JsonValue | null | undefined,
  right: JsonValue | null | undefined,
): boolean =>
  JSON.stringify(canonical(left ?? null)) ===
  JSON.stringify(canonical(right ?? null));

const canonical = (value: JsonValue | null): unknown => {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(canonical);
  return Object.fromEntries(
    Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, entry]) => [key, canonical(entry)]),
  );
};

/** The editable fields whose local value differs from the canonical base. */
export const changedCmsFieldIds = (
  base: CmsEditorialEditorState['baseValues'],
  values: CmsEditorialEditorState['values'],
  editable: readonly string[],
): readonly string[] =>
  editable.filter(
    (fieldId) => !sameCmsEditorialValue(base[fieldId], values[fieldId]),
  );

export const initialCmsEditorialEditorState = (
  init: CmsEditorialEntryEditorInit,
): CmsEditorialEditorState => ({
  phase: 'clean',
  message: '',
  alert: false,
  values: init.values,
  baseValues: init.values,
  baseRevision: init.baseRevision,
  expectedVersion: init.entryVersion,
  provenance: init.provenance,
  openConflict: init.openConflict,
  syncConflict: null,
  inputErrors: {},
  refusedFieldIds: [],
  summaryToken: 0,
  adoptCount: 0,
  fieldRevisions: {},
  unsentCount: 0,
  retryAfterSeconds: null,
  needsManualRetry: false,
});

export const cmsEditorialPointersFor = (
  fieldIds: readonly string[],
): readonly string[] =>
  [...fieldIds].sort().map((fieldId) => cmsEditorialFieldPointer(fieldId));
