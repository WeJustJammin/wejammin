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
      spans: [{ text: 'plain ' }, { text: 'bold', marks: ['bold'] }],
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
  it('[P2-S10-AC-2221] parses constrained markup to a canonical AST and offers native block controls', async () => {
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
    expect(doc?.blocks?.[0]?.spans).toEqual([
      { text: 'bold text', marks: ['bold'] },
    ]);
  });

  it('[P2-S10-AC-2222] refuses non-canonical markup inline before submit', async () => {
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

  it('[P2-S10-AC-2223] rejects unsafe link schemes inline before submit', async () => {
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
});
