import type { JsonValue } from '@wejammin/contracts';

import type {
  CmsEditorialDraftField,
  CmsEditorialEntryDraft,
} from './cms-editorial-types';

/**
 * Autosave carries "the changed field paths plus the base revision the draft
 * was loaded from" (IA03 AC-CMS-05, .memory/wiki/specs/ia/03-cms-content-modeling.md:37)
 * and BE03b requires 1-128 unique JSON Pointers plus strict stable-field-ID
 * values (.memory/wiki/specs/be/03b-editorial-workflow-publication.md:253-277).
 */

/** Stable, schema-identity-addressed path for one entry field value. */
export const cmsEditorialFieldPointer = (fieldId: string): string =>
  '/fields/' + fieldId;

const sameJsonValue = (left: JsonValue, right: JsonValue): boolean => {
  if (left === right) return true;
  if (
    left === null ||
    right === null ||
    typeof left !== 'object' ||
    typeof right !== 'object'
  )
    return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) return false;
    return left.every((value, index) =>
      sameJsonValue(value, right[index] as JsonValue),
    );
  }
  const leftEntries = Object.entries(left as Record<string, JsonValue>).sort(
    ([a], [b]) => (a < b ? -1 : a > b ? 1 : 0),
  );
  const rightEntries = Object.entries(right as Record<string, JsonValue>).sort(
    ([a], [b]) => (a < b ? -1 : a > b ? 1 : 0),
  );
  if (leftEntries.length !== rightEntries.length) return false;
  return leftEntries.every(([key, value], index) => {
    const rightEntry = rightEntries[index];
    return (
      rightEntry !== undefined &&
      rightEntry[0] === key &&
      sameJsonValue(value, rightEntry[1])
    );
  });
};

const byFieldId = (
  fields: readonly CmsEditorialDraftField[],
): Map<string, CmsEditorialDraftField> =>
  new Map(fields.map((field) => [field.fieldId, field]));

/**
 * Changed JSON Pointers against the loaded base revision, in a deterministic
 * order so an identical edit set always produces an identical request.
 */
export const collectCmsEditorialChangedPaths = (
  base: readonly CmsEditorialDraftField[],
  draft: readonly CmsEditorialDraftField[],
): readonly string[] => {
  const baseFields = byFieldId(base);
  const draftFields = byFieldId(draft);
  const changed: string[] = [];
  for (const [fieldId, draftField] of draftFields) {
    const baseField = baseFields.get(fieldId);
    if (
      baseField === undefined ||
      !sameJsonValue(baseField.value, draftField.value)
    )
      changed.push(cmsEditorialFieldPointer(fieldId));
  }
  for (const fieldId of baseFields.keys()) {
    if (!draftFields.has(fieldId))
      changed.push(cmsEditorialFieldPointer(fieldId));
  }
  return changed.sort((left, right) =>
    left < right ? -1 : left > right ? 1 : 0,
  );
};

/**
 * Changed values keyed by stable field ID. Only changed fields are sent;
 * an intentionally removed field is an explicit null, not an omitted patch
 * value, so every changed path has one value at the revision RPC boundary.
 */
export const collectCmsEditorialChangedValues = (
  base: readonly CmsEditorialDraftField[],
  draft: readonly CmsEditorialDraftField[],
): Readonly<Record<string, JsonValue>> => {
  const baseFields = byFieldId(base);
  const values: Record<string, JsonValue> = {};
  for (const field of draft) {
    const baseField = baseFields.get(field.fieldId);
    if (baseField === undefined || !sameJsonValue(baseField.value, field.value))
      values[field.fieldId] = field.value;
  }
  const draftFields = byFieldId(draft);
  for (const fieldId of baseFields.keys()) {
    if (!draftFields.has(fieldId)) values[fieldId] = null;
  }
  return values;
};

export const isCmsEditorialDraftDirty = (
  base: readonly CmsEditorialDraftField[],
  draft: readonly CmsEditorialDraftField[],
): boolean => collectCmsEditorialChangedPaths(base, draft).length > 0;

/**
 * Build the exact `EntryRevisionRequest` body. `baseRevision` and
 * `expectedVersion` come from the draft the editor loaded, never from the
 * last response, so a stale tab cannot silently advance the entry version.
 */
export const buildCmsEditorialEntryRevisionRequest = (input: {
  readonly draft: CmsEditorialEntryDraft;
  readonly base: readonly CmsEditorialDraftField[];
}): {
  readonly entryId: string;
  readonly baseRevision: string;
  readonly changedPaths: readonly string[];
  readonly values: Readonly<Record<string, JsonValue>>;
  readonly locale: string;
  readonly expectedVersion: string;
} => ({
  entryId: input.draft.entryId,
  baseRevision: input.draft.baseRevision,
  changedPaths: collectCmsEditorialChangedPaths(input.base, input.draft.fields),
  values: collectCmsEditorialChangedValues(input.base, input.draft.fields),
  locale: input.draft.locale,
  expectedVersion: input.draft.expectedVersion,
});

export type CmsEditorialDraftRebaseIssue =
  | {
      readonly kind: 'scope-mismatch';
      readonly localDraft: CmsEditorialEntryDraft;
    }
  | {
      readonly kind: 'schema-changed' | 'field-unavailable';
      readonly local: CmsEditorialDraftField;
    }
  | {
      readonly kind: 'same-field-conflict';
      readonly fieldId: string;
      readonly base: CmsEditorialDraftField | null;
      readonly theirs: CmsEditorialDraftField;
      readonly yours: CmsEditorialDraftField;
    };

export interface CmsEditorialDraftRebaseResult {
  readonly draft: CmsEditorialEntryDraft | null;
  readonly issues: readonly CmsEditorialDraftRebaseIssue[];
  readonly canAutosave: boolean;
}

/**
 * Three-way rebase after a refreshed entry read. Only actual local changes
 * overlay the canonical server fields; ambiguous changes stay in issues for
 * explicit resolution and must never be autosaved silently.
 */
export const rebaseCmsEditorialDraft = (input: {
  readonly previousBase: CmsEditorialEntryDraft;
  readonly localDraft: CmsEditorialEntryDraft;
  readonly nextBase: CmsEditorialEntryDraft;
}): CmsEditorialDraftRebaseResult => {
  const { previousBase, localDraft, nextBase } = input;
  if (
    previousBase.entryId !== localDraft.entryId ||
    previousBase.entryId !== nextBase.entryId ||
    previousBase.locale !== localDraft.locale ||
    previousBase.locale !== nextBase.locale ||
    previousBase.schemaVersionId !== localDraft.schemaVersionId ||
    previousBase.baseRevision !== localDraft.baseRevision ||
    previousBase.expectedVersion !== localDraft.expectedVersion
  ) {
    return {
      draft: null,
      issues: [{ kind: 'scope-mismatch', localDraft }],
      canAutosave: false,
    };
  }

  const previousFields = byFieldId(previousBase.fields);
  const localFields = byFieldId(localDraft.fields);
  const changedLocalFields = localDraft.fields.filter((field) => {
    const previous = previousFields.get(field.fieldId);
    return (
      previous === undefined || !sameJsonValue(previous.value, field.value)
    );
  });
  for (const previous of previousBase.fields) {
    if (!localFields.has(previous.fieldId)) {
      changedLocalFields.push({ ...previous, value: null });
    }
  }

  if (previousBase.schemaVersionId !== nextBase.schemaVersionId) {
    const issues: CmsEditorialDraftRebaseIssue[] = changedLocalFields.map(
      (local) => ({ kind: 'schema-changed', local }),
    );
    return {
      draft: nextBase,
      issues,
      canAutosave: issues.length === 0,
    };
  }

  const nextFields = byFieldId(nextBase.fields);
  const rebasedValues = new Map<string, JsonValue>();
  const issues: CmsEditorialDraftRebaseIssue[] = [];
  for (const local of changedLocalFields) {
    const previous = previousFields.get(local.fieldId);
    const next = nextFields.get(local.fieldId);
    if (next === undefined) {
      issues.push({ kind: 'field-unavailable', local });
    } else if (sameJsonValue(local.value, next.value)) {
      continue;
    } else if (
      previous === undefined ||
      !sameJsonValue(previous.value, next.value)
    ) {
      issues.push({
        kind: 'same-field-conflict',
        fieldId: local.fieldId,
        base: previous ?? null,
        theirs: next,
        yours: local,
      });
    } else {
      rebasedValues.set(local.fieldId, local.value);
    }
  }

  return {
    draft: {
      ...nextBase,
      fields: nextBase.fields.map((field) =>
        rebasedValues.has(field.fieldId)
          ? { ...field, value: rebasedValues.get(field.fieldId) as JsonValue }
          : field,
      ),
    },
    issues,
    canAutosave: issues.length === 0,
  };
};
