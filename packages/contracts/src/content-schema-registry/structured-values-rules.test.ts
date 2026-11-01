import { describe, expect, it } from 'vitest';

import {
  RichTextLinkSchema,
  RichTextSpanSchema,
  RichTextV1Schema,
  isObjectValueForStructure,
  richTextTotalCharacters,
  type ObjectStructure,
} from './structured-values.ts';
import {
  isObjectValueForStructureZodFree,
  isRichTextDocument,
  isRichTextLink,
  isRichTextSpan,
  richTextDocumentCharacters,
} from './structured-values-rules.ts';

/**
 * The browser walks rich_text.v1 and object values without zod
 * (`structured-values-rules.ts`). Every verdict must equal the schema's: the
 * leaf rules are shared, and this suite proves the structure walk equal over a
 * hand-written corpus and a deterministic mutation sweep of valid documents.
 */

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

const span = (
  text: string,
  marks: string[] = [],
  link?: Json,
): { [key: string]: Json } => ({
  text,
  marks,
  ...(link === undefined ? {} : { link }),
});

const VALID_DOCUMENTS: readonly Json[] = [
  { format: 'rich_text.v1', blocks: [{ type: 'paragraph', spans: [] }] },
  {
    format: 'rich_text.v1',
    blocks: [
      { type: 'heading', level: 2, spans: [span('Title', ['bold'])] },
      {
        type: 'paragraph',
        spans: [
          span('Plain '),
          span('emphasis', ['bold', 'italic']),
          span(' and ', ['code']),
          span('a link', [], { kind: 'https', href: 'https://example.com/a' }),
          span('mail', [], { kind: 'mailto', address: 'a@example.com' }),
          span('home', [], { kind: 'internal', route: '/app/home' }),
        ],
      },
      { type: 'quote', spans: [span('Quoted 😀 line\nsecond')] },
      {
        type: 'list_item',
        list: 'bulleted',
        depth: 1,
        spans: [span('one')],
      },
      {
        type: 'list_item',
        list: 'bulleted',
        depth: 2,
        spans: [span('nested')],
      },
      { type: 'list_item', list: 'numbered', depth: 1, spans: [] },
      { type: 'heading', level: 4, spans: [span('Deep')] },
    ],
  },
];

const BAD_TEXTS: readonly Json[] = [
  '',
  'x'.repeat(10_000),
  'x'.repeat(10_001),
  '😀'.repeat(10_000),
  '😀'.repeat(10_001),
  'é',
  'é',
  'tab\there',
  'line\nbreak',
  'nul\u0000byte',
  'bell\u0007',
  'c1\u0085',
  'del\u007f',
  'lone\ud800surrogate',
  'low\udc00surrogate',
  '😀 pair',
  null,
  7,
  true,
  [],
  {},
];

const BAD_HREFS: readonly Json[] = [
  'https://example.com',
  'https://example.com/path?q=1#f',
  'http://example.com',
  'https://',
  'https:///x',
  'https://exa mple.com',
  'https://user@example.com',
  'https://example.com/' + 'a'.repeat(2030),
  'https://example.com/' + 'a'.repeat(2040),
  'https://example.com/\u0001',
  'https://example.com/\ud800',
  '',
  null,
  3,
];

const BAD_ROUTES: readonly Json[] = [
  '/',
  '/app',
  '//host',
  '/a/../b',
  '/a/./b',
  '/a/..',
  '/..',
  '/a?x=1',
  '/a#f',
  '/a\\b',
  '/\\host',
  'relative',
  '',
  '/' + 'a'.repeat(2047),
  '/' + 'a'.repeat(2048),
  '/a\u0000b',
  '/a\ud800',
  '/a b',
  '/é',
  null,
];

const BAD_ADDRESSES: readonly Json[] = [
  'a@b',
  'a@',
  '@b',
  'a b@c',
  'a@b@c',
  'ab',
  'a'.repeat(120) + '@' + 'b'.repeat(133),
  'a'.repeat(121) + '@' + 'b'.repeat(133),
  'a@b\u0001',
  'a@\ud800',
  null,
];

const LINK_VARIANTS = (): Json[] => [
  ...BAD_HREFS.map((href) => ({ kind: 'https', href })),
  ...BAD_ADDRESSES.map((address) => ({ kind: 'mailto', address })),
  ...BAD_ROUTES.map((route) => ({ kind: 'internal', route })),
  { kind: 'entry', entryId: 'x' },
  { kind: 'https' },
  { kind: 'https', href: 'https://example.com', extra: 1 },
  { href: 'https://example.com' },
  { kind: 7, href: 'https://example.com' },
  'https://example.com',
  null,
  [],
];

/** A deterministic generator: the sweep must be reproducible. */
const generator = (seed: number) => {
  let state = seed >>> 0;
  return (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
};

const clone = <T extends Json>(value: T): T =>
  JSON.parse(JSON.stringify(value)) as T;

type Mutable = { [key: string]: Json } | Json[];

/** Every object and array of `root`, with the key that holds it. */
const containers = (root: Json): Mutable[] => {
  const found: Mutable[] = [];
  const walk = (value: Json): void => {
    if (value === null || typeof value !== 'object') return;
    found.push(value);
    for (const child of Array.isArray(value) ? value : Object.values(value))
      walk(child);
  };
  walk(root);
  return found;
};

const REPLACEMENTS: readonly Json[] = [
  null,
  0,
  1,
  2,
  4,
  -1,
  1.5,
  true,
  '',
  'x',
  'bulleted',
  'paragraph',
  'rich_text.v2',
  [],
  {},
  ['bold'],
  ['code', 'bold'],
  ['bold', 'bold'],
  ['bold', 'italic', 'code', 'code'],
  ['underline'],
  ...BAD_TEXTS,
];

const mutate = (document: Json, random: () => number): Json => {
  const copy = clone(document);
  const targets = containers(copy);
  const target = targets[Math.floor(random() * targets.length)] as Mutable;
  const pick = <T>(items: readonly T[]): T =>
    items[Math.floor(random() * items.length)] as T;
  if (Array.isArray(target)) {
    const choice = random();
    if (choice < 0.25 && target.length > 0)
      target.splice(Math.floor(random() * target.length), 1);
    else if (choice < 0.5 && target.length > 0)
      target.push(clone(target[Math.floor(random() * target.length)] as Json));
    else if (choice < 0.75 && target.length > 0)
      target[Math.floor(random() * target.length)] = pick(REPLACEMENTS);
    else target.push(pick(REPLACEMENTS));
    return copy;
  }
  const keys = Object.keys(target);
  const choice = random();
  if (choice < 0.2 && keys.length > 0) delete target[pick(keys)];
  else if (choice < 0.35) target[`extra${Math.floor(random() * 3)}`] = 1;
  else if (choice < 0.55 && keys.length > 0)
    target[pick(keys)] = pick(REPLACEMENTS);
  else if (choice < 0.7 && keys.length > 0) {
    const key = pick(keys);
    if (key === 'link') target.link = pick(LINK_VARIANTS());
    else if (key === 'text') target.text = pick(BAD_TEXTS);
    else if (key === 'type')
      target.type = pick(['paragraph', 'heading', 'quote', 'list_item', 'x']);
    else if (key === 'level') target.level = pick([1, 2, 3, 4, 5]);
    else if (key === 'depth') target.depth = pick([0, 1, 2, 3, 4]);
    else target[key] = pick(REPLACEMENTS);
  } else if (choice < 0.85) target.link = pick(LINK_VARIANTS());
  else if (keys.includes('text')) target.text = pick(BAD_TEXTS);
  else target.link = undefined as unknown as Json;
  return copy;
};

const agree = (value: unknown): boolean =>
  isRichTextDocument(value) === RichTextV1Schema.safeParse(value).success &&
  richTextDocumentCharacters(value) === richTextTotalCharacters(value);

describe('zod-free rich_text.v1 rules', () => {
  it('accept the same documents as the schema, and count the same characters', () => {
    for (const document of VALID_DOCUMENTS) {
      expect(RichTextV1Schema.safeParse(document).success).toBe(true);
      expect(isRichTextDocument(document)).toBe(true);
      expect(agree(document)).toBe(true);
    }
    expect(richTextDocumentCharacters(VALID_DOCUMENTS[1])).toBe(
      richTextTotalCharacters(VALID_DOCUMENTS[1]),
    );
    expect(richTextDocumentCharacters(VALID_DOCUMENTS[1])).toBeGreaterThan(20);
  });

  it('refuse every non-document the schema refuses', () => {
    const notDocuments: unknown[] = [
      null,
      undefined,
      0,
      '',
      [],
      {},
      { format: 'rich_text.v1' },
      { format: 'rich_text.v1', blocks: [] },
      { blocks: [] },
      { format: 'rich_text.v2', blocks: [{ type: 'paragraph', spans: [] }] },
      {
        format: 'rich_text.v1',
        blocks: Array.from({ length: 129 }, () => ({
          type: 'paragraph',
          spans: [],
        })),
      },
      {
        format: 'rich_text.v1',
        blocks: Array.from({ length: 128 }, () => ({
          type: 'paragraph',
          spans: [],
        })),
      },
    ];
    for (const value of notDocuments) expect(agree(value)).toBe(true);
    expect(isRichTextDocument(notDocuments[11])).toBe(true);
    expect(isRichTextDocument(notDocuments[10])).toBe(false);
  });

  it('agree on the span, link, mark, merge and list-depth rules', () => {
    for (const variant of LINK_VARIANTS()) {
      expect(isRichTextLink(variant), JSON.stringify(variant)).toBe(
        RichTextLinkSchema.safeParse(variant).success,
      );
      expect(
        isRichTextSpan({ text: 'x', marks: [], link: variant }),
        JSON.stringify(variant),
      ).toBe(
        RichTextSpanSchema.safeParse({ text: 'x', marks: [], link: variant })
          .success,
      );
    }
    for (const text of BAD_TEXTS)
      expect(isRichTextSpan({ text, marks: [] }), JSON.stringify(text)).toBe(
        RichTextSpanSchema.safeParse({ text, marks: [] }).success,
      );
    const documents: Json[] = [
      // adjacent spans with equal marks and link must be merged
      {
        format: 'rich_text.v1',
        blocks: [{ type: 'paragraph', spans: [span('a'), span('b')] }],
      },
      {
        format: 'rich_text.v1',
        blocks: [
          {
            type: 'paragraph',
            spans: [
              span('a', [], { kind: 'internal', route: '/x' }),
              span('b', [], { kind: 'internal', route: '/y' }),
            ],
          },
        ],
      },
      {
        format: 'rich_text.v1',
        blocks: [
          {
            type: 'paragraph',
            spans: [
              span('a', [], { kind: 'internal', route: '/x' }),
              span('b', [], { kind: 'internal', route: '/x' }),
            ],
          },
        ],
      },
      // the first item of a run starts at depth 1; depth never jumps by more than one
      {
        format: 'rich_text.v1',
        blocks: [{ type: 'list_item', list: 'bulleted', depth: 2, spans: [] }],
      },
      {
        format: 'rich_text.v1',
        blocks: [
          { type: 'list_item', list: 'bulleted', depth: 1, spans: [] },
          { type: 'list_item', list: 'bulleted', depth: 3, spans: [] },
        ],
      },
      {
        format: 'rich_text.v1',
        blocks: [
          { type: 'list_item', list: 'bulleted', depth: 1, spans: [] },
          { type: 'list_item', list: 'numbered', depth: 2, spans: [] },
        ],
      },
      {
        format: 'rich_text.v1',
        blocks: [
          { type: 'list_item', list: 'bulleted', depth: 1, spans: [] },
          { type: 'paragraph', spans: [] },
          { type: 'list_item', list: 'bulleted', depth: 2, spans: [] },
        ],
      },
      // headings and quotes need a span; marks are canonical and at most three
      {
        format: 'rich_text.v1',
        blocks: [{ type: 'heading', level: 3, spans: [] }],
      },
      {
        format: 'rich_text.v1',
        blocks: [{ type: 'quote', spans: [] }],
      },
      {
        format: 'rich_text.v1',
        blocks: [{ type: 'paragraph', spans: [span('a', ['italic', 'bold'])] }],
      },
      {
        format: 'rich_text.v1',
        blocks: [
          { type: 'paragraph', spans: [span('a', ['bold', 'italic', 'code'])] },
        ],
      },
    ];
    for (const document of documents)
      expect(agree(document), JSON.stringify(document)).toBe(true);
  });

  it('agree on a deterministic mutation sweep of valid documents', () => {
    const random = generator(0x5eed);
    let accepted = 0;
    let refused = 0;
    for (let round = 0; round < 6_000; round += 1) {
      let candidate: Json = VALID_DOCUMENTS[round % VALID_DOCUMENTS.length]!;
      const mutations = 1 + (round % 3);
      for (let step = 0; step < mutations; step += 1)
        candidate = mutate(candidate, random);
      const zodFree = isRichTextDocument(candidate);
      expect(zodFree, JSON.stringify(candidate)).toBe(
        RichTextV1Schema.safeParse(candidate).success,
      );
      expect(richTextDocumentCharacters(candidate)).toBe(
        richTextTotalCharacters(candidate),
      );
      if (zodFree) accepted += 1;
      else refused += 1;
    }
    // The sweep must exercise both verdicts, or it proves nothing.
    expect(accepted).toBeGreaterThan(100);
    expect(refused).toBeGreaterThan(1_000);
  });
});

const STRUCTURE: ObjectStructure = {
  properties: [
    {
      key: 'title',
      kind: 'scalar',
      required: true,
      constraints: { minLength: 2, maxLength: 6 },
    },
    {
      key: 'count',
      kind: 'scalar',
      required: false,
      constraints: { minimum: 1, maximum: 9 },
    },
    {
      key: 'tone',
      kind: 'enum',
      required: true,
      constraints: { enumValues: ['warm', 'cool'], maxLength: 4 },
    },
    {
      key: 'body',
      kind: 'rich_text',
      required: false,
      constraints: { minLength: 3, maxLength: 12 },
    },
  ],
} as ObjectStructure;

describe('zod-free object value rules', () => {
  it('agree with the schema-backed contract over objects of every shape', () => {
    const body = (text: string): Json => ({
      format: 'rich_text.v1',
      blocks: [{ type: 'paragraph', spans: [span(text)] }],
    });
    const values: unknown[] = [
      { title: 'abc', tone: 'warm' },
      { title: 'abc', tone: 'warm', count: 5 },
      { title: 'abc', tone: 'warm', count: 10 },
      { title: 'abc', tone: 'warm', count: 0 },
      { title: 'abc', tone: 'warm', count: 'x' },
      { title: 'abc', tone: 'warm', count: Number.NaN },
      { title: 'a', tone: 'warm' },
      { title: 'abcdefg', tone: 'warm' },
      { title: 'abc', tone: 'hot' },
      { title: 'abc', tone: 'warmth' },
      { title: 'abc' },
      { tone: 'warm' },
      { title: 'abc', tone: 'warm', extra: 1 },
      { title: 'abc', tone: 'warm', body: body('long enough') },
      { title: 'abc', tone: 'warm', body: body('no') },
      { title: 'abc', tone: 'warm', body: body('x'.repeat(13)) },
      { title: 'abc', tone: 'warm', body: 'plain' },
      { title: 'ab\ud800', tone: 'warm' },
      { title: 'abc', tone: 'warm', count: null },
      { title: null, tone: 'warm' },
      {},
      [],
      null,
      'text',
      7,
    ];
    for (const value of values)
      expect(
        isObjectValueForStructureZodFree(STRUCTURE, value),
        JSON.stringify(value),
      ).toBe(isObjectValueForStructure(STRUCTURE, value));
    expect(isObjectValueForStructureZodFree(STRUCTURE, values[0])).toBe(true);
    expect(isObjectValueForStructureZodFree(STRUCTURE, values[3])).toBe(false);
  });
});
