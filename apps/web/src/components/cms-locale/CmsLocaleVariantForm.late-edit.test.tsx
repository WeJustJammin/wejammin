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
import { BLURB, TITLE } from './locale-variant.test-support';
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

const savedMarks = (container: HTMLElement): number =>
  container.querySelectorAll('.cms-locale-saved').length;

/**
 * [P2-S12-AC-271] FE03 1048 keeps the translation fields editable while the CMS-03C-04 save is pending. A
 * field changed meanwhile was not sent: it is not marked "Saved in this draft", the value stays, and the form
 * says so; a field that was sent unchanged keeps its mark.
 */
describe('CmsLocaleVariantForm: an edit typed while the save is pending', () => {
  it('[P2-S12-AC-271] is not marked saved and is flagged as not part of the saved draft, while the sent field keeps its mark', async () => {
    const held = heldSubmit();
    const { container } = mount({ submit: held.submit });
    const title = byLabel<HTMLInputElement>(container, 'Title');
    const blurb = byLabel<HTMLInputElement>(container, 'Blurb');
    await typeInto(title, 'Tournée du printemps');
    await typeInto(blurb, 'Sent blurb');
    await click(buttonNamed(container, 'Save translation'));
    await flush();
    await typeInto(blurb, 'Late blurb');
    held.answer(savedResult({ savedFieldIds: [TITLE, BLURB] }));
    await flush();
    expect(text(container)).toContain('while this was saving');
    expect(text(container)).toContain('not part of the saved draft');
    expect(blurb.value).toBe('Late blurb');
    // Only the unchanged field is shown as saved.
    expect(savedMarks(container)).toBe(1);
    const mark = container.querySelector('.cms-locale-saved')!;
    expect(mark.parentElement?.textContent).toContain('Title');
    expect(mark.parentElement?.textContent).not.toContain('Blurb');
  });

  it('[P2-S12-AC-271] carries no late-edit notice and marks every sent field saved when nothing was typed during the save', async () => {
    const held = heldSubmit();
    const { container } = mount({ submit: held.submit });
    await typeInto(byLabel<HTMLInputElement>(container, 'Title'), 'Titre');
    await click(buttonNamed(container, 'Save translation'));
    await flush();
    held.answer(savedResult({ savedFieldIds: [TITLE] }));
    await flush();
    expect(text(container)).not.toContain('while this was saving');
    expect(savedMarks(container)).toBe(1);
  });
});

/** The mark belongs to the CONFIRMED save: a later attempt that is pending or failed confirms nothing. */
describe('CmsLocaleVariantForm: an edit after a confirmed save', () => {
  const savedThenHeld = () => {
    let answer: (result: LocaleSubmitResult) => void = () => undefined;
    const submit = vi
      .fn<() => Promise<LocaleSubmitResult>>()
      .mockResolvedValueOnce(savedResult({ savedFieldIds: [TITLE] }))
      .mockImplementationOnce(
        () =>
          new Promise<LocaleSubmitResult>((resolve) => {
            answer = resolve;
          }),
      );
    return { submit, answer: (result: LocaleSubmitResult) => answer(result) };
  };

  it('[P2-S12-AC-271] carries no "Saved in this draft." mark for the new value while the second save is pending or after it fails', async () => {
    const held = savedThenHeld();
    const { container } = mount({ submit: held.submit });
    const title = byLabel<HTMLInputElement>(container, 'Title');
    await typeInto(title, 'v1');
    await click(buttonNamed(container, 'Save translation'));
    await flush();
    expect(savedMarks(container)).toBe(1);
    await typeInto(title, 'v2');
    expect(savedMarks(container)).toBe(0);
    await click(buttonNamed(container, 'Save translation'));
    await flush();
    expect(held.submit).toHaveBeenCalledTimes(2);
    // The second save is pending: it confirmed nothing yet.
    expect(savedMarks(container)).toBe(0);
    held.answer({ kind: 'rejected', status: 503 });
    await flush();
    // It failed: the new value is still unconfirmed.
    expect(text(container)).toContain('Nothing was confirmed');
    expect(savedMarks(container)).toBe(0);
    expect(title.value).toBe('v2');
  });
});
