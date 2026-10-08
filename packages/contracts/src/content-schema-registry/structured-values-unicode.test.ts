import { describe, expect, it } from 'vitest';

import {
  ObjectPropertySchema,
  RichTextV1Schema,
  isObjectValueForStructure,
  isWellFormedAuthoredString,
  type ObjectStructure,
} from './structured-values.ts';

/**
 * Codex review s10-ts-2, finding M3 (PostgreSQL parity): every authored string
 * that is persisted through a `jsonb` column must be well-formed Unicode with no
 * NUL, or the browser/Worker accept a value that PostgreSQL then refuses.
 *
 * The PostgreSQL rule mirrored here is the `json_lex_string` rule of `jsonb`
 * input (the type every CMS command argument is cast to):
 *   - the escape `\u0000` is refused ("unsupported Unicode escape sequence",
 *     SQLSTATE 22P05), because a `text` value can never hold a NUL;
 *   - a high surrogate escape not followed by a low surrogate, or a low surrogate
 *     escape not preceded by a high surrogate, is refused ("Unicode low surrogate
 *     must follow a high surrogate" / "Unicode high surrogate must not follow a
 *     high surrogate", SQLSTATE 22P02).
 * `JSON.stringify` (well-formed since ES2019) serializes a lone surrogate as the
 * escape `\udXXX`, which is exactly the form PostgreSQL refuses, so a lone
 * surrogate is rejected on this side before any RPC is attempted.
 */

const LONE_SURROGATES: readonly string[] = [
  '\uD800',
  '\uDBFF',
  '\uDC00',
  '\uDFFF',
  'a\uD800b',
  '\uD800\uD800',
  '\uDC00\uD800',
  'tail\uD83D',
];
const NUL_STRINGS: readonly string[] = ['\u0000', 'a\u0000', '\u0000b'];
const WELL_FORMED: readonly string[] = [
  '',
  'plain',
  'café',
  '\u{1F600}',
  'a\u{1F600}b',
  '\u{10FFFF}',
  'line\nbreak',
];

const documentOf = (text: string): unknown => ({
  format: 'rich_text.v1',
  blocks: [{ type: 'paragraph', spans: [{ text, marks: [] }] }],
});

const linkDocument = (link: Record<string, unknown>): unknown => ({
  format: 'rich_text.v1',
  blocks: [{ type: 'paragraph', spans: [{ text: 'link', marks: [], link }] }],
});

const scalarStructure: ObjectStructure = {
  properties: [
    { key: 'label', kind: 'scalar', required: true, constraints: {} },
  ],
};

describe('M3: the well-formed authored-string predicate mirrors the PostgreSQL jsonb rule', () => {
  for (const value of WELL_FORMED)
    it(`accepts ${JSON.stringify(value)}`, () => {
      expect(isWellFormedAuthoredString(value)).toBe(true);
    });

  for (const value of [...LONE_SURROGATES, ...NUL_STRINGS])
    it(`refuses ${JSON.stringify(value)}`, () => {
      expect(isWellFormedAuthoredString(value)).toBe(false);
    });

  it('documents the wire form PostgreSQL refuses: a lone surrogate serializes as a \\udXXX escape', () => {
    expect(JSON.stringify('\uD800')).toBe('"\\ud800"');
    expect(JSON.stringify('\u0000')).toBe('"\\u0000"');
    expect(JSON.stringify('\u{1F600}')).toBe('"\u{1F600}"');
  });
});

describe('M3: rich_text.v1 refuses strings PostgreSQL cannot store', () => {
  it('accepts a span with an astral character (a valid surrogate pair)', () => {
    expect(RichTextV1Schema.safeParse(documentOf('hi \u{1F600}')).success).toBe(
      true,
    );
  });

  for (const text of LONE_SURROGATES)
    it(`refuses span text ${JSON.stringify(text)}`, () => {
      expect(RichTextV1Schema.safeParse(documentOf(text)).success).toBe(false);
    });

  for (const text of NUL_STRINGS)
    it(`refuses span text ${JSON.stringify(text)} (NUL)`, () => {
      expect(RichTextV1Schema.safeParse(documentOf(text)).success).toBe(false);
    });

  it('refuses a lone surrogate in an https href, a mailto address and an internal route', () => {
    expect(
      RichTextV1Schema.safeParse(
        linkDocument({ kind: 'https', href: 'https://example.com/\uD800' }),
      ).success,
    ).toBe(false);
    expect(
      RichTextV1Schema.safeParse(
        linkDocument({ kind: 'mailto', address: 'a\uDC00@example.com' }),
      ).success,
    ).toBe(false);
    expect(
      RichTextV1Schema.safeParse(
        linkDocument({ kind: 'internal', route: '/path/\uD83D' }),
      ).success,
    ).toBe(false);
  });

  it('still accepts the same links with well-formed astral characters', () => {
    expect(
      RichTextV1Schema.safeParse(
        linkDocument({ kind: 'https', href: 'https://example.com/\u{1F600}' }),
      ).success,
    ).toBe(true);
    expect(
      RichTextV1Schema.safeParse(
        linkDocument({ kind: 'mailto', address: 'a\u{1F600}@example.com' }),
      ).success,
    ).toBe(true);
    expect(
      RichTextV1Schema.safeParse(
        linkDocument({ kind: 'internal', route: '/path/\u{1F600}' }),
      ).success,
    ).toBe(true);
  });
});

describe('M3: object property values refuse strings PostgreSQL cannot store', () => {
  it('accepts a well-formed scalar string', () => {
    expect(
      isObjectValueForStructure(scalarStructure, { label: 'ok \u{1F600}' }),
    ).toBe(true);
  });

  for (const label of [...LONE_SURROGATES, ...NUL_STRINGS])
    it(`refuses scalar string ${JSON.stringify(label)}`, () => {
      expect(isObjectValueForStructure(scalarStructure, { label })).toBe(false);
    });

  it('refuses an enum value (and a declared enum member) that is not well-formed Unicode', () => {
    for (const member of ['\uD800', 'a\u0000']) {
      const structure: ObjectStructure = {
        properties: [
          {
            key: 'tone',
            kind: 'enum',
            required: true,
            constraints: { enumValues: [member] },
          },
        ],
      };
      // Independent of the definition: the value itself is never persisted.
      expect(isObjectValueForStructure(structure, { tone: member })).toBe(
        false,
      );
      // And the definition is refused before it can freeze such a member.
      expect(
        ObjectPropertySchema.safeParse(structure.properties[0]).success,
      ).toBe(false);
    }
  });

  it('refuses a rich_text property whose span text is not well-formed Unicode', () => {
    const structure: ObjectStructure = {
      properties: [
        { key: 'body', kind: 'rich_text', required: true, constraints: {} },
      ],
    };
    expect(
      isObjectValueForStructure(structure, { body: documentOf('ok') }),
    ).toBe(true);
    expect(
      isObjectValueForStructure(structure, { body: documentOf('\uD800') }),
    ).toBe(false);
  });
});
