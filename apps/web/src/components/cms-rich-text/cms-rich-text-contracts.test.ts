import { describe, expect, it } from 'vitest';

import { RichTextV1Schema } from '@wejammin/contracts';

// Runtime-computed specifier: the planned module is authored by the next slice.
const RICH_TEXT_CONTRACTS = String('./cms-rich-text-contracts');
type RichTextContractsModule = {
  RichTextV1DocumentSchema: {
    safeParse(value: unknown): { success: boolean };
  };
  RichTextSpanSchema: {
    safeParse(value: unknown): { success: boolean };
  };
};
const richTextModule = async (): Promise<RichTextContractsModule | null> => {
  try {
    return (await import(RICH_TEXT_CONTRACTS)) as RichTextContractsModule;
  } catch {
    return null;
  }
};

const document = (blocks: unknown[]) => ({ format: 'rich_text.v1', blocks });
const span = (
  text: string,
  marks: string[] = [],
  link?: {
    kind: string;
    href?: string;
    route?: string;
    address?: string;
  },
) => ({ text, marks, link });
const paragraph = (spans: unknown[]) => ({ type: 'paragraph', spans });

describe('[P2-S10] rich_text.v1 contract projection', () => {
  it('[P2-S10-AC-082][P2-S10-AC-083] exposes the canonical block document and span/link grammar', async () => {
    const mod = await richTextModule();
    expect(mod).not.toBeNull();
    const doc = document([
      paragraph([span('hello', ['bold'])]),
      { type: 'list_item', list: 'bulleted', depth: 1, spans: [span('item')] },
    ]);
    expect(RichTextV1Schema.safeParse(doc).success).toBe(true);
    expect(mod!.RichTextV1DocumentSchema.safeParse(doc).success).toBe(true);
    expect(
      mod!.RichTextSpanSchema.safeParse({
        text: 'a',
        marks: ['bold'],
        link: { kind: 'https', href: 'https://example.com/x' } as unknown as {
          kind: string;
          href: string;
        },
      }).success,
    ).toBe(true);
  });

  it('[P2-S10-AC-083] refuses non-canonical and unsafe documents', async () => {
    const mod = await richTextModule();
    const doc = document([paragraph([span('a', ['italic', 'bold'])])]);
    expect(RichTextV1Schema.safeParse(doc).success).toBe(false);
    expect(mod!.RichTextV1DocumentSchema.safeParse(doc).success).toBe(false);
    expect(
      mod!.RichTextV1DocumentSchema.safeParse(
        document([
          paragraph([
            span('a', [], {
              kind: 'https',
              href: 'http://x',
            } as unknown as {
              kind: string;
              href: string;
            }),
          ]),
        ]),
      ).success,
    ).toBe(false);
    expect(
      mod!.RichTextV1DocumentSchema.safeParse(
        document([
          paragraph([
            span('a', [], {
              kind: 'internal',
              route: '/\\\\evil.example',
            } as unknown as { kind: string; route: string }),
          ]),
        ]),
      ).success,
    ).toBe(false);
  });
});

/**
 * Codex review s10-ts-2, L1 and the browser half of M3: the browser projection
 * must accept and refuse exactly what the shared `RichTextV1Schema` (and so
 * PostgreSQL `cms_rich_text_v1_valid`) accepts and refuses. Lengths count
 * Unicode characters (code points), never UTF-16 units, and text PostgreSQL
 * `jsonb` cannot store (lone surrogates, NUL) is refused before submit.
 */
describe('[P2-S10] rich_text.v1 browser projection parity with the shared schema', () => {
  const spanDocument = (
    text: string,
    link?: Record<string, unknown>,
  ): unknown =>
    document([
      paragraph([
        link === undefined ? span(text) : span(text, [], link as never),
      ]),
    ]);

  const probes: readonly { readonly name: string; readonly value: unknown }[] =
    [
      {
        name: 'mailto of 200 emoji plus @x (202 characters, 402 UTF-16 units)',
        value: spanDocument('mail', {
          kind: 'mailto',
          address: '\u{1F600}'.repeat(200) + '@x',
        }),
      },
      {
        name: 'mailto at exactly 254 characters made of astral characters',
        value: spanDocument('mail', {
          kind: 'mailto',
          address: '\u{1F600}'.repeat(252) + '@x',
        }),
      },
      {
        name: 'mailto at 255 characters made of astral characters',
        value: spanDocument('mail', {
          kind: 'mailto',
          address: '\u{1F600}'.repeat(253) + '@x',
        }),
      },
      {
        name: 'lone high surrogate in span text',
        value: spanDocument('a\uD800'),
      },
      {
        name: 'lone low surrogate in span text',
        value: spanDocument('\uDC00b'),
      },
      { name: 'astral pair in span text', value: spanDocument('a\u{1F600}b') },
      {
        name: 'lone surrogate in an https href',
        value: spanDocument('l', {
          kind: 'https',
          href: 'https://x.example/\uD800',
        }),
      },
      {
        name: 'lone surrogate in a mailto address',
        value: spanDocument('l', {
          kind: 'mailto',
          address: 'a\uDC00@x.example',
        }),
      },
      {
        name: 'lone surrogate in an internal route',
        value: spanDocument('l', { kind: 'internal', route: '/a/\uD800' }),
      },
      {
        name: 'internal route with a dot segment',
        value: spanDocument('l', { kind: 'internal', route: '/a/../b' }),
      },
      {
        name: 'internal route with a backslash',
        value: spanDocument('l', { kind: 'internal', route: '/a\\b' }),
      },
      {
        name: 'ordinary https link',
        value: spanDocument('l', {
          kind: 'https',
          href: 'https://x.example/a_b',
        }),
      },
    ];

  for (const probe of probes)
    it(`agrees with the shared schema: ${probe.name}`, async () => {
      const mod = await richTextModule();
      const shared = RichTextV1Schema.safeParse(probe.value).success;
      expect(mod!.RichTextV1DocumentSchema.safeParse(probe.value).success).toBe(
        shared,
      );
    });

  it('L1: admits a 202-character mailto address that the browser used to refuse by UTF-16 length', async () => {
    const mod = await richTextModule();
    const value = spanDocument('mail', {
      kind: 'mailto',
      address: '\u{1F600}'.repeat(200) + '@x',
    });
    expect(RichTextV1Schema.safeParse(value).success).toBe(true);
    expect(mod!.RichTextV1DocumentSchema.safeParse(value).success).toBe(true);
  });

  it('M3: refuses a span whose text is not well-formed Unicode (the span schema alone)', async () => {
    const mod = await richTextModule();
    expect(
      mod!.RichTextSpanSchema.safeParse({ text: 'a\uD800', marks: [] }).success,
    ).toBe(false);
    expect(
      mod!.RichTextSpanSchema.safeParse({ text: 'a\u{1F600}', marks: [] })
        .success,
    ).toBe(true);
  });
});
