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
  link?: { kind: string; href: string },
) => ({ text, marks, link });
const paragraph = (spans: unknown[]) => ({ type: 'paragraph', spans });

describe('[P2-S10] rich_text.v1 contract projection', () => {
  it('[P2-S10-AC-2201] exposes the canonical block document and span/link grammar', async () => {
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

  it('[P2-S10-AC-2202] refuses non-canonical and unsafe documents', async () => {
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
  });
});
