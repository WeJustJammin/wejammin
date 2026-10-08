// @vitest-environment jsdom

import * as React from 'react';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  buttonNamed,
  byLabel,
  choose,
  click,
  disableReactAct,
  enableReactAct,
  mountElement,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import CmsRichTextEditor from './CmsRichTextEditor';
import CmsRichTextRenderer from './CmsRichTextRenderer';

/**
 * Slice 10 evidence lane EC (P2-S10-AC-083 raw-HTML clause, AC-086, AC-087).
 * The renderer maps only schema-valid nodes to native elements and refuses
 * everything else with an inert notice; the constrained editor is native controls
 * and constrained markup, never a JSON or HTML box.
 */

beforeAll(enableReactAct);
afterAll(disableReactAct);
afterEach(() => document.body.replaceChildren());

const span = (
  text: string,
  marks: readonly string[] = [],
  link?: Record<string, unknown>,
) => ({ text, marks, ...(link === undefined ? {} : { link }) });
const doc = (...blocks: readonly unknown[]) => ({
  format: 'rich_text.v1',
  blocks,
});
const paragraph = (...spans: readonly unknown[]) => ({
  type: 'paragraph',
  spans,
});

describe('EC-087 the typed renderer maps only validated nodes to native elements', () => {
  it('renders every block, mark and link variant as its native element', () => {
    const { container } = mountElement(
      <CmsRichTextRenderer
        value={doc(
          paragraph(span('plain')),
          { type: 'heading', level: 2, spans: [span('H2')] },
          { type: 'heading', level: 3, spans: [span('H3')] },
          { type: 'heading', level: 4, spans: [span('H4')] },
          { type: 'quote', spans: [span('quoted')] },
          {
            type: 'list_item',
            list: 'bulleted',
            depth: 1,
            spans: [span('bullet')],
          },
          { type: 'paragraph', spans: [span('split')] },
          {
            type: 'list_item',
            list: 'numbered',
            depth: 1,
            spans: [span('number')],
          },
          paragraph(
            span('bold', ['bold']),
            span('italic', ['italic']),
            span('code', ['code']),
            span('both', ['bold', 'italic']),
            span('site', [], { kind: 'https', href: 'https://example.com/a' }),
            span('mail', [], { kind: 'mailto', address: 'team@example.com' }),
            span('home', [], { kind: 'internal', route: '/app/home' }),
          ),
        )}
      />,
    );
    const q = (selector: string) => container.querySelectorAll(selector).length;
    expect([
      q('h2'),
      q('h3'),
      q('h4'),
      q('blockquote'),
      q('ul > li'),
      q('ol > li'),
    ]).toEqual([1, 1, 1, 1, 1, 1]);
    expect([q('strong'), q('em'), q('code')]).toEqual([2, 2, 1]);
    const links = Array.from(container.querySelectorAll('a')).map((anchor) => [
      anchor.getAttribute('href'),
      anchor.getAttribute('rel'),
    ]);
    expect(links).toEqual([
      ['https://example.com/a', 'noopener noreferrer'],
      ['mailto:team@example.com', null],
      ['/app/home', null],
    ]);
  });

  it('renders HTML-looking text as inert text, never as markup', () => {
    const { container } = mountElement(
      <CmsRichTextRenderer
        value={doc(
          paragraph(span('<img src=x onerror=alert(1)>')),
          paragraph(span('<script>alert(1)</script> & <b>bold</b>', ['bold'])),
        )}
      />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(container.textContent).toContain(
      '<script>alert(1)</script> & <b>bold</b>',
    );
    expect(container.innerHTML).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(container.querySelectorAll('strong')).toHaveLength(1);
  });

  const invalid: ReadonlyArray<readonly [string, unknown]> = [
    ['an unknown block type', doc({ type: 'embed', spans: [span('x')] })],
    ['a raw html block', doc({ type: 'html', html: '<b>x</b>' })],
    ['heading level 1', doc({ type: 'heading', level: 1, spans: [span('x')] })],
    ['heading level 5', doc({ type: 'heading', level: 5, spans: [span('x')] })],
    ['an unknown mark', doc(paragraph(span('x', ['underline'])))],
    [
      'an unknown link kind',
      doc(paragraph(span('x', [], { kind: 'entry', id: 'a' }))),
    ],
    [
      'a javascript: https href',
      doc(
        paragraph(
          span('x', [], { kind: 'https', href: 'javascript:alert(1)' }),
        ),
      ),
    ],
    [
      'a protocol-relative internal route',
      doc(
        paragraph(span('x', [], { kind: 'internal', route: '//evil.example' })),
      ),
    ],
    [
      'an unknown span key',
      doc(paragraph({ text: 'x', marks: [], onClick: 'alert(1)' })),
    ],
    ['a raw HTML string instead of a document', '<p onclick="x">raw</p>'],
    ['a null value', null],
    ['another format literal', { format: 'html.v1', blocks: [] }],
  ];

  it.each(invalid)(
    'fails closed with an inert, accessible notice for %s',
    (_name, value) => {
      const { container } = mountElement(<CmsRichTextRenderer value={value} />);
      const notice = container.querySelector('[role="note"]');
      expect(notice?.textContent).toContain('could not be displayed');
      expect(
        container.querySelectorAll(
          'p, h2, h3, h4, a, blockquote, li, img, script',
        ),
      ).toHaveLength(0);
      expect(container.innerHTML).not.toContain('onclick');
      expect(container.innerHTML).not.toContain('javascript:');
    },
  );

  it('stays recoverable: the notice never throws, siblings keep working, and a valid value renders again', async () => {
    const onClick = vi.fn();
    const view = (value: unknown) => (
      <div>
        <CmsRichTextRenderer value={value} />
        <button type="button" onClick={onClick}>
          Keep editing
        </button>
      </div>
    );
    const { container, rerender } = mountElement(view({ not: 'a document' }));
    expect(container.querySelector('[role="note"]')).not.toBeNull();
    await click(buttonNamed(container, 'Keep editing'));
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(view(doc(paragraph(span('Recovered')))));
    expect(container.querySelector('[role="note"]')).toBeNull();
    expect(container.querySelector('p')?.textContent).toBe('Recovered');
  });
});

const mountEditor = (value: unknown, onChange = vi.fn()) => ({
  ...mountElement(
    <CmsRichTextEditor value={value} onChange={onChange} label="Body" />,
  ),
  onChange,
});

describe('EC-086 the constrained rich-text editor exposes semantic native controls', () => {
  const full = doc(
    paragraph(span('intro')),
    { type: 'heading', level: 3, spans: [span('Title')] },
    { type: 'list_item', list: 'numbered', depth: 1, spans: [span('item')] },
    { type: 'list_item', list: 'numbered', depth: 2, spans: [span('nested')] },
    { type: 'quote', spans: [span('quoted')] },
  );

  it('offers block-type, heading-level, list-style and list-depth selects with the closed choices only', () => {
    const { container } = mountEditor(full);
    const optionsOf = (label: string): string[][] =>
      Array.from(container.querySelectorAll('label'))
        .filter((element) =>
          (element.textContent ?? '').trim().startsWith(label),
        )
        .map((element) =>
          Array.from(element.querySelectorAll('option')).map(
            (option) => option.value,
          ),
        );
    expect(optionsOf('Block type')).toHaveLength(5);
    expect(optionsOf('Block type')[0]).toEqual([
      'paragraph',
      'heading',
      'quote',
      'list_item',
    ]);
    expect(optionsOf('Heading level')).toEqual([['2', '3', '4']]);
    expect(optionsOf('List style')).toEqual([
      ['bulleted', 'numbered'],
      ['bulleted', 'numbered'],
    ]);
    expect(optionsOf('List depth')).toEqual([
      ['1', '2', '3'],
      ['1', '2', '3'],
    ]);
  });

  it('changes the document when a block, heading-level, list-style or list-depth select is chosen', async () => {
    const { container, onChange } = mountEditor(
      doc(
        paragraph(span('one')),
        { type: 'heading', level: 2, spans: [span('two')] },
        {
          type: 'list_item',
          list: 'bulleted',
          depth: 1,
          spans: [span('three')],
        },
        {
          type: 'list_item',
          list: 'bulleted',
          depth: 1,
          spans: [span('four')],
        },
      ),
    );
    const last = (): { blocks: Record<string, unknown>[] } =>
      onChange.mock.calls.at(-1)?.[0] as { blocks: Record<string, unknown>[] };
    const selectIn = (label: string, index: number): HTMLSelectElement =>
      Array.from(container.querySelectorAll('label'))
        .filter((element) =>
          (element.textContent ?? '').trim().startsWith(label),
        )
        .map((element) => element.querySelector('select') as HTMLSelectElement)[
        index
      ] as HTMLSelectElement;

    await choose(selectIn('Block type', 0), 'quote');
    expect(last().blocks[0]).toMatchObject({ type: 'quote' });
    expect(last().blocks[0]).not.toHaveProperty('level');

    await choose(selectIn('Heading level', 0), '4');
    expect(last().blocks[1]).toMatchObject({ type: 'heading', level: 4 });

    await choose(selectIn('List style', 0), 'numbered');
    expect(last().blocks[2]).toMatchObject({
      type: 'list_item',
      list: 'numbered',
      depth: 1,
    });

    // Depth may deepen by one level at a time, within one list style: the second item follows the
    // first one's style and then nests under it.
    await choose(selectIn('List style', 1), 'numbered');
    await choose(selectIn('List depth', 1), '2');
    expect(last().blocks[3]).toMatchObject({
      type: 'list_item',
      list: 'numbered',
      depth: 2,
    });

    await choose(selectIn('Block type', 1), 'list_item');
    expect(last().blocks[1]).toMatchObject({ type: 'list_item' });
    expect(last().blocks[1]).not.toHaveProperty('level');
    expect(last().blocks[1]).toHaveProperty('list');
    expect(last().blocks[1]).toHaveProperty('depth');
  });

  it('is native controls in document order, with no positive tabindex and no custom widget', () => {
    const { container } = mountEditor(full);
    const stops = Array.from(
      container.querySelectorAll(
        'select, textarea, button, input, a[href], [tabindex]',
      ),
    ).filter((element) => element.getAttribute('tabindex') !== '-1');
    expect(new Set(stops.map((element) => element.tagName))).toEqual(
      new Set(['SELECT', 'TEXTAREA', 'BUTTON']),
    );
    expect(
      container.querySelectorAll(
        '[tabindex]:not([tabindex="-1"]), [role="button"], [contenteditable]',
      ),
    ).toHaveLength(0);
    const labels = Array.from(container.querySelectorAll('button')).map(
      (button) => (button.textContent ?? '').trim(),
    );
    // AC-086: the semantic mark and link controls come first in each block (next to
    // the text they format), then the explicit move and remove buttons.
    expect(labels.slice(0, 7)).toEqual([
      'Bold',
      'Italic',
      'Code',
      'Link',
      'Move block up',
      'Move block down',
      'Remove block',
    ]);
    expect(labels.at(-1)).toBe('Add block');
    // Every button is a native `type="button"`: Enter and Space activation, and the Tab stop,
    // come from the browser, and nothing here can intercept or replace them.
    for (const button of Array.from(container.querySelectorAll('button')))
      expect(button.getAttribute('type')).toBe('button');
    // Each control has an accessible name from its label.
    for (const control of container.querySelectorAll('select, textarea'))
      expect((control.closest('label')?.textContent ?? '').trim()).not.toBe('');
  });

  it('reorders and removes blocks from the keyboard buttons, and disables a move that cannot happen', async () => {
    const { container, onChange } = mountEditor(
      doc(paragraph(span('first')), paragraph(span('second'))),
    );
    const firstUp = buttonNamed(container, 'Move block up');
    const firstDown = buttonNamed(container, 'Move block down');
    expect(firstUp?.disabled).toBe(true);
    expect(firstDown?.disabled).toBe(false);
    await click(firstDown as HTMLElement);
    const last = onChange.mock.calls.at(-1)?.[0] as {
      blocks: { spans: { text: string }[] }[];
    };
    expect(last.blocks.map((block) => block.spans[0]?.text)).toEqual([
      'second',
      'first',
    ]);
    await click(buttonNamed(container, 'Add block'));
    expect(container.querySelectorAll('textarea')).toHaveLength(3);
  });

  it('keeps focus and the typed text on an inline error and clears it when the text is fixed', async () => {
    const { container, onChange } = mountEditor(doc(paragraph(span('ok'))));
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    textarea.focus();
    await typeInto(textarea, 'bad [[bold]] text');
    expect(onChange).not.toHaveBeenCalled();
    expect(textarea.getAttribute('aria-invalid')).toBe('true');
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'rich_text_not_canonical',
    );
    expect(document.activeElement).toBe(textarea);
    expect(textarea.value).toBe('bad [[bold]] text');
    await typeInto(textarea, 'good **bold** text');
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(textarea.getAttribute('aria-invalid')).toBeNull();
    expect(onChange).toHaveBeenCalled();
  });

  it('refuses an unsafe link inline, names the destination and submits nothing', async () => {
    const { container, onChange } = mountEditor(doc(paragraph(span('ok'))));
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    await typeInto(textarea, '[click](javascript:alert(1))');
    expect(onChange).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'javascript:',
    );
  });

  it('authors marks and links as constrained markup, never as JSON or HTML', async () => {
    const { container, onChange } = mountEditor(doc(paragraph(span('intro'))));
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    // The control shows authored text, not the stored document.
    expect(textarea.value).toBe('intro');
    expect(textarea.value.trim().startsWith('{')).toBe(false);
    await typeInto(
      textarea,
      '**bold** _it_ `code` [site](https://example.com) <b>x</b>',
    );
    const submitted = onChange.mock.calls.at(-1)?.[0] as {
      blocks: { spans: { text: string; marks: string[]; link?: unknown }[] }[];
    };
    const spans = submitted.blocks[0]?.spans ?? [];
    const marked = (mark: string): string[] =>
      spans
        .filter((entry) => entry.marks.includes(mark))
        .map((entry) => entry.text);
    expect([marked('bold'), marked('italic'), marked('code')]).toEqual([
      ['bold'],
      ['it'],
      ['code'],
    ]);
    expect(spans.find((entry) => entry.link !== undefined)?.link).toEqual({
      kind: 'https',
      href: 'https://example.com',
    });
    // HTML typed by the author is literal text in the canonical AST, never a node.
    expect(spans.map((entry) => entry.text).join('')).toContain('<b>x</b>');
    expect(JSON.stringify(submitted)).not.toMatch(/"type":"html"/u);
    // And the live preview shows it as text.
    const preview = container.querySelector('[role="region"]');
    expect(preview?.querySelector('b')).toBeNull();
    expect(preview?.textContent).toContain('<b>x</b>');
    for (const area of Array.from(container.querySelectorAll('textarea')))
      expect(area.value.trim().startsWith('{')).toBe(false);
    expect(byLabel(container, /^Block text/u).tagName).toBe('TEXTAREA');
  });
});
