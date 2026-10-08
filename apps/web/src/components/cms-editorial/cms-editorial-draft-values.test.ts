import { EntryDraftDetailResourceSchema } from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import { describeCmsAuthoringFields } from '../cms-editorial-fields/cms-field-descriptor';
import { fieldUuid } from '../cms-editorial-fields/cms-field-fixtures.test-support';
import { draftValuesFromDetail } from './cms-editorial-draft-values';
import {
  BLURB,
  ENTRY_ID,
  HASH,
  INSTANT,
  RELATED,
  RATING,
  TITLE,
  editorFields,
} from './cms-editorial-editor-fixtures.test-support';

const meta = (id: string) => ({
  id,
  version: '1',
  createdAt: INSTANT,
  updatedAt: INSTANT,
});

const detail = (
  overrides: {
    readonly fields?: readonly unknown[];
    readonly relations?: readonly unknown[];
    readonly locale?: string;
  } = {},
) =>
  EntryDraftDetailResourceSchema.parse({
    entry: meta(ENTRY_ID),
    revision: meta(fieldUuid(0x600)),
    revisionNumber: '2',
    lifecycle: 'active',
    state: 'draft',
    locale: overrides.locale ?? 'en-US',
    contentHash: HASH,
    schemaVersionId: fieldUuid(0x601),
    validationState: 'valid',
    openConflict: null,
    fields: overrides.fields ?? [],
    relations: overrides.relations ?? [],
  });

const stored = (fieldId: string, value: unknown, locale = 'en-US') => ({
  fieldId,
  fieldDefinitionId: fieldId,
  locale,
  value,
  provenance: 'authored',
  valueHash: HASH,
});

const resolved = (
  position: number,
  target: number,
  version: string | null,
) => ({
  fieldId: RELATED,
  fieldDefinitionId: RELATED,
  targetKind: 'content',
  targetId: fieldUuid(target),
  expectedTargetVersion: version,
  position,
  onUnavailable: 'omit',
  unavailable: null,
});

const placeholder = (position: number) => ({
  fieldId: RELATED,
  fieldDefinitionId: RELATED,
  position,
  onUnavailable: 'placeholder',
  unavailable: { status: 'unavailable', reason: 'unavailable' },
});

const descriptors = describeCmsAuthoringFields(editorFields());

describe('draftValuesFromDetail', () => {
  it('maps stored values of the draft locale by stable field id and leaves the rest null', () => {
    const result = draftValuesFromDetail(
      detail({
        fields: [stored(TITLE, 'Hello'), stored(BLURB, 'Bonjour', 'fr-FR')],
      }),
      descriptors,
    );
    expect(result.values[TITLE]).toBe('Hello');
    // A value stored for another locale is not this draft's value.
    expect(result.values[BLURB]).toBeNull();
    expect(result.values[RATING]).toBeNull();
  });

  it('assembles a relation value from its ordered resolved rows', () => {
    const result = draftValuesFromDetail(
      detail({
        relations: [resolved(1, 0x2, '3'), resolved(0, 0x1, null)],
      }),
      descriptors,
    );
    expect(result.values[RELATED]).toEqual({
      targets: [
        { targetId: fieldUuid(0x1), expectedTargetVersion: null },
        { targetId: fieldUuid(0x2), expectedTargetVersion: '3' },
      ],
    });
    expect(result.readOnlyNotices[RELATED]).toBeUndefined();
  });

  it('makes a relation read-only when any target is unavailable, so a save cannot drop it', () => {
    const result = draftValuesFromDetail(
      detail({ relations: [resolved(0, 0x1, null), placeholder(1)] }),
      descriptors,
    );
    expect(result.readOnlyNotices[RELATED]).toContain('1 linked entry');
    expect(result.readOnlyNotices[RELATED]).toContain('unavailable');
  });

  it('gives a relation with no rows an empty target list', () => {
    const result = draftValuesFromDetail(detail(), descriptors);
    expect(result.values[RELATED]).toEqual({ targets: [] });
  });

  it('ignores values of fields the schema version does not define', () => {
    const result = draftValuesFromDetail(
      detail({ fields: [stored(fieldUuid(0xfff), 'stray')] }),
      descriptors,
    );
    expect(Object.keys(result.values)).not.toContain(fieldUuid(0xfff));
  });
});
