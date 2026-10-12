import {
  RICH_TEXT_MARKS,
  isRichTextDocument,
  isRichTextLink,
  type RichTextBlock,
  type RichTextLink,
  type RichTextMark,
  type RichTextSpan,
  type RichTextV1Document,
} from '@wejammin/contracts/client';

/**
 * Browser projection of the locked DEC-112 rich_text.v1 grammar
 * (.memory/wiki/specs/be/03b-editorial-workflow-publication.md, "Rich text
 * fields (DEC-112)").
 *
 * There is exactly one grammar: the code-owned shared schemas in
 * packages/contracts/src/content-schema-registry/structured-values.ts, which
 * PostgreSQL `cms_rich_text_v1_valid` mirrors. The editors cannot ship zod
 * (FE03 "Performance budgets and loading strategy", AC-106), so they decide
 * with the zod-free walker of `structured-values-rules.ts`, whose leaf rules the
 * schemas import and whose verdicts `structured-values-rules.test.ts` proves
 * equal to the schemas' over a corpus and a mutation sweep. The editor, the
 * server and the database can therefore neither drift on a bound (lengths count
 * Unicode characters, not UTF-16 units) nor on what `jsonb` can store (no lone
 * surrogate, no NUL). Any change to the grammar is a locked-decision change made
 * in the shared rules first. `cms-rich-text-schemas.ts` keeps the zod schemas
 * for the parity tests.
 */

export { RICH_TEXT_MARKS };
export type {
  RichTextBlock,
  RichTextLink,
  RichTextMark,
  RichTextSpan,
  RichTextV1Document,
};

/**
 * True for the canonical rich_text.v1 block document. The shared grammar is the
 * final authority; the browser-side backslash guard stays as defence in depth
 * for an internal route, because a browser reads `/\host` as `//host`.
 */
export const isCanonicalRichText = (
  value: unknown,
): value is RichTextV1Document =>
  isRichTextDocument(value) &&
  value.blocks.every((block) =>
    block.spans.every(
      (span) =>
        !(span.link?.kind === 'internal' && /\\/u.test(span.link.route)),
    ),
  );

/** The link `value` is, when one of the three shared canonical variants accepts it. */
export const canonicalRichTextLink = (value: unknown): RichTextLink | null =>
  isRichTextLink(value) ? value : null;
