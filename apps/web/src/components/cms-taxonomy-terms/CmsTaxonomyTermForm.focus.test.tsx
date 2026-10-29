// @vitest-environment jsdom
import './term-action-preload.test-support';
import type { TaxonomyTermActionRequest } from '@wejammin/contracts';
import * as React from 'react';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SURVIVOR_ID } from '../../server/cms-taxonomy-platform.test-support';
import {
  buttonNamed,
  byLabel,
  choose,
  click,
  disableReactAct,
  enableReactAct,
  flush,
  mountElement,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import CmsTaxonomyTermForm from './CmsTaxonomyTermForm';
import {
  doneResult,
  formProps,
  heldTermsRead,
  namedTerm,
  optionValues,
  organ,
  pageFacts,
  readTermsStub,
  readVersionsStub,
  submitStub,
  termFacts,
  termsLoaded,
  termsPage,
} from './term-form.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);

const TUBA_ID = '50000000-0000-4000-8000-0000000000a1';
const FLUTE_ID = '50000000-0000-4000-8000-0000000000a2';
const OBOE_ID = '50000000-0000-4000-8000-0000000000a3';
const tuba = namedTerm(TUBA_ID, 'tuba', 'Tuba');
const flute = namedTerm(FLUTE_ID, 'flute', 'Flute');
const oboe = namedTerm(OBOE_ID, 'oboe', 'Oboe');

const mount = (
  props: Partial<React.ComponentProps<typeof CmsTaxonomyTermForm>>,
) =>
  mountElement(
    <CmsTaxonomyTermForm
      {...formProps({
        readVersions: readVersionsStub(),
        terms: pageFacts(undefined, { nextCursor: 'page.2' }),
        ...props,
      })}
    />,
  );

const noteIn = (container: HTMLElement): Element | undefined =>
  Array.from(container.querySelectorAll('[role="status"]')).find((entry) =>
    entry.textContent?.includes('no longer available'),
  );

/** A keyboard user: the control has focus before it is activated. */
const press = async (button: HTMLButtonElement): Promise<void> => {
  button.focus();
  await click(button);
};

describe('keyboard focus stays on the paging control (FE03 :898, WCAG 2.4.3)', () => {
  it('keeps focus on "Load more terms" through every page, then moves it to the choice on the last', async () => {
    const held = heldTermsRead();
    const { container } = mount({ readTerms: held.read });
    await click(buttonNamed(container, 'Merge term guitar into another'));
    held.release(termsPage([termFacts(), tuba], 'page.2'));
    await flush();
    const more = buttonNamed(container, 'Load more terms');

    await press(more);
    // While the read is in flight the same button is still there, named the same, and still focused.
    expect(held.pending()).toBe(1);
    expect(buttonNamed(container, 'Load more terms')).toBe(more);
    expect(more.disabled).toBe(false);
    expect(more.getAttribute('aria-disabled')).toBe('true');
    expect(document.activeElement).toBe(more);
    await click(more);
    expect(held.read).toHaveBeenCalledTimes(2);

    held.release(termsPage([flute], 'page.3'));
    await flush();
    expect(buttonNamed(container, 'Load more terms')).toBe(more);
    expect(more.getAttribute('aria-disabled')).not.toBe('true');
    expect(document.activeElement).toBe(more);

    await press(more);
    expect(document.activeElement).toBe(more);
    held.release(termsPage([oboe], null));
    await flush();
    expect(() => buttonNamed(container, 'Load more terms')).toThrow();
    const survivor = byLabel<HTMLSelectElement>(container, 'Merge into');
    expect(optionValues(survivor)).toEqual(['', TUBA_ID, FLUTE_ID, OBOE_ID]);
    expect(document.activeElement).toBe(survivor);
  });

  it('keeps focus on the same button through a failure, "Try again" and the pages after it', async () => {
    const held = heldTermsRead();
    const { container } = mount({ readTerms: held.read });
    await click(buttonNamed(container, 'Merge term guitar into another'));
    held.release(termsPage([termFacts(), tuba], 'page.2'));
    await flush();
    const more = buttonNamed(container, 'Load more terms');

    await press(more);
    held.release({ kind: 'unavailable' });
    await flush();
    expect(buttonNamed(container, 'Try again')).toBe(more);
    expect(document.activeElement).toBe(more);

    await press(more);
    // The label does not change while the retry is in flight.
    expect(buttonNamed(container, 'Try again')).toBe(more);
    expect(more.getAttribute('aria-disabled')).toBe('true');
    expect(document.activeElement).toBe(more);
    held.release({ kind: 'unavailable' });
    await flush();
    expect(document.activeElement).toBe(more);

    await press(more);
    held.release(termsPage([flute], 'page.3'));
    await flush();
    expect(buttonNamed(container, 'Load more terms')).toBe(more);
    expect(document.activeElement).toBe(more);

    await press(more);
    held.release(termsPage([oboe], null));
    await flush();
    expect(document.activeElement).toBe(
      byLabel<HTMLSelectElement>(container, 'Merge into'),
    );
  });

  it('keeps focus on "Try again" when the very first read fails', async () => {
    const held = heldTermsRead();
    const { container } = mount({ readTerms: held.read });
    await click(buttonNamed(container, 'Merge term guitar into another'));
    held.release({ kind: 'unavailable' });
    await flush();
    const again = buttonNamed(container, 'Try again');

    await press(again);
    expect(buttonNamed(container, 'Try again')).toBe(again);
    expect(document.activeElement).toBe(again);
    held.release(termsPage([termFacts(), tuba], 'page.2'));
    await flush();
    expect(buttonNamed(container, 'Load more terms')).toBe(again);
    expect(document.activeElement).toBe(again);
  });

  it('moves focus to the choice when "Try again" brings the last page after a failed first read', async () => {
    const held = heldTermsRead();
    const { container } = mount({ readTerms: held.read });
    await click(buttonNamed(container, 'Merge term guitar into another'));
    held.release({ kind: 'unavailable' });
    await flush();
    await press(buttonNamed(container, 'Try again'));
    held.release(termsPage([termFacts(), tuba], null));
    await flush();
    expect(() => buttonNamed(container, 'Try again')).toThrow();
    expect(document.activeElement).toBe(
      byLabel<HTMLSelectElement>(container, 'Merge into'),
    );
  });

  it('leaves focus where the person moved it while the last page was loading', async () => {
    const held = heldTermsRead();
    const { container } = mount({ readTerms: held.read });
    await click(buttonNamed(container, 'Rename term guitar'));
    held.release(termsPage([termFacts(), tuba], 'page.2'));
    await flush();
    const more = buttonNamed(container, 'Load more terms');

    await press(more);
    const label = byLabel<HTMLInputElement>(container, 'Label 1');
    label.focus();
    expect(document.activeElement).toBe(label);
    held.release(termsPage([flute], null));
    await flush();
    expect(() => buttonNamed(container, 'Load more terms')).toThrow();
    expect(document.activeElement).toBe(label);
  });

  it('moves focus to the choice when the focused button leaves and focus fell to the page', async () => {
    const held = heldTermsRead();
    const { container } = mount({ readTerms: held.read });
    await click(buttonNamed(container, 'Rename term guitar'));
    held.release(termsPage([termFacts(), tuba], 'page.2'));
    await flush();
    await press(buttonNamed(container, 'Load more terms'));
    held.release(termsPage([flute], null));
    await flush();
    expect(document.activeElement).toBe(
      byLabel<HTMLSelectElement>(container, 'Parent term'),
    );
  });

  it('keeps focus on the button through a restart after a stale cursor (409)', async () => {
    const held = heldTermsRead();
    const { container } = mount({ readTerms: held.read });
    await click(buttonNamed(container, 'Merge term guitar into another'));
    held.release(termsPage([termFacts(), tuba], 'page.2'));
    await flush();
    const more = buttonNamed(container, 'Load more terms');

    await press(more);
    held.release({ kind: 'rejected', status: 409 });
    await flush();
    // The restart read is in flight: the button is still the focused one.
    expect(held.pending()).toBe(1);
    expect(buttonNamed(container, 'Load more terms')).toBe(more);
    expect(document.activeElement).toBe(more);
    held.release(termsPage([termFacts(), tuba, flute], 'page.2'));
    await flush();
    expect(buttonNamed(container, 'Load more terms')).toBe(more);
    expect(document.activeElement).toBe(more);
  });
});

describe('a chosen merge survivor never disappears or mismatches (FE03 :887)', () => {
  it('keeps a survivor chosen from a later page when a stale cursor restarts the list', async () => {
    const readTerms = readTermsStub(
      termsPage([termFacts(), tuba], 'page.2'),
      termsPage([flute], 'page.3'),
      { kind: 'rejected', status: 409 },
      termsPage([termFacts(), tuba], 'page.2'),
    );
    const submit = submitStub(
      doneResult({ version: '3', lifecycle: 'merged', successorId: FLUTE_ID }),
    );
    const { container } = mount({ readTerms, submit });
    await click(buttonNamed(container, 'Merge term guitar into another'));
    await flush();
    await click(buttonNamed(container, 'Load more terms'));
    await flush();
    const survivor = byLabel<HTMLSelectElement>(container, 'Merge into');
    await choose(survivor, FLUTE_ID);
    await click(buttonNamed(container, 'Load more terms'));
    await flush();

    expect(container.textContent).toContain('restarted from the first page');
    const after = byLabel<HTMLSelectElement>(container, 'Merge into');
    expect(optionValues(after)).toEqual(['', TUBA_ID, FLUTE_ID]);
    expect(after.value).toBe(FLUTE_ID);

    await click(buttonNamed(container, 'Review the merge'));
    expect(container.querySelector('.cms-term-confirm')?.textContent).toContain(
      'Merge guitar (Guitar) into flute (Flute).',
    );
    await click(buttonNamed(container, 'Merge permanently'));
    await flush();
    const sent = (
      submit.mock.calls[0] as unknown as [TaxonomyTermActionRequest]
    )[0];
    expect(sent).toMatchObject({ action: 'merge', survivorId: FLUTE_ID });
  });

  it('clears a survivor that is no longer offered, says so, and never reaches the merge review with it', async () => {
    const mergedAway = termFacts({
      ...organ,
      lifecycle: 'merged',
      successorId: TUBA_ID,
    });
    const submit = submitStub({ kind: 'conflict', currentVersion: '3' });
    const readTerms = readTermsStub(
      termsLoaded(pageFacts([termFacts(), mergedAway, tuba])),
    );
    const { container } = mount({
      terms: pageFacts([termFacts(), organ, tuba]),
      readTerms,
      submit,
    });
    await click(buttonNamed(container, 'Merge term guitar into another'));
    await choose(
      byLabel<HTMLSelectElement>(container, 'Merge into'),
      SURVIVOR_ID,
    );
    await click(buttonNamed(container, 'Review the merge'));
    await click(buttonNamed(container, 'Merge permanently'));
    await flush();

    // The refresh found the survivor merged away: it is not offered, and the hidden value is gone.
    const survivor = byLabel<HTMLSelectElement>(container, 'Merge into');
    expect(optionValues(survivor)).toEqual(['', TUBA_ID]);
    expect(survivor.value).toBe('');
    expect(noteIn(container)?.textContent).toBe(
      'The term you chose to merge into is no longer available. Choose a term again.',
    );

    await click(buttonNamed(container, 'Review the merge'));
    expect(container.querySelector('.cms-term-confirm')).toBeNull();
    expect(submit).toHaveBeenCalledTimes(1);

    // Choosing again, and then un-choosing, does not bring the old note back.
    await choose(survivor, TUBA_ID);
    expect(noteIn(container)).toBeUndefined();
    await choose(survivor, '');
    expect(noteIn(container)).toBeUndefined();
  });

  it('also clears a survivor merged away when the picker holds an older read of an incomplete list', async () => {
    const mergedAway = termFacts({
      ...organ,
      lifecycle: 'merged',
      successorId: TUBA_ID,
    });
    const submit = submitStub({ kind: 'conflict', currentVersion: '3' });
    const readTerms = readTermsStub(
      // The picker's own read, then the refresh after the conflict.
      termsPage([termFacts(), organ, tuba], 'page.2'),
      termsLoaded(
        pageFacts([termFacts(), mergedAway, tuba], { nextCursor: 'page.2' }),
      ),
    );
    const { container } = mount({
      terms: pageFacts([termFacts(), organ, tuba], { nextCursor: 'page.2' }),
      readTerms,
      submit,
    });
    await click(buttonNamed(container, 'Merge term guitar into another'));
    await flush();
    await choose(
      byLabel<HTMLSelectElement>(container, 'Merge into'),
      SURVIVOR_ID,
    );
    await click(buttonNamed(container, 'Review the merge'));
    await click(buttonNamed(container, 'Merge permanently'));
    await flush();

    const survivor = byLabel<HTMLSelectElement>(container, 'Merge into');
    expect(optionValues(survivor)).toEqual(['', TUBA_ID]);
    expect(survivor.value).toBe('');
    expect(noteIn(container)?.textContent).toBe(
      'The term you chose to merge into is no longer available. Choose a term again.',
    );
    await click(buttonNamed(container, 'Review the merge'));
    expect(container.querySelector('.cms-term-confirm')).toBeNull();
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it('does not carry the note to another term opened while it shows', async () => {
    const mergedAway = termFacts({
      ...organ,
      lifecycle: 'merged',
      successorId: TUBA_ID,
    });
    const submit = submitStub({ kind: 'conflict', currentVersion: '3' });
    const { container } = mount({
      terms: pageFacts([termFacts(), organ, tuba]),
      readTerms: readTermsStub(
        termsLoaded(pageFacts([termFacts(), mergedAway, tuba])),
      ),
      submit,
    });
    await click(buttonNamed(container, 'Merge term guitar into another'));
    await choose(
      byLabel<HTMLSelectElement>(container, 'Merge into'),
      SURVIVOR_ID,
    );
    await click(buttonNamed(container, 'Review the merge'));
    await click(buttonNamed(container, 'Merge permanently'));
    await flush();
    expect(noteIn(container)).toBeDefined();
    await click(buttonNamed(container, 'Merge term tuba into another'));
    expect(noteIn(container)).toBeUndefined();
  });

  it('keeps a survivor chosen from the page while the picker read, which does not list it, was in flight', async () => {
    const held = heldTermsRead();
    const { container } = mount({
      terms: pageFacts([termFacts(), organ], { nextCursor: 'page.2' }),
      readTerms: held.read,
    });
    await click(buttonNamed(container, 'Merge term guitar into another'));
    const survivor = byLabel<HTMLSelectElement>(container, 'Merge into');
    await choose(survivor, SURVIVOR_ID);
    held.release(termsPage([termFacts(), tuba], null));
    await flush();
    expect(optionValues(survivor)).toEqual(['', TUBA_ID, SURVIVOR_ID]);
    expect(survivor.value).toBe(SURVIVOR_ID);
    expect(noteIn(container)).toBeUndefined();
  });
});
