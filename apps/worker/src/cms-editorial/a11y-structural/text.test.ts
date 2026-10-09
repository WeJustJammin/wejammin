import { describe, expect, it } from 'vitest';

import {
  genericLinkPhrases,
  hasNonWhitespace,
  normalizeIdentity,
  normalizeLinkText,
  primaryLanguageOf,
} from './text';

describe('hasNonWhitespace', () => {
  it.each(['', ' ', '  　  ', '\n'])('is false for %j', (text) => {
    expect(hasNonWhitespace(text)).toBe(false);
  });

  it.each(['a', ' a ', '?', '​'])('is true for %j', (text) => {
    expect(hasNonWhitespace(text)).toBe(true);
  });
});

describe('normalizeLinkText (BE05c: NFKC, lowercase, trim, whitespace collapse, trailing punctuation)', () => {
  it.each([
    ['Click here', 'click here'],
    ['  Click   HERE!! ', 'click here'],
    ['ＣＬＩＣＫ ｈｅｒｅ', 'click here'],
    ['Read more…', 'read more'],
    ['learn  more', 'learn more'],
    ['More »', 'more'],
    ['here.)', 'here'],
    ['line\none', 'line one'],
    ['a . , ; !', 'a'],
    ['"Link"', '"link'],
    ['...', ''],
    ['', ''],
  ])('normalizes %j to %j', (input, expected) => {
    expect(normalizeLinkText(input)).toBe(expected);
  });
});

describe('normalizeLinkText: trailing punctuation removal', () => {
  it.each([
    ['click here\u{10100}', 'click here'],
    ['click here\u{10100}\u{10100}!', 'click here'],
    ['click here\u{1f3b8}', 'click here\u{1f3b8}'],
    ['\u{1f3b8}!', '\u{1f3b8}'],
    ['!', ''],
    ['\u{10100}', ''],
  ])('treats astral characters as whole code points: %j', (input, expected) => {
    expect(normalizeLinkText(input)).toBe(expected);
  });

  it('takes linear time on a long punctuation run (no ReDoS)', () => {
    const hostile = `a${'!'.repeat(100_000)}x`;
    const started = performance.now();
    expect(normalizeLinkText(hostile)).toBe(hostile);
    expect(normalizeLinkText(`${'!'.repeat(100_000)}`)).toBe('');
    expect(performance.now() - started).toBeLessThan(1_000);
  });
});

describe('normalizeIdentity (NFKC, lowercase, trim, whitespace collapse)', () => {
  it.each([
    ['  Main   Navigation ', 'main navigation'],
    ['Ｍａｉｎ', 'main'],
    ['Primary.', 'primary.'],
    ['', ''],
  ])('normalizes %j to %j', (input, expected) => {
    expect(normalizeIdentity(input)).toBe(expected);
  });
});

describe('primaryLanguageOf', () => {
  it.each([
    ['en', 'en'],
    ['en-US', 'en'],
    ['DE', 'de'],
    ['zh-Hant-TW', 'zh'],
    ['Fr-ca', 'fr'],
  ])('reads the lowercase first subtag of %s', (locale, expected) => {
    expect(primaryLanguageOf(locale)).toBe(expected);
  });
});

describe('genericLinkPhrases (version 1)', () => {
  it('lists exactly the ten English phrases', () => {
    expect([...(genericLinkPhrases('en') ?? [])].sort()).toEqual(
      [
        'click here',
        'click',
        'here',
        'more',
        'read more',
        'learn more',
        'link',
        'this link',
        'this page',
        'tap here',
      ].sort(),
    );
  });

  it.each(['de', 'fr', 'es', 'ja', 'constructor', 'tostring', '__proto__'])(
    'has no list for %s',
    (language) => {
      expect(genericLinkPhrases(language)).toBeUndefined();
    },
  );
});
