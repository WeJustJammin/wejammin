/**
 * The term grammar of CMS-03C-03 (BE03c 380), written out so the browser checks a term
 * without loading zod (FE03 AC261). `term-rules.test.ts` proves each rule equals the
 * generated contract: the key grammar, the locale grammar, the NFC label (1 to 160 UTF-16
 * code units), the alias (1 to 160) and the list limits.
 */
export const TERM_KEY_REGEX = /^[a-z][a-z0-9-]{1,63}$/u;
const LOCALE_REGEX = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/u;

export const LABEL_MAX_CHARACTERS = 160;
export const ALIAS_MAX_CHARACTERS = 160;
export const TERM_LIMITS = { labels: 64, aliases: 64 } as const;

export const isLocale = (value: string): boolean => LOCALE_REGEX.test(value);

/** A label is 1 to 160 characters and already NFC. */
export const isTermLabelText = (value: string): boolean =>
  value.length >= 1 &&
  value.length <= LABEL_MAX_CHARACTERS &&
  value.normalize('NFC') === value;

export const isTermAlias = (value: string): boolean =>
  value.length >= 1 && value.length <= ALIAS_MAX_CHARACTERS;
