import type {
  RichTextLink,
  RichTextMark,
  RichTextSpan,
} from './cms-rich-text-contracts';
import { linkFromHref } from './cms-rich-text-links';
import {
  inlineError,
  markupCharRanges,
  parseInlineMarkup,
  pushRun,
  serializeSpans,
  sameLink,
  sortMarks,
  type InlineError,
} from './cms-rich-text-markup';

/**
 * The semantic mark and link controls of the constrained editor (AC-086). A
 * control acts on the author's selection in a block's markup, but never by
 * splicing marker characters: the selection is mapped to the TEXT it covers, the
 * mark or link is applied to exactly that text range of the canonical spans, and
 * the block is serialized back to the lossless markup. A control can therefore
 * never produce markup the parser reads differently, never changes the text, and
 * the author never sees or types JSON or HTML.
 */

export interface MarkupSelection {
  readonly start: number;
  readonly end: number;
}

export type FormatResult =
  | {
      readonly ok: true;
      readonly markup: string;
      /** The same text, selected again in the new markup. */
      readonly selection: MarkupSelection;
    }
  | { readonly ok: false; readonly error: InlineError };

export interface SelectionFormat {
  /** Marks every selected character has. */
  readonly marks: readonly RichTextMark[];
  /** The link every selected character shares, else null. */
  readonly link: RichTextLink | null;
}

interface Piece {
  readonly from: number;
  readonly to: number;
  readonly span: RichTextSpan;
}

const SELECTION_EMPTY = inlineError('rich_text_selection_empty');

/** Text offsets of a markup selection (end exclusive), or null if not canonical. */
const textRange = (
  markup: string,
  selection: MarkupSelection,
): { readonly from: number; readonly to: number } | null => {
  const ranges = markupCharRanges(markup);
  if (ranges === null) return null;
  // A character is selected when its markup range lies inside the selection.
  const from = ranges.findIndex((range) => range.start >= selection.start);
  const after = ranges.findIndex((range) => range.end > selection.end);
  const start = from === -1 ? ranges.length : from;
  const end = after === -1 ? ranges.length : after;
  return { from: start, to: Math.max(start, end) };
};

const isHigh = (code: number): boolean => code >= 0xd800 && code <= 0xdbff;
const isLow = (code: number): boolean => code >= 0xdc00 && code <= 0xdfff;

/**
 * Widens a text range to whole characters: a selection that starts or ends
 * between the two UTF-16 halves of an astral character (a programmatic or IME
 * selection) takes the whole character, so a rebuilt span never holds a lone
 * surrogate.
 */
const wholeCharacters = (
  spans: readonly RichTextSpan[],
  range: { readonly from: number; readonly to: number },
): { readonly from: number; readonly to: number } => {
  const text = spans.map((span) => span.text).join('');
  let { from, to } = range;
  if (
    from > 0 &&
    isLow(text.charCodeAt(from)) &&
    isHigh(text.charCodeAt(from - 1))
  )
    from -= 1;
  if (
    to > 0 &&
    to < text.length &&
    isHigh(text.charCodeAt(to - 1)) &&
    isLow(text.charCodeAt(to))
  )
    to += 1;
  return { from, to };
};

/** Splits spans into pieces with their text offsets. */
const pieces = (spans: readonly RichTextSpan[]): Piece[] => {
  const out: Piece[] = [];
  let offset = 0;
  for (const span of spans) {
    out.push({ from: offset, to: offset + span.text.length, span });
    offset += span.text.length;
  }
  return out;
};

/** Rebuilds canonical spans from `[from, to, mapped span]` runs. */
const rebuild = (
  spans: readonly RichTextSpan[],
  from: number,
  to: number,
  change: (span: RichTextSpan) => {
    readonly marks: readonly RichTextMark[];
    readonly link: RichTextLink | undefined;
  },
): RichTextSpan[] => {
  const next: RichTextSpan[] = [];
  for (const piece of pieces(spans)) {
    const cuts = [piece.from, from, to, piece.to]
      .filter((offset) => offset >= piece.from && offset <= piece.to)
      .sort((a, b) => a - b);
    for (let index = 0; index + 1 < cuts.length; index += 1) {
      const a = cuts[index]!;
      const b = cuts[index + 1]!;
      if (a === b) continue;
      const text = piece.span.text.slice(a - piece.from, b - piece.from);
      const inside = a >= from && b <= to;
      const changed = inside
        ? change(piece.span)
        : { marks: piece.span.marks, link: piece.span.link };
      pushRun(next, text, sortMarks(changed.marks), changed.link);
    }
  }
  return next;
};

const selectionOfText = (
  markup: string,
  from: number,
  to: number,
): MarkupSelection => {
  const ranges = markupCharRanges(markup) ?? [];
  const start = ranges[from]?.start ?? markup.length;
  const end = to > from ? (ranges[to - 1]?.end ?? markup.length) : start;
  return { start, end };
};

const parsed = (markup: string) => {
  const result = parseInlineMarkup(markup);
  return result.ok ? result.spans : null;
};

const apply = (
  markup: string,
  selection: MarkupSelection,
  change: (
    spans: readonly RichTextSpan[],
    from: number,
    to: number,
  ) => RichTextSpan[],
): FormatResult => {
  const spans = parsed(markup);
  const found = textRange(markup, selection);
  if (spans === null || found === null)
    return { ok: false, error: inlineError('rich_text_not_canonical') };
  if (found.to <= found.from) return { ok: false, error: SELECTION_EMPTY };
  const range = wholeCharacters(spans, found);
  const next = serializeSpans(change(spans, range.from, range.to));
  return {
    ok: true,
    markup: next,
    selection: selectionOfText(next, range.from, range.to),
  };
};

/** Turns one mark on for the whole selection, or off when all of it has it. */
export const toggleMarkInMarkup = (
  markup: string,
  selection: MarkupSelection,
  mark: RichTextMark,
): FormatResult =>
  apply(markup, selection, (spans, from, to) => {
    const covered = pieces(spans).filter(
      (piece) => piece.to > from && piece.from < to,
    );
    const allHave =
      covered.length > 0 &&
      covered.every((piece) => piece.span.marks.includes(mark));
    return rebuild(spans, from, to, (span) => ({
      marks: allHave
        ? span.marks.filter((existing) => existing !== mark)
        : [...new Set([...span.marks, mark])],
      link: span.link,
    }));
  });

/**
 * Links the selected text with `href` (https, mailto or an in-app route), or
 * removes the link when `href` is null. The address is validated with the one
 * shared link grammar; an unsafe or malformed address is refused naming it.
 */
export const setLinkInMarkup = (
  markup: string,
  selection: MarkupSelection,
  href: string | null,
): FormatResult => {
  let link: RichTextLink | undefined;
  if (href !== null) {
    const address = href.trim();
    if (address.length === 0)
      return { ok: false, error: inlineError('rich_text_link_empty') };
    const found = linkFromHref(address);
    if (found === null)
      return {
        ok: false,
        error: inlineError('rich_text_unsafe_link', href),
      };
    link = found;
  }
  return apply(markup, selection, (spans, from, to) =>
    rebuild(spans, from, to, (span) => ({ marks: span.marks, link })),
  );
};

/** The marks and link the selection (or the caret's character) carries. */
export const formatAtSelection = (
  markup: string,
  selection: MarkupSelection,
): SelectionFormat => {
  const none: SelectionFormat = { marks: [], link: null };
  const spans = parsed(markup);
  const found = textRange(markup, selection);
  if (spans === null || found === null) return none;
  const range = wholeCharacters(spans, found);
  const probe =
    range.to > range.from
      ? { from: range.from, to: range.to }
      : { from: range.from, to: range.from + 1 };
  const covered = pieces(spans).filter(
    (piece) => piece.to > probe.from && piece.from < probe.to,
  );
  if (covered.length === 0) return none;
  const marks = (['bold', 'italic', 'code'] as const).filter((mark) =>
    covered.every((piece) => piece.span.marks.includes(mark)),
  );
  const first = covered[0]!.span.link;
  const shared =
    first !== undefined &&
    covered.every((piece) => sameLink(piece.span.link, first));
  return { marks, link: shared ? first : null };
};
