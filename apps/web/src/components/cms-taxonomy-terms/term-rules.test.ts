import {
  CmsLocaleSchema,
  TaxonomyTermActionRequestSchema,
  TaxonomyTermKeySchema,
  TaxonomyTermLabelSchema,
} from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import {
  ALIAS_MAX_CHARACTERS,
  LABEL_MAX_CHARACTERS,
  TERM_KEY_REGEX,
  TERM_LIMITS,
  isLocale,
  isTermAlias,
  isTermLabelText,
} from './term-rules';

const KEYS = [
  'ab',
  'a1',
  'a-b',
  'a_b',
  'A',
  '1a',
  '-a',
  'a',
  'a'.repeat(64),
  'a'.repeat(65),
  'ab\n',
  'é1',
  'a b',
  '',
];
const LOCALES = [
  'en',
  'e',
  'en-GB',
  'zh-Hant-TW',
  'abcdefghi',
  'en-',
  '-en',
  'en_GB',
  'en-GB-x-twain',
  'en-abcdefghi',
  '',
  'é',
  'en US',
];
const LABELS = [
  '',
  'a',
  'x'.repeat(160),
  'x'.repeat(161),
  'é',
  'é',
  'Guitar',
  ' padded ',
  '日本語',
];

describe('term grammar mirrors the contract', () => {
  it('has the contract term key grammar', () => {
    expect(TERM_KEY_REGEX.source).toBe('^[a-z][a-z0-9-]{1,63}$');
    expect(TERM_KEY_REGEX.flags).toBe('u');
    for (const key of KEYS)
      expect(TERM_KEY_REGEX.test(key), JSON.stringify(key)).toBe(
        TaxonomyTermKeySchema.safeParse(key).success,
      );
  });

  it('has the contract locale grammar', () => {
    for (const locale of LOCALES)
      expect(isLocale(locale), JSON.stringify(locale)).toBe(
        CmsLocaleSchema.safeParse(locale).success,
      );
  });

  it('has the contract label rule: 1 to 160 characters, NFC', () => {
    for (const label of LABELS)
      expect(isTermLabelText(label), JSON.stringify(label)).toBe(
        TaxonomyTermLabelSchema.safeParse({ locale: 'en', label }).success,
      );
    expect(LABEL_MAX_CHARACTERS).toBe(160);
  });

  it('has the contract alias rule: 1 to 160 characters', () => {
    for (const alias of LABELS) {
      const schema = TaxonomyTermActionRequestSchema.shape.aliases;
      expect(isTermAlias(alias), JSON.stringify(alias)).toBe(
        schema.safeParse([alias]).success,
      );
    }
    expect(ALIAS_MAX_CHARACTERS).toBe(160);
  });

  it('has the contract list limits', () => {
    const shape = TaxonomyTermActionRequestSchema.shape;
    const label = { locale: 'en', label: 'Guitar' };
    expect(
      shape.labels.safeParse(
        Array.from({ length: TERM_LIMITS.labels }, () => label),
      ).success,
    ).toBe(true);
    expect(
      shape.labels.safeParse(
        Array.from({ length: TERM_LIMITS.labels + 1 }, () => label),
      ).success,
    ).toBe(false);
    expect(shape.labels.safeParse([]).success).toBe(false);
    expect(
      shape.aliases.safeParse(
        Array.from({ length: TERM_LIMITS.aliases }, () => 'a'),
      ).success,
    ).toBe(true);
    expect(
      shape.aliases.safeParse(
        Array.from({ length: TERM_LIMITS.aliases + 1 }, () => 'a'),
      ).success,
    ).toBe(false);
  });
});
