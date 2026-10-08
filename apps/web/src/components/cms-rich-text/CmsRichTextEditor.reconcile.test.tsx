// @vitest-environment jsdom

import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
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

/** The same document with every object's keys in the opposite order. */
const reordered = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(reordered)
    : typeof value === 'object' && value !== null
      ? Object.fromEntries(
          Object.entries(value)
            .reverse()
            .map(([key, entry]) => [key, reordered(entry)]),
        )
      : value;

interface Mounted {
  readonly container: HTMLElement;
  readonly root: Root;
  readonly emitted: unknown[];
  readonly render: (value: unknown) => void;
}

const mount = (value: unknown): Mounted => {
  reactActGlobal.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const emitted: unknown[] = [];
  const render = (next: unknown): void =>
    act(() =>
      root.render(
        React.createElement(CmsRichTextEditor, {
          value: next,
          onChange: (changed: unknown) => emitted.push(changed),
        }),
      ),
    );
  render(value);
  return { container, root, emitted, render };
};

const textareas = (container: HTMLElement): HTMLTextAreaElement[] =>
  Array.from(container.querySelectorAll('textarea'));

const type = async (textarea: HTMLTextAreaElement, text: string) => {
  await act(async () => {
    textarea.value = text;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

afterEach(() => {
  document.body.replaceChildren();
  delete reactActGlobal.IS_REACT_ACT_ENVIRONMENT;
});

/**
 * Codex review s10-ts-2, H4: the editor hydrated its blocks once, so when the
 * parent adopted a canonical document (conflict reconciliation, "discard and
 * load current") the UI kept showing the old text and the next edit was
 * assembled from it, overwriting the document the parent had just adopted.
 */
describe('H4: CmsRichTextEditor follows a canonical value the parent adopts', () => {
  it('shows the adopted document and builds the next edit from it', async () => {
    const view = mount(doc('Document A'));
    expect(textareas(view.container).map((node) => node.value)).toEqual([
      'Document A',
    ]);
    view.render(doc('Document B', 'Second block'));
    expect(textareas(view.container).map((node) => node.value)).toEqual([
      'Document B',
      'Second block',
    ]);
    await type(textareas(view.container)[0]!, 'Document B edited');
    expect(view.emitted).toEqual([doc('Document B edited', 'Second block')]);
  });

  it('does not rehydrate for the echo of its own edit, even with reordered keys', async () => {
    const view = mount(doc('Start'));
    const before = textareas(view.container)[0]!;
    await type(before, 'Typed text');
    expect(view.emitted).toEqual([doc('Typed text')]);
    // The parent hands the document it just received straight back.
    view.render(reordered(view.emitted[0]));
    const after = textareas(view.container)[0]!;
    expect(after).toBe(before);
    expect(after.value).toBe('Typed text');
  });

  it('recovers when an invalid value is replaced by a valid canonical one', () => {
    const view = mount({ format: 'rich_text.v1', blocks: 'not blocks' });
    expect(view.container.textContent).toContain('could not be edited');
    view.render(doc('Recovered'));
    expect(textareas(view.container).map((node) => node.value)).toEqual([
      'Recovered',
    ]);
  });

  it('keeps an unfinished invalid edit, says the text changed elsewhere, and loads the latest on request', async () => {
    const view = mount(doc('Start'));
    await type(textareas(view.container)[0]!, 'half [[typed');
    expect(view.emitted).toEqual([]);
    view.render(doc('Adopted elsewhere'));
    expect(textareas(view.container)[0]!.value).toBe('half [[typed');
    const notice = view.container.querySelector('[data-rich-text-stale]');
    expect(notice?.textContent).toContain('changed elsewhere');
    const load = notice!.querySelector('button')!;
    expect(load.textContent).toContain('Load the latest text');
    act(() => load.click());
    expect(textareas(view.container)[0]!.value).toBe('Adopted elsewhere');
    expect(view.container.querySelector('[data-rich-text-stale]')).toBeNull();
    await type(textareas(view.container)[0]!, 'Adopted elsewhere, edited');
    expect(view.emitted).toEqual([doc('Adopted elsewhere, edited')]);
  });

  it('clears the notice when the parent value returns to the document the editor holds', async () => {
    const view = mount(doc('Start'));
    await type(textareas(view.container)[0]!, 'half [[typed');
    view.render(doc('Elsewhere'));
    expect(
      view.container.querySelector('[data-rich-text-stale]'),
    ).not.toBeNull();
    view.render(doc('Start'));
    expect(view.container.querySelector('[data-rich-text-stale]')).toBeNull();
    expect(textareas(view.container)[0]!.value).toBe('half [[typed');
  });
});

/**
 * Codex review s10-ts-2, H3 at the component: loading a valid document and
 * editing another block must emit every untouched block byte-identically.
 */
describe('H3: editing one block never rewrites another', () => {
  it('emits the untouched blocks exactly as loaded, including literal markup characters', async () => {
    const original = {
      format: 'rich_text.v1',
      blocks: [
        {
          type: 'paragraph',
          spans: [{ text: 'a_b and [c] and **d**', marks: [] }],
        },
        {
          type: 'heading',
          level: 3,
          spans: [
            { text: 'x', marks: ['bold'] },
            { text: ' y\\z`', marks: [] },
          ],
        },
        { type: 'paragraph', spans: [{ text: 'edit me', marks: [] }] },
      ],
    };
    const view = mount(original);
    await type(textareas(view.container)[2]!, 'edited');
    expect(view.emitted).toHaveLength(1);
    const next = view.emitted[0] as typeof original;
    expect(JSON.stringify(next.blocks.slice(0, 2))).toBe(
      JSON.stringify(original.blocks.slice(0, 2)),
    );
    expect(next.blocks[2]).toEqual({
      type: 'paragraph',
      spans: [{ text: 'edited', marks: [] }],
    });
  });
});
