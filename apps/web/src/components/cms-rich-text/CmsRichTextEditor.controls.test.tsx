// @vitest-environment jsdom

import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import { CmsRichTextEditor } from './CmsRichTextEditor';

const reactActGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

const doc = (...blocks: unknown[]) => ({ format: 'rich_text.v1', blocks });
const paragraph = (...spans: unknown[]) => ({ type: 'paragraph', spans });
const span = (text: string, marks: string[] = [], link?: unknown) => ({
  text,
  marks,
  ...(link === undefined ? {} : { link }),
});

const mount = (value: unknown) => {
  reactActGlobal.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const emitted: unknown[] = [];
  act(() =>
    root.render(
      React.createElement(CmsRichTextEditor, {
        value,
        onChange: (changed: unknown) => emitted.push(changed),
      }),
    ),
  );
  return { container, emitted };
};

const textarea = (container: HTMLElement, index = 0): HTMLTextAreaElement =>
  container.querySelectorAll('textarea')[index] as HTMLTextAreaElement;

const select = async (
  node: HTMLTextAreaElement,
  start: number,
  end: number,
): Promise<void> => {
  await act(async () => {
    node.focus();
    node.setSelectionRange(start, end);
    node.dispatchEvent(new Event('select', { bubbles: true }));
    node.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
  });
};

const button = (container: HTMLElement, name: string): HTMLButtonElement => {
  const found = Array.from(container.querySelectorAll('button')).find(
    (candidate) => candidate.textContent?.trim() === name,
  );
  if (found === undefined) throw new Error(`No button ${name}`);
  return found as HTMLButtonElement;
};

const click = async (element: HTMLElement): Promise<void> => {
  await act(async () => element.click());
};

const typeInto = async (input: HTMLInputElement, text: string) => {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set;
  await act(async () => {
    setter?.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

const key = async (
  element: HTMLElement,
  name: string,
): Promise<KeyboardEvent> => {
  const event = new KeyboardEvent('keydown', {
    key: name,
    bubbles: true,
    cancelable: true,
  });
  await act(async () => {
    element.dispatchEvent(event);
  });
  return event;
};

const addressInput = (container: HTMLElement): HTMLInputElement =>
  container.querySelector(
    'input[data-rich-text-link-address]',
  ) as HTMLInputElement;

afterEach(() => {
  document.body.replaceChildren();
  delete reactActGlobal.IS_REACT_ACT_ENVIRONMENT;
});

/**
 * AC-086 (FE03 CmsRichTextEditor): native, labelled MARK and LINK controls with keyboard, focus and
 * error behavior. They act on the selection through the canonical spans, so the markup stays
 * lossless and no JSON or HTML is ever shown.
 */
describe('mark controls', () => {
  it('offers Bold, Italic and Code toggles and a Link control in a labelled toolbar for every block', () => {
    const { container } = mount(
      doc(paragraph(span('one')), {
        type: 'heading',
        level: 2,
        spans: [span('two')],
      }),
    );
    const toolbars = container.querySelectorAll('[role="toolbar"]');
    expect(toolbars).toHaveLength(2);
    expect(toolbars[0]?.getAttribute('aria-label')).toBe('Text formatting');
    for (const name of ['Bold', 'Italic', 'Code'])
      expect(
        Array.from(toolbars[0]!.querySelectorAll('button'))
          .find((b) => b.textContent === name)
          ?.getAttribute('aria-pressed'),
      ).toBe('false');
    expect(
      Array.from(toolbars[1]!.querySelectorAll('button')).some(
        (b) => b.textContent === 'Link',
      ),
    ).toBe(true);
  });

  it('applies Bold to the selected text, updates the textarea and emits the canonical AST', async () => {
    const { container, emitted } = mount(doc(paragraph(span('plain text'))));
    const area = textarea(container);
    await select(area, 6, 10);
    await click(button(container, 'Bold'));
    expect(area.value).toBe('plain **text**');
    expect(emitted.at(-1)).toEqual(
      doc(paragraph(span('plain '), span('text', ['bold']))),
    );
    expect(button(container, 'Bold').getAttribute('aria-pressed')).toBe('true');
    // The selection follows the text and the textarea has the focus again.
    expect(document.activeElement).toBe(area);
    expect([area.selectionStart, area.selectionEnd]).toEqual([8, 12]);
  });

  it('toggles it off again, and reports the pressed state for the selection', async () => {
    const { container, emitted } = mount(
      doc(paragraph(span('plain '), span('text', ['bold']))),
    );
    const area = textarea(container);
    await select(area, 8, 12);
    expect(button(container, 'Bold').getAttribute('aria-pressed')).toBe('true');
    expect(button(container, 'Italic').getAttribute('aria-pressed')).toBe(
      'false',
    );
    await click(button(container, 'Bold'));
    expect(area.value).toBe('plain text');
    expect(emitted.at(-1)).toEqual(doc(paragraph(span('plain text'))));
  });

  it('says what to do, politely, when nothing is selected, and changes nothing', async () => {
    const { container, emitted } = mount(doc(paragraph(span('plain text'))));
    await select(textarea(container), 3, 3);
    await click(button(container, 'Italic'));
    const status = container.querySelector(
      '[role="status"][data-rich-text-message]',
    );
    expect(status?.textContent).toBe('Select the text to format first.');
    expect(textarea(container).value).toBe('plain text');
    expect(emitted).toEqual([]);
  });

  it('keeps literal markup characters literal (lossless): the control never splices markers', async () => {
    const { container, emitted } = mount(doc(paragraph(span('snake_case'))));
    const area = textarea(container);
    expect(area.value).toBe('snake\\_case');
    await select(area, 7, 11);
    await click(button(container, 'Code'));
    expect(emitted.at(-1)).toEqual(
      doc(paragraph(span('snake_'), span('case', ['code']))),
    );
  });
});

describe('link controls', () => {
  const linked = doc(
    paragraph(
      span('read the '),
      span('docs', [], { kind: 'https', href: 'https://example.com/old' }),
    ),
  );

  it('opens an inline address field with focus, applies a https link on Enter and returns focus to the text', async () => {
    const { container, emitted } = mount(doc(paragraph(span('read the docs'))));
    const area = textarea(container);
    await select(area, 9, 13);
    await click(button(container, 'Link'));
    const input = addressInput(container);
    expect(input).not.toBeNull();
    expect(document.activeElement).toBe(input);
    expect(input.getAttribute('aria-label') ?? container.textContent).toContain(
      'Link address',
    );
    await typeInto(input, 'https://example.com/docs');
    const enter = await key(input, 'Enter');
    // Enter must not reach the surrounding form (that would be Save draft).
    expect(enter.defaultPrevented).toBe(true);
    expect(emitted.at(-1)).toEqual(
      doc(
        paragraph(
          span('read the '),
          span('docs', [], { kind: 'https', href: 'https://example.com/docs' }),
        ),
      ),
    );
    expect(addressInput(container)).toBeNull();
    expect(document.activeElement).toBe(area);
  });

  it('accepts a mailto address and a safe internal route', async () => {
    for (const [address, expected] of [
      [
        'mailto:team@example.com',
        { kind: 'mailto', address: 'team@example.com' },
      ],
      ['/app/home', { kind: 'internal', route: '/app/home' }],
    ] as const) {
      document.body.replaceChildren();
      const { container, emitted } = mount(doc(paragraph(span('go home'))));
      await select(textarea(container), 3, 7);
      await click(button(container, 'Link'));
      await typeInto(addressInput(container), address);
      await click(button(container, 'Apply link'));
      expect(emitted.at(-1)).toEqual(
        doc(paragraph(span('go '), span('home', [], expected))),
      );
    }
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,x',
    '//evil.example',
    'http://insecure.example',
  ])(
    'refuses %s inline, names it, marks the field invalid, keeps focus and changes nothing',
    async (address) => {
      const { container, emitted } = mount(
        doc(paragraph(span('read the docs'))),
      );
      await select(textarea(container), 9, 13);
      await click(button(container, 'Link'));
      const input = addressInput(container);
      await typeInto(input, address);
      await click(button(container, 'Apply link'));
      const alert = container.querySelector(
        '[role="alert"][data-rich-text-link-error]',
      );
      expect(alert?.textContent).toContain('That link is not allowed.');
      expect(alert?.textContent).toContain(address);
      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(input.getAttribute('aria-describedby')).toBe(alert?.id);
      expect(document.activeElement).toBe(input);
      expect(emitted).toEqual([]);
      expect(textarea(container).value).toBe('read the docs');
    },
  );

  it('asks for an address when it is empty', async () => {
    const { container, emitted } = mount(doc(paragraph(span('read the docs'))));
    await select(textarea(container), 9, 13);
    await click(button(container, 'Link'));
    await click(button(container, 'Apply link'));
    expect(
      container.querySelector('[data-rich-text-link-error]')?.textContent,
    ).toBe('Enter a link address.');
    expect(emitted).toEqual([]);
  });

  it('asks for a selection instead of opening the field when no text is selected', async () => {
    const { container } = mount(doc(paragraph(span('read the docs'))));
    await select(textarea(container), 4, 4);
    await click(button(container, 'Link'));
    expect(addressInput(container)).toBeNull();
    expect(
      container.querySelector('[role="status"][data-rich-text-message]')
        ?.textContent,
    ).toBe('Select the text to link first.');
  });

  it('Escape closes the field before anything changes and returns focus to the Link control', async () => {
    const { container, emitted } = mount(doc(paragraph(span('read the docs'))));
    await select(textarea(container), 9, 13);
    const link = button(container, 'Link');
    await click(link);
    const input = addressInput(container);
    await typeInto(input, 'https://example.com/');
    await key(input, 'Escape');
    expect(addressInput(container)).toBeNull();
    expect(document.activeElement).toBe(link);
    expect(emitted).toEqual([]);
  });

  it('edits an existing link: the field is prefilled and the new address replaces it', async () => {
    const { container, emitted } = mount(linked);
    const area = textarea(container);
    await select(area, 10, 14);
    expect(button(container, 'Link').getAttribute('aria-pressed')).toBe('true');
    await click(button(container, 'Link'));
    const input = addressInput(container);
    expect(input.value).toBe('https://example.com/old');
    await typeInto(input, 'https://example.com/new');
    await click(button(container, 'Apply link'));
    expect(emitted.at(-1)).toEqual(
      doc(
        paragraph(
          span('read the '),
          span('docs', [], { kind: 'https', href: 'https://example.com/new' }),
        ),
      ),
    );
  });

  it('removes a link and keeps its text', async () => {
    const { container, emitted } = mount(linked);
    await select(textarea(container), 10, 14);
    await click(button(container, 'Link'));
    await click(button(container, 'Remove link'));
    expect(emitted.at(-1)).toEqual(doc(paragraph(span('read the docs'))));
    expect(textarea(container).value).toBe('read the docs');
    expect(document.activeElement).toBe(textarea(container));
  });

  it('offers Remove link only for a selection that is a link', async () => {
    const { container } = mount(doc(paragraph(span('read the docs'))));
    await select(textarea(container), 9, 13);
    await click(button(container, 'Link'));
    expect(
      Array.from(container.querySelectorAll('button')).some(
        (b) => b.textContent === 'Remove link',
      ),
    ).toBe(false);
  });
});

describe('the controls expose no raw JSON or HTML', () => {
  it('shows labelled controls and text only', async () => {
    const { container } = mount(doc(paragraph(span('read the docs'))));
    await select(textarea(container), 9, 13);
    await click(button(container, 'Link'));
    expect(container.textContent).not.toContain('{"');
    expect(container.innerHTML).not.toContain('&lt;');
    expect(container.querySelector('input[type="hidden"]')).toBeNull();
  });
});
