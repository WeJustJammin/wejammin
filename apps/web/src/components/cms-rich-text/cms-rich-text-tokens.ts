import type { RichTextLink } from './cms-rich-text-contracts';
import { linkFromHref } from './cms-rich-text-links';

/**
 * Pass 1 of the constrained inline markup (see cms-rich-text-markup.ts for the
 * grammar): splitting a block into literal text and links, with the position of
 * every token's source in the whole markup, and the map from a markup position
 * to the character of text it renders.
 */

export const TEXT_SPECIALS = new Set(['\\', '*', '_', '[', ']', '`']);
export const DESTINATION_SPECIALS = new Set(['\\', '(', ')']);

export type InlineError = {
  readonly code: string;
  readonly detail: string | null;
};

export const inlineError = (code: string, detail?: string): InlineError => ({
  code,
  detail: detail ?? null,
});

const NOT_CANONICAL = inlineError('rich_text_not_canonical');

export type MarkupToken =
  | {
      readonly kind: 'text';
      readonly source: string;
      /** Where `source` starts in the whole markup. */
      readonly start: number;
    }
  | {
      readonly kind: 'link';
      readonly source: string;
      readonly start: number;
      readonly link: RichTextLink;
    };

/** Index after the character at `at`, or after the pair when it is an escape. */
export const escapedLength = (
  source: string,
  at: number,
  specials: ReadonlySet<string>,
): number =>
  source[at] === '\\' && specials.has(source[at + 1] ?? '') ? 2 : 1;

type LinkRead =
  { readonly end: number; readonly token: MarkupToken } | InlineError;

/** Reads `[label](destination)` starting at the `[` at `start`. */
const readLink = (source: string, start: number): LinkRead => {
  let at = start + 1;
  while (at < source.length && source[at] !== ']') {
    if (source[at] === '[') return NOT_CANONICAL;
    at += escapedLength(source, at, TEXT_SPECIALS);
  }
  const label = source.slice(start + 1, at);
  if (at >= source.length || label.length === 0) return NOT_CANONICAL;
  if (source[at + 1] !== '(') return NOT_CANONICAL;
  let depth = 0;
  let cursor = at + 2;
  let destination = '';
  for (;;) {
    if (cursor >= source.length) return NOT_CANONICAL;
    const step = escapedLength(source, cursor, DESTINATION_SPECIALS);
    const char = source[cursor + step - 1]!;
    if (step === 1 && char === ')') {
      if (depth === 0) break;
      depth -= 1;
    } else if (step === 1 && char === '(') {
      depth += 1;
    }
    destination += char;
    cursor += step;
  }
  if (destination.length === 0) return NOT_CANONICAL;
  const link = linkFromHref(destination);
  if (link === null) return inlineError('rich_text_unsafe_link', destination);
  return {
    end: cursor + 1,
    token: { kind: 'link', source: label, start: start + 1, link },
  };
};

/**
 * Pass 1 splits the block into literal text and links. An unescaped `[` must
 * open a well-formed link and an unescaped `]` outside one is refused, so a
 * typo never silently becomes literal text.
 */
export const tokenize = (
  source: string,
): readonly MarkupToken[] | InlineError => {
  const tokens: MarkupToken[] = [];
  let literal = '';
  let literalStart = 0;
  const flush = (): void => {
    if (literal.length > 0)
      tokens.push({ kind: 'text', source: literal, start: literalStart });
    literal = '';
  };
  for (let at = 0; at < source.length;) {
    const step = escapedLength(source, at, TEXT_SPECIALS);
    const char = source[at]!;
    if (step === 1 && char === ']') return NOT_CANONICAL;
    if (step === 1 && char === '[') {
      flush();
      const read = readLink(source, at);
      if ('code' in read) return read;
      tokens.push(read.token);
      at = read.end;
      continue;
    }
    if (literal.length === 0) literalStart = at;
    literal += source.slice(at, at + step);
    at += step;
  }
  flush();
  return tokens;
};

/** Where one character of the parsed TEXT sits in the markup that produced it. */
export interface MarkupCharRange {
  readonly start: number;
  readonly end: number;
}

/**
 * One range per UTF-16 unit of the text the markup renders: an escaped
 * character covers its backslash and the character, a plain one just itself;
 * toggles and link syntax (brackets, destination) cover nothing. This maps a
 * textarea selection to the text it selects, and back, without guessing from
 * marker characters. Null when the markup is not canonical.
 */
export const markupCharRanges = (source: string): MarkupCharRange[] | null => {
  const tokens = tokenize(source);
  if (!Array.isArray(tokens)) return null;
  const ranges: MarkupCharRange[] = [];
  for (const token of tokens as readonly MarkupToken[])
    for (let at = 0; at < token.source.length;) {
      const step = escapedLength(token.source, at, TEXT_SPECIALS);
      const char = token.source[at]!;
      const from = token.start + at;
      if (step === 2) {
        ranges.push({ start: from, end: from + 2 });
        at += 2;
      } else if (char === '\u0060' || char === '_') {
        at += 1;
      } else if (char === '*' && token.source[at + 1] === '*') {
        at += 2;
      } else {
        ranges.push({ start: from, end: from + 1 });
        at += 1;
      }
    }
  return ranges;
};
