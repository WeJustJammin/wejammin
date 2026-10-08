import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { isRichTextV1 } from './structured-values.ts';

/**
 * P2-S10-AC-083 / AC-084 (audit WP-A4): rich_text.v1 link, text-unit and
 * merge-key parity between this TypeScript validator and
 * `platform_private.cms_rich_text_v1_valid(jsonb)`.
 *
 * The single source of truth for the corpus is the pgTAP file
 * `supabase/tests/phase_02_slice_10_rich_text_link_parity.sql`: its VALUES list
 * is parsed here and every row is run through the TypeScript validator, so the
 * two implementations can only agree or fail one of the two suites. Bound
 * units are asserted explicitly with the same astral-character boundaries the
 * SQL file asserts (BE03a "Unicode characters": code points, never UTF-16
 * units).
 */

const CORPUS_FILE = new URL(
  '../../../../supabase/tests/phase_02_slice_10_rich_text_link_parity.sql',
  import.meta.url,
);

type CorpusRow = Readonly<{
  label: string;
  kind: 'link' | 'doc';
  json: string;
  expected: boolean;
}>;

const ROW_PATTERN =
  /\(\s*'([^']*)'\s*,\s*'(link|doc)'\s*,\s*\$j\$([\s\S]*?)\$j\$\s*,\s*(true|false)\s*\)/g;

const readCorpus = (): readonly CorpusRow[] =>
  [...readFileSync(CORPUS_FILE, 'utf8').matchAll(ROW_PATTERN)].map((match) => ({
    label: match[1]!,
    kind: match[2] as 'link' | 'doc',
    json: match[3]!,
    expected: match[4] === 'true',
  }));

const wrapLink = (link: unknown): unknown => ({
  format: 'rich_text.v1',
  blocks: [
    {
      type: 'paragraph',
      spans: [{ text: 'x', marks: [], link }],
    },
  ],
});

const wrapText = (text: string): unknown => ({
  format: 'rich_text.v1',
  blocks: [{ type: 'paragraph', spans: [{ text, marks: [] }] }],
});

const EMOJI = '\u{1F600}';

describe('[P2-S10-AC-083] rich_text.v1 shared corpus parity with PostgreSQL', () => {
  const corpus = readCorpus();

  it('parses the shared corpus', () => {
    expect(corpus.length).toBeGreaterThanOrEqual(58);
    expect(new Set(corpus.map((row) => row.label)).size).toBe(corpus.length);
  });

  for (const row of corpus) {
    it(row.label, () => {
      const parsed: unknown = JSON.parse(row.json);
      const value = row.kind === 'link' ? wrapLink(parsed) : parsed;
      expect(isRichTextV1(value)).toBe(row.expected);
    });
  }
});

describe('[P2-S10-AC-084] rich_text.v1 bounds count Unicode characters like PostgreSQL', () => {
  it('accepts a span of exactly 10000 astral characters and refuses 10001', () => {
    expect(isRichTextV1(wrapText(EMOJI.repeat(10_000)))).toBe(true);
    expect(isRichTextV1(wrapText(EMOJI.repeat(10_001)))).toBe(false);
  });

  it('bounds an https href at 2048 characters', () => {
    const href = (count: number): unknown =>
      wrapLink({
        kind: 'https',
        href: 'https://a.example/' + EMOJI.repeat(count),
      });
    expect(isRichTextV1(href(2030))).toBe(true);
    expect(isRichTextV1(href(2031))).toBe(false);
  });

  it('bounds a mailto address at 254 characters', () => {
    const address = (count: number): unknown =>
      wrapLink({ kind: 'mailto', address: 'a@' + EMOJI.repeat(count) });
    expect(isRichTextV1(address(252))).toBe(true);
    expect(isRichTextV1(address(253))).toBe(false);
  });

  it('bounds an internal route at 2048 characters', () => {
    const route = (count: number): unknown =>
      wrapLink({ kind: 'internal', route: '/' + EMOJI.repeat(count) });
    expect(isRichTextV1(route(2047))).toBe(true);
    expect(isRichTextV1(route(2048))).toBe(false);
  });
});
