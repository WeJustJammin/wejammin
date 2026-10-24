// @vitest-environment jsdom
import type { TaxonomyTermActionRequest } from '@wejammin/contracts';
import * as React from 'react';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  PARENT_ID,
  SURVIVOR_ID,
} from '../../server/cms-taxonomy-platform.test-support';
import {
  buttonNamed,
  byLabel,
  choose,
  click,
  disableReactAct,
  enableReactAct,
  flush,
  mountElement,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import CmsTaxonomyTermForm from './CmsTaxonomyTermForm';
import type { TermsResult } from './taxonomy-terms-read';
import {
  doneResult,
  formProps,
  namedTerm,
  optionValues,
  organ,
  pageFacts,
  readTermsStub,
  readVersionsStub,
  strings,
  submitStub,
  termFacts,
  termsLoaded,
  termsPage,
} from './term-form.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);

const TUBA_ID = '50000000-0000-4000-8000-0000000000a1';
const tuba = namedTerm(TUBA_ID, 'tuba', 'Tuba');
const HELD_LABEL = 'Current parent (not among the terms loaded yet)';

/** guitar sits under `strings`, which is on no page the form has read yet. */
const guitar = termFacts({ parentId: PARENT_ID });

const mount = (
  props: Partial<React.ComponentProps<typeof CmsTaxonomyTermForm>>,
) =>
  mountElement(
    <CmsTaxonomyTermForm
      {...formProps({
        readVersions: readVersionsStub(),
        terms: pageFacts([guitar, organ], { nextCursor: 'page.2' }),
        readTerms: readTermsStub(
          termsPage([guitar, organ, tuba], 'page.2'),
          termsPage([strings], null),
        ),
        ...props,
      })}
    />,
  );

const sentOf = (
  submit: ReturnType<typeof submitStub>,
): TaxonomyTermActionRequest =>
  (submit.mock.calls[0] as unknown as [TaxonomyTermActionRequest])[0];

const parentSelect = (container: HTMLElement): HTMLSelectElement =>
  byLabel<HTMLSelectElement>(container, 'Parent term');

const openRename = async (
  props: Partial<React.ComponentProps<typeof CmsTaxonomyTermForm>> = {},
) => {
  const mounted = mount(props);
  await click(buttonNamed(mounted.container, 'Rename term guitar'));
  await flush();
  return mounted;
};

describe('a rename holds a current parent that no read page has brought yet (FE03 :28, WCAG 4.1.2)', () => {
  it('shows the held parent as the one selected option, labelled as not yet loaded', async () => {
    const { container } = await openRename();
    const select = parentSelect(container);
    expect(select.value).toBe(PARENT_ID);
    expect(optionValues(select)).toEqual(['', PARENT_ID, SURVIVOR_ID, TUBA_ID]);
    expect(select.selectedOptions).toHaveLength(1);
    expect(select.selectedOptions[0]?.textContent).toBe(HELD_LABEL);
  });

  it('sends the held parent when the rename is submitted unchanged', async () => {
    const submit = submitStub(doneResult({ version: '3' }));
    const { container } = await openRename({ submit });
    await click(buttonNamed(container, 'Rename term'));
    await flush();
    expect(sentOf(submit)).toMatchObject({
      action: 'rename',
      parentId: PARENT_ID,
    });
  });

  it('lets the person choose "No parent" to move the term to the top level', async () => {
    const submit = submitStub(doneResult({ version: '3' }));
    const { container } = await openRename({ submit });
    await choose(parentSelect(container), '');
    expect(parentSelect(container).value).toBe('');
    await click(buttonNamed(container, 'Rename term'));
    await flush();
    expect(sentOf(submit)).toMatchObject({
      action: 'rename',
      parentId: null,
    });
  });

  it('keeps the held parent on offer after another parent was chosen, so the choice can be undone', async () => {
    const submit = submitStub(doneResult({ version: '3' }));
    const { container } = await openRename({ submit });
    await choose(parentSelect(container), TUBA_ID);
    expect(optionValues(parentSelect(container))).toContain(PARENT_ID);
    await choose(parentSelect(container), PARENT_ID);
    expect(parentSelect(container).value).toBe(PARENT_ID);
    await click(buttonNamed(container, 'Rename term'));
    await flush();
    expect(sentOf(submit)).toMatchObject({ parentId: PARENT_ID });
  });

  it('replaces the held option with the named term once a page brings it, still selected', async () => {
    const { container } = await openRename();
    await click(buttonNamed(container, 'Load more terms'));
    await flush();
    const select = parentSelect(container);
    expect(optionValues(select)).toEqual(['', SURVIVOR_ID, TUBA_ID, PARENT_ID]);
    expect(select.value).toBe(PARENT_ID);
    expect(
      Array.from(select.options).find((option) => option.value === PARENT_ID)
        ?.textContent,
    ).toBe('strings (Strings)');
    expect(container.textContent).not.toContain(HELD_LABEL);
  });

  it('holds a listed but merged current parent under its own name, never as "No parent"', async () => {
    const mergedParent = termFacts({ ...strings, lifecycle: 'merged' });
    const { container } = await openRename({
      terms: pageFacts([guitar, organ, mergedParent]),
    });
    const select = parentSelect(container);
    expect(select.value).toBe(PARENT_ID);
    expect(select.selectedOptions[0]?.textContent).toBe(
      'strings (Strings) (current parent, merged)',
    );
  });

  it('names a held merged parent from the page when the picker read does not list it', async () => {
    const mergedParent = termFacts({ ...strings, lifecycle: 'merged' });
    const { container } = await openRename({
      terms: pageFacts([guitar, organ, mergedParent], {
        nextCursor: 'page.2',
      }),
    });
    expect(parentSelect(container).selectedOptions[0]?.textContent).toBe(
      'strings (Strings) (current parent, merged)',
    );
  });

  it('names a held merged parent from the picker read when the page does not list it', async () => {
    const mergedParent = termFacts({ ...strings, lifecycle: 'merged' });
    const { container } = await openRename({
      readTerms: readTermsStub(termsPage([guitar, organ, mergedParent], null)),
    });
    expect(parentSelect(container).value).toBe(PARENT_ID);
    expect(parentSelect(container).selectedOptions[0]?.textContent).toBe(
      'strings (Strings) (current parent, merged)',
    );
  });

  it('shows no held option when the page already lists the parent', async () => {
    const under = termFacts({ parentId: PARENT_ID });
    const { container } = await openRename({
      terms: pageFacts([under, organ, strings]),
    });
    const select = parentSelect(container);
    expect(optionValues(select)).toEqual(['', SURVIVOR_ID, PARENT_ID]);
    expect(select.value).toBe(PARENT_ID);
    expect(container.textContent).not.toContain(HELD_LABEL);
  });

  it('shows no held option for a term at the top level or on a new term', async () => {
    const top = await openRename({
      terms: pageFacts([termFacts(), organ], { nextCursor: 'page.2' }),
    });
    expect(top.container.textContent).not.toContain(HELD_LABEL);
    expect(parentSelect(top.container).value).toBe('');
    top.unmount();

    const created = mount({
      readTerms: readTermsStub(termsLoaded(pageFacts([guitar, organ]))),
    });
    await click(buttonNamed(created.container, 'Create a term'));
    await flush();
    expect(created.container.textContent).not.toContain(HELD_LABEL);
    expect(parentSelect(created.container).value).toBe('');
  });
});

/** The chosen parent, as a later read reports it: merged away into `organ`. */
const mergedTuba = termFacts({
  ...tuba,
  lifecycle: 'merged',
  successorId: SURVIVOR_ID,
});

/** A cursor conflict, so the picker restarts and its first page now reports `tuba` merged. */
const STALE_CURSOR: TermsResult = { kind: 'rejected', status: 409 };

/** A picker read whose restart from the first page reports the chosen parent `tuba` as merged. */
const restartReportingMergedTuba = (): ReturnType<typeof readTermsStub> =>
  readTermsStub(
    termsPage([guitar, organ, tuba], 'page.2'),
    STALE_CURSOR,
    termsPage([guitar, organ, mergedTuba], null),
  );

describe('a chosen parent a later read reports merged stays the value the control shows and the form sends (FE03 :887, WCAG 4.1.2)', () => {
  it('keeps a rename\'s chosen parent selected and sent after "Load more terms" reports it merged', async () => {
    const submit = submitStub(doneResult({ version: '3' }));
    const { container } = await openRename({
      submit,
      readTerms: restartReportingMergedTuba(),
    });
    await choose(parentSelect(container), TUBA_ID);
    await click(buttonNamed(container, 'Load more terms'));
    await flush();
    const select = parentSelect(container);
    // The form still holds TUBA_ID as the parent, so the native control must show it: a select with
    // no option for the value falls back to "No parent (top level)" while the request sends the id.
    expect(select.value).toBe(TUBA_ID);
    expect(select.selectedOptions[0]?.value).toBe(TUBA_ID);
    // The copy names the chosen parent, not the term's current parent (root's exact wording).
    expect(select.selectedOptions[0]?.textContent).not.toBe(HELD_LABEL);
    expect(select.selectedOptions[0]?.textContent).toMatch(
      /no longer available/i,
    );
    await click(buttonNamed(container, 'Rename term'));
    await flush();
    expect(sentOf(submit)).toMatchObject({
      action: 'rename',
      parentId: TUBA_ID,
    });
  });

  it('keeps a new term\'s chosen parent selected and sent after "Load more terms" reports it merged', async () => {
    const submit = submitStub(
      doneResult({ termKey: 'cello', termId: PARENT_ID }),
    );
    const { container } = mount({
      submit,
      readTerms: restartReportingMergedTuba(),
    });
    await click(buttonNamed(container, 'Create a term'));
    await flush();
    await choose(parentSelect(container), TUBA_ID);
    await click(buttonNamed(container, 'Load more terms'));
    await flush();
    expect(parentSelect(container).value).toBe(TUBA_ID);
    await typeInto(byLabel<HTMLInputElement>(container, 'Term key'), 'cello');
    await typeInto(byLabel<HTMLInputElement>(container, 'Label 1'), 'Cello');
    await click(buttonNamed(container, 'Create term'));
    await flush();
    expect(sentOf(submit)).toMatchObject({
      action: 'create',
      termKey: 'cello',
      parentId: TUBA_ID,
    });
  });

  it('clears both the shown and the sent parent when "No parent" is chosen instead', async () => {
    const submit = submitStub(doneResult({ version: '3' }));
    const { container } = await openRename({
      submit,
      readTerms: restartReportingMergedTuba(),
    });
    await choose(parentSelect(container), TUBA_ID);
    await click(buttonNamed(container, 'Load more terms'));
    await flush();
    await choose(parentSelect(container), '');
    expect(parentSelect(container).value).toBe('');
    await click(buttonNamed(container, 'Rename term'));
    await flush();
    expect(sentOf(submit)).toMatchObject({ action: 'rename', parentId: null });
  });

  it('keeps both the chosen parent and the stored current parent on offer after a restart reports the chosen parent merged, so either can be sent', async () => {
    const submit = submitStub(doneResult({ version: '3' }));
    const { container } = await openRename({
      submit,
      readTerms: restartReportingMergedTuba(),
    });
    await choose(parentSelect(container), TUBA_ID);
    await click(buttonNamed(container, 'Load more terms'));
    await flush();
    const select = parentSelect(container);
    // The chosen parent stays the shown value; the term's stored current parent stays on offer, so
    // the choice can still be undone once the restart dropped the chosen term from the choices.
    expect(select.value).toBe(TUBA_ID);
    const values = optionValues(select);
    expect(values).toContain(TUBA_ID);
    expect(values).toContain(PARENT_ID);
    await choose(select, PARENT_ID);
    expect(select.value).toBe(PARENT_ID);
    await click(buttonNamed(container, 'Rename term'));
    await flush();
    expect(sentOf(submit)).toMatchObject({
      action: 'rename',
      parentId: PARENT_ID,
    });
  });
});
