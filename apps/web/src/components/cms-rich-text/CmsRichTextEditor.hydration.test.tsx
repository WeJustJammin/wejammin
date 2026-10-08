// @vitest-environment jsdom

import * as React from 'react';
import { act } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';

import { CmsRichTextEditor } from './CmsRichTextEditor';

const reactActGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

const doc = (...paragraphs: string[]) => ({
  format: 'rich_text.v1',
  blocks: paragraphs.map((text) => ({
    type: 'paragraph',
    spans: [{ text, marks: [] }],
  })),
});

/**
 * A real keystroke changes the control through the browser's own value setter,
 * which React's value tracker does not see, then fires a bubbling `input`.
 */
const typeLikeABrowser = async (
  textarea: HTMLTextAreaElement,
  text: string,
): Promise<void> => {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    'value',
  )?.set;
  await act(async () => {
    setter?.call(textarea, text);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

afterEach(() => {
  document.body.replaceChildren();
  delete reactActGlobal.IS_REACT_ACT_ENVIRONMENT;
});

/**
 * Lane P (real browser, built app): typing into the server-rendered editor was
 * reverted. The block ids came from a module counter, so the server HTML carried
 * `data-block-id="rtb-25"` while the hydrated client state held `rtb-1`; React
 * does not patch attributes on hydration, so the id the browser held matched no
 * block. jsdom specs that render only on the client could never see it.
 */
describe('rich text editor: server render and hydration agree', () => {
  const value = doc('Hello', 'Second block');

  it('renders identical HTML on every server render of the same props, so ids do not depend on module state', () => {
    const element = <CmsRichTextEditor value={value} />;
    const first = renderToString(element);
    renderToString(<CmsRichTextEditor value={doc('Another editor')} />);
    expect(renderToString(element)).toBe(first);
  });

  it('keeps what is typed into the hydrated, server-rendered editor and updates the preview', async () => {
    reactActGlobal.IS_REACT_ACT_ENVIRONMENT = true;
    const emitted: unknown[] = [];
    const element = (
      <CmsRichTextEditor
        value={value}
        onChange={(changed) => emitted.push(changed)}
      />
    );
    // Another editor was rendered on the server first, as on a real page.
    renderToString(<CmsRichTextEditor value={doc('Earlier editor')} />);
    const container = document.createElement('div');
    container.innerHTML = renderToString(element);
    document.body.appendChild(container);
    const serverIds = Array.from(
      container.querySelectorAll('textarea'),
      (textarea) => textarea.dataset.blockId,
    );
    await act(async () => {
      hydrateRoot(container, element);
    });
    const textareas = Array.from(container.querySelectorAll('textarea'));
    expect(textareas.map((textarea) => textarea.dataset.blockId)).toEqual(
      serverIds,
    );
    await typeLikeABrowser(textareas[0]!, 'Hello **world**');
    expect(textareas[0]!.value).toBe('Hello **world**');
    expect(container.querySelector('strong')?.textContent).toBe('world');
    expect(emitted).toEqual([
      {
        format: 'rich_text.v1',
        blocks: [
          {
            type: 'paragraph',
            spans: [
              { text: 'Hello ', marks: [] },
              { text: 'world', marks: ['bold'] },
            ],
          },
          { type: 'paragraph', spans: [{ text: 'Second block', marks: [] }] },
        ],
      },
    ]);
  });

  it("carries typed text through the editor's own input listener even when React's onChange never runs (real browsers: the value tracker saw no change)", async () => {
    reactActGlobal.IS_REACT_ACT_ENVIRONMENT = true;
    renderToString(<CmsRichTextEditor value={doc('Earlier editor')} />);
    const container = document.createElement('div');
    container.innerHTML = renderToString(<CmsRichTextEditor value={value} />);
    document.body.appendChild(container);
    await act(async () => {
      hydrateRoot(container, <CmsRichTextEditor value={value} />);
    });
    const textarea = container.querySelector('textarea')!;
    // Registered after the editor's own listener: React's root never sees it.
    textarea.addEventListener('input', (event) => event.stopPropagation());
    await typeLikeABrowser(textarea, 'Hello **world**');
    expect(container.querySelector('strong')?.textContent).toBe('world');
    expect(container.querySelector('textarea')!.value).toBe('Hello **world**');
  });

  it('keeps ids unique and stable across add, move and remove after hydration', async () => {
    reactActGlobal.IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement('div');
    container.innerHTML = renderToString(<CmsRichTextEditor value={value} />);
    document.body.appendChild(container);
    await act(async () => {
      hydrateRoot(container, <CmsRichTextEditor value={value} />);
    });
    const ids = (): string[] =>
      Array.from(
        container.querySelectorAll('textarea'),
        (textarea) => textarea.dataset.blockId ?? '',
      );
    const before = ids();
    const add = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Add block',
    )!;
    await act(async () => add.click());
    const afterAdd = ids();
    expect(afterAdd).toHaveLength(3);
    expect(new Set(afterAdd).size).toBe(3);
    expect(afterAdd.slice(0, 2)).toEqual(before);
    await act(async () =>
      container
        .querySelector<HTMLButtonElement>(
          '[data-rich-text-move-up]:not([disabled])',
        )!
        .click(),
    );
    expect([...ids()].sort()).toEqual([...afterAdd].sort());
    await act(async () => add.click());
    expect(new Set(ids()).size).toBe(4);
  });
});
