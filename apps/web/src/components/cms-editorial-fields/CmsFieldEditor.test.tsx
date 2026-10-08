// @vitest-environment jsdom

import type { JsonValue } from '@wejammin/contracts';
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

import CmsFieldEditor from './CmsFieldEditor';
import {
  buttonNamed,
  byLabel,
  choose,
  click,
  disableReactAct,
  enableReactAct,
  mountElement,
  typeInto,
} from './cms-editor-dom.test-support';
import {
  describeCmsAuthoringFields,
  type CmsFieldDescriptor,
} from './cms-field-descriptor';
import { allKindFields, fieldUuid } from './cms-field-fixtures.test-support';
import { validateCmsFieldValue, type CmsFieldIssue } from './cms-field-value';

beforeAll(enableReactAct);
afterAll(disableReactAct);
afterEach(() => document.body.replaceChildren());

const descriptor = (key: string): CmsFieldDescriptor => {
  const found = describeCmsAuthoringFields(allKindFields()).find(
    (entry) => entry.key === key,
  );
  if (found === undefined) throw new Error(`fixture missing ${key}`);
  return found;
};

/** A stateful host so edits flow back into `value` exactly as in the real forms. */
const Host = ({
  field,
  initial,
  issues,
  onValue,
  readOnlyNotice,
}: {
  readonly field: CmsFieldDescriptor;
  readonly initial: JsonValue | null;
  readonly issues?: readonly CmsFieldIssue[] | undefined;
  readonly onValue: (value: JsonValue | null) => void;
  readonly readOnlyNotice?: string | undefined;
}): React.ReactElement => {
  const [value, setValue] = React.useState<JsonValue | null>(initial);
  return (
    <CmsFieldEditor
      descriptor={field}
      value={value}
      issues={issues ?? validateCmsFieldValue(field, value)}
      readOnlyNotice={readOnlyNotice}
      onChange={(next) => {
        setValue(next);
        onValue(next);
      }}
    />
  );
};

const render = (
  key: string,
  initial: JsonValue | null = null,
  extra: { issues?: readonly CmsFieldIssue[]; readOnlyNotice?: string } = {},
) => {
  const onValue = vi.fn();
  const mounted = mountElement(
    <Host
      field={descriptor(key)}
      initial={initial}
      onValue={onValue}
      issues={extra.issues}
      readOnlyNotice={extra.readOnlyNotice}
    />,
  );
  return { ...mounted, onValue };
};

describe('CmsFieldEditor: frame', () => {
  it('names the control, marks required, and links help, hint and errors', () => {
    const { container } = render('title', 'x', {
      issues: [{ code: 'too_short', message: 'Enter at least 2 characters.' }],
    });
    const input = byLabel<HTMLInputElement>(container, 'Title (required)');
    expect(input.getAttribute('aria-required')).toBe('true');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const described = (input.getAttribute('aria-describedby') ?? '')
      .split(' ')
      .map((id) => document.getElementById(id)?.textContent ?? '');
    expect(described.join(' ')).toContain('Between 2 and 40 characters.');
    expect(described.join(' ')).toContain('Enter at least 2 characters.');
    const group = container.querySelector(
      `[data-cms-editorial-field="${fieldUuid(1)}"]`,
    );
    expect(group?.id).toBe(`field-${fieldUuid(1)}-group`);
    expect(input.id).toBe(`field-${fieldUuid(1)}`);
  });

  it('is not invalid while there are no issues', () => {
    const { container } = render('title', 'Fine title');
    expect(
      byLabel<HTMLInputElement>(container, 'Title (required)').getAttribute(
        'aria-invalid',
      ),
    ).toBeNull();
  });
});

describe('CmsFieldEditor: scalar and enum kinds', () => {
  it('edits text and clears to null', async () => {
    const { container, onValue } = render('blurb');
    const area = byLabel<HTMLTextAreaElement>(container, 'Blurb');
    expect(area.tagName).toBe('TEXTAREA');
    await typeInto(area, 'Hello');
    expect(onValue).toHaveBeenLastCalledWith('Hello');
    await typeInto(area, '');
    expect(onValue).toHaveBeenLastCalledWith(null);
  });

  it('renders an enum as a select over its declared values only', async () => {
    const { container, onValue } = render('category');
    const select = byLabel<HTMLSelectElement>(container, 'Category');
    expect(select.tagName).toBe('SELECT');
    expect(
      Array.from(select.options)
        .map((option) => option.value)
        .filter((value) => value !== ''),
    ).toEqual(['news', 'tutorial', 'event']);
    await choose(select, 'tutorial');
    expect(onValue).toHaveBeenLastCalledWith('tutorial');
  });

  it('puts the checkbox before its label so the label reads as the question', async () => {
    const { container, onValue } = render('featured', false);
    const box = byLabel<HTMLInputElement>(container, 'Featured');
    expect(box.type).toBe('checkbox');
    await click(box);
    expect(onValue).toHaveBeenLastCalledWith(true);
  });
});

describe('CmsFieldEditor: list', () => {
  it('adds, edits, reorders and removes items with one native control per item', async () => {
    const { container, onValue } = render('tags', ['a', 'b']);
    expect(byLabel<HTMLInputElement>(container, 'Tags item 1').value).toBe('a');
    await click(buttonNamed(container, 'Add Tags item'));
    expect(onValue).toHaveBeenLastCalledWith(['a', 'b', '']);
    await typeInto(byLabel<HTMLInputElement>(container, 'Tags item 3'), 'c');
    expect(onValue).toHaveBeenLastCalledWith(['a', 'b', 'c']);
    await click(buttonNamed(container, 'Move Tags item 3 up'));
    expect(onValue).toHaveBeenLastCalledWith(['a', 'c', 'b']);
    await click(buttonNamed(container, 'Remove Tags item 1'));
    expect(onValue).toHaveBeenLastCalledWith(['c', 'b']);
  });

  it('cannot move the first item up or the last item down', () => {
    const { container } = render('tags', ['a', 'b']);
    expect(buttonNamed(container, 'Move Tags item 1 up').disabled).toBe(true);
    expect(buttonNamed(container, 'Move Tags item 2 down').disabled).toBe(true);
  });

  it('shows an item-level issue next to the item it belongs to', () => {
    const { container } = render('tags', ['ok', 'x'.repeat(13)]);
    const second = byLabel<HTMLInputElement>(container, 'Tags item 2');
    expect(second.getAttribute('aria-invalid')).toBe('true');
    expect(
      byLabel<HTMLInputElement>(container, 'Tags item 1').getAttribute(
        'aria-invalid',
      ),
    ).toBeNull();
    const described = document.getElementById(
      (second.getAttribute('aria-describedby') ?? '').split(' ').pop() ?? '',
    );
    expect(described?.textContent).toContain('at most 12 characters');
  });
});

describe('CmsFieldEditor: object (DEC-133, never raw JSON)', () => {
  it('renders one labelled native control per declared property', () => {
    const { container } = render('meta');
    expect(
      container.querySelectorAll('fieldset').length,
    ).toBeGreaterThanOrEqual(4);
    const headline = byLabel<HTMLInputElement>(container, /^Headline/u);
    expect(headline.tagName).toBe('INPUT');
    expect(headline.getAttribute('aria-required')).toBe('true');
    expect(byLabel<HTMLSelectElement>(container, /^Tone/u).tagName).toBe(
      'SELECT',
    );
    expect(byLabel<HTMLInputElement>(container, /^Priority/u).tagName).toBe(
      'INPUT',
    );
    // A property that declares a rich_text kind uses the constrained editor.
    expect(container.querySelectorAll('.cms-rich-text-editor').length).toBe(1);
    // No JSON editor anywhere.
    for (const area of Array.from(container.querySelectorAll('textarea')))
      expect(area.value.trim().startsWith('{')).toBe(false);
  });

  it('describes each property from its declared constraints and marks required ones', () => {
    const { container } = render('meta');
    const headline = byLabel<HTMLInputElement>(container, /^Headline/u);
    const description = (headline.getAttribute('aria-describedby') ?? '')
      .split(' ')
      .map((id) => document.getElementById(id)?.textContent ?? '')
      .join(' ');
    expect(description).toContain('Between 3 and 20 characters.');
    expect(container.querySelector('legend')?.textContent ?? '').toContain(
      'Meta',
    );
    expect(container.textContent).toContain('Headline (required)');
    expect(container.textContent).toContain('Priority');
    expect(container.textContent).not.toContain('Priority (required)');
  });

  it('submits a strict property-keyed object and drops a cleared optional property', async () => {
    const { container, onValue } = render('meta');
    await typeInto(
      byLabel<HTMLInputElement>(container, /^Headline/u),
      'Launch',
    );
    await choose(byLabel<HTMLSelectElement>(container, /^Tone/u), 'casual');
    await typeInto(byLabel<HTMLInputElement>(container, /^Priority/u), '3');
    expect(onValue).toHaveBeenLastCalledWith({
      headline: 'Launch',
      tone: 'casual',
      priority: 3,
    });
    await typeInto(byLabel<HTMLInputElement>(container, /^Priority/u), '');
    expect(onValue).toHaveBeenLastCalledWith({
      headline: 'Launch',
      tone: 'casual',
    });
  });

  it('reports a property issue on that property only', () => {
    const { container } = render('meta', { headline: 'x', tone: 'formal' });
    expect(
      byLabel<HTMLInputElement>(container, /^Headline/u).getAttribute(
        'aria-invalid',
      ),
    ).toBe('true');
    expect(
      byLabel<HTMLSelectElement>(container, /^Tone/u).getAttribute(
        'aria-invalid',
      ),
    ).toBeNull();
  });
});

describe('CmsFieldEditor: relation', () => {
  const target = (n: number) => ({
    targetId: fieldUuid(n),
    expectedTargetVersion: null,
  });

  it('adds, edits and removes ordered targets within the definition bounds', async () => {
    const { container, onValue } = render('related', { targets: [target(1)] });
    expect(
      byLabel<HTMLInputElement>(container, 'Related entries target 1 entry id')
        .value,
    ).toBe(fieldUuid(1));
    await click(buttonNamed(container, 'Add Related entries target'));
    await typeInto(
      byLabel<HTMLInputElement>(container, 'Related entries target 2 entry id'),
      fieldUuid(2),
    );
    expect(onValue).toHaveBeenLastCalledWith({
      targets: [target(1), target(2)],
    });
    await typeInto(
      byLabel<HTMLInputElement>(
        container,
        'Related entries target 2 pinned version',
      ),
      '4',
    );
    expect(onValue).toHaveBeenLastCalledWith({
      targets: [
        target(1),
        { targetId: fieldUuid(2), expectedTargetVersion: '4' },
      ],
    });
    await click(buttonNamed(container, 'Remove Related entries target 1'));
    expect(onValue).toHaveBeenLastCalledWith({
      targets: [{ targetId: fieldUuid(2), expectedTargetVersion: '4' }],
    });
  });

  it('stops offering Add at the definition maximum', async () => {
    const { container } = render('related', {
      targets: [target(1), target(2), target(3)],
    });
    expect(buttonNamed(container, 'Add Related entries target').disabled).toBe(
      true,
    );
  });

  it('shows the not-yet-available state instead of controls when the host says so', () => {
    const { container } = render('related', null, {
      readOnlyNotice: 'Links can be added after the entry is created.',
    });
    expect(container.textContent).toContain(
      'Links can be added after the entry is created.',
    );
    expect(
      container.querySelector('input, select, textarea, button'),
    ).toBeNull();
  });
});

describe('CmsFieldEditor: kinds without a producer, and rich text', () => {
  it('renders taxonomy and media as a typed unavailable state with no control', () => {
    for (const key of ['topics', 'cover']) {
      const { container, unmount } = render(key);
      expect(container.textContent).toContain('cannot be set yet');
      expect(container.querySelector('input, select, textarea')).toBeNull();
      unmount();
    }
  });

  it('uses the constrained rich text editor, labelled once', async () => {
    const { container, onValue } = render('body');
    expect(container.querySelectorAll('.cms-rich-text-editor').length).toBe(1);
    const legends = Array.from(container.querySelectorAll('legend')).map(
      (legend) => legend.textContent,
    );
    expect(legends.filter((text) => text?.startsWith('Body')).length).toBe(1);
    await typeInto(container.querySelector('textarea')!, 'Hello **world**');
    expect(onValue).toHaveBeenCalled();
    const emitted = onValue.mock.calls.at(-1)?.[0] as {
      format: string;
    } | null;
    expect(emitted?.format).toBe('rich_text.v1');
  });
});
