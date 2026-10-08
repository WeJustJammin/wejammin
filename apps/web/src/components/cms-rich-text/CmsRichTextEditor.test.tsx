// @vitest-environment jsdom

import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

// Runtime-computed specifier: the planned component is authored by the next slice.
const EDITOR = String('./CmsRichTextEditor');
type EditorModule = {
  CmsRichTextEditor: (props: {
    value: unknown;
    onChange?: (value: unknown) => void;
    label?: string;
  }) => React.ReactElement;
};
const editorModule = async (): Promise<EditorModule | null> => {
  try {
    return (await import(EDITOR)) as EditorModule;
  } catch {
    return null;
  }
};

const reactActGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
reactActGlobal.IS_REACT_ACT_ENVIRONMENT = true;

const initial = {
  format: 'rich_text.v1',
  blocks: [
    {
      type: 'paragraph',
      spans: [
        { text: 'plain ', marks: [] },
        { text: 'bold', marks: ['bold'] },
      ],
    },
  ],
};

const mount = async (props: {
  value: unknown;
  onChange?: (value: unknown) => void;
}) => {
  const mod = await editorModule();
  if (!mod) return { container: null, root: null, mod };
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(React.createElement(mod.CmsRichTextEditor, props)));
  return { container, root, mod };
};

const typeTextarea = async (
  container: HTMLElement,
  root: Root,
  text: string,
) => {
  const textarea = container.querySelector('textarea');
  expect(textarea).not.toBeNull();
  await act(async () => {
    textarea!.value = text;
    textarea!.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

afterEach(() => {
  document.body.replaceChildren();
  delete reactActGlobal.IS_REACT_ACT_ENVIRONMENT;
});

describe('[P2-S10] CmsRichTextEditor', () => {
  it('[P2-S10-AC-086] parses constrained markup to a canonical AST and offers native block controls', async () => {
    let submitted: unknown = null;
    const { container, root } = await mount({
      value: initial,
      onChange: (next: unknown) => {
        submitted = next;
      },
    });
    expect(container).not.toBeNull();
    const textarea = container!.querySelector('textarea');
    expect(textarea).not.toBeNull();
    expect(container!.querySelector('select')).not.toBeNull();
    const reorderControls = container!.querySelectorAll(
      '[data-rich-text-move-up], [data-rich-text-move-down]',
    );
    expect(reorderControls.length).toBeGreaterThan(0);
    await typeTextarea(container!, root!, '**bold** text');
    const doc = submitted as {
      blocks: { spans: { text: string; marks: string[] }[] }[];
    };
    // Markers toggle (Codex review s10-ts-2, H3): the closing `**` ends bold, so
    // the span list stays expressible in markup and loads back byte-identically.
    expect(doc?.blocks?.[0]?.spans).toEqual([
      { text: 'bold', marks: ['bold'] },
      { text: ' text', marks: [] },
    ]);
  });

  it('[P2-S10-AC-086] refuses non-canonical markup inline before submit', async () => {
    let submitted: unknown = null;
    const { container, root } = await mount({
      value: initial,
      onChange: (next: unknown) => {
        submitted = next;
      },
    });
    await typeTextarea(container!, root!, 'ok [[bold]] text');
    expect(submitted).toBeNull();
    expect(container!.textContent).toContain('rich_text_not_canonical');
  });

  it('[P2-S10-AC-086] rejects unsafe link schemes inline before submit', async () => {
    let submitted: unknown = null;
    const { container, root } = await mount({
      value: initial,
      onChange: (next: unknown) => {
        submitted = next;
      },
    });
    await typeTextarea(container!, root!, 'text [link](javascript:alert(1))');
    expect(submitted).toBeNull();
    expect(container!.textContent).toContain('javascript:');
  });

  it('[P2-S10-AC-086] round-trips supported mailto and internal links', async () => {
    let submitted: unknown = null;
    const { container, root } = await mount({
      value: {
        format: 'rich_text.v1',
        blocks: [
          {
            type: 'paragraph',
            spans: [
              {
                text: 'Email',
                marks: [],
                link: { kind: 'mailto', address: 'team@example.com' },
              },
              {
                text: 'Home',
                marks: [],
                link: { kind: 'internal', route: '/app/home' },
              },
            ],
          },
        ],
      },
      onChange: (next: unknown) => {
        submitted = next;
      },
    });
    await typeTextarea(
      container!,
      root!,
      '[Email](mailto:team@example.com) [Home](/app/home)',
    );
    expect(submitted).toEqual({
      format: 'rich_text.v1',
      blocks: [
        {
          type: 'paragraph',
          spans: [
            {
              text: 'Email',
              marks: [],
              link: { kind: 'mailto', address: 'team@example.com' },
            },
            { text: ' ', marks: [] },
            {
              text: 'Home',
              marks: [],
              link: { kind: 'internal', route: '/app/home' },
            },
          ],
        },
      ],
    });
  });

  it('[P2-S10-AC-086] refuses an invalid initial document without editing it', async () => {
    let submitted: unknown = null;
    const { container } = await mount({
      value: {
        format: 'rich_text.v1',
        blocks: [{ type: 'paragraph', spans: [{ text: 'missing marks' }] }],
      },
      onChange: (next: unknown) => {
        submitted = next;
      },
    });
    expect(container!.querySelector('[role="alert"]')?.textContent).toContain(
      'could not be edited',
    );
    expect(container!.querySelector('textarea')).toBeNull();
    expect(submitted).toBeNull();
  });

  it('[P2-S10-AC-086] names each preview region after its own editor, so several editors on one page keep unique landmarks', async () => {
    const mod = await editorModule();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() =>
      root.render(
        React.createElement(
          React.Fragment,
          null,
          React.createElement(mod!.CmsRichTextEditor, {
            value: initial,
            label: 'Body',
          }),
          React.createElement(mod!.CmsRichTextEditor, {
            value: initial,
            label: 'Summary',
          }),
        ),
      ),
    );
    const names = Array.from(container.querySelectorAll('[role="region"]')).map(
      (region) => region.getAttribute('aria-label'),
    );
    expect(names).toEqual(['Body preview', 'Summary preview']);
  });
});
