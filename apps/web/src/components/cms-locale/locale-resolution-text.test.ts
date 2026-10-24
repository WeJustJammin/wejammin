import { describe, expect, it } from 'vitest';

import { LOCALE, TITLE, resolution } from './locale-variant.test-support';
import { fieldRuleText, resolutionText } from './locale-resolution-text';

describe('resolutionText (FE03 :891, :1122; BE03c 1526)', () => {
  it('says nothing about a resolution it was not given', () => {
    expect(resolutionText(null, false)).toBeNull();
  });

  it.each([
    ['an own value', resolution(TITLE), 'Translated in this language.'],
    [
      'an own value whose source changed',
      resolution(TITLE, { stale: true }),
      'Translated in this language, but the source changed since. It keeps showing the last translation until you revalidate it.',
    ],
    [
      'a fallback from another language',
      resolution(TITLE, {
        provenance: 'localized_fallback',
        resolvedFromLocale: 'en-US',
      }),
      'Not translated yet. Readers see the en-US version through the fallback order.',
    ],
    [
      'a missing fallback-permitted value',
      resolution(TITLE, { outcome: 'missing', provenance: 'missing' }),
      'Not translated yet, and no language in the fallback order has a value.',
    ],
    [
      'a missing no_fallback value',
      resolution(TITLE, {
        mode: 'no_fallback',
        outcome: 'missing',
        provenance: 'missing',
        blocking: true,
        reasonCode: 'no_fallback_missing',
      }),
      'Missing. This field never uses another language, so publishing this language is blocked until you translate it.',
    ],
    [
      'a stale no_fallback value',
      resolution(TITLE, {
        mode: 'no_fallback',
        stale: true,
        blocking: true,
        reasonCode: 'no_fallback_stale',
      }),
      'Out of date. This field never uses another language, so publishing this language is blocked until you revalidate it.',
    ],
  ])('states %s as text, with no locale text', (_name, input, expected) => {
    expect(resolutionText(input, false)).toBe(expected);
  });

  it('marks a field the last save reported stale even when no resolution is known', () => {
    expect(resolutionText(null, true)).toBe(
      'The source changed since this was translated. Revalidate it.',
    );
  });

  it('never words a no_fallback field as using a fallback', () => {
    for (const text of [
      resolutionText(
        resolution(TITLE, {
          mode: 'no_fallback',
          outcome: 'missing',
          provenance: 'missing',
          blocking: true,
          reasonCode: 'no_fallback_missing',
        }),
        false,
      ),
      fieldRuleText('no_fallback'),
    ])
      expect(text).not.toMatch(/readers see|through the fallback order/iu);
  });
});

describe('fieldRuleText', () => {
  it('states the rule of each mode in this locale', () => {
    expect(fieldRuleText('no_fallback')).toBe(
      'No fallback: this field is never shown in another language, and publishing this language needs it.',
    );
    expect(fieldRuleText('localized')).toBe(
      'Fallback allowed: untranslated, it follows the fallback order.',
    );
    expect(LOCALE).toBe('fr-CA');
  });
});
