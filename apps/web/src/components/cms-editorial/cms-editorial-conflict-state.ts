import {
  fieldIdOfPointer,
  type AuthoringContextField,
  type ConflictDetailResource,
  type JsonValue,
} from '@wejammin/contracts';

/**
 * One side of one divergent field, exactly as the bounded CMS-03B-12 read gives
 * it: the schema-typed value (null when there is none), its closed provenance
 * and its safe digest. No owner or resolver identity exists at this level.
 */
export interface CmsEditorialConflictSide {
  readonly value: JsonValue | null;
  readonly provenance: string;
  readonly valueHash: string | null;
}

export interface CmsEditorialConflictPathView {
  readonly fieldId: string;
  readonly base: CmsEditorialConflictSide;
  readonly theirs: CmsEditorialConflictSide;
  readonly yours: CmsEditorialConflictSide;
}

/** What the resolution island is given; JSON-serializable. */
export interface CmsEditorialConflictResolveInit {
  readonly entryId: string;
  readonly conflictId: string;
  /** `entry.version`: the If-Match / `expectedVersion` of the resolve. */
  readonly entryVersion: string;
  /** The common base revision number: the resolve `baseRevision`. */
  readonly baseRevision: string;
  readonly fields: readonly AuthoringContextField[];
  readonly paths: readonly CmsEditorialConflictPathView[];
}

export type CmsEditorialConflictChoice =
  'base' | 'theirs' | 'yours' | 'explicit';

export interface CmsEditorialConflictChoiceState {
  readonly choice: CmsEditorialConflictChoice | null;
  /** The explicit replacement; used only while `choice` is `explicit`. */
  readonly explicit: JsonValue | null;
}

export type CmsEditorialConflictPhase =
  | 'idle'
  | 'submitting'
  | 'resolved'
  | 'unknown'
  | 'closed'
  | 'invalid'
  | 'waiting'
  | 'denied'
  | 'unauthenticated';

export interface CmsEditorialConflictState {
  readonly phase: CmsEditorialConflictPhase;
  readonly message: string;
  readonly alert: boolean;
  readonly paths: readonly CmsEditorialConflictPathView[];
  readonly entryVersion: string;
  readonly baseRevision: string;
  readonly choices: Readonly<Record<string, CmsEditorialConflictChoiceState>>;
  /** Fields whose choice is missing, invalid, reset or refused by the server. */
  readonly refusedFieldIds: readonly string[];
  readonly inputErrors: Readonly<Record<string, string>>;
  readonly summaryToken: number;
  readonly retryAfterSeconds: number | null;
}

const sideOf = (side: {
  readonly value: JsonValue | null;
  readonly provenance: string;
  readonly valueHash: string | null;
}): CmsEditorialConflictSide => ({
  value: side.value,
  provenance: side.provenance,
  valueHash: side.valueHash,
});

/** The paths of a verified conflict read, keyed by stable field id. */
export const conflictPathViewsFrom = (
  detail: ConflictDetailResource,
): readonly CmsEditorialConflictPathView[] =>
  detail.paths.map((path) => ({
    fieldId: fieldIdOfPointer(path.path),
    base: sideOf(path.base),
    theirs: sideOf(path.theirs),
    yours: sideOf(path.yours),
  }));

export const conflictInitFrom = (
  detail: ConflictDetailResource,
  fields: readonly AuthoringContextField[],
): CmsEditorialConflictResolveInit => ({
  entryId: detail.entry.id,
  conflictId: detail.conflict.id,
  entryVersion: detail.entry.version,
  baseRevision: detail.base.revisionNumber,
  fields,
  paths: conflictPathViewsFrom(detail),
});

const sameSide = (
  left: CmsEditorialConflictSide,
  right: CmsEditorialConflictSide,
): boolean =>
  left.valueHash === right.valueHash &&
  JSON.stringify(left.value) === JSON.stringify(right.value);

/** A path is unchanged when all three preimages are exactly as the author saw them. */
export const conflictPathUnchanged = (
  before: CmsEditorialConflictPathView | undefined,
  after: CmsEditorialConflictPathView,
): boolean =>
  before !== undefined &&
  sameSide(before.base, after.base) &&
  sameSide(before.theirs, after.theirs) &&
  sameSide(before.yours, after.yours);

/**
 * After the conflict was re-read: a choice survives only for a path whose three
 * preimages are unchanged. Every other path starts undecided again and is
 * returned in `reset` so the form can mark it.
 */
export const retainConflictChoices = (
  before: readonly CmsEditorialConflictPathView[],
  after: readonly CmsEditorialConflictPathView[],
  choices: Readonly<Record<string, CmsEditorialConflictChoiceState>>,
): {
  readonly choices: Readonly<Record<string, CmsEditorialConflictChoiceState>>;
  readonly reset: readonly string[];
} => {
  const previous = new Map(before.map((path) => [path.fieldId, path]));
  const reset: string[] = [];
  const retained = Object.fromEntries(
    after.map((path) => {
      const kept = conflictPathUnchanged(previous.get(path.fieldId), path)
        ? choices[path.fieldId]
        : undefined;
      if (kept === undefined || kept.choice === null) reset.push(path.fieldId);
      return [path.fieldId, kept ?? { choice: null, explicit: null }];
    }),
  );
  return { choices: retained, reset };
};

export const initialConflictState = (
  init: CmsEditorialConflictResolveInit,
): CmsEditorialConflictState => ({
  phase: 'idle',
  message: '',
  alert: false,
  paths: init.paths,
  entryVersion: init.entryVersion,
  baseRevision: init.baseRevision,
  choices: Object.fromEntries(
    init.paths.map((path) => [path.fieldId, { choice: null, explicit: null }]),
  ),
  refusedFieldIds: [],
  inputErrors: {},
  summaryToken: 0,
  retryAfterSeconds: null,
});
