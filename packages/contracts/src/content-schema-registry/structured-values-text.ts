/**
 * The one well-formed-Unicode predicate for every authored string a CMS command
 * persists (rich-text span text and link targets, object scalar and enum
 * strings, enum members).
 *
 * Every command argument reaches PostgreSQL as `jsonb`. The `jsonb` input
 * lexer (`json_lex_string`) refuses the escape `\u0000` ("unsupported Unicode
 * escape sequence", SQLSTATE 22P05: a `text` value can never hold a NUL) and any
 * unpaired surrogate escape ("Unicode low surrogate must follow a high
 * surrogate" / "Unicode high surrogate must not follow a high surrogate",
 * SQLSTATE 22P02). `JSON.stringify` writes a lone surrogate as a `\udXXX`
 * escape, which is exactly the form PostgreSQL refuses, so a value that fails
 * this predicate is rejected here, before any RPC, as a validation error rather
 * than reaching the database and failing as an unexplained 5xx.
 *
 * A well-formed surrogate PAIR (any astral character) is ordinary Unicode and is
 * accepted; with the `u` flag `\p{Cs}` matches only a surrogate that is not part
 * of a valid pair.
 */
const LONE_SURROGATE_PATTERN = /\p{Cs}/u;

export const isWellFormedAuthoredString = (value: string): boolean =>
  !value.includes('\u0000') && !LONE_SURROGATE_PATTERN.test(value);
