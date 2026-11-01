// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  buttonNamed,
  byLabel,
  click,
  disableReactAct,
  enableReactAct,
  flush,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import { mount, savedResult, text } from './locale-variant-form.test-support';
import type { LocaleSubmitResult } from './locale-variant-submit';

beforeAll(enableReactAct);
afterAll(disableReactAct);

const heldSubmit = () => {
  let answer: (result: LocaleSubmitResult) => void = () => undefined;
  const submit = vi.fn(
    () =>
      new Promise<LocaleSubmitResult>((resolve) => {
        answer = resolve;
      }),
  );
  return { submit, answer: (result: LocaleSubmitResult) => answer(result) };
};

const disabledControls = (container: HTMLElement): string[] =>
  Array.from(
    container.querySelectorAll<HTMLElement>(
      'form input, form select, form textarea, form button',
    ),
  )
    .filter((control) => control.matches(':disabled'))
    .map((control) => (control.textContent ?? '') || control.id);

/**
 * [P2-S12-AC-271] FE03 1048 (Slice 12 `commandState`, CMS-03C-04 `loading`): "Stable pending label;
 * only the commit control disabled". The translation form keeps every field editable while the save
 * is in flight and withholds only the commit control; an edit made meanwhile does not lift the
 * pending state, and the save in flight is the one that was sent.
 */
describe('CmsLocaleVariantForm: pending command state', () => {
  it('[P2-S12-AC-271] disables only the commit control while the save is pending, keeps the fields editable, and names the result', async () => {
    const held = heldSubmit();
    const { container } = mount({ submit: held.submit });
    const title = byLabel<HTMLInputElement>(container, 'Title');
    await typeInto(title, 'Tournée du printemps');
    await click(buttonNamed(container, 'Save translation'));
    await flush();
    expect(held.submit).toHaveBeenCalledTimes(1);
    expect(text(container)).toContain('Saving…');
    expect(disabledControls(container)).toEqual(['Saving…']);
    // The fields stay editable and focus is not taken from them.
    title.focus();
    await typeInto(title, 'Tournée du printemps 2');
    expect(title.value).toBe('Tournée du printemps 2');
    expect(document.activeElement).toBe(title);
    // An edit made while the save is in flight neither lifts the pending state nor re-enables the commit control.
    expect(text(container)).toContain('Saving…');
    expect(disabledControls(container)).toEqual(['Saving…']);
    await click(buttonNamed(container, 'Saving…'));
    expect(held.submit).toHaveBeenCalledTimes(1);
    held.answer(savedResult());
    await flush();
    expect(text(container)).not.toContain('Saving…');
    expect(disabledControls(container)).toEqual([]);
    expect(document.activeElement?.id).toBe('cms-locale-result-heading');
  });
});
