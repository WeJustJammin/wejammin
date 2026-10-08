import { describe, expect, it } from 'vitest';

import {
  RICH_TEXT_NOT_CANONICAL,
  RichTextV1Schema,
  validateRichTextV1,
} from './structured-values.ts';

/**
 * AC-084 "parity for typed errors" (lane EC R1, EVIDENCE GAP EC R1 084-a). PostgreSQL
 * `cms_rich_text_v1_valid` refuses a non-canonical value with the reason token
 * `rich_text_not_canonical` (the Worker publishes it as 422 `details.reasonCode`). The TypeScript
 * validator used to answer a boolean, so a caller could only tell "refused" and had to invent its own
 * code. `validateRichTextV1` answers the SAME token. The shapes below are the ones evidence lane EC
 * drove through the real Worker -> PostgREST -> SQL path (tests/postgrest/
 * phase-02-slice-10-ev-ec-r1-typed-values.apispec.ts, BAD_RICH_TEXT), so a shape SQL refuses with
 * `rich_text_not_canonical` is refused here with that token, and the verdicts agree both ways.
 */

type Json = unknown;

const richText = (text: string, extra: Record<string, Json> = {}): Json => ({
  format: 'rich_text.v1',
  blocks: [{ type: 'paragraph', spans: [{ text, marks: [], ...extra }] }],
});

const BAD_RICH_TEXT: ReadonlyArray<readonly [string, Json]> = [
  ['a raw HTML string', '<script>alert(1)</script>'],
  [
    'a typed raw-HTML block',
    { format: 'rich_text.v1', blocks: [{ type: 'html', html: '<b>x</b>' }] },
  ],
  [
    'an inline embed span',
    richText('x', {
      embed: { kind: 'image', src: 'https://example.com/a.png' },
    }),
  ],
  [
    'an embed link kind',
    richText('x', { link: { kind: 'embed', href: 'https://example.com' } }),
  ],
  [
    'a javascript: link',
    richText('x', { link: { kind: 'https', href: 'javascript:alert(1)' } }),
  ],
  [
    'a data: link',
    richText('x', { link: { kind: 'https', href: 'data:text/html,<b>x</b>' } }),
  ],
  [
    'a protocol-relative internal route',
    richText('x', { link: { kind: 'internal', route: '//evil.example' } }),
  ],
  [
    'adjacent spans with equal marks',
    {
      format: 'rich_text.v1',
      blocks: [
        {
          type: 'paragraph',
          spans: [
            { text: 'a', marks: [] },
            { text: 'b', marks: [] },
          ],
        },
      ],
    },
  ],
  ['an unknown mark', richText('x', { marks: ['underline'] })],
  [
    'heading level 1',
    {
      format: 'rich_text.v1',
      blocks: [
        { type: 'heading', level: 1, spans: [{ text: 'x', marks: [] }] },
      ],
    },
  ],
  [
    'an unknown top-level key',
    {
      format: 'rich_text.v1',
      blocks: [{ type: 'paragraph', spans: [] }],
      extra: 1,
    },
  ],
  ['null', null],
  ['a number', 7],
];

const GOOD_RICH_TEXT: ReadonlyArray<readonly [string, Json]> = [
  ['one plain paragraph', richText('Hello')],
  [
    'an empty paragraph',
    { format: 'rich_text.v1', blocks: [{ type: 'paragraph', spans: [] }] },
  ],
  [
    'marks and a safe link',
    richText('x', {
      marks: ['bold', 'code'],
      link: { kind: 'https', href: 'https://example.com/a' },
    }),
  ],
];

describe('AC-084: the TypeScript validator answers the PostgreSQL reason token', () => {
  it('exports the token PostgreSQL emits', () => {
    expect(RICH_TEXT_NOT_CANONICAL).toBe('rich_text_not_canonical');
  });

  for (const [name, value] of BAD_RICH_TEXT)
    it(`${name} is refused with rich_text_not_canonical (the verdict of the schema and of SQL)`, () => {
      expect(RichTextV1Schema.safeParse(value).success).toBe(false);
      const verdict = validateRichTextV1(value);
      expect(verdict.ok).toBe(false);
      if (!verdict.ok) {
        expect(verdict.reason).toBe('rich_text_not_canonical');
        // Safe, bounded RFC 6901 pointers into the document; never a value.
        expect(verdict.pointers.length).toBeLessThanOrEqual(50);
        for (const pointer of verdict.pointers)
          expect(pointer).toMatch(/^(\/[A-Za-z0-9_~-]*)*$/u);
      }
    });

  for (const [name, value] of GOOD_RICH_TEXT)
    it(`${name} is accepted and returned unchanged`, () => {
      const verdict = validateRichTextV1(value);
      expect(verdict.ok).toBe(true);
      if (verdict.ok) expect(verdict.document).toEqual(value);
    });

  it('points at the first offending location without echoing text', () => {
    const verdict = validateRichTextV1(
      richText('secret words', { marks: ['underline'] }),
    );
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.pointers).toContain('/blocks/0/spans/0/marks/0');
      expect(JSON.stringify(verdict)).not.toContain('secret words');
    }
  });
});
