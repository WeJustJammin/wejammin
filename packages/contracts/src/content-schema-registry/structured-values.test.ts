import { describe, expect, it } from 'vitest';

import {
  CMS_RICH_TEXT_FORMATS,
  ObjectPropertyKindSchema,
  ObjectPropertySchema,
  ObjectStructureSchema,
  RichTextV1Schema,
  isRichTextV1,
} from './structured-values.ts';

/**
 * Phase 2 / slice 10 (BE03b content schema registry). The structured-value
 * grammar a registry definition stores on a scalar/enum/rich-text field: the
 * flat object-property structure and the 'rich_text.v1' block grammar. These
 * tests pin the exported contracts; the implementation follows the test.
 */

type Parseable = { safeParse: (value: unknown) => { success: boolean } };
const accepts = (schema: Parseable, value: unknown): boolean =>
  schema.safeParse(value).success;

const property = (
  over: Record<string, unknown> = {},
): Record<string, unknown> => ({
  key: 'title',
  kind: 'scalar',
  required: true,
  constraints: {},
  ...over,
});

const structure = (properties: unknown[]): Record<string, unknown> => ({
  properties,
});

const span = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  text: 'hello',
  marks: [],
  ...over,
});

const paragraph = (spans: unknown[]): Record<string, unknown> => ({
  type: 'paragraph',
  spans,
});

const heading = (
  level: unknown,
  spans: unknown[],
): Record<string, unknown> => ({
  type: 'heading',
  level,
  spans,
});

const quote = (spans: unknown[]): Record<string, unknown> => ({
  type: 'quote',
  spans,
});

const listItem = (
  list: unknown,
  depth: unknown,
  spans: unknown[],
): Record<string, unknown> => ({ type: 'list_item', list, depth, spans });

const document = (blocks: unknown[]): Record<string, unknown> => ({
  format: 'rich_text.v1',
  blocks,
});

const httpsLink = (href: unknown): Record<string, unknown> => ({
  kind: 'https',
  href,
});
const mailtoLink = (address: unknown): Record<string, unknown> => ({
  kind: 'mailto',
  address,
});
const internalLink = (route: unknown): Record<string, unknown> => ({
  kind: 'internal',
  route,
});

/** Alternating marks so no two adjacent spans are merge-equivalent. */
const distinctSpans = (count: number): Record<string, unknown>[] =>
  Array.from({ length: count }, (_unused, index) =>
    index % 2 === 0
      ? span({ text: 's' + index, marks: ['bold'] })
      : span({ text: 's' + index, marks: [] }),
  );

describe('[P2-S10] ObjectPropertyKindSchema exposes exactly scalar, enum, rich_text', () => {
  it('accepts the three scalar kinds', () => {
    for (const kind of ['scalar', 'enum', 'rich_text'])
      expect(accepts(ObjectPropertyKindSchema, kind), kind).toBe(true);
  });

  it('has no nested/object property kind', () => {
    for (const kind of ['object', 'nested', 'array', 'richText', 'Enum', ''])
      expect(accepts(ObjectPropertyKindSchema, kind), kind).toBe(false);
  });
});

describe('[P2-S10] ObjectPropertySchema', () => {
  it('accepts a minimal scalar property', () => {
    expect(accepts(ObjectPropertySchema, property())).toBe(true);
  });

  it('requires key, kind, required and constraints', () => {
    expect(
      accepts(ObjectPropertySchema, {
        kind: 'scalar',
        required: false,
        constraints: {},
      }),
    ).toBe(false);
    expect(
      accepts(ObjectPropertySchema, {
        key: 'title',
        required: false,
        constraints: {},
      }),
    ).toBe(false);
    expect(
      accepts(ObjectPropertySchema, {
        key: 'title',
        kind: 'scalar',
        constraints: {},
      }),
    ).toBe(false);
    expect(
      accepts(ObjectPropertySchema, {
        key: 'title',
        kind: 'scalar',
        required: true,
      }),
    ).toBe(false);
  });

  it('enforces the key grammar /^[a-z][a-z0-9_]{1,63}$/', () => {
    for (const key of ['ab', 'a1', 'release_note', 'a'.repeat(64)]) {
      expect(accepts(ObjectPropertySchema, property({ key })), key).toBe(true);
    }
    for (const key of [
      'a',
      'A',
      '1a',
      '_a',
      'a-b',
      'a.b',
      'a'.repeat(65),
      ' with space',
    ]) {
      expect(accepts(ObjectPropertySchema, property({ key })), key).toBe(false);
    }
  });

  it('requires a boolean required flag', () => {
    expect(accepts(ObjectPropertySchema, property({ required: false }))).toBe(
      true,
    );
    expect(accepts(ObjectPropertySchema, property({ required: true }))).toBe(
      true,
    );
    for (const required of ['true', 1, 0, null]) {
      expect(
        accepts(ObjectPropertySchema, property({ required })),
        String(required),
      ).toBe(false);
    }
  });

  it('closes the constraint vocabulary per property kind (DEC-144, not an open record)', () => {
    const scalar = (constraints: Record<string, unknown>): boolean =>
      accepts(ObjectPropertySchema, property({ constraints }));
    // scalar: minLength / maxLength / minimum / maximum only.
    expect(scalar({ minLength: 1, maxLength: 8 })).toBe(true);
    expect(scalar({ minimum: -5, maximum: 5.5 })).toBe(true);
    expect(scalar({ minimum: 8, maximum: 1 })).toBe(false);
    expect(scalar({ minLength: 9, maxLength: 3 })).toBe(false);
    expect(scalar({ pattern: 'x' })).toBe(false);
    expect(scalar({ nested: { a: [1, 2, null] } })).toBe(false);
    expect(scalar({ flag: true, count: 3 })).toBe(false);
    expect(scalar({ enumValues: ['a'] })).toBe(false);
    expect(scalar({ itemKind: 'short_text' })).toBe(false);
    // member types: lengths are integers in 0..100000, bounds are numbers.
    expect(scalar({ minLength: '1' })).toBe(false);
    expect(scalar({ minLength: -1 })).toBe(false);
    expect(scalar({ maxLength: 1.5 })).toBe(false);
    expect(scalar({ maxLength: 100_001 })).toBe(false);
    expect(scalar({ maxLength: 100_000 })).toBe(true);
    expect(scalar({ maximum: null })).toBe(false);
    expect(scalar({ minimum: '1' })).toBe(false);
    // rich_text: minLength / maxLength only.
    const richText = (constraints: Record<string, unknown>): boolean =>
      accepts(
        ObjectPropertySchema,
        property({ kind: 'rich_text', constraints }),
      );
    expect(richText({ minLength: 1, maxLength: 100 })).toBe(true);
    expect(richText({ minimum: 1 })).toBe(false);
    expect(richText({ enumValues: ['a'] })).toBe(false);
    expect(richText({ minLength: 5, maxLength: 1 })).toBe(false);
  });

  it('keeps constraint values inside the JSON value bound', () => {
    expect(
      accepts(
        ObjectPropertySchema,
        property({ constraints: { nan: Number.NaN } }),
      ),
    ).toBe(false);
    expect(
      accepts(
        ObjectPropertySchema,
        property({ constraints: { inf: Number.POSITIVE_INFINITY } }),
      ),
    ).toBe(false);
    expect(
      accepts(ObjectPropertySchema, property({ constraints: 'nope' })),
    ).toBe(false);
    expect(accepts(ObjectPropertySchema, property({ constraints: 7 }))).toBe(
      false,
    );
  });

  it('is strict about unknown property keys', () => {
    expect(accepts(ObjectPropertySchema, property({ nested: [] }))).toBe(false);
    expect(accepts(ObjectPropertySchema, property({ kind: 'object' }))).toBe(
      false,
    );
  });

  it('admits 1-256 enumValues of at most 160 characters, like PostgreSQL (DEC-144)', () => {
    const choices = (count: number, length = 3): string[] =>
      Array.from({ length: count }, (_unused, index) =>
        String(index).padStart(length, 'v'),
      );
    const enumProperty = (enumValues: unknown) =>
      property({ kind: 'enum', constraints: { enumValues } });
    expect(accepts(ObjectPropertySchema, enumProperty(choices(1)))).toBe(true);
    expect(accepts(ObjectPropertySchema, enumProperty(choices(256)))).toBe(
      true,
    );
    expect(accepts(ObjectPropertySchema, enumProperty(choices(257)))).toBe(
      false,
    );
    expect(accepts(ObjectPropertySchema, enumProperty(['x'.repeat(160)]))).toBe(
      true,
    );
    expect(accepts(ObjectPropertySchema, enumProperty(['x'.repeat(161)]))).toBe(
      false,
    );
    expect(
      accepts(ObjectPropertySchema, enumProperty(['\u{1F600}'.repeat(160)])),
    ).toBe(true);
  });

  it('requires a nonempty string enumValues list for an enum kind', () => {
    expect(
      accepts(
        ObjectPropertySchema,
        property({ kind: 'enum', constraints: { enumValues: ['a', 'b'] } }),
      ),
    ).toBe(true);
    expect(
      accepts(
        ObjectPropertySchema,
        property({
          kind: 'enum',
          constraints: { enumValues: ['a'], minLength: 1, maxLength: 4 },
        }),
      ),
    ).toBe(true);
    // DEC-144: an unknown member and a member of another kind are refused.
    expect(
      accepts(
        ObjectPropertySchema,
        property({
          kind: 'enum',
          constraints: { enumValues: ['a'], custom: { x: 1 } },
        }),
      ),
    ).toBe(false);
    expect(
      accepts(
        ObjectPropertySchema,
        property({
          kind: 'enum',
          constraints: { enumValues: ['a'], minimum: 1 },
        }),
      ),
    ).toBe(false);
    expect(
      accepts(
        ObjectPropertySchema,
        property({ kind: 'enum', constraints: {} }),
      ),
    ).toBe(false);
    expect(
      accepts(
        ObjectPropertySchema,
        property({ kind: 'enum', constraints: { enumValues: [] } }),
      ),
    ).toBe(false);
    expect(
      accepts(
        ObjectPropertySchema,
        property({ kind: 'enum', constraints: { enumValues: 'a' } }),
      ),
    ).toBe(false);
    expect(
      accepts(
        ObjectPropertySchema,
        property({ kind: 'enum', constraints: { enumValues: [1, 2] } }),
      ),
    ).toBe(false);
  });
});

describe('[P2-S10] ObjectStructureSchema', () => {
  it('accepts zero to 32 unique properties', () => {
    expect(accepts(ObjectStructureSchema, structure([]))).toBe(true);
    expect(accepts(ObjectStructureSchema, structure([property()]))).toBe(true);
    const many = Array.from({ length: 32 }, (_unused, index) =>
      property({ key: 'key_' + index }),
    );
    expect(accepts(ObjectStructureSchema, structure(many))).toBe(true);
  });

  it('rejects more than 32 properties', () => {
    const overflow = Array.from({ length: 33 }, (_unused, index) =>
      property({ key: 'key_' + index }),
    );
    expect(accepts(ObjectStructureSchema, structure(overflow))).toBe(false);
  });

  it('rejects a missing properties key', () => {
    expect(accepts(ObjectStructureSchema, {})).toBe(false);
  });

  it('rejects duplicate property keys', () => {
    expect(
      accepts(
        ObjectStructureSchema,
        structure([property({ key: 'ab' }), property({ key: 'ab' })]),
      ),
    ).toBe(false);
    expect(
      accepts(
        ObjectStructureSchema,
        structure([property({ key: 'ab' }), property({ key: 'ac' })]),
      ),
    ).toBe(true);
  });

  it('applies the enum-kind constraint to the structure', () => {
    expect(
      accepts(
        ObjectStructureSchema,
        structure([property({ kind: 'enum', constraints: {} })]),
      ),
    ).toBe(false);
    expect(
      accepts(
        ObjectStructureSchema,
        structure([
          property({ kind: 'enum', constraints: { enumValues: ['a'] } }),
        ]),
      ),
    ).toBe(true);
  });

  it('is strict about unknown structure keys', () => {
    expect(
      accepts(ObjectStructureSchema, { properties: [property()], extra: true }),
    ).toBe(false);
  });
});

describe('[P2-S10] CMS_RICH_TEXT_FORMATS', () => {
  it('is the single readonly rich_text.v1 format', () => {
    expect(CMS_RICH_TEXT_FORMATS).toEqual(['rich_text.v1']);
  });

  it('pins the document format literal to rich_text.v1', () => {
    expect(accepts(RichTextV1Schema, document([paragraph([span()])]))).toBe(
      true,
    );
    expect(
      accepts(RichTextV1Schema, {
        format: 'rich_text.v2',
        blocks: [paragraph([span()])],
      }),
    ).toBe(false);
    expect(accepts(RichTextV1Schema, { blocks: [paragraph([span()])] })).toBe(
      false,
    );
  });
});

describe('[P2-S10] RichTextV1Schema spans', () => {
  it('accepts a marked span and rejects empty text', () => {
    expect(accepts(RichTextV1Schema, document([paragraph([span()])]))).toBe(
      true,
    );
    expect(
      accepts(RichTextV1Schema, document([paragraph([span({ text: '' })])])),
    ).toBe(false);
  });

  it('requires marks explicitly', () => {
    expect(
      accepts(RichTextV1Schema, document([paragraph([{ text: 'hello' }])])),
    ).toBe(false);
    expect(
      accepts(
        RichTextV1Schema,
        document([paragraph([span({ marks: undefined })])]),
      ),
    ).toBe(false);
    expect(
      accepts(RichTextV1Schema, document([paragraph([span({ marks: null })])])),
    ).toBe(false);
    expect(
      accepts(
        RichTextV1Schema,
        document([paragraph([span({ marks: 'bold' })])]),
      ),
    ).toBe(false);
    expect(
      accepts(RichTextV1Schema, document([paragraph([span({ marks: [] })])])),
    ).toBe(true);
  });

  it('requires NFC-normal text', () => {
    expect(
      accepts(
        RichTextV1Schema,
        document([paragraph([span({ text: '\u00e9' })])]),
      ),
    ).toBe(true);
    expect(
      accepts(
        RichTextV1Schema,
        document([paragraph([span({ text: 'e\u0301' })])]),
      ),
    ).toBe(false);
  });

  it('rejects control characters except the excluded newline', () => {
    for (const text of [
      '\u0000',
      'a\u0009b',
      'a\u000bb',
      'a\u001fb',
      'a\u007fb',
      'a\u0085b',
      'a\u009fb',
    ]) {
      expect(
        accepts(RichTextV1Schema, document([paragraph([span({ text })])])),
        JSON.stringify(text),
      ).toBe(false);
    }
    expect(
      accepts(
        RichTextV1Schema,
        document([paragraph([span({ text: 'a\u000ab' })])]),
      ),
    ).toBe(true);
  });

  it('bounds text at 10000 characters', () => {
    expect(
      accepts(
        RichTextV1Schema,
        document([paragraph([span({ text: 'a'.repeat(10_000) })])]),
      ),
    ).toBe(true);
    expect(
      accepts(
        RichTextV1Schema,
        document([paragraph([span({ text: 'a'.repeat(10_001) })])]),
      ),
    ).toBe(false);
  });

  it('keeps marks unique and in canonical enum order', () => {
    for (const marks of [
      ['bold'],
      ['italic'],
      ['code'],
      ['bold', 'italic'],
      ['bold', 'code'],
      ['italic', 'code'],
      ['bold', 'italic', 'code'],
      [],
    ]) {
      expect(
        accepts(RichTextV1Schema, document([paragraph([span({ marks })])])),
        JSON.stringify(marks),
      ).toBe(true);
    }
    for (const marks of [
      ['italic', 'bold'],
      ['code', 'bold'],
      ['code', 'italic'],
      ['bold', 'code', 'italic'],
      ['italic', 'bold', 'code'],
      ['bold', 'bold'],
      ['bold', 'bold', 'italic'],
    ]) {
      expect(
        accepts(RichTextV1Schema, document([paragraph([span({ marks })])])),
        JSON.stringify(marks),
      ).toBe(false);
    }
  });

  it('caps marks at three', () => {
    expect(
      accepts(
        RichTextV1Schema,
        document([paragraph([span({ marks: ['bold', 'italic', 'code'] })])]),
      ),
    ).toBe(true);
  });

  it('is strict about unknown span keys', () => {
    expect(
      accepts(
        RichTextV1Schema,
        document([paragraph([span({ color: 'red' })])]),
      ),
    ).toBe(false);
  });

  it('rejects adjacent merge-equivalent spans', () => {
    expect(
      accepts(
        RichTextV1Schema,
        document([paragraph([span({ text: 'a' }), span({ text: 'b' })])]),
      ),
    ).toBe(false);
    expect(
      accepts(
        RichTextV1Schema,
        document([
          paragraph([
            span({ text: 'a', marks: ['bold'] }),
            span({ text: 'b', marks: ['italic'] }),
          ]),
        ]),
      ),
    ).toBe(true);
    expect(
      accepts(
        RichTextV1Schema,
        document([
          paragraph([
            span({ text: 'a', marks: ['bold'] }),
            span({ text: 'b', marks: ['bold'] }),
          ]),
        ]),
      ),
    ).toBe(false);
  });
});

describe('[P2-S10] RichTextV1Schema links', () => {
  it('accepts an https link and rejects unsafe or protocol-relative links', () => {
    expect(
      accepts(
        RichTextV1Schema,
        document([
          paragraph([span({ link: httpsLink('https://example.com/a') })]),
        ]),
      ),
    ).toBe(true);
    expect(
      accepts(
        RichTextV1Schema,
        document([
          paragraph([span({ link: httpsLink('https://example.com/') })]),
        ]),
      ),
    ).toBe(true);
    expect(
      accepts(
        RichTextV1Schema,
        document([
          paragraph([span({ link: httpsLink('https://example.com/a?b=1#c') })]),
        ]),
      ),
    ).toBe(true);
    expect(
      accepts(
        RichTextV1Schema,
        document([
          paragraph([
            span({ link: httpsLink('https://example.com:8443/a/b') }),
          ]),
        ]),
      ),
    ).toBe(true);
    for (const href of [
      'http://example.com',
      '//example.com',
      'data:text/html,x',
      'javascript:alert(1)',
      'ftp://example.com',
      'example.com',
      '',
      'https://u@example.com',
      'https://ex ample.com',
      'https:///path',
    ]) {
      expect(
        accepts(
          RichTextV1Schema,
          document([paragraph([span({ link: httpsLink(href) })])]),
        ),
        href,
      ).toBe(false);
    }
  });

  it('bounds the https href at 2048 characters', () => {
    const prefix = 'https://example.com/';
    const atLimit = prefix + 'a'.repeat(2048 - prefix.length);
    const overLimit = prefix + 'a'.repeat(2049 - prefix.length);
    expect(
      accepts(
        RichTextV1Schema,
        document([paragraph([span({ link: httpsLink(atLimit) })])]),
      ),
    ).toBe(true);
    expect(
      accepts(
        RichTextV1Schema,
        document([paragraph([span({ link: httpsLink(overLimit) })])]),
      ),
    ).toBe(false);
  });

  it('accepts a mailto link and bounds the address at 3..254 characters', () => {
    expect(
      accepts(
        RichTextV1Schema,
        document([paragraph([span({ link: mailtoLink('a@b') })])]),
      ),
    ).toBe(true);
    expect(
      accepts(
        RichTextV1Schema,
        document([
          paragraph([span({ link: mailtoLink('someone@example.com') })]),
        ]),
      ),
    ).toBe(true);
    const longLocal = 'a'.repeat(254 - '@example.com'.length);
    expect(
      accepts(
        RichTextV1Schema,
        document([
          paragraph([span({ link: mailtoLink(longLocal + '@example.com') })]),
        ]),
      ),
    ).toBe(true);
    expect(
      accepts(
        RichTextV1Schema,
        document([
          paragraph([span({ link: mailtoLink(longLocal + 'a@example.com') })]),
        ]),
      ),
    ).toBe(false);
    for (const address of [
      'ab',
      'a@',
      '@b',
      'a b@c',
      'a@b@c',
      'no-at-sign',
      '',
    ]) {
      expect(
        accepts(
          RichTextV1Schema,
          document([paragraph([span({ link: mailtoLink(address) })])]),
        ),
        address,
      ).toBe(false);
    }
  });

  it('accepts an internal route and rejects unsafe routes', () => {
    expect(
      accepts(
        RichTextV1Schema,
        document([paragraph([span({ link: internalLink('/') })])]),
      ),
    ).toBe(true);
    expect(
      accepts(
        RichTextV1Schema,
        document([paragraph([span({ link: internalLink('/blog/post') })])]),
      ),
    ).toBe(true);
    expect(
      accepts(
        RichTextV1Schema,
        document([paragraph([span({ link: internalLink('/a b') })])]),
      ),
    ).toBe(true);
    const atLimit = '/' + 'a'.repeat(2047);
    expect(
      accepts(
        RichTextV1Schema,
        document([paragraph([span({ link: internalLink(atLimit) })])]),
      ),
    ).toBe(true);
    expect(
      accepts(
        RichTextV1Schema,
        document([paragraph([span({ link: internalLink(atLimit + 'a') })])]),
      ),
    ).toBe(false);
    for (const route of [
      '//example.com',
      'a',
      '/a?b',
      '/a#b',
      '/a\u0000b',
      '/a\u001fb',
      '',
    ]) {
      expect(
        accepts(
          RichTextV1Schema,
          document([paragraph([span({ link: internalLink(route) })])]),
        ),
        JSON.stringify(route),
      ).toBe(false);
    }
  });

  it('no longer recognises the entry link kind', () => {
    expect(
      accepts(
        RichTextV1Schema,
        document([
          paragraph([
            span({
              link: {
                kind: 'entry',
                entryId: '018f0c45-73fe-7dc2-9c09-68f7ecf132da',
              },
            }),
          ]),
        ]),
      ),
    ).toBe(false);
    expect(
      accepts(
        RichTextV1Schema,
        document([
          paragraph([
            span({
              link: {
                kind: 'entry',
                entryId: '018f0c45-73fe-7dc2-9c09-68f7ecf132da',
                locale: 'en-US',
              },
            }),
          ]),
        ]),
      ),
    ).toBe(false);
  });

  it('is strict about unknown link keys and requires a kind discriminant', () => {
    expect(
      accepts(
        RichTextV1Schema,
        document([
          paragraph([
            span({
              link: {
                kind: 'https',
                href: 'https://example.com',
                target: '_blank',
              },
            }),
          ]),
        ]),
      ),
    ).toBe(false);
    expect(
      accepts(
        RichTextV1Schema,
        document([
          paragraph([span({ link: { href: 'https://example.com' } })]),
        ]),
      ),
    ).toBe(false);
    expect(
      accepts(
        RichTextV1Schema,
        document([
          paragraph([
            span({ link: { kind: 'mailto', address: 'a@b', subject: 'hi' } }),
          ]),
        ]),
      ),
    ).toBe(false);
    expect(
      accepts(
        RichTextV1Schema,
        document([
          paragraph([
            span({ link: { kind: 'internal', route: '/a', target: '_self' } }),
          ]),
        ]),
      ),
    ).toBe(false);
  });
});

describe('[P2-S10] RichTextV1Schema blocks', () => {
  it('accepts paragraph, heading, quote and list_item blocks', () => {
    expect(accepts(RichTextV1Schema, document([paragraph([span()])]))).toBe(
      true,
    );
    for (const level of [2, 3, 4])
      expect(
        accepts(RichTextV1Schema, document([heading(level, [span()])])),
        String(level),
      ).toBe(true);
    expect(accepts(RichTextV1Schema, document([quote([span()])]))).toBe(true);
    expect(
      accepts(RichTextV1Schema, document([listItem('bulleted', 1, [span()])])),
    ).toBe(true);
    expect(
      accepts(RichTextV1Schema, document([listItem('numbered', 1, [span()])])),
    ).toBe(true);
  });

  it('rejects unsupported heading levels and list kinds', () => {
    for (const level of [1, 5, 0, '2', 2.5])
      expect(
        accepts(RichTextV1Schema, document([heading(level, [span()])])),
        String(level),
      ).toBe(false);
    expect(
      accepts(RichTextV1Schema, document([listItem('dashed', 1, [span()])])),
    ).toBe(false);
  });

  it('allows empty spans on paragraph and list_item but not on heading or quote', () => {
    expect(accepts(RichTextV1Schema, document([paragraph([])]))).toBe(true);
    expect(
      accepts(RichTextV1Schema, document([listItem('bulleted', 1, [])])),
    ).toBe(true);
    expect(accepts(RichTextV1Schema, document([heading(2, [])]))).toBe(false);
    expect(accepts(RichTextV1Schema, document([quote([])]))).toBe(false);
  });

  it('caps spans per block at 128', () => {
    expect(
      accepts(RichTextV1Schema, document([paragraph(distinctSpans(128))])),
    ).toBe(true);
    expect(
      accepts(RichTextV1Schema, document([paragraph(distinctSpans(129))])),
    ).toBe(false);
    expect(
      accepts(RichTextV1Schema, document([heading(2, distinctSpans(128))])),
    ).toBe(true);
    expect(
      accepts(RichTextV1Schema, document([heading(2, distinctSpans(129))])),
    ).toBe(false);
  });

  it('requires 1..128 blocks per document', () => {
    const maxBlocks = Array.from({ length: 128 }, () => paragraph([span()]));
    expect(accepts(RichTextV1Schema, document(maxBlocks))).toBe(true);
    expect(
      accepts(RichTextV1Schema, document([...maxBlocks, paragraph([span()])])),
    ).toBe(false);
    expect(accepts(RichTextV1Schema, document([]))).toBe(false);
  });

  it('is strict about unknown block keys and rejects a missing type', () => {
    expect(
      accepts(
        RichTextV1Schema,
        document([{ ...paragraph([span()]), align: 'center' }]),
      ),
    ).toBe(false);
    expect(accepts(RichTextV1Schema, document([{ spans: [span()] }]))).toBe(
      false,
    );
    expect(
      accepts(RichTextV1Schema, {
        format: 'rich_text.v1',
        blocks: [paragraph([span()])],
        extra: true,
      }),
    ).toBe(false);
  });
});

describe('[P2-S10] RichTextV1Schema list nesting', () => {
  it('requires the first list item to start at depth 1', () => {
    expect(
      accepts(RichTextV1Schema, document([listItem('bulleted', 1, [span()])])),
    ).toBe(true);
    expect(
      accepts(RichTextV1Schema, document([listItem('bulleted', 2, [span()])])),
    ).toBe(false);
    expect(
      accepts(
        RichTextV1Schema,
        document([paragraph([span()]), listItem('numbered', 3, [span()])]),
      ),
    ).toBe(false);
  });

  it('forbids a list depth increase greater than one within a run', () => {
    expect(
      accepts(
        RichTextV1Schema,
        document([
          listItem('bulleted', 1, [span()]),
          listItem('bulleted', 2, [span()]),
          listItem('bulleted', 3, [span()]),
        ]),
      ),
    ).toBe(true);
    expect(
      accepts(
        RichTextV1Schema,
        document([
          listItem('bulleted', 1, [span()]),
          listItem('bulleted', 3, [span()]),
        ]),
      ),
    ).toBe(false);
    expect(
      accepts(
        RichTextV1Schema,
        document([
          listItem('bulleted', 3, [span()]),
          listItem('bulleted', 1, [span()]),
        ]),
      ),
    ).toBe(false);
    expect(
      accepts(
        RichTextV1Schema,
        document([
          listItem('bulleted', 1, [span()]),
          listItem('bulleted', 2, [span()]),
          listItem('bulleted', 1, [span()]),
        ]),
      ),
    ).toBe(true);
  });

  it('starts a new depth-1 run when the list kind changes', () => {
    expect(
      accepts(
        RichTextV1Schema,
        document([
          listItem('bulleted', 1, [span()]),
          listItem('numbered', 1, [span()]),
        ]),
      ),
    ).toBe(true);
    expect(
      accepts(
        RichTextV1Schema,
        document([
          listItem('bulleted', 1, [span()]),
          listItem('bulleted', 2, [span()]),
          listItem('numbered', 1, [span()]),
        ]),
      ),
    ).toBe(true);
    expect(
      accepts(
        RichTextV1Schema,
        document([
          listItem('bulleted', 1, [span()]),
          listItem('numbered', 2, [span()]),
        ]),
      ),
    ).toBe(false);
  });

  it('starts a new depth-1 run after a non-list block', () => {
    expect(
      accepts(
        RichTextV1Schema,
        document([paragraph([span()]), listItem('bulleted', 1, [span()])]),
      ),
    ).toBe(true);
    expect(
      accepts(
        RichTextV1Schema,
        document([
          listItem('bulleted', 1, [span()]),
          listItem('bulleted', 2, [span()]),
          paragraph([span()]),
          listItem('bulleted', 1, [span()]),
        ]),
      ),
    ).toBe(true);
    expect(
      accepts(
        RichTextV1Schema,
        document([
          listItem('bulleted', 2, [span()]),
          paragraph([span()]),
          listItem('bulleted', 1, [span()]),
        ]),
      ),
    ).toBe(false);
  });
});

describe('[P2-S10] isRichTextV1', () => {
  it('agrees with RichTextV1Schema over a corpus', () => {
    const corpus: unknown[] = [
      document([paragraph([span()])]),
      document([paragraph([])]),
      document([
        listItem('bulleted', 1, [span()]),
        listItem('bulleted', 2, [span()]),
      ]),
      document([heading(2, [span({ marks: ['bold', 'italic'] })])]),
      document([quote([span({ link: httpsLink('https://example.com') })])]),
      document([paragraph([span({ link: mailtoLink('a@b') })])]),
      document([paragraph([span({ link: internalLink('/a') })])]),
      document([]),
      document([heading(2, [])]),
      document([paragraph([span({ text: '' })])]),
      document([paragraph([{ text: 'hello' }])]),
      document([paragraph([span({ text: 'e\u0301' })])]),
      document([paragraph([span({ text: 'a\u0000b' })])]),
      document([listItem('bulleted', 2, [span()])]),
      document([
        listItem('bulleted', 1, [span()]),
        listItem('bulleted', 3, [span()]),
      ]),
      document([
        listItem('bulleted', 1, [span()]),
        listItem('numbered', 2, [span()]),
      ]),
      document([paragraph([span({ link: httpsLink('http://example.com') })])]),
      document([
        paragraph([
          span({
            link: {
              kind: 'entry',
              entryId: '018f0c45-73fe-7dc2-9c09-68f7ecf132da',
            },
          }),
        ]),
      ]),
      { format: 'rich_text.v1', blocks: [paragraph([span()])], extra: 1 },
      null,
      'not a document',
      42,
    ];
    for (const value of corpus)
      expect(isRichTextV1(value), JSON.stringify(value)?.slice(0, 60)).toBe(
        accepts(RichTextV1Schema, value),
      );
  });
});
