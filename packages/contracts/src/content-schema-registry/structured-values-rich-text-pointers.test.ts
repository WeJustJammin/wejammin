import { describe, expect, it } from 'vitest';

import {
  richTextTotalCharacters,
  validateRichTextV1,
} from './structured-values.ts';

const richText = (
  text: string,
  extra: Record<string, unknown> = {},
): unknown => ({
  format: 'rich_text.v1',
  blocks: [{ type: 'paragraph', spans: [{ text, marks: [], ...extra }] }],
});

describe('validateRichTextV1 pointer bounds and the character count of a refused document', () => {
  it('lists each offending location once, at most 50', () => {
    const blocks = Array.from({ length: 60 }, () => ({
      type: 'paragraph',
      spans: [{ text: 'x', marks: ['underline'] }],
    }));
    const verdict = validateRichTextV1({ format: 'rich_text.v1', blocks });
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.pointers).toHaveLength(50);
    expect(new Set(verdict.pointers).size).toBe(50);
  });

  it('collapses two refusals at the same location into one pointer', () => {
    // Decomposed (non-NFC) text with a control character fails two text rules at /blocks/0/spans/0/text.
    const verdict = validateRichTextV1(richText('e\u0301\u0001'));
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    const text = verdict.pointers.filter(
      (pointer) => pointer === '/blocks/0/spans/0/text',
    );
    expect(text).toHaveLength(1);
  });

  it('counts no characters in a document the grammar refuses', () => {
    expect(richTextTotalCharacters(richText('abc'))).toBe(3);
    expect(richTextTotalCharacters({ format: 'html', blocks: [] })).toBe(0);
    expect(richTextTotalCharacters('not a document')).toBe(0);
  });
});
