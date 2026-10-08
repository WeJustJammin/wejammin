import { describe, expect, it } from 'vitest';

import { RichTextV1Schema } from '@wejammin/contracts';

import {
  assembleRichTextDocument,
  toEditorBlocks,
} from './cms-rich-text-blocks';
import { parseInlineMarkup, serializeSpans } from './cms-rich-text-markup';
import {
  NASTY_TEXT_ALPHABET,
  jcs,
  randomDocument,
  randomSpans,
  seeded,
} from './cms-rich-text-roundtrip.test-support';

/**
 * Codex review s10-ts-2, H3: the editor keeps each block as markup text, so the
 * markup MUST be a lossless view of the canonical spans. Loading a valid
 * document and editing another block (or none) may never change a byte of the
 * canonical AST: `parse(serialize(spans))` is the identity, compared in JCS form.
 */

const paragraph = (...spans: unknown[]) => ({
  format: 'rich_text.v1',
  blocks: [{ type: 'paragraph', spans }],
});

const span = (
  text: string,
  marks: string[] = [],
  link?: Record<string, unknown>,
) => ({ text, marks, ...(link === undefined ? {} : { link }) });

const roundTrip = (document: unknown): unknown => {
  const assembled = assembleRichTextDocument(toEditorBlocks(document));
  expect(assembled.ok).toBe(true);
  return assembled.ok ? assembled.document : null;
};

describe('H3: literal markup characters survive the editor round trip', () => {
  const corpus: readonly {
    readonly name: string;
    readonly document: unknown;
  }[] = [
    {
      name: 'underscore inside a word (a_b)',
      document: paragraph(span('a_b')),
    },
    {
      name: 'snake_case_words',
      document: paragraph(span('use snake_case_names')),
    },
    { name: 'literal brackets', document: paragraph(span('see [1] and [2]')) },
    {
      name: 'literal backticks',
      document: paragraph(span('the \u0060x\u0060 flag')),
    },
    {
      name: 'literal double asterisks',
      document: paragraph(span('2**3 and **not bold**')),
    },
    { name: 'a single asterisk', document: paragraph(span('2 * 3 * 4')) },
    { name: 'backslashes', document: paragraph(span('C:\\path\\to\\file')) },
    {
      name: 'a backslash before a special',
      document: paragraph(span('\\*\\_\\[')),
    },
    { name: 'parentheses', document: paragraph(span('(see below) and f(x)')) },
    {
      name: 'a bracket pair then parentheses',
      document: paragraph(span('[a](b)')),
    },
    { name: 'a trailing backslash', document: paragraph(span('ends with \\')) },
    { name: 'only specials', document: paragraph(span('*_[]()\u0060\\')) },
    {
      name: 'newline and astral text',
      document: paragraph(span('line one\nline \u{1F600} two')),
    },
    {
      name: 'bold then plain then italic then bold-italic then code',
      document: paragraph(
        span('one ', ['bold']),
        span('two '),
        span('three ', ['italic']),
        span('four ', ['bold', 'italic']),
        span('five', ['code']),
      ),
    },
    {
      name: 'all three marks',
      document: paragraph(span('everything', ['bold', 'italic', 'code'])),
    },
    {
      name: 'marks around specials',
      document: paragraph(
        span('a_b*c', ['bold']),
        span('[x](y)', ['italic', 'code']),
      ),
    },
    {
      name: 'a link whose text has brackets and marks',
      document: paragraph(
        span('before '),
        span('see [1] _now_', ['bold'], {
          kind: 'https',
          href: 'https://example.com/a_b/(c)/d\\e*',
        }),
        span(' after'),
      ),
    },
    {
      name: 'adjacent links with different targets',
      document: paragraph(
        span('one', [], { kind: 'internal', route: '/a/(b)_c' }),
        span('two', [], { kind: 'mailto', address: 'a(b)@x.example' }),
      ),
    },
    {
      name: 'a link span next to a plain span with the same marks',
      document: paragraph(
        span('plain', ['bold']),
        span('linked', ['bold'], {
          kind: 'https',
          href: 'https://example.com/',
        }),
      ),
    },
  ];

  for (const { name, document } of corpus)
    it(`${name} round-trips byte-identically (JCS)`, () => {
      expect(RichTextV1Schema.safeParse(document).success).toBe(true);
      expect(jcs(roundTrip(document))).toBe(jcs(document));
    });

  it('parse(serialize(spans)) is the identity for 400 seeded random span lists', () => {
    const random = seeded(0x5eed);
    let checked = 0;
    for (let round = 0; round < 400; round += 1) {
      const spans = randomSpans(random);
      const parsed = parseInlineMarkup(serializeSpans(spans));
      expect(parsed.ok, JSON.stringify(spans)).toBe(true);
      if (parsed.ok)
        expect(jcs(parsed.spans), JSON.stringify(spans)).toBe(jcs(spans));
      checked += 1;
    }
    expect(checked).toBe(400);
  });

  it('assemble(hydrate(document)) is the identity for 300 seeded random documents', () => {
    const random = seeded(0xd0c5);
    let checked = 0;
    for (let round = 0; round < 600 && checked < 300; round += 1) {
      const document = randomDocument(random);
      if (document === null) continue;
      expect(jcs(roundTrip(document)), JSON.stringify(document)).toBe(
        jcs(document),
      );
      checked += 1;
    }
    expect(checked).toBe(300);
  });

  it('is stable for text the author types: parse, serialize, parse again gives the same spans', () => {
    const random = seeded(0xa11ce);
    const alphabet = [...NASTY_TEXT_ALPHABET, '*', '*', '_', '_', '\u0060'];
    let accepted = 0;
    for (let round = 0; round < 600; round += 1) {
      const typed = Array.from(
        { length: 1 + Math.floor(random() * 14) },
        () => alphabet[Math.floor(random() * alphabet.length)],
      ).join('');
      const first = parseInlineMarkup(typed);
      if (!first.ok) continue;
      accepted += 1;
      const second = parseInlineMarkup(serializeSpans(first.spans));
      expect(second.ok, typed).toBe(true);
      if (second.ok) expect(jcs(second.spans), typed).toBe(jcs(first.spans));
    }
    expect(accepted).toBeGreaterThan(100);
  });
});

describe('H3: the documented markup keeps its meaning', () => {
  it('**bold**, _italic_ and backtick code toggle their mark on and off', () => {
    expect(
      parseInlineMarkup('plain **bold** mid _it_ \u0060c\u0060 end'),
    ).toEqual({
      ok: true,
      spans: [
        { text: 'plain ', marks: [] },
        { text: 'bold', marks: ['bold'] },
        { text: ' mid ', marks: [] },
        { text: 'it', marks: ['italic'] },
        { text: ' ', marks: [] },
        { text: 'c', marks: ['code'] },
        { text: ' end', marks: [] },
      ],
    });
  });

  it('a backslash escapes a special character and nothing else', () => {
    expect(parseInlineMarkup('a\\_b \\*\\*x\\*\\* \\q \\\\')).toEqual({
      ok: true,
      spans: [{ text: 'a_b **x** \\q \\', marks: [] }],
    });
  });

  it('marks apply to link text, whether opened outside or inside the label', () => {
    const link = { kind: 'https', href: 'https://example.com/' };
    expect(
      parseInlineMarkup(
        '**[one](https://example.com/)** [**two**](https://example.com/)',
      ),
    ).toEqual({
      ok: true,
      spans: [
        { text: 'one', marks: ['bold'], link },
        { text: ' ', marks: [] },
        { text: 'two', marks: ['bold'], link },
      ],
    });
  });

  it('accepts parentheses in prose and refuses an unescaped stray bracket', () => {
    expect(parseInlineMarkup('(see below)')).toEqual({
      ok: true,
      spans: [{ text: '(see below)', marks: [] }],
    });
    expect(parseInlineMarkup('oops ] here')).toMatchObject({ ok: false });
    expect(parseInlineMarkup('oops [ here')).toMatchObject({ ok: false });
    expect(parseInlineMarkup('[label] (not a link)')).toMatchObject({
      ok: false,
    });
  });

  it('still names an unsafe destination, including nested parentheses', () => {
    expect(parseInlineMarkup('x [l](javascript:alert(1))')).toEqual({
      ok: false,
      error: { code: 'rich_text_unsafe_link', detail: 'javascript:alert(1)' },
    });
  });

  it('keeps a balanced parenthesised destination and unescapes an escaped one', () => {
    const wiki = 'https://en.wikipedia.org/wiki/Foo_(bar)';
    for (const typed of [
      `[w](${wiki})`,
      '[w](https://en.wikipedia.org/wiki/Foo_\\(bar\\))',
    ])
      expect(parseInlineMarkup(typed)).toEqual({
        ok: true,
        spans: [{ text: 'w', marks: [], link: { kind: 'https', href: wiki } }],
      });
  });
});
