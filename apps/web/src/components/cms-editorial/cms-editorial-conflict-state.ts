import type { ConflictDetailResource, JsonValue } from '@wejammin/contracts';
import { fieldIdOfPointer } from '@wejammin/contracts/client';

import type { CmsFieldDescriptor } from '../cms-editorial-fields/cms-field-descriptor';

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

/**
 * The taxonomy scope a divergent taxonomy field's explicit replacement needs,
 * bound from verified reads elsewhere (the conflict detail read carries no
 * locale): the server-derived type key, the exact conflict locale and the four
 * immutable reference members of the server-read `theirs` revision. It is an
 * internal, JSON-only island input, never a protected wire member.
 */
export interface CmsEditorialConflictTaxonomyContext {
  readonly typeKey: string;
  readonly locale: string;
  readonly theirs: ConflictDetailResource['theirs'];
}

/** What the resolution island is given; JSON-serializable. */
export interface CmsEditorialConflictResolveInit {
  readonly entryId: string;
  readonly conflictId: string;
  /** `entry.version`: the If-Match / `expectedVersion` of the resolve. */
  readonly entryVersion: string;
  /** The common base revision number: the resolve `baseRevision`. */
  readonly baseRevision: string;
  /** Decoded by the loader from the author-safe definitions (AC-106: no zod in the island). */
  readonly descriptors: readonly CmsFieldDescriptor[];
  readonly paths: readonly CmsEditorialConflictPathView[];
  /**
   * The selector scope of a divergent taxonomy field, bound by the host from
   * verified reads; absent for a conflict with no taxonomy field.
   */
  readonly taxonomyContext?: CmsEditorialConflictTaxonomyContext;
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
  /**
   * Bumped only by a verified 422 `VALIDATION_FAILED` naming `term_unavailable`,
   * so a divergent taxonomy field re-reads its selector. Never bumped otherwise.
   */
  readonly taxonomyRefreshToken: number;
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
  descriptors: readonly CmsFieldDescriptor[],
): CmsEditorialConflictResolveInit => ({
  entryId: detail.entry.id,
  conflictId: detail.conflict.id,
  entryVersion: detail.entry.version,
  baseRevision: detail.base.revisionNumber,
  descriptors,
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
  taxonomyRefreshToken: 0,
});

/** A 409 re-read may be adopted only while it names the bound `theirs` revision. */
export const conflictTheirsMatches = (
  bound: ConflictDetailResource['theirs'],
  read: ConflictDetailResource['theirs'],
): boolean =>
  bound.revisionId === read.revisionId &&
  bound.revisionNumber === read.revisionNumber &&
  bound.schemaVersionId === read.schemaVersionId &&
  bound.contentHash === read.contentHash;

/**
 * True when a 409 re-read cannot be adopted for a taxonomy-bound conflict: it
 * names a different `theirs` revision than the selector scope was bound to. A
 * conflict with no taxonomy context is never refused here.
 */
export const conflictRebindRefused = (
  context: CmsEditorialConflictTaxonomyContext | undefined,
  read: ConflictDetailResource,
): boolean =>
  context !== undefined && !conflictTheirsMatches(context.theirs, read.theirs);

/**
 * True when a refusal is the one that re-reads a divergent taxonomy field's
 * selector: a verified 422 whose `VALIDATION_FAILED` reason token names a term
 * that is gone. A 400 also maps to `validation`, so the status is part of the
 * rule, not only the reason.
 */
export const conflictRefusalRefreshesTaxonomy = (result: {
  readonly outcome: string;
  readonly status: number | null;
  readonly reasonCode: string | null;
}): boolean =>
  result.outcome === 'validation' &&
  result.status === 422 &&
  result.reasonCode === 'term_unavailable';

/** The existing failed-reload patch: a re-read that could not be verified. */
export const conflictReloadFailedState = (
  message: string,
): Partial<CmsEditorialConflictState> => ({
  phase: 'idle',
  alert: true,
  retryAfterSeconds: null,
  message,
});
