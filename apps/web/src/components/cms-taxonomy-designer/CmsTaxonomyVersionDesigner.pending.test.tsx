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
import { fillValid, mount, text } from './taxonomy-designer-form.test-support';
import { createdFacts } from './taxonomy-designer.test-support';
import type { TaxonomySubmitResult } from './taxonomy-designer-submit';

beforeAll(enableReactAct);
afterAll(disableReactAct);

/** A submit that stays in flight until the test answers it. */
const heldSubmit = () => {
  let answer: (result: TaxonomySubmitResult) => void = () => undefined;
  const submit = vi.fn(
    () =>
      new Promise<TaxonomySubmitResult>((resolve) => {
        answer = resolve;
      }),
  );
  return { submit, answer: (result: TaxonomySubmitResult) => answer(result) };
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
 * [P2-S12-AC-271] FE03 1048 (Slice 12 `commandState`, CMS-03C-16 `loading`): "Stable pending label;
 * only the commit control disabled". The vocabulary designer keeps every field editable while the
 * save is in flight, withholds only the commit control, and locks the fields only after a verified
 * success.
 */
describe('CmsTaxonomyVersionDesigner: pending command state', () => {
  it('[P2-S12-AC-271] disables only the commit control while the save is pending, keeps the fields editable, then locks after success', async () => {
    const held = heldSubmit();
    const { container } = mount({ submit: held.submit });
    await fillValid(container);
    await click(buttonNamed(container, 'Create draft'));
    // Pending: the label is at once, the one disabled control is the commit control.
    expect(text(container)).toContain('Saving…');
    expect(disabledControls(container)).toEqual(['Saving…']);
    // The fields stay editable and focus is not taken from them.
    const key = byLabel<HTMLInputElement>(container, 'Vocabulary key');
    key.focus();
    await typeInto(key, 'instruments-edited');
    expect(key.value).toBe('instruments-edited');
    expect(document.activeElement).toBe(key);
    // Editing a field does not lift the pending state or re-enable the commit control.
    expect(disabledControls(container)).toEqual(['Saving…']);
    await click(buttonNamed(container, 'Saving…'));
    expect(held.submit).toHaveBeenCalledTimes(1);
    held.answer({ kind: 'created', resource: createdFacts() });
    await flush();
    // Success: the named resource is claimed and the form is locked.
    expect(text(container)).toContain('Vocabulary draft saved');
    expect(key.matches(':disabled')).toBe(true);
    expect(buttonNamed(container, 'Create draft').matches(':disabled')).toBe(
      true,
    );
  });
});
