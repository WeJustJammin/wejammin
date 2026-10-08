import {
  type RichTextLink,
  type RichTextMark,
  type RichTextSpan,
} from './cms-rich-text-contracts';
import { hrefOfLink } from './cms-rich-text-links';
import {
  DESTINATION_SPECIALS,
  TEXT_SPECIALS,
  escapedLength,
  tokenize,
  type InlineError,
  type MarkupToken,
} from './cms-rich-text-tokens';

export { inlineError, markupCharRanges } from './cms-rich-text-tokens';
export type { InlineError, MarkupCharRange } from './cms-rich-text-tokens';

/**
 * Constrained inline markup for the DEC-112 rich_text.v1 editor
 * (.memory/wiki/specs/fe/03-cms-content-modeling.md, CmsRichTextEditor row), a
 * LOSSLESS view of the canonical spans (Codex review s10-ts-2, H3):
 *
 * - `**` toggles bold, `_` toggles italic, a backtick toggles code. A toggle
 *   stays on until its closing marker (or the end of the block), and toggles
 *   apply to link text too, whether opened outside or inside the label.
 * - `[label](destination)` is a link. The destination may hold balanced
 *   parentheses; an unsafe scheme is refused naming the destination.
 * - A backslash makes the next special character literal. The specials are
 *   `\`, `*`, `_`, `[`, `]` and the backtick in text, and `\`, `(` and `)` in a
 *   destination; a backslash before anything else is a literal backslash.
 *
 * `serializeSpans` escapes exactly those characters, so for every canonical span
 * list `parseInlineMarkup(serializeSpans(spans))` is the same spans, byte for
 * byte. Non-canonical input is refused as rich_text_not_canonical; the shared
 * span schema stays the final authority and nothing here widens it.
 */

export type InlineParse =
  | { readonly ok: true; readonly spans: readonly RichTextSpan[] }
  | { readonly ok: false; readonly error: InlineError };

/** Canonical mark order: bold, then italic, then code. */
const MARK_ORDER: readonly RichTextMark[] = ['bold', 'italic', 'code'];
export const sortMarks = (marks: Iterable<RichTextMark>): RichTextMark[] =>
  [...marks].sort(
    (left, right) => MARK_ORDER.indexOf(left) - MARK_ORDER.indexOf(right),
  );

export const sameLink = (
  left: RichTextSpan['link'],
  right: RichTextSpan['link'],
): boolean => JSON.stringify(left ?? null) === JSON.stringify(right ?? null);

/** Append a run, merging it into the previous span when marks and link match. */
export const pushRun = (
  spans: RichTextSpan[],
  text: string,
  marks: readonly RichTextMark[],
  link: RichTextLink | undefined,
): void => {
  if (text.length === 0) return;
  const previous = spans[spans.length - 1];
  if (
    previous !== undefined &&
    sameLink(previous.link, link) &&
    previous.marks.length === marks.length &&
    previous.marks.every((mark, index) => mark === marks[index])
  ) {
    spans[spans.length - 1] = { ...previous, text: previous.text + text };
    return;
  }
  spans.push({
    text,
    marks: [...marks],
    ...(link === undefined ? {} : { link }),
  });
};

/** Pass 2 turns a token's source into runs under the toggles active so far. */
const applyMarks = (
  source: string,
  active: Set<RichTextMark>,
  link: RichTextLink | undefined,
  spans: RichTextSpan[],
): void => {
  let buffer = '';
  const flush = (): void => {
    pushRun(spans, buffer, sortMarks(active), link);
    buffer = '';
  };
  const toggle = (mark: RichTextMark): void => {
    flush();
    if (active.has(mark)) active.delete(mark);
    else active.add(mark);
  };
  for (let at = 0; at < source.length;) {
    const step = escapedLength(source, at, TEXT_SPECIALS);
    const char = source[at]!;
    if (step === 2) {
      buffer += source[at + 1]!;
      at += 2;
    } else if (char === '`') {
      toggle('code');
      at += 1;
    } else if (char === '*' && source[at + 1] === '*') {
      toggle('bold');
      at += 2;
    } else if (char === '_') {
      toggle('italic');
      at += 1;
    } else {
      buffer += char;
      at += 1;
    }
  }
  flush();
};

/**
 * The constrained markup parser. Every token becomes canonical spans; adjacent
 * spans with equal marks and link are merged and empty runs are dropped.
 */
export const parseInlineMarkup = (source: string): InlineParse => {
  const tokens = tokenize(source);
  if (!Array.isArray(tokens))
    return { ok: false, error: tokens as InlineError };
  const spans: RichTextSpan[] = [];
  const active = new Set<RichTextMark>();
  for (const token of tokens as readonly MarkupToken[])
    applyMarks(
      token.source,
      active,
      token.kind === 'link' ? token.link : undefined,
      spans,
    );
  return { ok: true, spans };
};

const escape = (text: string, specials: ReadonlySet<string>): string =>
  Array.from(text, (char) => (specials.has(char) ? '\\' + char : char)).join(
    '',
  );

const MARK_MARKER: Readonly<Record<RichTextMark, string>> = {
  bold: '**',
  italic: '_',
  code: '`',
};

/**
 * Serialize canonical spans to the markup subset: a marker is written only
 * where a mark switches on or off between neighbours (and closed at the end of
 * the block), text and destinations are escaped, so nothing a reader typed as
 * prose can be mistaken for markup when it is parsed back.
 */
export const serializeSpans = (spans: readonly RichTextSpan[]): string => {
  let out = '';
  let active: readonly RichTextMark[] = [];
  const switchTo = (next: readonly RichTextMark[]): void => {
    for (const mark of MARK_ORDER)
      if (active.includes(mark) !== next.includes(mark))
        out += MARK_MARKER[mark];
    active = next;
  };
  for (const span of spans) {
    switchTo(span.marks);
    const text = escape(span.text, TEXT_SPECIALS);
    out +=
      span.link === undefined
        ? text
        : '[' +
          text +
          '](' +
          escape(hrefOfLink(span.link), DESTINATION_SPECIALS) +
          ')';
  }
  switchTo([]);
  return out;
};

/** Serialize one span (kept for callers that build markup span by span). */
export const serializeSpan = (span: RichTextSpan): string =>
  serializeSpans([span]);
