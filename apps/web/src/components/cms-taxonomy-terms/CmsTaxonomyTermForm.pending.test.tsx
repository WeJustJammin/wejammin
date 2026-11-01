// @vitest-environment jsdom
import './term-action-preload.test-support';
import * as React from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  buttonNamed,
  byLabel,
  click,
  disableReactAct,
  enableReactAct,
  flush,
  mountElement,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import CmsTaxonomyTermForm from './CmsTaxonomyTermForm';
import type { TermActionResult } from './term-action-submit';
import {
  doneResult,
  formProps,
  readTermsStub,
  readVersionsStub,
  termsLoaded,
} from './term-form.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);

const heldSubmit = () => {
  let answer: (result: TermActionResult) => void = () => undefined;
  const submit = vi.fn(
    () =>
      new Promise<TermActionResult>((resolve) => {
        answer = resolve;
      }),
  );
  return { submit, answer: (result: TermActionResult) => answer(result) };
};

const mount = (submit: ReturnType<typeof heldSubmit>['submit']) =>
  mountElement(
    <CmsTaxonomyTermForm
      {...formProps({
        readTerms: readTermsStub(termsLoaded()),
        readVersions: readVersionsStub(),
        submit,
      })}
    />,
  );

const disabledInForm = (container: HTMLElement): string[] =>
  Array.from(
    container.querySelectorAll<HTMLElement>(
      '.cms-term-action form input, .cms-term-action form select, .cms-term-action form textarea, .cms-term-action form button',
    ),
  )
    .filter((control) => control.matches(':disabled'))
    .map((control) => (control.textContent ?? '') || control.id);

/** The lone label cannot be removed (a field rule, not the pending lock), then the commit control and Cancel. */
const LONE_LABEL_AND_COMMIT = ['Remove', 'Saving…', 'Cancel'];

/**
 * [P2-S12-AC-271] FE03 1048 (Slice 12 `commandState`, CMS-03C-03 `loading`): "Stable pending
 * label; only the commit control disabled". The term action keeps every field editable while the
 * command is in flight and withholds only the commit control. Cancel (and Back on the review
 * step) leave the form and are not fields; FE03 is silent on them, so they keep their existing
 * pending lock rather than closing a form whose command is in flight.
 */
describe('CmsTaxonomyTermForm: pending command state', () => {
  it('[P2-S12-AC-271] keeps the fields editable and disables only the commit control (and Cancel) while a rename is pending', async () => {
    const held = heldSubmit();
    const { container } = mount(held.submit);
    await click(buttonNamed(container, 'Rename term guitar'));
    await click(buttonNamed(container, 'Rename term'));
    await flush();
    expect(held.submit).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('Saving…');
    expect(disabledInForm(container)).toEqual(LONE_LABEL_AND_COMMIT);
    // Fields stay editable and keep focus.
    const label = byLabel<HTMLInputElement>(container, 'Label 1');
    label.focus();
    await typeInto(label, 'Electric guitar');
    expect(label.value).toBe('Electric guitar');
    expect(document.activeElement).toBe(label);
    expect(disabledInForm(container)).toEqual(LONE_LABEL_AND_COMMIT);
    held.answer(doneResult({ version: '3' }));
    await flush();
    expect(container.textContent).toContain('Term guitar renamed');
  });

  it('[P2-S12-AC-271] withholds only the commit control (and Back) on the review step while a deprecation is pending', async () => {
    const held = heldSubmit();
    const { container } = mount(held.submit);
    await click(buttonNamed(container, 'Deprecate term guitar'));
    await click(buttonNamed(container, 'Review the deprecation'));
    await click(buttonNamed(container, 'Deprecate permanently'));
    await flush();
    expect(held.submit).toHaveBeenCalledTimes(1);
    expect(disabledInForm(container)).toEqual(['Saving…', 'Back']);
    held.answer(doneResult({ lifecycle: 'deprecated' }));
    await flush();
    expect(container.textContent).not.toContain('Saving…');
  });
});
