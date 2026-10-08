/**
 * Slice 10 evidence lane EC (P2-S10-AC-084): `rich_text.v1` normalizes to RFC 8785/JCS
 * bytes and the TypeScript and PostgreSQL validators agree. One corpus is held to BOTH
 * implementations against the real database:
 *
 *   - the canonical text and its SHA-256 are byte-identical between the TypeScript JCS
 *     (apps/worker content-schema-registry migration-transform-jcs) and
 *     platform_private.cms_jcs / cms_jcs_sha256, whatever order the input keys arrive in;
 *   - the verdict of RichTextV1Schema equals platform_private.cms_rich_text_v1_valid for
 *     every document, valid and invalid, including the bounds.
 *
 * No fixture is committed; run right after `pnpm db:reset` like every apispec.
 */
import { describe, expect, it } from 'vitest';

import {
  RICH_TEXT_V1_ARTIFACT_HASH,
  RICH_TEXT_V1_ARTIFACT_REF,
  RICH_TEXT_V1_DESCRIPTOR,
  protectedValidatorDescriptor,
} from '../../packages/contracts/src/content-schema-registry/protected-validators';

import {
  canonicalHash,
  canonicalJson,
} from '../../apps/worker/src/content-schema-registry/migration-transform-jcs';
import { isRichTextV1 } from '../../packages/contracts/src/content-schema-registry/structured-values';
import { psql } from './support/stack';

type Json =
  | null
  | boolean
  | number
  | string
  | readonly Json[]
  | { readonly [key: string]: Json };

const span = (
  text: string,
  marks: readonly string[] = [],
  link?: Json,
): Json => ({
  text,
  marks,
  ...(link === undefined ? {} : { link }),
});
const paragraph = (...spans: Json[]): Json => ({ type: 'paragraph', spans });
const doc = (...blocks: Json[]): Json => ({ format: 'rich_text.v1', blocks });

/** The same value with every object's keys in reverse insertion order. */
const reversed = (value: Json): Json => {
  if (Array.isArray(value)) return value.map(reversed);
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as { [key: string]: Json }).reverse();
    return Object.fromEntries(
      entries.map(([key, item]) => [key, reversed(item)]),
    );
  }
  return value;
};

const VALID: ReadonlyArray<readonly [string, Json]> = [
  ['a minimal paragraph', doc(paragraph(span('Hello')))],
  ['a paragraph with no spans', doc(paragraph())],
  [
    'every mark in canonical order',
    doc(paragraph(span('all', ['bold', 'italic', 'code']), span(' plain'))),
  ],
  [
    'headings 2 to 4 and a quote',
    doc(
      { type: 'heading', level: 2, spans: [span('Two')] },
      { type: 'heading', level: 3, spans: [span('Three')] },
      { type: 'heading', level: 4, spans: [span('Four')] },
      { type: 'quote', spans: [span('Quoted')] },
    ),
  ],
  [
    'a nested numbered list after a paragraph',
    doc(
      paragraph(span('Intro')),
      { type: 'list_item', list: 'numbered', depth: 1, spans: [span('One')] },
      { type: 'list_item', list: 'numbered', depth: 2, spans: [span('One a')] },
      {
        type: 'list_item',
        list: 'bulleted',
        depth: 1,
        spans: [span('Bullet')],
      },
    ),
  ],
  [
    'https, mailto and internal links',
    doc(
      paragraph(
        span('site', [], {
          kind: 'https',
          href: 'https://example.com/a?b=c&d=%20e',
        }),
        span('mail', ['bold'], { kind: 'mailto', address: 'team@example.com' }),
        span('home', [], { kind: 'internal', route: '/app/home' }),
      ),
    ),
  ],
  [
    'characters JCS must escape or keep verbatim',
    doc(
      paragraph(span('quote " backslash \\ slash / line\nbreak')),
      paragraph(span('separator   and   nbsp and é composed')),
    ),
  ],
  [
    'astral and CJK text',
    doc(paragraph(span('\u{1F600}\u{1F3B5} 日本語 \u{20BB7}'))),
  ],
  [
    'the 128-span bound in one paragraph',
    doc(
      paragraph(
        ...Array.from({ length: 128 }, (_, index) =>
          span(`s${String(index)}`, index % 2 === 0 ? ['bold'] : []),
        ),
      ),
    ),
  ],
  ['a 10000-character span', doc(paragraph(span('x'.repeat(10_000))))],
  [
    'list depth 1, 2 and 3 in one run, then a restart',
    doc(
      { type: 'list_item', list: 'bulleted', depth: 1, spans: [span('a')] },
      { type: 'list_item', list: 'bulleted', depth: 2, spans: [span('b')] },
      { type: 'list_item', list: 'bulleted', depth: 3, spans: [span('c')] },
      { type: 'list_item', list: 'bulleted', depth: 1, spans: [span('d')] },
      { type: 'list_item', list: 'bulleted', depth: 2, spans: [span('e')] },
    ),
  ],
  [
    'HTML-looking text, which is plain text and never markup',
    doc(
      paragraph(
        span('<script>alert(1)</script> <img src=x onerror=alert(1)> &amp;'),
      ),
    ),
  ],
  [
    'the 128-block bound',
    doc(
      ...Array.from({ length: 128 }, (_, index) =>
        paragraph(span(`Block ${String(index)}`)),
      ),
    ),
  ],
];

const INVALID: ReadonlyArray<readonly [string, Json]> = [
  ['adjacent spans with equal marks', doc(paragraph(span('a'), span('b')))],
  [
    'marks out of canonical order',
    doc(paragraph(span('a', ['italic', 'bold']))),
  ],
  ['a duplicate mark', doc(paragraph(span('a', ['bold', 'bold'])))],
  ['an unknown mark', doc(paragraph(span('a', ['underline'])))],
  ['heading level 1', doc({ type: 'heading', level: 1, spans: [span('a')] })],
  ['heading level 5', doc({ type: 'heading', level: 5, spans: [span('a')] })],
  ['an empty span text', doc(paragraph(span('')))],
  ['decomposed (NFD) text', doc(paragraph(span('é')))],
  ['a control character', doc(paragraph(span('a\u0001b')))],
  [
    'a plain http link',
    doc(
      paragraph(span('a', [], { kind: 'https', href: 'http://example.com' })),
    ),
  ],
  [
    'a javascript link',
    doc(
      paragraph(span('a', [], { kind: 'https', href: 'javascript:alert(1)' })),
    ),
  ],
  [
    'a protocol-relative route',
    doc(
      paragraph(span('a', [], { kind: 'internal', route: '//evil.example' })),
    ),
  ],
  [
    'a relative route',
    doc(paragraph(span('a', [], { kind: 'internal', route: 'app/home' }))),
  ],
  [
    'an unknown link kind',
    doc(paragraph(span('a', [], { kind: 'entry', id: 'x' }))),
  ],
  ['an unknown block type', doc({ type: 'embed', spans: [span('a')] })],
  [
    'an unknown top-level key',
    { format: 'rich_text.v1', blocks: [paragraph(span('a'))], extra: 1 },
  ],
  [
    'another format literal',
    { format: 'html.v1', blocks: [paragraph(span('a'))] },
  ],
  ['no blocks', doc()],
  [
    '129 blocks',
    doc(
      ...Array.from({ length: 129 }, (_, index) =>
        paragraph(span(`Block ${String(index)}`)),
      ),
    ),
  ],
  [
    'a list whose first item is depth 2',
    doc({ type: 'list_item', list: 'bulleted', depth: 2, spans: [span('a')] }),
  ],
  [
    'a list depth jump of two',
    doc(
      { type: 'list_item', list: 'bulleted', depth: 1, spans: [span('a')] },
      { type: 'list_item', list: 'bulleted', depth: 3, spans: [span('b')] },
    ),
  ],
  ['a span of 10001 characters', doc(paragraph(span('x'.repeat(10_001))))],
  ['a raw HTML string', '<p>raw</p>'],
  [
    '129 spans in one paragraph',
    doc(
      paragraph(
        ...Array.from({ length: 129 }, (_, index) =>
          span(`s${String(index)}`, index % 2 === 0 ? ['bold'] : []),
        ),
      ),
    ),
  ],
  [
    'list depth 4 after depth 3',
    doc(
      { type: 'list_item', list: 'bulleted', depth: 1, spans: [span('a')] },
      { type: 'list_item', list: 'bulleted', depth: 2, spans: [span('b')] },
      { type: 'list_item', list: 'bulleted', depth: 3, spans: [span('c')] },
      { type: 'list_item', list: 'bulleted', depth: 4, spans: [span('d')] },
    ),
  ],
  [
    'list depth 0',
    doc({ type: 'list_item', list: 'bulleted', depth: 0, spans: [span('a')] }),
  ],
  [
    'a numbered item at depth 2 right after a bulleted depth 1',
    doc(
      { type: 'list_item', list: 'bulleted', depth: 1, spans: [span('a')] },
      { type: 'list_item', list: 'numbered', depth: 2, spans: [span('b')] },
    ),
  ],
  ['a quote with no spans', doc({ type: 'quote', spans: [] })],
  ['a heading with no spans', doc({ type: 'heading', level: 2, spans: [] })],
  ['a typed raw-HTML block', doc({ type: 'html', html: '<b>x</b>' })],
  ['an image block', doc({ type: 'image', src: 'https://example.com/a.png' })],
  [
    'an inline embed member on a span',
    doc(
      paragraph({
        text: 'x',
        marks: [],
        embed: { kind: 'image', src: 'https://example.com/a.png' },
      }),
    ),
  ],
  [
    'an html member on a span',
    doc(paragraph({ text: 'x', marks: [], html: '<b>x</b>' })),
  ],
  [
    'an attrs member on a block',
    {
      format: 'rich_text.v1',
      blocks: [{ type: 'paragraph', spans: [], attrs: { class: 'x' } }],
    },
  ],
  [
    'an embed link kind',
    doc(
      paragraph(span('x', [], { kind: 'embed', href: 'https://example.com' })),
    ),
  ],
  [
    'an extra member on an https link',
    doc(
      paragraph(
        span('x', [], {
          kind: 'https',
          href: 'https://example.com',
          target: '_blank',
        }),
      ),
    ),
  ],
  [
    'an inline data: href',
    doc(
      paragraph(
        span('x', [], { kind: 'https', href: 'data:text/html,<b>x</b>' }),
      ),
    ),
  ],
];

const pgText = (expression: string, value: Json): string =>
  psql(`select ${expression}($ec$${JSON.stringify(value)}$ec$::jsonb)`);

describe('EC-084 rich_text.v1 canonical bytes: TypeScript equals PostgreSQL', () => {
  it.each(VALID)(
    'the JCS text and SHA-256 of %s are identical in TypeScript and PostgreSQL',
    async (_name, value) => {
      const typescriptText = canonicalJson(value);
      expect(pgText('platform_private.cms_jcs', value)).toBe(typescriptText);
      expect(pgText('platform_private.cms_jcs_sha256', value)).toBe(
        await canonicalHash(value),
      );
    },
  );

  it.each(VALID)(
    'the canonical hash of %s does not depend on the order the keys arrive in',
    async (_name, value) => {
      const shuffled = reversed(value);
      expect(canonicalJson(shuffled)).toBe(canonicalJson(value));
      expect(await canonicalHash(shuffled)).toBe(await canonicalHash(value));
      expect(pgText('platform_private.cms_jcs_sha256', shuffled)).toBe(
        await canonicalHash(value),
      );
    },
  );

  it('is compact key-sorted JSON: no whitespace, members in code-unit order, unicode kept as characters', () => {
    const text = canonicalJson(doc(paragraph(span('\u{1F600} é'))));
    expect(text).toBe(
      '{"blocks":[{"spans":[{"marks":[],"text":"\u{1F600} é"}],"type":"paragraph"}],"format":"rich_text.v1"}',
    );
  });
});

describe('EC-084 rich_text.v1 verdicts and bounds: TypeScript equals PostgreSQL', () => {
  it.each(VALID)('both validators admit %s', (_name, value) => {
    expect(isRichTextV1(value)).toBe(true);
    expect(pgText('platform_private.cms_rich_text_v1_valid', value)).toBe('t');
  });

  it.each(INVALID)('both validators refuse %s', (_name, value) => {
    expect(isRichTextV1(value)).toBe(false);
    expect(pgText('platform_private.cms_rich_text_v1_valid', value)).toBe('f');
  });
});

describe('EC-085 the protected rich_text.v1@1 descriptor is identical in TypeScript and PostgreSQL', () => {
  const body = (): unknown =>
    JSON.parse(
      psql(
        `select platform_private.cms_protected_validator_descriptor_body('rich_text.v1', 1)::text`,
      ),
    );

  it('holds the same descriptor body, member for member', () => {
    expect(body()).toEqual(RICH_TEXT_V1_DESCRIPTOR);
  });

  it('hashes it to the same JCS SHA-256 in TypeScript, in PostgreSQL and in the pinned constant', async () => {
    const hash = await canonicalHash(RICH_TEXT_V1_DESCRIPTOR);
    expect(hash).toBe(RICH_TEXT_V1_ARTIFACT_HASH);
    expect(
      psql(
        `select platform_private.cms_jcs_sha256(platform_private.cms_protected_validator_descriptor_body('rich_text.v1', 1))`,
      ),
    ).toBe(hash);
    expect(
      pgText(
        'platform_private.cms_jcs',
        JSON.parse(JSON.stringify(RICH_TEXT_V1_DESCRIPTOR)) as Json,
      ),
    ).toBe(canonicalJson(RICH_TEXT_V1_DESCRIPTOR));
  });

  it('returns the same registry entry (key, version, artifact reference, hash) and nothing for any other member', () => {
    const entry = JSON.parse(
      psql(
        `select platform_private.cms_protected_validator_descriptor('rich_text.v1', 1)::text`,
      ),
    ) as unknown;
    expect(entry).toEqual(protectedValidatorDescriptor('rich_text.v1', 1));
    expect(entry).toEqual({
      key: 'rich_text.v1',
      version: 1,
      artifactRef: RICH_TEXT_V1_ARTIFACT_REF,
      artifactHash: RICH_TEXT_V1_ARTIFACT_HASH,
    });
    for (const [key, version] of [
      ['rich_text.v1', 2],
      ['rich_text.v2', 1],
      ['free.form', 1],
    ] as const) {
      expect(
        psql(
          `select coalesce(platform_private.cms_protected_validator_descriptor('${key}', ${String(version)})::text, 'none')`,
        ),
      ).toBe('none');
      expect(protectedValidatorDescriptor(key, version)).toBeNull();
    }
  });

  it('pins the very bounds the grammar enforces: the descriptor bounds equal the verdicts of both validators', () => {
    const { bounds, headingLevels, listDepths } = RICH_TEXT_V1_DESCRIPTOR;
    const at = (count: number): Json =>
      doc(...Array.from({ length: count }, () => paragraph(span('x'))));
    expect([
      isRichTextV1(at(bounds.blocks)),
      isRichTextV1(at(bounds.blocks + 1)),
    ]).toEqual([true, false]);
    const atSpans = (count: number): Json =>
      doc(
        paragraph(
          ...Array.from({ length: count }, (_, i) =>
            span(`s${String(i)}`, i % 2 === 0 ? ['bold'] : []),
          ),
        ),
      );
    expect([
      isRichTextV1(atSpans(bounds.spansPerBlock)),
      isRichTextV1(atSpans(bounds.spansPerBlock + 1)),
    ]).toEqual([true, false]);
    expect(Math.max(...listDepths)).toBe(3);
    expect(Math.max(...headingLevels)).toBe(4);
  });
});
