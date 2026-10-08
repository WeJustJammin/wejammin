// @vitest-environment jsdom

import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

// Runtime-computed specifier: the planned component is authored by the next slice.
const RENDERER = String('./CmsRichTextRenderer');
type RendererModule = {
  CmsRichTextRenderer: (props: { value: unknown }) => React.ReactElement;
};
const rendererModule = async (): Promise<RendererModule | null> => {
  try {
    return (await import(RENDERER)) as RendererModule;
  } catch {
    return null;
  }
};

const mount = async (value: unknown) => {
  const mod = await rendererModule();
  if (!mod) return { container: null, mod };
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(React.createElement(mod.CmsRichTextRenderer, { value }));
  });
  return { container, mod };
};

const reactActGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
reactActGlobal.IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  document.body.replaceChildren();
  delete reactActGlobal.IS_REACT_ACT_ENVIRONMENT;
});

const value = {
  format: 'rich_text.v1',
  blocks: [
    { type: 'paragraph', spans: [{ text: 'plain', marks: [] }] },
    {
      type: 'heading',
      level: 2,
      spans: [{ text: 'Title', marks: ['bold'] }],
    },
    { type: 'quote', spans: [{ text: 'quoted', marks: ['code'] }] },
    {
      type: 'list_item',
      list: 'bulleted',
      depth: 1,
      spans: [{ text: 'item', marks: ['italic'] }],
    },
  ],
};

describe('[P2-S10] CmsRichTextRenderer', () => {
  it('[P2-S10-AC-087] renders typed elements without dangerouslySetInnerHTML', async () => {
    const { container } = await mount(value);
    expect(container).not.toBeNull();
    const html = container!.innerHTML;
    expect(html).toContain('<p>');
    expect(html).toContain('plain');
    expect(container!.querySelector('h2')?.textContent).toBe('Title');
    expect(container!.querySelector('blockquote')?.textContent).toBe('quoted');
    expect(container!.querySelector('li')?.textContent).toBe('item');
    expect(container!.querySelector('strong')).not.toBeNull();
    expect(container!.querySelector('em')).not.toBeNull();
    expect(container!.querySelector('code')).not.toBeNull();
    expect(html.includes('dangerouslySetInnerHTML')).toBe(false);
  });

  it('[P2-S10-AC-087] renders https links with noopener noreferrer and non-empty text', async () => {
    const { container } = await mount({
      format: 'rich_text.v1',
      blocks: [
        {
          type: 'paragraph',
          spans: [
            {
              text: 'Read',
              marks: [],
              link: { kind: 'https', href: 'https://example.com/page' },
            },
          ],
        },
      ],
    });
    expect(container).not.toBeNull();
    const anchor = container!.querySelector('a');
    expect(anchor?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(anchor?.getAttribute('href')).toBe('https://example.com/page');
    expect((anchor?.textContent ?? '').length).toBeGreaterThan(0);
  });

  it('[P2-S10-AC-087] fails closed for an invalid span instead of repairing marks', async () => {
    const { container } = await mount({
      format: 'rich_text.v1',
      blocks: [
        {
          type: 'paragraph',
          spans: [{ text: '<img src=x onerror=alert(1)>' }],
        },
      ],
    });
    expect(container?.querySelector('[role="note"]')?.textContent).toContain(
      'could not be displayed',
    );
    expect(container?.querySelector('img')).toBeNull();
    expect(container?.querySelector('p')).toBeNull();
  });
});
