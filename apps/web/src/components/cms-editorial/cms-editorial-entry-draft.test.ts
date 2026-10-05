import { describe, expect, it } from 'vitest';

import { CmsEditorialEntryRevisionRequestSchema } from './cms-editorial-contracts';
import {
  buildCmsEditorialEntryRevisionRequest,
  cmsEditorialFieldPointer,
  collectCmsEditorialChangedPaths,
  collectCmsEditorialChangedValues,
  isCmsEditorialDraftDirty,
  rebaseCmsEditorialDraft,
} from './cms-editorial-entry-draft';
import type {
  CmsEditorialDraftField,
  CmsEditorialEntryDraft,
} from './cms-editorial-types';

// Stable field IDs are UUIDs (BE03b:173 "strict object keyed by stable field
// IDs; max 128 keys/8 levels/256 KiB").
const FIELD_A = '018f0c45-73fe-7dc2-9c09-68f7ecf132da';
const FIELD_B = '018f0c45-73fe-7dc2-9c09-68f7ecf132db';
const FIELD_C = '018f0c45-73fe-7dc2-9c09-68f7ecf132dc';
const ENTRY_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132dd';
const SCHEMA_VERSION_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132de';

const field = (fieldId: string, value: unknown): CmsEditorialDraftField => ({
  fieldId,
  fieldKey: 'body',
  value: value as CmsEditorialDraftField['value'],
});

const entryDraft = (
  fields: readonly CmsEditorialDraftField[],
  overrides: Partial<CmsEditorialEntryDraft> = {},
): CmsEditorialEntryDraft => ({
  entryId: ENTRY_ID,
  entryLifecycle: 'active',
  baseRevision: '4',
  expectedVersion: '11',
  locale: 'en-US',
  schemaVersionId: SCHEMA_VERSION_ID,
  fields,
  ...overrides,
});

describe('cmsEditorialFieldPointer', () => {
  it('addresses a stable field ID and stays inside the 1-256 char bound', () => {
    const pointer = cmsEditorialFieldPointer(FIELD_A);
    expect(pointer).toBe('/fields/' + FIELD_A);
    expect(pointer.length).toBeGreaterThanOrEqual(1);
    expect(pointer.length).toBeLessThanOrEqual(256);
    expect(pointer.startsWith('/')).toBe(true);
  });
});

describe('collectCmsEditorialChangedPaths', () => {
  it('is empty when the draft matches the loaded base', () => {
    const base = [field(FIELD_A, 'hello'), field(FIELD_B, 2)];
    expect(collectCmsEditorialChangedPaths(base, base)).toEqual([]);
    expect(isCmsEditorialDraftDirty(base, base)).toBe(false);
  });

  it('returns a deterministic sorted order regardless of input order', () => {
    const base = [field(FIELD_B, 'b'), field(FIELD_A, 'a')];
    const draft = [field(FIELD_B, 'changed'), field(FIELD_A, 'changed')];
    const forward = collectCmsEditorialChangedPaths(base, draft);
    const reversed = collectCmsEditorialChangedPaths(
      [...base].reverse(),
      [...draft].reverse(),
    );
    expect(forward).toEqual(reversed);
    expect(forward).toEqual([
      cmsEditorialFieldPointer(FIELD_A),
      cmsEditorialFieldPointer(FIELD_B),
    ]);
  });

  it('reports only the changed field, never unchanged siblings', () => {
    const base = [field(FIELD_A, 'keep'), field(FIELD_B, 'edit')];
    const draft = [field(FIELD_A, 'keep'), field(FIELD_B, 'edited')];
    expect(collectCmsEditorialChangedPaths(base, draft)).toEqual([
      cmsEditorialFieldPointer(FIELD_B),
    ]);
    expect(isCmsEditorialDraftDirty(base, draft)).toBe(true);
  });

  it('treats fields added by the draft as changed', () => {
    const base = [field(FIELD_A, 'a')];
    const draft = [field(FIELD_A, 'a'), field(FIELD_C, 'new')];
    expect(collectCmsEditorialChangedPaths(base, draft)).toEqual([
      cmsEditorialFieldPointer(FIELD_C),
    ]);
  });

  it('treats fields removed from the draft as changed', () => {
    const base = [field(FIELD_A, 'a'), field(FIELD_C, 'gone')];
    const draft = [field(FIELD_A, 'a')];
    expect(collectCmsEditorialChangedPaths(base, draft)).toEqual([
      cmsEditorialFieldPointer(FIELD_C),
    ]);
  });

  it('compares nested JSON values structurally rather than by reference', () => {
    const base = [field(FIELD_A, { layout: 'grid', items: [1, 2] })];
    expect(
      collectCmsEditorialChangedPaths(base, [
        field(FIELD_A, { items: [1, 2], layout: 'grid' }),
      ]),
    ).toEqual([]);
    expect(
      collectCmsEditorialChangedPaths(base, [
        field(FIELD_A, { items: [2, 1], layout: 'grid' }),
      ]),
    ).toEqual([cmsEditorialFieldPointer(FIELD_A)]);
  });

  it('distinguishes falsy and null values from their neighbours', () => {
    const base = [
      field(FIELD_A, 0),
      field(FIELD_B, false),
      field(FIELD_C, null),
    ];
    const draft = [
      field(FIELD_A, false),
      field(FIELD_B, 0),
      field(FIELD_C, null),
    ];
    expect(collectCmsEditorialChangedPaths(base, draft)).toEqual([
      cmsEditorialFieldPointer(FIELD_A),
      cmsEditorialFieldPointer(FIELD_B),
    ]);
  });
});

describe('collectCmsEditorialChangedValues', () => {
  it('sends only changed fields, keyed by stable field ID', () => {
    const base = [field(FIELD_A, 'keep'), field(FIELD_B, 'edit')];
    const draft = [field(FIELD_A, 'keep'), field(FIELD_B, 'edited')];
    const values = collectCmsEditorialChangedValues(base, draft);
    expect(Object.keys(values)).toEqual([FIELD_B]);
    expect(values[FIELD_B]).toBe('edited');
    expect(Object.hasOwn(values, FIELD_A)).toBe(false);
  });

  it('sends an explicit null when a field is removed from the local draft', () => {
    const base = [field(FIELD_A, 'keep'), field(FIELD_B, 'remove')];
    const draft = [field(FIELD_A, 'keep')];
    expect(collectCmsEditorialChangedPaths(base, draft)).toEqual([
      '/fields/' + FIELD_B,
    ]);
    expect(collectCmsEditorialChangedValues(base, draft)).toEqual({
      [FIELD_B]: null,
    });
  });
});

describe('buildCmsEditorialEntryRevisionRequest', () => {
  it('carries the loaded base revision and expected version, not the last response', () => {
    const base = [field(FIELD_A, 'hello')];
    const draft = entryDraft([field(FIELD_A, 'hello there')]);
    const request = buildCmsEditorialEntryRevisionRequest({ draft, base });
    expect(request).toEqual({
      entryId: ENTRY_ID,
      baseRevision: '4',
      changedPaths: ['/fields/' + FIELD_A],
      values: { [FIELD_A]: 'hello there' },
      locale: 'en-US',
      expectedVersion: '11',
    });
  });

  it('keeps a removed field path and explicit-null value paired for the RPC', () => {
    const base = [field(FIELD_A, 'retain'), field(FIELD_B, 'clear')];
    const request = buildCmsEditorialEntryRevisionRequest({
      draft: entryDraft([field(FIELD_A, 'retain')]),
      base,
    });
    expect(request.changedPaths).toEqual(['/fields/' + FIELD_B]);
    expect(request.values).toEqual({ [FIELD_B]: null });
    expect(
      CmsEditorialEntryRevisionRequestSchema.safeParse(request).success,
    ).toBe(true);
  });

  it('reports no changed paths for an untouched draft', () => {
    const base = [field(FIELD_A, 'hello')];
    const request = buildCmsEditorialEntryRevisionRequest({
      draft: entryDraft(base),
      base,
    });
    expect(request.changedPaths).toEqual([]);
    expect(request.values).toEqual({});
  });
});

describe('rebaseCmsEditorialDraft', () => {
  it('keeps fresh server values for untouched fields and only overlays local edits', () => {
    const previousBase = entryDraft([
      field(FIELD_A, 'old-a'),
      field(FIELD_B, 'old-b'),
    ]);
    const localDraft = entryDraft([
      field(FIELD_A, 'old-a'),
      { ...field(FIELD_B, 'local-b'), fieldKey: 'stale-label' },
    ]);
    const nextBase = entryDraft(
      [
        field(FIELD_A, 'server-a'),
        { ...field(FIELD_B, 'old-b'), fieldKey: 'canonical-label' },
      ],
      { baseRevision: '5', expectedVersion: '12' },
    );
    const result = rebaseCmsEditorialDraft({
      previousBase,
      localDraft,
      nextBase,
    });
    expect(result.canAutosave).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.draft?.baseRevision).toBe('5');
    expect(result.draft?.expectedVersion).toBe('12');
    expect(result.draft?.fields).toEqual([
      field(FIELD_A, 'server-a'),
      { ...field(FIELD_B, 'local-b'), fieldKey: 'canonical-label' },
    ]);
  });

  it('retains base, theirs, and yours when both sides changed the same field', () => {
    const previousBase = entryDraft([field(FIELD_A, 'old')]);
    const localDraft = entryDraft([field(FIELD_A, 'local')]);
    const nextBase = entryDraft([field(FIELD_A, 'server')], {
      baseRevision: '5',
      expectedVersion: '12',
    });
    const result = rebaseCmsEditorialDraft({
      previousBase,
      localDraft,
      nextBase,
    });
    expect(result.canAutosave).toBe(false);
    expect(result.draft?.fields).toEqual([field(FIELD_A, 'server')]);
    expect(result.issues).toEqual([
      {
        kind: 'same-field-conflict',
        fieldId: FIELD_A,
        base: field(FIELD_A, 'old'),
        theirs: field(FIELD_A, 'server'),
        yours: field(FIELD_A, 'local'),
      },
    ]);
  });

  it('does not invent a conflict when both sides reached the same value', () => {
    const previousBase = entryDraft([field(FIELD_A, 'old')]);
    const localDraft = entryDraft([field(FIELD_A, 'shared')]);
    const nextBase = entryDraft([field(FIELD_A, 'shared')]);
    const result = rebaseCmsEditorialDraft({
      previousBase,
      localDraft,
      nextBase,
    });
    expect(result.canAutosave).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.draft?.fields).toEqual([field(FIELD_A, 'shared')]);
  });

  it('preserves a local field removal as explicit null when the server field is unchanged', () => {
    const previousBase = entryDraft([
      field(FIELD_A, 'keep'),
      field(FIELD_B, 'remove'),
    ]);
    const localDraft = entryDraft([field(FIELD_A, 'keep')]);
    const nextBase = entryDraft([
      field(FIELD_A, 'keep'),
      field(FIELD_B, 'remove'),
    ]);
    const result = rebaseCmsEditorialDraft({
      previousBase,
      localDraft,
      nextBase,
    });
    expect(result.canAutosave).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.draft?.fields).toEqual([
      field(FIELD_A, 'keep'),
      field(FIELD_B, null),
    ]);
  });

  it('treats a local removal and server edit as a same-field conflict', () => {
    const previousBase = entryDraft([field(FIELD_A, 'old')]);
    const localDraft = entryDraft([]);
    const nextBase = entryDraft([field(FIELD_A, 'server')]);
    const result = rebaseCmsEditorialDraft({
      previousBase,
      localDraft,
      nextBase,
    });
    expect(result.canAutosave).toBe(false);
    expect(result.draft?.fields).toEqual([field(FIELD_A, 'server')]);
    expect(result.issues).toEqual([
      {
        kind: 'same-field-conflict',
        fieldId: FIELD_A,
        base: field(FIELD_A, 'old'),
        theirs: field(FIELD_A, 'server'),
        yours: field(FIELD_A, null),
      },
    ]);
  });

  it('retains edits to a field missing from the refreshed schema instead of dropping them', () => {
    const previousBase = entryDraft([
      field(FIELD_A, 'old'),
      field(FIELD_C, 'old-c'),
    ]);
    const localDraft = entryDraft([
      field(FIELD_A, 'old'),
      field(FIELD_C, 'local-c'),
    ]);
    const nextBase = entryDraft([field(FIELD_A, 'server-a')]);
    const result = rebaseCmsEditorialDraft({
      previousBase,
      localDraft,
      nextBase,
    });
    expect(result.canAutosave).toBe(false);
    expect(result.draft?.fields).toEqual([field(FIELD_A, 'server-a')]);
    expect(result.issues).toEqual([
      { kind: 'field-unavailable', local: field(FIELD_C, 'local-c') },
    ]);
  });

  it('withholds all local edits when the schema version changed', () => {
    const previousBase = entryDraft([field(FIELD_A, 'old')]);
    const localDraft = entryDraft([field(FIELD_A, 'local')]);
    const nextBase = entryDraft([field(FIELD_A, 'server')], {
      schemaVersionId: FIELD_C,
    });
    const result = rebaseCmsEditorialDraft({
      previousBase,
      localDraft,
      nextBase,
    });
    expect(result.canAutosave).toBe(false);
    expect(result.draft).toEqual(nextBase);
    expect(result.issues).toEqual([
      { kind: 'schema-changed', local: field(FIELD_A, 'local') },
    ]);
  });

  it('never merges across entry or locale scope and retains the complete local draft', () => {
    const previousBase = entryDraft([field(FIELD_A, 'old')]);
    const localDraft = entryDraft([field(FIELD_A, 'local')]);
    const nextBase = entryDraft([field(FIELD_A, 'other')], {
      entryId: FIELD_C,
      locale: 'fr-FR',
    });
    const result = rebaseCmsEditorialDraft({
      previousBase,
      localDraft,
      nextBase,
    });
    expect(result.canAutosave).toBe(false);
    expect(result.draft).toBeNull();
    expect(result.issues).toEqual([{ kind: 'scope-mismatch', localDraft }]);
  });
});
