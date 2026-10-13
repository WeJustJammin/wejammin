/** Shared text predicates and normalizers of the cms.a11y.structural rules. */

const NON_WHITESPACE = /\S/u;
const WHITESPACE_RUN = /\s+/gu;
const TRAILING_CHARACTER = /^[\s\p{P}]$/u;
const MAX_BMP_CODE_POINT = 0xffff;

/** True when the text has at least one non-whitespace character (JavaScript `\s`, Unicode-aware). */
export const hasNonWhitespace = (text: string): boolean =>
  NON_WHITESPACE.test(text);

/**
 * NFKC, lowercase, trim and whitespace collapse: the identity two pieces of
 * text are compared by (accessible names, link text against its target).
 */
export const normalizeIdentity = (text: string): string =>
  text.normalize('NFKC').toLowerCase().replace(WHITESPACE_RUN, ' ').trim();

/**
 * Walks back from the end one code point at a time, so the cost is the length
 * of the trailing run. The obvious `/[\s\p{P}]+$/` backtracks quadratically on
 * a long punctuation run, and author text may be up to 10,000 characters per span.
 */
const withoutTrailingPunctuation = (text: string): string => {
  let end = text.length;
  while (end > 0) {
    const width =
      end > 1 && (text.codePointAt(end - 2) as number) > MAX_BMP_CODE_POINT
        ? 2
        : 1;
    if (!TRAILING_CHARACTER.test(text.slice(end - width, end))) break;
    end -= width;
  }
  return text.slice(0, end);
};

/**
 * BE05c link-text normalization: NFKC, lowercase, trim, whitespace collapse and
 * removal of trailing punctuation (Unicode general category P, with the
 * whitespace around it).
 */
export const normalizeLinkText = (text: string): string =>
  withoutTrailingPunctuation(normalizeIdentity(text));

/** The primary language of a BCP 47 locale: the lowercase first subtag. */
export const primaryLanguageOf = (locale: string): string => {
  const separator = locale.indexOf('-');
  return (separator === -1 ? locale : locale.slice(0, separator)).toLowerCase();
};

/**
 * Version 1 generic-phrase lists, keyed by primary language. `en` is the only
 * list; an absent language yields the `link.text_unchecked_language` warning,
 * never silence. A Map keeps the lookup free of prototype keys.
 */
const GENERIC_LINK_PHRASES: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  [
    'en',
    new Set([
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
    ]),
  ],
]);

export const genericLinkPhrases = (
  language: string,
): ReadonlySet<string> | undefined => GENERIC_LINK_PHRASES.get(language);
