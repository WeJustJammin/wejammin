/**
 * BE03a "Locale configuration (OD-4)". Every message below is an exact,
 * client-visible 422 `ApiError.details[].message` string; never reword one
 * without changing the spec table and the database validator together.
 */
export const LOCALE_CONFIG_MESSAGES = {
  size: 'supportedLocales must contain 1 to 32 locales',
  canonical: 'locale tag must be a canonical-case BCP 47 tag',
  unique: 'supportedLocales must be unique',
  missingSource: 'supportedLocales must include sourceLocale',
  missingDefault: 'supportedLocales must include defaultLocale',
  chainKeyUnsupported: 'fallbackChains key must be a supported locale',
  chainForDefault: 'defaultLocale must not have a fallback chain',
  chainMissing:
    'every supported locale other than defaultLocale needs a fallback chain',
  chainSize: 'fallback chain must contain 1 to 16 locales',
  chainUnsupported: 'fallback chain locale must be a supported locale',
  chainUnique: 'fallback chain locales must be unique',
  chainSelf: 'fallback chain must not include its own target locale',
  chainEnd: 'fallback chain must end at defaultLocale',
  chainCycle: 'fallback chains must not form a cycle',
  pair: 'supportedLocales and fallbackChains must be both null or both present',
} as const;

export const LOCALE_CONFIG_LIMITS = {
  minTagLength: 2,
  maxTagLength: 35,
  maxSupportedLocales: 32,
  maxChainLength: 16,
} as const;

export const BCP47_SHAPE = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/u;
const ALPHA = /^[A-Za-z]+$/u;
const DIGITS = /^[0-9]+$/u;

type Position = 'language' | 'script' | 'region' | 'rest';

const titleCase = (value: string): string =>
  `${value.slice(0, 1).toUpperCase()}${value.slice(1).toLowerCase()}`;

/**
 * Pure, code-owned canonical-case mapper: language lower-case, a four-letter
 * script Title-case, a two-letter or three-digit region upper-case, and every
 * other subtag (variant, extension, private use) lower-case. A tag is
 * canonical when `canonicalizeBcp47(tag) === tag` and it has the BCP 47 shape.
 */
export const canonicalizeBcp47 = (tag: string): string => {
  const [language = '', ...subtags] = tag.split('-');
  const output = [language.toLowerCase()];
  let position: Position = 'language';
  for (const subtag of subtags) {
    if (position === 'rest' || subtag.length === 1) {
      position = 'rest';
      output.push(subtag.toLowerCase());
    } else if (
      position === 'language' &&
      subtag.length === 4 &&
      ALPHA.test(subtag)
    ) {
      position = 'script';
      output.push(titleCase(subtag));
    } else if (
      (position === 'language' || position === 'script') &&
      ((subtag.length === 2 && ALPHA.test(subtag)) ||
        (subtag.length === 3 && DIGITS.test(subtag)))
    ) {
      position = 'region';
      output.push(subtag.toUpperCase());
    } else {
      if (!(
        position === 'language' &&
        subtag.length === 3 &&
        ALPHA.test(subtag)
      ))
        position = 'rest';
      output.push(subtag.toLowerCase());
    }
  }
  return output.join('-');
};

export const isCanonicalLocale = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length >= LOCALE_CONFIG_LIMITS.minTagLength &&
  value.length <= LOCALE_CONFIG_LIMITS.maxTagLength &&
  BCP47_SHAPE.test(value) &&
  canonicalizeBcp47(value) === value;
