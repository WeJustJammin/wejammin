import { describe, expect, it } from 'vitest';

import {
  LocaleVariantReadApiRequestSchema,
  LocaleVariantReadSchema,
  localeVariantReadAnswers,
} from './locale-variant-read';

const ENTRY_ID = '10000000-0000-4000-8000-000000000001';
const OTHER_ENTRY_ID = '10000000-0000-4000-8000-0000000000ff';
const FIELD_A = '30000000-0000-4000-8000-000000000003';
const FIELD_B = '30000000-0000-4000-8000-000000000004';
const VARIANT_ID = '40000000-0000-4000-8000-000000000004';
const REVISION_ID = '50000000-0000-4000-8000-000000000005';
const SOURCE_REVISION_ID = '20000000-0000-4000-8000-000000000002';
const HASH = 'a'.repeat(64);

const variant = {
  id: VARIANT_ID,
  version: '3',
  contentHash: HASH,
  createdAt: '2026-09-27T12:00:00Z',
  updatedAt: '2026-09-27T12:00:00Z',
  state: 'draft',
  entryId: ENTRY_ID,
  revisionId: REVISION_ID,
  locale: 'fr-CA',
  sourceRevisionId: SOURCE_REVISION_ID,
  fallbackChain: ['fr', 'en-US'],
  noFallbackFieldIds: [FIELD_B],
  staleFieldIds: [],
};
const resolution = (fieldId: string, patch: Record<string, unknown> = {}) => ({
  fieldId,
  locale: 'fr-CA',
  mode: 'localized',
  outcome: 'resolved',
  provenance: 'authored',
  resolvedFromLocale: null,
  stale: false,
  blocking: false,
  reasonCode: null,
  ...patch,
});
const read = {
  locale: 'fr-CA',
  activeFallbackChain: ['fr', 'en-US'],
  variant,
  fields: [
    { fieldId: FIELD_A, value: 'Bonjour' },
    { fieldId: FIELD_B, value: null },
  ],
  resolutions: [
    resolution(FIELD_A),
    resolution(FIELD_B, {
      mode: 'no_fallback',
      outcome: 'missing',
      provenance: 'missing',
      blocking: true,
      reasonCode: 'no_fallback_missing',
    }),
  ],
};
const untranslated = {
  locale: 'fr-CA',
  activeFallbackChain: ['fr'],
  variant: null,
  fields: [],
  resolutions: [
    resolution(FIELD_A, { outcome: 'missing', provenance: 'missing' }),
  ],
};

describe('cmsLocaleVariantRead addressing (DEC-205)', () => {
  it('addresses the entry and the target locale by path only', () => {
    expect(
      LocaleVariantReadApiRequestSchema.parse({
        entryId: ENTRY_ID,
        locale: 'fr-CA',
      }),
    ).toEqual({ entryId: ENTRY_ID, locale: 'fr-CA' });
  });

  it('refuses a missing, malformed or extra member', () => {
    for (const candidate of [
      {},
      { entryId: ENTRY_ID },
      { locale: 'fr-CA' },
      { entryId: 'private', locale: 'fr-CA' },
      { entryId: ENTRY_ID, locale: 'fr_CA' },
      { entryId: ENTRY_ID, locale: '' },
      { entryId: ENTRY_ID, locale: 'fr-CA', cursor: 'x' },
      { entryId: ENTRY_ID, locale: 'fr-CA', sourceRevisionId: ENTRY_ID },
      { entryId: ENTRY_ID, locale: 'fr-CA', ownerId: ENTRY_ID },
    ])
      expect(
        LocaleVariantReadApiRequestSchema.safeParse(candidate).success,
        JSON.stringify(candidate),
      ).toBe(false);
  });
});

describe('LocaleVariantRead answer (DEC-205)', () => {
  it('answers the variant, its stored values, every resolution and the active order', () => {
    expect(LocaleVariantReadSchema.parse(read)).toEqual(read);
  });

  it('answers an explicit null variant with no stored values when none exists', () => {
    expect(LocaleVariantReadSchema.parse(untranslated)).toEqual(untranslated);
  });

  it('keeps the stored value of every kind verbatim, null included', () => {
    const values = [
      'text',
      true,
      7,
      1.5,
      null,
      '2026-10-01',
      { a: [1, { b: null }] },
    ];
    const fields = values.map((value, index) => ({
      fieldId: `30000000-0000-4000-8000-0000000001${String(index).padStart(2, '0')}`,
      value,
    }));
    const parsed = LocaleVariantReadSchema.parse({
      ...read,
      fields,
      resolutions: [],
    });
    expect(parsed.fields.map(({ value }) => value)).toEqual(values);
  });

  it('refuses a missing, extra, undefined or malformed member', () => {
    for (const candidate of [
      {},
      { ...read, locale: undefined },
      { ...read, variant: undefined },
      { ...read, fields: undefined },
      { ...read, resolutions: undefined },
      { ...read, activeFallbackChain: undefined },
      { ...read, extra: true },
      { ...read, etag: '"3"' },
      { ...read, locale: 'fr_CA' },
      { ...read, activeFallbackChain: ['fr_CA'] },
      {
        ...read,
        activeFallbackChain: Array.from({ length: 17 }, (_, i) => `x${i}`),
      },
      { ...read, variant: { ...variant, ownerId: ENTRY_ID } },
      { ...read, variant: { ...variant, state: 'published' } },
      { ...read, fields: [{ fieldId: FIELD_A }] },
      { ...read, fields: [{ fieldId: FIELD_A, value: 'x', extra: 1 }] },
      { ...read, fields: [{ fieldId: 'x', value: 'x' }] },
      { ...read, resolutions: [{ ...resolution(FIELD_A), extra: 1 }] },
      { ...read, resolutions: [resolution(FIELD_A, { mode: 'fallback' })] },
      { ...read, resolutions: [resolution(FIELD_A, { stale: undefined })] },
      null,
      [],
    ])
      expect(
        LocaleVariantReadSchema.safeParse(candidate).success,
        JSON.stringify(candidate),
      ).toBe(false);
  });

  it('bounds the stored values and the resolutions at 128 each', () => {
    const many = (count: number) =>
      Array.from({ length: count }, (_, index) => ({
        fieldId: `30000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
        value: 'x',
      }));
    expect(
      LocaleVariantReadSchema.safeParse({
        ...read,
        fields: many(128),
        resolutions: many(128).map(({ fieldId }) => resolution(fieldId)),
      }).success,
    ).toBe(true);
    expect(
      LocaleVariantReadSchema.safeParse({ ...read, fields: many(129) }).success,
    ).toBe(false);
    expect(
      LocaleVariantReadSchema.safeParse({
        ...read,
        resolutions: many(129).map(({ fieldId }) => resolution(fieldId)),
      }).success,
    ).toBe(false);
  });

  it('refuses a resolution that breaks the CMS-03C-20 invariants', () => {
    for (const patch of [
      { provenance: 'localized_fallback', resolvedFromLocale: null },
      { outcome: 'missing', provenance: 'authored' },
      { mode: 'no_fallback', outcome: 'missing', provenance: 'missing' },
    ])
      expect(
        LocaleVariantReadSchema.safeParse({
          ...read,
          resolutions: [resolution(FIELD_A, patch)],
        }).success,
        JSON.stringify(patch),
      ).toBe(false);
  });

  it('refuses a duplicated stored field or resolution, whatever the id case', () => {
    expect(
      LocaleVariantReadSchema.safeParse({
        ...read,
        fields: [
          { fieldId: FIELD_A, value: 'a' },
          { fieldId: FIELD_A.toUpperCase(), value: 'b' },
        ],
      }).success,
    ).toBe(false);
    expect(
      LocaleVariantReadSchema.safeParse({
        ...read,
        resolutions: [resolution(FIELD_A), resolution(FIELD_A.toUpperCase())],
      }).success,
    ).toBe(false);
  });

  it('refuses a stored value when there is no variant', () => {
    expect(
      LocaleVariantReadSchema.safeParse({
        ...untranslated,
        fields: [{ fieldId: FIELD_A, value: 'x' }],
      }).success,
    ).toBe(false);
  });

  it('refuses a variant or resolution for another locale than the one read', () => {
    expect(
      LocaleVariantReadSchema.safeParse({
        ...read,
        variant: { ...variant, locale: 'de' },
      }).success,
    ).toBe(false);
    expect(
      LocaleVariantReadSchema.safeParse({
        ...read,
        resolutions: [resolution(FIELD_A, { locale: 'de' })],
      }).success,
    ).toBe(false);
  });

  it('compares locale tags case-insensitively', () => {
    expect(
      LocaleVariantReadSchema.safeParse({
        ...read,
        locale: 'FR-ca',
      }).success,
    ).toBe(true);
  });
});

describe('localeVariantReadAnswers (DEC-205)', () => {
  const answers = (
    value: unknown,
    entryId = ENTRY_ID,
    locale = 'fr-CA',
  ): boolean =>
    localeVariantReadAnswers(
      LocaleVariantReadSchema.parse(value),
      entryId,
      locale,
    );

  it('accepts the read of this entry and locale, whatever the case', () => {
    expect(answers(read)).toBe(true);
    expect(answers(untranslated)).toBe(true);
    expect(answers(read, ENTRY_ID.toUpperCase(), 'FR-ca')).toBe(true);
  });

  it("refuses another entry's variant, another locale's answer, and an 'untranslated' variant resource", () => {
    expect(
      answers({ ...read, variant: { ...variant, entryId: OTHER_ENTRY_ID } }),
    ).toBe(false);
    expect(answers(read, OTHER_ENTRY_ID)).toBe(false);
    expect(answers(read, ENTRY_ID, 'de')).toBe(false);
    expect(
      answers({ ...read, variant: { ...variant, state: 'untranslated' } }),
    ).toBe(false);
  });

  it('refuses a no_fallback field resolved from another locale', () => {
    const crossed = resolution(FIELD_B, {
      mode: 'no_fallback',
      provenance: 'localized_fallback',
      resolvedFromLocale: 'fr',
    });
    expect(
      LocaleVariantReadSchema.safeParse({ ...read, resolutions: [crossed] })
        .success,
    ).toBe(false);
  });
});
