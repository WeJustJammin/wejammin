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

import CmsScalarControl from './CmsScalarControl';
import {
  byLabel,
  choose,
  click,
  disableReactAct,
  enableReactAct,
  mountElement,
  selectBy,
  typeInto,
} from './cms-editor-dom.test-support';
import type { CmsScalarKind } from './cms-field-descriptor';

beforeAll(enableReactAct);
afterAll(disableReactAct);
afterEach(() => document.body.replaceChildren());

const render = (
  kind: CmsScalarKind,
  props: Partial<React.ComponentProps<typeof CmsScalarControl>> = {},
) => {
  const onChange = vi.fn();
  const onInputError = vi.fn();
  const mounted = mountElement(
    <CmsScalarControl
      id="c1"
      label="Thing"
      kind={kind}
      constraints={{}}
      value={null}
      required={false}
      invalid={false}
      onChange={onChange}
      onInputError={onInputError}
      {...props}
    />,
  );
  return { ...mounted, onChange, onInputError };
};

describe('CmsScalarControl', () => {
  it('renders the native control each scalar kind calls for', () => {
    const kinds: Array<[CmsScalarKind, string, string | null]> = [
      ['short_text', 'input', 'text'],
      ['long_text', 'textarea', null],
      ['boolean', 'input', 'checkbox'],
      ['integer', 'input', 'text'],
      ['decimal', 'input', 'text'],
      ['date', 'input', 'date'],
      ['datetime', 'input', 'datetime-local'],
    ];
    for (const [kind, tag, type] of kinds) {
      const { container, unmount } = render(kind);
      const control = container.querySelector('#c1');
      expect(control?.tagName.toLowerCase(), kind).toBe(tag);
      if (type !== null) expect(control?.getAttribute('type'), kind).toBe(type);
      if (kind === 'integer')
        expect(control?.getAttribute('inputmode')).toBe('numeric');
      if (kind === 'decimal')
        expect(control?.getAttribute('inputmode')).toBe('decimal');
      unmount();
    }
    const { container } = render('enum', {
      constraints: { enumValues: ['a', 'b'] },
    });
    const select = container.querySelector('select');
    expect(select).not.toBeNull();
    expect(
      Array.from(select?.options ?? []).map((option) => option.value),
    ).toEqual(['', 'a', 'b']);
  });

  it('emits text as typed, and null when it is cleared', async () => {
    const { container, onChange } = render('short_text');
    const input = container.querySelector<HTMLInputElement>('#c1')!;
    await typeInto(input, 'Hello');
    expect(onChange).toHaveBeenLastCalledWith('Hello');
    await typeInto(input, '');
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('emits an integer as a number and refuses fractional text without emitting it', async () => {
    const { container, onChange, onInputError } = render('integer');
    const input = container.querySelector<HTMLInputElement>('#c1')!;
    await typeInto(input, '42');
    expect(onChange).toHaveBeenLastCalledWith(42);
    expect(onInputError).toHaveBeenLastCalledWith(null);
    onChange.mockClear();
    await typeInto(input, '4.5');
    expect(onChange).not.toHaveBeenCalled();
    expect(onInputError).toHaveBeenLastCalledWith('Enter a whole number.');
    expect(input.value).toBe('4.5');
  });

  it('keeps typed text while the parent value has not moved', async () => {
    const { container, rerender, onChange, onInputError } = render('decimal');
    const input = container.querySelector<HTMLInputElement>('#c1')!;
    await typeInto(input, '1.');
    // "1." parses as 1; the control must not rewrite what the author is typing.
    expect(onChange).toHaveBeenLastCalledWith(1);
    rerender(
      <CmsScalarControl
        id="c1"
        label="Thing"
        kind="decimal"
        constraints={{}}
        value={1}
        required={false}
        invalid={false}
        onChange={onChange}
        onInputError={onInputError}
      />,
    );
    expect(container.querySelector<HTMLInputElement>('#c1')?.value).toBe('1.');
  });

  it('adopts an external value change', () => {
    const { container, rerender, onChange } = render('integer', { value: 3 });
    expect(container.querySelector<HTMLInputElement>('#c1')?.value).toBe('3');
    rerender(
      <CmsScalarControl
        id="c1"
        label="Thing"
        kind="integer"
        constraints={{}}
        value={9}
        required={false}
        invalid={false}
        onChange={onChange}
      />,
    );
    expect(container.querySelector<HTMLInputElement>('#c1')?.value).toBe('9');
  });

  it('toggles a boolean and offers the select options of an enum', async () => {
    const bool = render('boolean', { value: false });
    await click(bool.container.querySelector<HTMLInputElement>('#c1')!);
    expect(bool.onChange).toHaveBeenLastCalledWith(true);
    bool.unmount();
    const choice = render('enum', { constraints: { enumValues: ['a', 'b'] } });
    await choose(selectBy(choice.container, '#c1'), 'b');
    expect(choice.onChange).toHaveBeenLastCalledWith('b');
    await choose(selectBy(choice.container, '#c1'), '');
    expect(choice.onChange).toHaveBeenLastCalledWith(null);
  });

  it('shows a stored datetime in local time and emits the UTC instant', async () => {
    const { container, onChange } = render('datetime', {
      value: '2026-10-05T12:00:00Z',
    });
    const input = container.querySelector<HTMLInputElement>('#c1')!;
    expect(input.value).toMatch(/^2026-10-0[45]T\d{2}:\d{2}(:\d{2})?$/u);
    await typeInto(input, '2026-10-05T08:15:00');
    expect(onChange).toHaveBeenLastCalledWith(
      expect.stringMatching(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/u,
      ),
    );
  });

  it('exposes the accessible name, required and invalid state natively', () => {
    const { container } = render('short_text', {
      required: true,
      invalid: true,
      describedBy: 'c1-hint c1-error',
    });
    const input = byLabel<HTMLInputElement>(container, 'Thing');
    expect(input.getAttribute('aria-required')).toBe('true');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('c1-hint c1-error');
  });
});
