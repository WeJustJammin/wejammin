import {
  RICH_TEXT_MARKS,
  RichTextLinkSchema,
  RichTextSpanSchema,
  RichTextV1Schema,
} from '@wejammin/contracts';
import type { z } from 'zod';

/**
 * Browser projection of the locked DEC-112 rich_text.v1 grammar
 * (.memory/wiki/specs/be/03b-editorial-workflow-publication.md, "Rich text
 * fields (DEC-112)").
 *
 * There is exactly one grammar: the code-owned shared schemas in
 * packages/contracts/src/content-schema-registry/structured-values.ts, which
 * PostgreSQL `cms_rich_text_v1_valid` mirrors. The span, link and document
 * schemas are re-exported here under the slice names and never redeclared, so
 * the editor, the server and the database can neither drift on a bound (lengths
 * count Unicode characters, not UTF-16 units) nor on what `jsonb` can store
 * (no lone surrogate, no NUL). Any change to the grammar is a locked-decision
 * change made in the shared schema first.
 */

export { RICH_TEXT_MARKS, RichTextLinkSchema, RichTextSpanSchema };

/**
 * The canonical rich_text.v1 block document. The shared schema is the final
 * authority; the browser-side backslash guard stays as defence in depth for an
 * internal route, because a browser reads `/\host` as `//host`.
 */
export const RichTextV1DocumentSchema = RichTextV1Schema.superRefine(
  (document, context) => {
    document.blocks.forEach((block, blockIndex) => {
      block.spans.forEach((span, spanIndex) => {
        if (span.link?.kind === 'internal' && /\\/u.test(span.link.route))
          context.addIssue({
            code: 'custom',
            path: ['blocks', blockIndex, 'spans', spanIndex, 'link', 'route'],
            message: 'route must not contain backslashes',
          });
      });
    });
  },
);

export type RichTextMark = (typeof RICH_TEXT_MARKS)[number];
export type RichTextLink = z.infer<typeof RichTextLinkSchema>;
export type RichTextSpan = z.infer<typeof RichTextSpanSchema>;
export type RichTextV1Document = z.infer<typeof RichTextV1DocumentSchema>;
