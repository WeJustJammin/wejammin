import { describe, expect, it } from 'vitest';
import { LocaleVariantRequestSchema } from '@wejammin/contracts';

import {
  BLURB,
  CHAIN,
  ENTRY_ID,
  HASH,
  LEGAL,
  LOCALE,
  SOURCE_REVISION_ID,
  TITLE,
  entryFacts,
  fieldInits,
} from './locale-variant.test-support';
import {
  buildLocaleVariantRequest,
  type LocaleVariantFields,
} from './locale-variant-request';

const fields = (
  values: LocaleVariantFields['values'],
  fallbackChain: readonly string[] = CHAIN,
): LocaleVariantFields => ({
  fields: fieldInits(),
  values,
  fallbackChain,
});

describe('buildLocaleVariantRequest (CMS-03C-04, FE03 :891, :1834)', () => {
  it('builds a request the strict contract accepts, with only the filled fields, the equality chain and the schema no_fallback ids', () => {
    const built = buildLocaleVariantRequest(
      fields({ [TITLE]: 'Tournée de printemps', [LEGAL]: null, [BLURB]: '' }),
      entryFacts(),
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.value).toEqual({
      entryId: ENTRY_ID,
      locale: LOCALE,
      sourceRevisionId: SOURCE_REVISION_ID,
      fields: [{ fieldId: TITLE, value: 'Tournée de printemps' }],
      fallbackChain: ['fr', 'en-US'],
      noFallbackFieldIds: [LEGAL],
      sourceHash: HASH,
      expectedVersion: '4',
    });
    expect(LocaleVariantRequestSchema.safeParse(built.value).success).toBe(
      true,
    );
    expect(built.body).toBe(JSON.stringify(built.value));
  });

  it('sends an empty chain exactly when the chain is empty (the default locale)', () => {
    const built = buildLocaleVariantRequest(
      fields({ [TITLE]: 'x' }, []),
      entryFacts(),
    );
    expect(built.ok && built.value.fallbackChain).toEqual([]);
  });

  it('refuses a save with nothing to translate before any send', () => {
    const built = buildLocaleVariantRequest(
      fields({ [TITLE]: '', [LEGAL]: null }),
      entryFacts(),
    );
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.issues.map((issue) => issue.code)).toEqual([
      'nothing_to_save',
    ]);
    expect(built.issues[0]?.target).toBe('form');
  });

  it('names the field whose value breaks its declared constraint, and sends nothing', () => {
    const built = buildLocaleVariantRequest(
      fields({ [TITLE]: 'x'.repeat(41), [BLURB]: 'ok' }),
      entryFacts(),
    );
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.issues).toHaveLength(1);
    expect(built.issues[0]).toMatchObject({
      code: 'field_invalid',
      target: TITLE,
    });
    expect(built.issues[0]?.message).toContain('Title');
  });

  it('keeps a false boolean and a zero as real translations', () => {
    const init = fieldInits();
    const built = buildLocaleVariantRequest(
      {
        fields: [
          {
            ...init[0]!,
            descriptor: { ...init[0]!.descriptor, kind: 'boolean' },
          },
          {
            ...init[2]!,
            descriptor: {
              ...init[2]!.descriptor,
              kind: 'integer',
              constraints: {},
            },
          },
        ],
        values: { [TITLE]: false, [BLURB]: 0 },
        fallbackChain: CHAIN,
      },
      entryFacts(),
    );
    expect(built.ok && built.value.fields).toEqual([
      { fieldId: TITLE, value: false },
      { fieldId: BLURB, value: 0 },
    ]);
  });

  it.each([
    ['entry_invalid', { entryId: 'nope' }],
    ['locale_invalid', { locale: 'fr_CA' }],
    ['source_invalid', { sourceRevisionId: 'nope' }],
    ['hash_invalid', { sourceHash: 'A'.repeat(64) }],
    ['version_invalid', { version: '0' }],
  ] as const)('refuses %s', (code, extra) => {
    const built = buildLocaleVariantRequest(
      fields({ [TITLE]: 'x' }),
      entryFacts(extra),
    );
    expect(built.ok).toBe(false);
    if (!built.ok) expect(built.issues.map((i) => i.code)).toContain(code);
  });

  it('refuses a chain longer than 16 tags or one that repeats the target', () => {
    const long = Array.from({ length: 17 }, (_, i) => `x${'a'.repeat(i + 1)}`);
    for (const chain of [long, ['fr-CA']]) {
      const built = buildLocaleVariantRequest(
        fields({ [TITLE]: 'x' }, chain),
        entryFacts(),
      );
      expect(built.ok).toBe(false);
      if (!built.ok)
        expect(built.issues.map((i) => i.code)).toContain('chain_invalid');
    }
  });
});
