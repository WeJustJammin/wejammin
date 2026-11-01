// @vitest-environment jsdom
import { act } from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  buttonNamed,
  byLabel,
  click,
  disableReactAct,
  enableReactAct,
  mountElement,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import CmsPatternInsertForm from './CmsPatternInsertForm';
import type { PlacementFields } from './composition-insert-fields';
import { selectorItem, selectorPage } from './composition.test-support';

/*
 * FE03 1114; P2-S12-AC-045: the native instance form of the composition page. Every field is a native control with a
 * label, an inline message and an error summary; the link mode is an explicit choice; Enter submits.
 */
beforeAll(enableReactAct);
afterAll(disableReactAct);

const item = selectorItem('hero-block', 2);
const fields = (extra: Partial<PlacementFields> = {}): PlacementFields => ({
  item: null,
  linkMode: null,
  slotPath: '/',
  overridesText: '',
  ...extra,
});
const mount = (
  props: Partial<React.ComponentProps<typeof CmsPatternInsertForm>> = {},
) => {
  const onChange = vi.fn();
  const onSubmit = vi.fn();
  const onLoadMore = vi.fn();
  const mounted = mountElement(
    <CmsPatternInsertForm
      page={selectorPage([item], null)}
      selectorState={{ kind: 'idle' }}
      fields={fields()}
      issues={[]}
      pending={false}
      disabled={false}
      onChange={onChange}
      onSubmit={onSubmit}
      onLoadMore={onLoadMore}
      {...props}
    />,
  );
  return { ...mounted, onChange, onSubmit, onLoadMore };
};

describe('CmsPatternInsertForm', () => {
  it('has native labelled controls, with no link mode preselected', () => {
    const { container } = mount();
    expect(byLabel<HTMLSelectElement>(container, 'Pattern').tagName).toBe(
      'SELECT',
    );
    expect(byLabel<HTMLInputElement>(container, 'Slot path').value).toBe('/');
    expect(
      byLabel<HTMLTextAreaElement>(container, 'Overrides (JSON, optional)')
        .tagName,
    ).toBe('TEXTAREA');
    const radios = container.querySelectorAll<HTMLInputElement>(
      'input[name="linkMode"]',
    );
    expect(Array.from(radios).map((radio) => radio.value)).toEqual([
      'linked',
      'detached',
    ]);
    expect(Array.from(radios).every((radio) => !radio.checked)).toBe(true);
    expect(
      container.querySelector('form')?.getAttribute('noValidate'),
    ).not.toBeNull();
  });

  it('reports each change as a patch', async () => {
    const { container, onChange } = mount();
    await typeInto(byLabel<HTMLInputElement>(container, 'Slot path'), '/main');
    expect(onChange).toHaveBeenLastCalledWith({ slotPath: '/main' });
    await typeInto(
      byLabel<HTMLTextAreaElement>(container, 'Overrides (JSON, optional)'),
      '{}',
    );
    expect(onChange).toHaveBeenLastCalledWith({ overridesText: '{}' });
    await click(byLabel<HTMLInputElement>(container, /^Linked/u));
    expect(onChange).toHaveBeenLastCalledWith({ linkMode: 'linked' });
    await click(byLabel<HTMLInputElement>(container, /^Detached/u));
    expect(onChange).toHaveBeenLastCalledWith({ linkMode: 'detached' });
  });

  it('states what linked and detached mean', () => {
    const { container } = mount();
    expect(container.textContent).toContain('Linked: receives pattern updates');
    expect(container.textContent).toContain(
      'Detached: a local copy that never receives updates',
    );
  });

  it('submits through the native form, so Enter works, and disables the command while pending', async () => {
    const { container, onSubmit } = mount({
      fields: fields({ item, linkMode: 'linked' }),
    });
    await act(async () => {
      container
        .querySelector('form')
        ?.dispatchEvent(
          new Event('submit', { bubbles: true, cancelable: true }),
        );
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const pending = mount({ pending: true });
    expect(buttonNamed(pending.container, 'Place pattern').disabled).toBe(true);
    const off = mount({ disabled: true });
    expect(buttonNamed(off.container, 'Place pattern').disabled).toBe(true);
  });

  it('puts each issue at its field with an error summary that links to it', async () => {
    const { container } = mount({
      issues: [
        { field: 'pattern', message: 'Choose a pattern to insert.' },
        {
          field: 'slotPath',
          message: 'Enter a slot path that starts with a slash.',
        },
      ],
    });
    expect(
      byLabel<HTMLInputElement>(container, 'Slot path').getAttribute(
        'aria-invalid',
      ),
    ).toBe('true');
    const summary = container.querySelector('[role="alert"]');
    expect(summary?.textContent).toContain(
      '2 problems to fix; nothing was sent.',
    );
    const links = Array.from(summary!.querySelectorAll('a'));
    expect(links.map((link) => link.textContent)).toEqual([
      'Choose a pattern to insert.',
      'Enter a slot path that starts with a slash.',
    ]);
    await click(links[1]!);
    expect(document.activeElement).toBe(
      byLabel<HTMLInputElement>(container, 'Slot path'),
    );
  });

  it('marks the link-mode group and the overrides invalid with their messages', () => {
    const { container } = mount({
      issues: [
        {
          field: 'linkMode',
          message: 'Choose whether the placement is linked or detached.',
        },
        { field: 'overrides', message: 'Overrides must be a JSON object.' },
      ],
    });
    expect(container.querySelector('fieldset')?.textContent).toContain(
      'Choose whether the placement is linked or detached.',
    );
    expect(
      byLabel<HTMLTextAreaElement>(
        container,
        'Overrides (JSON, optional)',
      ).getAttribute('aria-invalid'),
    ).toBe('true');
  });
});
