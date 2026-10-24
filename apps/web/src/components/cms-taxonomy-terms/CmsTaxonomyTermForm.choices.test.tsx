// @vitest-environment jsdom
import type { TaxonomyTermActionRequest } from '@wejammin/contracts';
import * as React from 'react';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  PARENT_ID,
  SURVIVOR_ID,
  TAXONOMY_ID,
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
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import CmsTaxonomyTermForm from './CmsTaxonomyTermForm';
import type { TermFacts, TermsResult } from './taxonomy-terms-read';
import {
  doneResult,
  formProps,
  organ,
  pageFacts,
  readTermsStub,
  readVersionsStub,
  submitStub,
  termFacts,
  termsLoaded,
} from './term-form.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);

const TUBA_ID = '50000000-0000-4000-8000-0000000000a1';
const FLUTE_ID = '50000000-0000-4000-8000-0000000000a2';
const tuba = termFacts({
  termId: TUBA_ID,
  termKey: 'tuba',
  labels: [{ locale: 'en', label: 'Tuba' }],
  aliases: [],
});
const flute = termFacts({
  termId: FLUTE_ID,
  termKey: 'flute',
  labels: [{ locale: 'en', label: 'Flute' }],
  aliases: [],
});

const firstOfVocabulary = (
  items: readonly TermFacts[],
  nextCursor: string | null,
): TermsResult => termsLoaded(pageFacts(items, { nextCursor }));
const text = (container: HTMLElement): string => container.textContent ?? '';
const optionKeys = (select: HTMLSelectElement): string[] =>
  Array.from(select.options).map((option) => option.value);
const queryOf = (call: readonly unknown[]): unknown => call[1];

const mount = (
  props: Partial<React.ComponentProps<typeof CmsTaxonomyTermForm>>,
) =>
  mountElement(
    <CmsTaxonomyTermForm
      {...formProps({ readVersions: readVersionsStub(), ...props })}
    />,
  );

/** A page that is the first of two: the picker must reach the terms it does not hold. */
const partialProps = (readTerms: ReturnType<typeof readTermsStub>) => ({
  terms: pageFacts(undefined, { nextCursor: 'page.2' }),
  readTerms,
});

describe('the merge survivor picker reaches every term of the vocabulary', () => {
  it('reads nothing more when the loaded page is the whole vocabulary', async () => {
    const readTerms = readTermsStub(termsLoaded());
    const { container } = mount({ readTerms });
    await click(buttonNamed(container, 'Merge term guitar into another'));
    await flush();
    expect(readTerms).not.toHaveBeenCalled();
    expect(() => buttonNamed(container, 'Load more terms')).toThrow();
  });

  it('reads the unfiltered first page when the loaded page is a part of the vocabulary', async () => {
    const readTerms = readTermsStub(
      firstOfVocabulary([termFacts(), tuba], 'page.2'),
    );
    const { container } = mount(partialProps(readTerms));
    await click(buttonNamed(container, 'Merge term guitar into another'));
    await flush();
    expect(readTerms).toHaveBeenCalledTimes(1);
    expect((readTerms.mock.calls[0] as unknown[])[0]).toBe(TAXONOMY_ID);
    expect(queryOf(readTerms.mock.calls[0] ?? [])).toEqual({ limit: 50 });
    expect(
      optionKeys(byLabel<HTMLSelectElement>(container, 'Merge into')),
    ).toEqual(['', TUBA_ID]);
  });

  it('loads further pages by cursor on request, then merges into a term from the last page', async () => {
    const readTerms = readTermsStub(
      firstOfVocabulary([termFacts(), tuba], 'page.2'),
      firstOfVocabulary([flute], null),
    );
    const submit = submitStub(
      doneResult({
        version: '3',
        lifecycle: 'merged',
        successorId: FLUTE_ID,
      }),
    );
    const { container } = mount({ ...partialProps(readTerms), submit });
    await click(buttonNamed(container, 'Merge term guitar into another'));
    await flush();
    // A browser focuses a button when it is pressed; jsdom's click() does not.
    const more = buttonNamed(container, 'Load more terms');
    more.focus();
    await click(more);
    await flush();
    expect(queryOf(readTerms.mock.calls[1] ?? [])).toEqual({
      cursor: 'page.2',
      limit: 50,
    });
    const survivor = byLabel<HTMLSelectElement>(container, 'Merge into');
    expect(optionKeys(survivor)).toEqual(['', TUBA_ID, FLUTE_ID]);
    expect(() => buttonNamed(container, 'Load more terms')).toThrow();
    expect(document.activeElement).toBe(survivor);
    await choose(survivor, FLUTE_ID);
    await click(buttonNamed(container, 'Review the merge'));
    expect(text(container)).toContain(
      'Merge guitar (Guitar) into flute (Flute).',
    );
    await click(buttonNamed(container, 'Merge permanently'));
    await flush();
    const sent = (
      submit.mock.calls[0] as unknown as [TaxonomyTermActionRequest]
    )[0];
    expect(sent).toMatchObject({ action: 'merge', survivorId: FLUTE_ID });
  });

  it('does not offer a term the picker read found merged, although the page still lists it active', async () => {
    const mergedAway = termFacts({
      ...organ,
      lifecycle: 'merged',
      successorId: TUBA_ID,
    });
    const readTerms = readTermsStub(
      firstOfVocabulary([termFacts(), mergedAway, tuba], 'page.2'),
    );
    const { container } = mount(partialProps(readTerms));
    await click(buttonNamed(container, 'Merge term guitar into another'));
    await flush();
    expect(
      optionKeys(byLabel<HTMLSelectElement>(container, 'Merge into')),
    ).toEqual(['', TUBA_ID]);
  });

  it('lists a term once when a later page repeats it', async () => {
    const readTerms = readTermsStub(
      firstOfVocabulary([termFacts(), tuba], 'page.2'),
      firstOfVocabulary([tuba, flute], null),
    );
    const { container } = mount(partialProps(readTerms));
    await click(buttonNamed(container, 'Merge term guitar into another'));
    await flush();
    await click(buttonNamed(container, 'Load more terms'));
    await flush();
    expect(
      optionKeys(byLabel<HTMLSelectElement>(container, 'Merge into')),
    ).toEqual(['', TUBA_ID, FLUTE_ID]);
  });

  it('keeps the term merged away and the term itself out of the choices on every page', async () => {
    const merged = termFacts({
      termId: PARENT_ID,
      termKey: 'old-guitar',
      lifecycle: 'merged',
      successorId: TUBA_ID,
    });
    const readTerms = readTermsStub(
      firstOfVocabulary([termFacts(), merged, tuba], null),
    );
    const { container } = mount(partialProps(readTerms));
    await click(buttonNamed(container, 'Merge term guitar into another'));
    await flush();
    expect(
      optionKeys(byLabel<HTMLSelectElement>(container, 'Merge into')),
    ).toEqual(['', TUBA_ID]);
  });

  it('restarts from the first page when the cursor is stale (409) and says so', async () => {
    const readTerms = readTermsStub(
      firstOfVocabulary([termFacts(), tuba], 'page.2'),
      { kind: 'rejected', status: 409 },
      firstOfVocabulary([termFacts(), tuba, flute], null),
    );
    const { container } = mount(partialProps(readTerms));
    await click(buttonNamed(container, 'Merge term guitar into another'));
    await flush();
    await click(buttonNamed(container, 'Load more terms'));
    await flush();
    expect(queryOf(readTerms.mock.calls[2] ?? [])).toEqual({ limit: 50 });
    expect(
      optionKeys(byLabel<HTMLSelectElement>(container, 'Merge into')),
    ).toEqual(['', TUBA_ID, FLUTE_ID]);
    expect(text(container)).toContain(
      'The list of terms changed while loading, so it restarted from the first page.',
    );
  });

  it('keeps the loaded choices and offers a retry when more terms cannot be loaded', async () => {
    const readTerms = readTermsStub(
      firstOfVocabulary([termFacts(), tuba], 'page.2'),
      { kind: 'unavailable' },
      firstOfVocabulary([flute], null),
    );
    const { container } = mount(partialProps(readTerms));
    await click(buttonNamed(container, 'Merge term guitar into another'));
    await flush();
    await click(buttonNamed(container, 'Load more terms'));
    await flush();
    const alert = container.querySelector('.cms-term-choices [role="alert"]');
    expect(alert?.textContent).toContain('More terms could not be loaded.');
    expect(
      optionKeys(byLabel<HTMLSelectElement>(container, 'Merge into')),
    ).toEqual(['', TUBA_ID]);
    await click(buttonNamed(container, 'Try again'));
    await flush();
    expect(
      optionKeys(byLabel<HTMLSelectElement>(container, 'Merge into')),
    ).toEqual(['', TUBA_ID, FLUTE_ID]);
  });

  it('offers the first page again after a failed first read, without losing the loaded page', async () => {
    const readTerms = readTermsStub(
      { kind: 'unavailable' },
      firstOfVocabulary([termFacts(), tuba], null),
    );
    const { container } = mount(partialProps(readTerms));
    await click(buttonNamed(container, 'Merge term guitar into another'));
    await flush();
    expect(text(container)).toContain('More terms could not be loaded.');
    expect(
      optionKeys(byLabel<HTMLSelectElement>(container, 'Merge into')),
    ).toEqual(['', SURVIVOR_ID, PARENT_ID]);
    await click(buttonNamed(container, 'Try again'));
    await flush();
    expect(
      optionKeys(byLabel<HTMLSelectElement>(container, 'Merge into')),
    ).toEqual(['', TUBA_ID]);
  });

  it('shows what is loaded and what remains, and the button is a native named button', async () => {
    const readTerms = readTermsStub(
      firstOfVocabulary([termFacts(), tuba], 'page.2'),
    );
    const { container } = mount(partialProps(readTerms));
    await click(buttonNamed(container, 'Merge term guitar into another'));
    await flush();
    const more = buttonNamed(container, 'Load more terms');
    expect(more.tagName).toBe('BUTTON');
    expect(more.getAttribute('type')).toBe('button');
    expect(more.disabled).toBe(false);
    expect(container.querySelector('.cms-term-choices')?.textContent).toContain(
      'More terms are available.',
    );
  });
});

describe('the parent picker reaches every term of the vocabulary', () => {
  it('pages the same way for a new term in a hierarchical vocabulary', async () => {
    const readTerms = readTermsStub(
      firstOfVocabulary([termFacts(), tuba], 'page.2'),
      firstOfVocabulary([flute], null),
    );
    const { container } = mount(partialProps(readTerms));
    await click(buttonNamed(container, 'Create a term'));
    await flush();
    await click(buttonNamed(container, 'Load more terms'));
    await flush();
    expect(
      optionKeys(byLabel<HTMLSelectElement>(container, 'Parent term')),
    ).toEqual(['', expect.any(String), TUBA_ID, FLUTE_ID]);
  });

  it('reads no more terms for a flat vocabulary, which has no parent field', async () => {
    const readTerms = readTermsStub(firstOfVocabulary([termFacts()], null));
    const { container } = mount({
      ...partialProps(readTerms),
      vocabulary: { ...formProps().vocabulary, shape: 'flat' },
    });
    await click(buttonNamed(container, 'Create a term'));
    await flush();
    expect(readTerms).not.toHaveBeenCalled();
  });

  it('reads the whole vocabulary when the page was reached by a cursor, even with no next page', async () => {
    const readTerms = readTermsStub(
      firstOfVocabulary([termFacts(), tuba], null),
    );
    const { container } = mount({
      readTerms,
      query: { lifecycle: null, cursor: 'page.2' },
    });
    await click(buttonNamed(container, 'Merge term guitar into another'));
    await flush();
    expect(readTerms).toHaveBeenCalledTimes(1);
    expect(queryOf(readTerms.mock.calls[0] ?? [])).toEqual({ limit: 50 });
  });

  it('reads the whole vocabulary when the page is filtered, since a filter hides terms', async () => {
    const readTerms = readTermsStub(
      firstOfVocabulary([termFacts(), tuba, flute], null),
    );
    const { container } = mount({
      readTerms,
      query: { lifecycle: 'deprecated', cursor: null },
    });
    await click(buttonNamed(container, 'Merge term strings into another'));
    await flush();
    expect(queryOf(readTerms.mock.calls[0] ?? [])).toEqual({ limit: 50 });
  });
});
