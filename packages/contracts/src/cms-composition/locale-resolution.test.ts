import { describe, expect, it } from 'vitest';

import {
  isRefused,
  issuePaths,
  uid,
  without,
} from './composition-fixtures.test-support';
import {
  CMS_LOCALE_NO_FALLBACK_GATE,
  CMS_LOCALE_NO_FALLBACK_REASONS,
  LocaleFieldResolutionRequestSchema,
  LocaleFieldResolutionSchema,
} from './locale-resolution';

const fieldId = uid(160);
const base = {
  fieldId,
  locale: 'fr-CA',
  mode: 'localized',
  outcome: 'resolved',
  provenance: 'authored',
  resolvedFromLocale: null,
  stale: false,
  blocking: false,
  reasonCode: null,
} as const;

describe('CMS-03C-20 locale field resolution (DEC-121, DEC-138)', () => {
  it('[P2-S12-AC-148] takes the entry, the target locale and the field id of the RPC', () => {
    const request = { entryId: uid(161), locale: 'fr-CA', fieldId };
    expect(LocaleFieldResolutionRequestSchema.parse(request)).toEqual(request);
    for (const candidate of [
      without(request, 'fieldId'),
      without(request, 'locale'),
      without(request, 'entryId'),
      { ...request, locale: 'fr_CA' },
      { ...request, entryId: 'x' },
      { ...request, fieldId: 'x' },
      { ...request, sourceHash: 'a'.repeat(64) },
    ])
      expect(isRefused(LocaleFieldResolutionRequestSchema, candidate)).toBe(
        true,
      );
  });

  it('[P2-S12-AC-148] returns the nine members with their closed vocabularies', () => {
    expect(LocaleFieldResolutionSchema.parse(base)).toEqual(base);
    for (const mode of ['none', 'localized', 'no_fallback'])
      expect(
        LocaleFieldResolutionSchema.safeParse({ ...base, mode }).success,
        mode,
      ).toBe(true);
    for (const candidate of [
      { ...base, mode: 'fallback' },
      { ...base, outcome: 'resolved_with_fallback' },
      { ...base, provenance: 'inherited' },
      {
        ...base,
        reasonCode: 'no_fallback_unknown',
        mode: 'no_fallback',
        blocking: true,
      },
      { ...base, fieldId: 'x' },
      { ...base, locale: 'fr_CA' },
      { ...base, resolvedFromLocale: 'fr_CA' },
      { ...base, stale: 'no' },
      { ...base, value: 'Bonjour' },
      { ...base, text: 'Bonjour' },
      without(base, 'reasonCode'),
      without(base, 'blocking'),
      without(base, 'resolvedFromLocale'),
      without(base, 'stale'),
    ])
      expect(isRefused(LocaleFieldResolutionSchema, candidate)).toBe(true);
  });

  it('[P2-S12-AC-149] resolves a none-mode field to the source-locale value without fallback', () => {
    expect(
      LocaleFieldResolutionSchema.safeParse({ ...base, mode: 'none' }).success,
    ).toBe(true);
    for (const candidate of [
      {
        ...base,
        mode: 'none',
        provenance: 'localized_fallback',
        resolvedFromLocale: 'en',
      },
      { ...base, mode: 'none', blocking: true },
      { ...base, mode: 'none', reasonCode: 'no_fallback_missing' },
    ])
      expect(isRefused(LocaleFieldResolutionSchema, candidate)).toBe(true);
  });

  it('[P2-S12-AC-149] walks the fallback chain for a localized field and records where the value came from', () => {
    expect(
      LocaleFieldResolutionSchema.safeParse({
        ...base,
        provenance: 'localized_fallback',
        resolvedFromLocale: 'fr',
      }).success,
    ).toBe(true);
    expect(
      issuePaths(LocaleFieldResolutionSchema, {
        ...base,
        provenance: 'localized_fallback',
        resolvedFromLocale: null,
      }),
    ).toEqual(['resolvedFromLocale']);
    expect(
      LocaleFieldResolutionSchema.safeParse({
        ...base,
        outcome: 'missing',
        provenance: 'missing',
      }).success,
    ).toBe(true);
    // A missing value has no source locale and a resolved one is never "missing".
    for (const candidate of [
      {
        ...base,
        outcome: 'missing',
        provenance: 'missing',
        resolvedFromLocale: 'fr',
      },
      { ...base, outcome: 'missing', provenance: 'authored' },
      { ...base, outcome: 'resolved', provenance: 'missing' },
    ])
      expect(isRefused(LocaleFieldResolutionSchema, candidate)).toBe(true);
  });

  it('[P2-S12-AC-052] serves a stale localized field and flags it without ever blocking', () => {
    expect(
      LocaleFieldResolutionSchema.safeParse({ ...base, stale: true }).success,
    ).toBe(true);
    for (const candidate of [
      { ...base, stale: true, blocking: true },
      { ...base, stale: true, blocking: true, reasonCode: 'no_fallback_stale' },
      { ...base, outcome: 'missing', provenance: 'missing', blocking: true },
    ])
      expect(isRefused(LocaleFieldResolutionSchema, candidate)).toBe(true);
  });

  it('[P2-S12-AC-051] blocks a missing no_fallback field with no_fallback_missing and never resolves it through the chain', () => {
    const missing = {
      ...base,
      mode: 'no_fallback',
      outcome: 'missing',
      provenance: 'missing',
      blocking: true,
      reasonCode: 'no_fallback_missing',
    } as const;
    expect(LocaleFieldResolutionSchema.parse(missing)).toEqual(missing);
    for (const candidate of [
      { ...missing, reasonCode: null },
      { ...missing, reasonCode: 'no_fallback_stale' },
      { ...missing, blocking: false },
      {
        ...missing,
        provenance: 'localized_fallback',
        outcome: 'resolved',
        resolvedFromLocale: 'en',
      },
      {
        ...base,
        mode: 'no_fallback',
        provenance: 'localized_fallback',
        resolvedFromLocale: 'en',
      },
    ])
      expect(isRefused(LocaleFieldResolutionSchema, candidate)).toBe(true);
  });

  it('[P2-S12-AC-051] blocks a stale no_fallback field with no_fallback_stale and passes a current one', () => {
    const stale = {
      ...base,
      mode: 'no_fallback',
      stale: true,
      blocking: true,
      reasonCode: 'no_fallback_stale',
    } as const;
    expect(LocaleFieldResolutionSchema.parse(stale)).toEqual(stale);
    const current = { ...base, mode: 'no_fallback' } as const;
    expect(LocaleFieldResolutionSchema.parse(current)).toEqual(current);
    for (const candidate of [
      { ...stale, reasonCode: null },
      { ...stale, reasonCode: 'no_fallback_missing' },
      { ...stale, blocking: false },
      { ...current, blocking: true },
      { ...current, reasonCode: 'no_fallback_stale' },
      {
        ...current,
        stale: false,
        reasonCode: 'no_fallback_stale',
        blocking: true,
      },
    ])
      expect(isRefused(LocaleFieldResolutionSchema, candidate)).toBe(true);
  });

  it('[P2-S12-AC-240] registers the no_fallback_gate provider and its three closed failure reasons', () => {
    expect(CMS_LOCALE_NO_FALLBACK_GATE).toEqual({
      providerKey: 'cms.locale.no_fallback_gate',
      providerVersion: '1',
      category: 'locale',
    });
    expect([...CMS_LOCALE_NO_FALLBACK_REASONS]).toEqual([
      'no_fallback_missing',
      'no_fallback_stale',
      'locale_variant_not_approved',
    ]);
  });
});
