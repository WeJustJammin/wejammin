import { describe, expect, it } from 'vitest';

import type { AuthoringContextField, JsonValue } from '@wejammin/contracts';
import { isCmsUuid } from '@wejammin/contracts/client';

import { describeCmsAuthoringFields } from './cms-field-descriptor-decode';
import type { CmsFieldDescriptor } from './cms-field-descriptor';
import { isCmsFieldValueEmpty, validateCmsFieldValue } from './cms-field-value';
import {
  allKindFields,
  authoringField,
  fieldUuid,
} from './cms-field-fixtures.test-support';
import { collectCmsCreateValues } from '../cms-editorial/cms-editorial-entry-create-values';
import { editableCmsFieldIds } from '../cms-editorial/cms-editorial-entry-editor-state';

/**
 * The taxonomy field value, recalled from the locked BE03b value encoding
 * (03b-editorial-workflow-publication.md line 1539) and the database shape
 * predicate (supabase/migrations/20261005010100_cms_field_kind_encodings.sql
 * lines 634..660): exactly `{ termIds: UUID[] <= 128 }`.
 *
 * The shape is all the browser mirrors. The object is strict (one present key),
 * `termIds` is an array of at most 128 UUID strings, and duplicates are not
 * refused (the predicate never de-duplicates). Whether a term is active, visible
 * to the field, or usable for the entry type is decided by the server, so a local
 * pass is never an eligibility claim and the server stays the authority.
 *
 * Strictness is checked before emptiness: an object that looks empty
 * (`{ termIds: [], extra: … }`) carries an unknown key, so it is malformed, never
 * an absent value that an optional field may silently skip.
 */

const TAXONOMY_N = 0x211;

const taxonomyField = (required: boolean): AuthoringContextField =>
  authoringField({
    n: TAXONOMY_N,
    key: 'topics',
    kind: 'taxonomy',
    label: 'Topics',
    required,
  });

/** The decode is expected to produce a taxonomy descriptor (base + kind taxonomy). */
const taxonomyDescriptor = (required: boolean): CmsFieldDescriptor => {
  const [descriptor] = describeCmsAuthoringFields([taxonomyField(required)]);
  if (descriptor === undefined)
    throw new Error('taxonomy fixture did not decode');
  return descriptor;
};

const descriptorByKey = (
  fields: readonly AuthoringContextField[],
  key: string,
): CmsFieldDescriptor => {
  const found = describeCmsAuthoringFields(fields).find(
    (descriptor) => descriptor.key === key,
  );
  if (found === undefined) throw new Error(`fixture missing ${key}`);
  return found;
};

const termIds = (...ids: string[]): JsonValue => ({ termIds: ids });

const refused = (
  descriptor: CmsFieldDescriptor,
  value: JsonValue | null,
): boolean => validateCmsFieldValue(descriptor, value).length > 0;

const manyTermIds = (count: number): string[] =>
  Array.from({ length: count }, (_, index) => fieldUuid(index + 1));

describe('isCmsFieldValueEmpty: taxonomy', () => {
  it('treats null and an empty termIds list as the absence of a value, and a non-empty list as a value', () => {
    const optional = taxonomyDescriptor(false);
    expect(isCmsFieldValueEmpty(optional, null)).toBe(true);
    expect(isCmsFieldValueEmpty(optional, termIds())).toBe(true);
    expect(isCmsFieldValueEmpty(optional, termIds(fieldUuid(1)))).toBe(false);
  });

  it('never mistakes a malformed taxonomy object for an absent value', () => {
    const optional = taxonomyDescriptor(false);
    expect(isCmsFieldValueEmpty(optional, { termIds: 'not-an-array' })).toBe(
      false,
    );
    expect(isCmsFieldValueEmpty(optional, termIds('not-a-uuid'))).toBe(false);
    expect(isCmsFieldValueEmpty(optional, {})).toBe(false);
    // An empty-looking list with an unknown key is malformed, not absent: the
    // strict object must reject the extra key before emptiness can skip it.
    expect(isCmsFieldValueEmpty(optional, { termIds: [], extra: 1 })).toBe(
      false,
    );
    expect(isCmsFieldValueEmpty(optional, { termIds: [], extra: null })).toBe(
      false,
    );
  });
});

describe('validateCmsFieldValue: taxonomy { termIds: UUID[] <= 128 }', () => {
  it('requires a value only where the field is required', () => {
    const required = taxonomyDescriptor(true);
    const optional = taxonomyDescriptor(false);
    expect(validateCmsFieldValue(required, null).map((i) => i.code)).toEqual([
      'required',
    ]);
    expect(
      validateCmsFieldValue(required, termIds()).map((i) => i.code),
    ).toEqual(['required']);
    expect(validateCmsFieldValue(optional, null)).toEqual([]);
    expect(validateCmsFieldValue(optional, termIds())).toEqual([]);
  });

  it('accepts a strict, non-empty taxonomy object', () => {
    expect(
      validateCmsFieldValue(
        taxonomyDescriptor(false),
        termIds(fieldUuid(1), fieldUuid(2)),
      ),
    ).toEqual([]);
  });

  it('accepts exactly 128 termIds and refuses 129', () => {
    const optional = taxonomyDescriptor(false);
    expect(
      validateCmsFieldValue(optional, termIds(...manyTermIds(128))),
    ).toEqual([]);
    expect(refused(optional, termIds(...manyTermIds(129)))).toBe(true);
  });

  it('permits duplicate term ids: the shape predicate does not de-duplicate', () => {
    expect(
      validateCmsFieldValue(
        taxonomyDescriptor(false),
        termIds(fieldUuid(1), fieldUuid(1)),
      ),
    ).toEqual([]);
  });

  it('refuses a non-object, unknown keys, a missing or non-array termIds, and malformed ids', () => {
    const optional = taxonomyDescriptor(false);
    expect(refused(optional, 42)).toBe(true);
    expect(refused(optional, 'term')).toBe(true);
    expect(refused(optional, ['term'])).toBe(true);
    expect(refused(optional, { termIds: [fieldUuid(1)], extra: 1 })).toBe(true);
    expect(refused(optional, {})).toBe(true);
    expect(refused(optional, { termIds: 'not-an-array' })).toBe(true);
    expect(refused(optional, termIds('not-a-uuid'))).toBe(true);
    expect(refused(optional, { termIds: [1] })).toBe(true);
    expect(refused(optional, { termIds: [null] })).toBe(true);
  });

  it('refuses a malformed taxonomy as an invalid value, never as a missing one', () => {
    const optional = taxonomyDescriptor(false);
    const malformed: readonly JsonValue[] = [
      { termIds: 'not-an-array' },
      termIds('not-a-uuid'),
      { termIds: [1] },
      {},
      { termIds: [fieldUuid(1)], extra: 1 },
      { termIds: [], extra: 1 },
      { termIds: [], extra: null },
    ];
    for (const value of malformed) {
      const issues = validateCmsFieldValue(optional, value);
      expect(issues.length).toBeGreaterThan(0);
      expect(issues.every((issue) => issue.code !== 'required')).toBe(true);
    }
  });

  it('accepts a term id exactly when the shared isCmsUuid predicate does', () => {
    const optional = taxonomyDescriptor(false);
    const samples: readonly string[] = [
      fieldUuid(1),
      '018f0c45-73fe-7dc2-9c09-68f7ecf1ffff',
      '00000000-0000-0000-0000-000000000000',
      'not-a-uuid',
      '',
      '018f0c45-73fe-0dc2-9c09-68f7ecf10001',
      '018f0c45-73fe-7dc2-1c09-68f7ecf10001',
    ];
    for (const id of samples)
      expect(validateCmsFieldValue(optional, termIds(id)).length === 0).toBe(
        isCmsUuid(id),
      );
  });

  it('validates only the shape, leaving term eligibility to the server', () => {
    // Two syntactically valid ids validate locally; whether either is an active
    // term of a vocabulary that lists this entry type and field is the server's
    // decision.
    expect(
      validateCmsFieldValue(
        taxonomyDescriptor(false),
        termIds(fieldUuid(0x999), fieldUuid(0x998)),
      ),
    ).toEqual([]);
  });
});

describe('collectCmsCreateValues: taxonomy', () => {
  const REQUIRED_TAXONOMY = authoringField({
    n: 0x212,
    key: 'genres',
    kind: 'taxonomy',
    label: 'Genres',
    required: true,
  });
  const fields = (): readonly AuthoringContextField[] => [
    ...allKindFields(),
    REQUIRED_TAXONOMY,
  ];

  it('sends a non-empty taxonomy and marks a missing required taxonomy', () => {
    const topics = descriptorByKey(fields(), 'topics');
    const genres = descriptorByKey(fields(), 'genres');
    const collected = collectCmsCreateValues(
      describeCmsAuthoringFields(fields()),
      { [topics.fieldId]: termIds(fieldUuid(1)), [genres.fieldId]: null },
      new Set(),
    );
    expect(collected.values[topics.fieldId]).toEqual(termIds(fieldUuid(1)));
    expect(collected.issues.get(genres.fieldId)).toEqual([
      expect.objectContaining({ code: 'required' }),
    ]);
  });

  it('does not send an empty optional taxonomy', () => {
    const topics = descriptorByKey(fields(), 'topics');
    const collected = collectCmsCreateValues(
      describeCmsAuthoringFields(fields()),
      { [topics.fieldId]: termIds() },
      new Set(),
    );
    expect(collected.values).not.toHaveProperty(topics.fieldId);
    expect(collected.issues.has(topics.fieldId)).toBe(false);
  });

  it('flags a malformed taxonomy object instead of silently dropping it', () => {
    const topics = descriptorByKey(fields(), 'topics');
    const collected = collectCmsCreateValues(
      describeCmsAuthoringFields(fields()),
      { [topics.fieldId]: { termIds: 'not-an-array' } },
      new Set(),
    );
    expect(collected.issues.get(topics.fieldId)?.length ?? 0).toBeGreaterThan(
      0,
    );
  });

  it('flags an empty-looking taxonomy with an extra key instead of ignoring it', () => {
    const topics = descriptorByKey(fields(), 'topics');
    const emptyLooking: readonly JsonValue[] = [
      { termIds: [], extra: 1 },
      { termIds: [], extra: null },
    ];
    for (const value of emptyLooking) {
      const collected = collectCmsCreateValues(
        describeCmsAuthoringFields(fields()),
        { [topics.fieldId]: value },
        new Set(),
      );
      // The strict shape refuses the extra key, so the field is reported, never
      // skipped as an optional empty value.
      expect(collected.issues.get(topics.fieldId)?.length ?? 0).toBeGreaterThan(
        0,
      );
      expect(
        collected.issues
          .get(topics.fieldId)
          ?.every((issue) => issue.code !== 'required') ?? false,
      ).toBe(true);
    }
  });

  it('keeps media, relation and unsupported fields out of the create payload', () => {
    const descriptors = describeCmsAuthoringFields(fields());
    const media = descriptorByKey(fields(), 'cover');
    const relation = descriptorByKey(fields(), 'related');
    const unsupported: CmsFieldDescriptor = {
      kind: 'unsupported',
      fieldId: fieldUuid(0x501),
      key: 'mystery',
      label: 'Mystery',
      helpText: undefined,
      required: false,
      order: 99,
    };
    const collected = collectCmsCreateValues(
      [...descriptors, unsupported],
      {
        [media.fieldId]: { assetId: fieldUuid(2), assetVersion: '1' },
        [relation.fieldId]: {
          targets: [{ targetId: fieldUuid(3), expectedTargetVersion: null }],
        },
        [unsupported.fieldId]: 'anything',
      },
      new Set(),
    );
    expect(collected.values).not.toHaveProperty(media.fieldId);
    expect(collected.values).not.toHaveProperty(relation.fieldId);
    expect(collected.values).not.toHaveProperty(unsupported.fieldId);
  });

  it('still never raises a validation issue for media and an unreadable field', () => {
    const media = descriptorByKey(fields(), 'cover');
    const unsupported: CmsFieldDescriptor = {
      kind: 'unsupported',
      fieldId: fieldUuid(0x502),
      key: 'mystery',
      label: 'Mystery',
      helpText: undefined,
      required: false,
      order: 99,
    };
    expect(
      validateCmsFieldValue(media, {
        assetId: fieldUuid(2),
        assetVersion: '1',
      }),
    ).toEqual([]);
    expect(validateCmsFieldValue(unsupported, 'anything')).toEqual([]);
    expect(isCmsFieldValueEmpty(media, 'anything')).toBe(true);
    expect(isCmsFieldValueEmpty(unsupported, { anything: true })).toBe(true);
  });
});

/**
 * Editor availability, not a database producer proof: the browser now lists a
 * taxonomy field as editable and renders it. The database still refuses a
 * non-empty taxonomy with `taxonomy_source_unavailable` until the taxonomy
 * authority is registered (BE03b value encodings), so this says nothing about
 * what the SQL will accept.
 */
describe('taxonomy editor availability', () => {
  it('lists a taxonomy field as editable while media stays without an editor', () => {
    const descriptors = describeCmsAuthoringFields(allKindFields());
    const editable = editableCmsFieldIds(descriptors, { readOnlyNotices: {} });
    const taxonomy = descriptors.find(
      (descriptor) => descriptor.kind === 'taxonomy',
    );
    const media = descriptors.find((descriptor) => descriptor.kind === 'media');
    if (taxonomy === undefined || media === undefined)
      throw new Error('fixture missing a taxonomy or media descriptor');
    expect(editable).toContain(taxonomy.fieldId);
    expect(editable).not.toContain(media.fieldId);
  });
});
