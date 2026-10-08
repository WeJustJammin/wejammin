import { describe, expect, it } from 'vitest';

import { RichTextV1Schema } from '@wejammin/contracts';

import { parseInlineMarkup } from './cms-rich-text-markup';

/**
 * The constrained inline markup (FE03 CmsRichTextEditor row) is a view of the
 * canonical rich_text.v1 spans. Admission of a link target must be exactly the
 * shared schema's: lengths count Unicode characters (Codex review s10-ts-2, L1).
 */
describe('[P2-S10] rich_text markup link admission matches the shared schema', () => {
  it('L1: admits a mailto address of 202 characters (402 UTF-16 units), as the shared schema does', () => {
    const address = '\u{1F600}'.repeat(200) + '@x';
    const parsed = parseInlineMarkup(`[mail](mailto:${address})`);
    expect(parsed).toEqual({
      ok: true,
      spans: [{ text: 'mail', marks: [], link: { kind: 'mailto', address } }],
    });
    expect(
      RichTextV1Schema.safeParse({
        format: 'rich_text.v1',
        blocks: [
          {
            type: 'paragraph',
            spans: parsed.ok ? parsed.spans : [],
          },
        ],
      }).success,
    ).toBe(true);
  });

  it('L1: refuses a mailto address of 255 characters, as the shared schema does', () => {
    const address = '\u{1F600}'.repeat(253) + '@x';
    expect(parseInlineMarkup(`[mail](mailto:${address})`)).toEqual({
      ok: false,
      error: {
        code: 'rich_text_unsafe_link',
        detail: `mailto:${address}`,
      },
    });
  });
});
