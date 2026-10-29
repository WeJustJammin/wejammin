// @vitest-environment jsdom
import './term-action-preload.test-support';
import type { TaxonomyTermActionRequest } from '@wejammin/contracts';
import * as React from 'react';
import { act } from 'react';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

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
import {
  PARENT_ID,
  SURVIVOR_ID,
  TAXONOMY_ID,
} from '../../server/cms-taxonomy-platform.test-support';
import CmsTaxonomyTermForm from './CmsTaxonomyTermForm';
import {
  REVIEW_HREF,
  doneResult,
  formProps,
  pageFacts,
  readTermsStub,
  readVersionsStub,
  submitStub,
  termFacts,
  termsLoaded,
} from './term-form.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);

const mount = (
  props: Partial<React.ComponentProps<typeof CmsTaxonomyTermForm>> = {},
) => {
  const readTerms = props.readTerms ?? readTermsStub(termsLoaded());
  const readVersions = props.readVersions ?? readVersionsStub();
  return {
    ...mountElement(
      <CmsTaxonomyTermForm
        {...formProps({ readTerms, readVersions, ...props })}
      />,
    ),
    readTerms,
    readVersions,
  };
};
const text = (container: HTMLElement): string => container.textContent ?? '';
const sentOf = (
  submit: ReturnType<typeof submitStub>,
  call = 0,
): TaxonomyTermActionRequest =>
  (submit.mock.calls[call] as unknown as [TaxonomyTermActionRequest])[0];
const rows = (container: HTMLElement): string[] =>
  Array.from(container.querySelectorAll('table.cms-term-table tbody tr')).map(
    (row) => row.textContent ?? '',
  );

describe('CmsTaxonomyTermForm: the term list', () => {
  it('lists every term with labels, aliases, lifecycle and the survivor redirect', () => {
    const { container } = mount();
    expect(container.querySelector('caption')?.textContent).toBe(
      'Terms of instruments',
    );
    const list = rows(container);
    expect(list).toHaveLength(4);
    expect(list[0]).toContain('guitar');
    expect(list[0]).toContain('en: Guitar');
    expect(list[0]).toContain('axe');
    expect(list[0]).toContain('Active');
    expect(list[2]).toContain('Deprecated');
    expect(list[3]).toContain('Merged');
    expect(list[3]).toContain('Redirects permanently to organ.');
    expect(text(container)).toContain('4 terms on this page.');
    expect(text(container)).toContain(
      'Term actions run under the active version, 2.',
    );
    expect(container.querySelector('span[lang="en"]')?.textContent).toBe(
      'Guitar',
    );
  });

  it('says where an off-page survivor is, and shows an empty list in words', () => {
    const { container } = mount({
      terms: pageFacts([
        termFacts({ lifecycle: 'merged', successorId: SURVIVOR_ID }),
      ]),
    });
    expect(rows(container)[0]).toContain(
      'Redirects permanently to another term that is not on this page.',
    );
    const empty = mount({ terms: pageFacts([]) });
    expect(text(empty.container)).toContain('No terms match.');
    expect(text(empty.container)).toContain('0 terms on this page.');
  });

  it('offers each action by name only where it applies', () => {
    const { container } = mount();
    expect(() => buttonNamed(container, 'Rename term guitar')).not.toThrow();
    expect(() =>
      buttonNamed(container, 'Add an alias to term guitar'),
    ).not.toThrow();
    expect(() => buttonNamed(container, 'Deprecate term guitar')).not.toThrow();
    expect(() =>
      buttonNamed(container, 'Merge term guitar into another'),
    ).not.toThrow();
    expect(() => buttonNamed(container, 'Deprecate term strings')).toThrow();
    expect(() => buttonNamed(container, 'Rename term strings')).not.toThrow();
    expect(() => buttonNamed(container, 'Rename term old-organ')).toThrow();
    expect(text(container)).toContain('No actions');
  });

  it('renders no action control against a vocabulary with no active version, and links its review', () => {
    const { container } = mount({
      vocabulary: { ...formProps().vocabulary, active: null },
    });
    expect(container.querySelectorAll('table button')).toHaveLength(0);
    expect(() => buttonNamed(container, 'Create a term')).toThrow();
    expect(
      container.querySelector('th[scope="col"]:last-child')?.textContent,
    ).toBe('State');
    const link = Array.from(container.querySelectorAll('a')).find((a) =>
      a.textContent?.includes('governed review'),
    );
    expect(link?.getAttribute('href')).toBe(REVIEW_HREF);
    expect(text(container)).toContain('listed read-only');
    expect(rows(container)).toHaveLength(4);
  });

  it('keeps the filter and the cursor in the URL: a GET filter form and pager links', () => {
    const base = `/app/cms-content-modeling/taxonomies/${TAXONOMY_ID}`;
    const { container } = mount({
      terms: pageFacts(undefined, { nextCursor: 'next.cursor' }),
      query: { lifecycle: 'deprecated', cursor: 'this.cursor' },
    });
    const form = container.querySelector(
      'form.cms-term-filter',
    ) as HTMLFormElement;
    expect(form.getAttribute('method')).toBe('get');
    expect(form.getAttribute('action')).toBe(base);
    expect((byLabel(container, 'Show') as HTMLSelectElement).value).toBe(
      'deprecated',
    );
    expect(
      Array.from(form.querySelectorAll('option')).map((o) =>
        o.getAttribute('value'),
      ),
    ).toEqual(['', 'active', 'deprecated', 'merged']);
    const links = Array.from(
      container.querySelectorAll('nav[aria-label="Term pages"] a'),
    ).map((a) => [a.textContent, a.getAttribute('href')]);
    expect(links).toEqual([
      ['First page', `${base}?lifecycle=deprecated`],
      ['Next page of terms', `${base}?lifecycle=deprecated&cursor=next.cursor`],
    ]);
    expect(text(container)).toContain('(deprecated only)');
    expect(container.querySelector('a[href="' + base + '"]')?.textContent).toBe(
      'Clear filter',
    );
  });

  it('shows no pager on a single unfiltered first page', () => {
    const { container } = mount();
    expect(
      container.querySelectorAll('nav[aria-label="Term pages"] a'),
    ).toHaveLength(0);
    expect(() => byLabel(container, 'Show')).not.toThrow();
    expect(
      Array.from(container.querySelectorAll('a')).some(
        (a) => a.textContent === 'Clear filter',
      ),
    ).toBe(false);
  });
});

describe('CmsTaxonomyTermForm: create', () => {
  it('opens a labelled form, sends the exact request under the active version and shows the result', async () => {
    const submit = submitStub(
      doneResult({ termKey: 'cello', termId: PARENT_ID }),
    );
    const readTerms = readTermsStub(termsLoaded());
    const { container, readVersions } = mount({ submit, readTerms });
    await click(buttonNamed(container, 'Create a term'));
    expect(document.activeElement?.id).toBe('cms-term-form-heading');
    expect(document.activeElement?.textContent).toBe('Create a term');
    await typeInto(byLabel<HTMLInputElement>(container, 'Term key'), 'cello');
    await typeInto(byLabel<HTMLInputElement>(container, 'Label 1'), 'Cello');
    const alias = byLabel<HTMLInputElement>(container, 'Alias');
    await typeInto(alias, 'violoncello');
    await act(async () => {
      alias.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    expect(submit).not.toHaveBeenCalled();
    await choose(
      byLabel<HTMLSelectElement>(container, 'Parent term'),
      PARENT_ID,
    );
    await click(buttonNamed(container, 'Create term'));
    await flush();
    expect(sentOf(submit)).toEqual({
      taxonomyId: TAXONOMY_ID,
      action: 'create',
      termKey: 'cello',
      parentId: PARENT_ID,
      survivorId: null,
      labels: [{ locale: 'en', label: 'Cello' }],
      aliases: ['violoncello'],
      expectedVersion: '2',
    });
    const args = submit.mock.calls[0] as unknown as [unknown, string, string];
    expect(args[1]).toBe('csrf-token-000000000001');
    expect(document.activeElement?.id).toBe('cms-term-result-heading');
    expect(document.activeElement?.textContent).toBe('Term cello created');
    expect(readTerms).toHaveBeenCalledTimes(1);
    expect(readVersions).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.cms-term-action')).toBeNull();
    expect(text(container)).toContain(
      'cello is active and available to authors.',
    );
  });

  it('lists the parent choices from non-merged terms only, and offers none for a flat vocabulary', async () => {
    const { container } = mount();
    await click(buttonNamed(container, 'Create a term'));
    const parent = byLabel<HTMLSelectElement>(container, 'Parent term');
    expect(
      Array.from(parent.options).map((option) => option.textContent),
    ).toEqual([
      'No parent (top level)',
      'guitar (Guitar)',
      'organ (Organ)',
      'strings (Strings)',
    ]);
    const flat = mount({
      vocabulary: { ...formProps().vocabulary, shape: 'flat' },
    });
    await click(buttonNamed(flat.container, 'Create a term'));
    expect(() => byLabel(flat.container, 'Parent term')).toThrow();
  });

  it('names every problem, links each to its control and sends nothing', async () => {
    const submit = submitStub();
    const { container } = mount({ submit });
    await click(buttonNamed(container, 'Create a term'));
    await typeInto(byLabel<HTMLInputElement>(container, 'Label 1'), '');
    await click(buttonNamed(container, 'Create term'));
    expect(submit).not.toHaveBeenCalled();
    expect(document.activeElement?.textContent).toBe('Check the term');
    const links = Array.from(
      container.querySelectorAll('.cms-term-status a'),
    ).map((a) => a.getAttribute('href'));
    expect(links).toEqual(['#cms-term-key', '#cms-term-labels']);
    await click(
      container.querySelector(
        '.cms-term-status a[href="#cms-term-key"]',
      ) as HTMLElement,
    );
    expect(document.activeElement?.id).toBe('cms-term-key');
    expect(
      byLabel<HTMLInputElement>(container, 'Term key').getAttribute(
        'aria-invalid',
      ),
    ).toBe('true');
    expect(text(container)).toContain('Label 1: Enter the label');
  });

  it('adds and removes label rows with named buttons and keeps one', async () => {
    const { container } = mount();
    await click(buttonNamed(container, 'Create a term'));
    expect(buttonNamed(container, 'Remove label 1').disabled).toBe(true);
    await click(buttonNamed(container, 'Add a label in another language'));
    await typeInto(
      byLabel<HTMLInputElement>(container, 'Language of label 2'),
      'fr',
    );
    await typeInto(
      byLabel<HTMLInputElement>(container, 'Label 2'),
      'Violoncelle',
    );
    expect(buttonNamed(container, 'Remove label 1').disabled).toBe(false);
    await click(buttonNamed(container, 'Remove label 1'));
    expect(byLabel<HTMLInputElement>(container, 'Label 1').value).toBe(
      'Violoncelle',
    );
    expect(
      byLabel<HTMLInputElement>(container, 'Language of label 1').value,
    ).toBe('fr');
  });

  it('cancels back to the control that opened the form', async () => {
    const { container } = mount();
    const trigger = buttonNamed(container, 'Create a term');
    await click(trigger);
    await click(buttonNamed(container, 'Cancel'));
    expect(container.querySelector('.cms-term-action')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
