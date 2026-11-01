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
  TERM_ID,
} from '../../server/cms-taxonomy-platform.test-support';
import CmsTaxonomyTermForm from './CmsTaxonomyTermForm';
import {
  doneResult,
  formProps,
  readTermsStub,
  readVersionsStub,
  submitStub,
  termsLoaded,
} from './term-form.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);

const mount = (
  props: Partial<React.ComponentProps<typeof CmsTaxonomyTermForm>> = {},
) =>
  mountElement(
    <CmsTaxonomyTermForm
      {...formProps({
        readTerms: readTermsStub(termsLoaded()),
        readVersions: readVersionsStub(),
        ...props,
      })}
    />,
  );
const text = (container: HTMLElement): string => container.textContent ?? '';
const sentOf = (
  submit: ReturnType<typeof submitStub>,
  call = 0,
): TaxonomyTermActionRequest =>
  (submit.mock.calls[call] as unknown as [TaxonomyTermActionRequest])[0];

describe('CmsTaxonomyTermForm: rename', () => {
  it('prefills the labels and the current parent, so a rename does not move the term', async () => {
    const submit = submitStub(doneResult({ version: '3' }));
    const { container } = mount({ submit });
    await click(buttonNamed(container, 'Rename term strings'));
    expect(byLabel<HTMLInputElement>(container, 'Label 1').value).toBe(
      'Strings',
    );
    expect(byLabel<HTMLSelectElement>(container, 'Parent term').value).toBe('');
    await click(buttonNamed(container, 'Cancel'));
    await click(buttonNamed(container, 'Rename term guitar'));
    expect(text(container)).toContain('Term: guitar');
    expect(() => byLabel(container, 'Term key')).toThrow();
    await typeInto(
      byLabel<HTMLInputElement>(container, 'Label 1'),
      'Electric guitar',
    );
    await click(buttonNamed(container, 'Rename term'));
    await flush();
    expect(sentOf(submit)).toEqual({
      taxonomyId: TAXONOMY_ID,
      action: 'rename',
      termKey: 'guitar',
      parentId: null,
      survivorId: null,
      labels: [{ locale: 'en', label: 'Electric guitar' }],
      aliases: [],
      expectedVersion: '2',
    });
    expect(document.activeElement?.textContent).toBe('Term guitar renamed');
  });

  it('offers neither the term nor a merged term as its own parent', async () => {
    const { container } = mount();
    await click(buttonNamed(container, 'Rename term guitar'));
    const options = Array.from(
      byLabel<HTMLSelectElement>(container, 'Parent term').options,
    ).map((o) => o.textContent);
    expect(options).toEqual([
      'No parent (top level)',
      'organ (Organ)',
      'strings (Strings)',
    ]);
  });
});

describe('CmsTaxonomyTermForm: alias', () => {
  it("requires an alias, sends the term's own labels and clears nothing it was not asked to", async () => {
    const submit = submitStub(doneResult({ version: '3' }));
    const { container } = mount({ submit });
    await click(buttonNamed(container, 'Add an alias to term guitar'));
    await click(buttonNamed(container, 'Add the alias'));
    expect(submit).not.toHaveBeenCalled();
    expect(text(container)).toContain('Add the alias to add.');
    const input = byLabel<HTMLInputElement>(container, 'Alias');
    await typeInto(input, '  six string  ');
    await click(buttonNamed(container, 'Add alias'));
    expect(
      container.querySelector('ul[aria-label="Aliases to add"] li')
        ?.textContent,
    ).toContain('six string');
    await click(buttonNamed(container, 'Add the alias'));
    await flush();
    expect(sentOf(submit)).toMatchObject({
      action: 'alias',
      termKey: 'guitar',
      parentId: null,
      labels: [{ locale: 'en', label: 'Guitar' }],
      aliases: ['six string'],
    });
    expect(document.activeElement?.textContent).toBe('Alias added to guitar');
  });

  it('removes an alias with a named button and ignores a repeat', async () => {
    const { container } = mount();
    await click(buttonNamed(container, 'Add an alias to term guitar'));
    const input = byLabel<HTMLInputElement>(container, 'Alias');
    await typeInto(input, 'axe2');
    await click(buttonNamed(container, 'Add alias'));
    await typeInto(input, 'axe2');
    await click(buttonNamed(container, 'Add alias'));
    expect(
      container.querySelectorAll('ul[aria-label="Aliases to add"] li'),
    ).toHaveLength(1);
    await click(buttonNamed(container, 'Remove alias axe2'));
    expect(
      container.querySelector('ul[aria-label="Aliases to add"]'),
    ).toBeNull();
    expect(document.activeElement).toBe(input);
  });
});

describe('CmsTaxonomyTermForm: deprecate', () => {
  it('has a separate review step that names the consequence, Back and Escape return, and commits only there', async () => {
    const submit = submitStub(
      doneResult({ version: '3', lifecycle: 'deprecated' }),
    );
    const { container } = mount({ submit });
    await click(buttonNamed(container, 'Deprecate term guitar'));
    expect(text(container)).toContain('cannot be made active again');
    await click(buttonNamed(container, 'Review the deprecation'));
    expect(submit).not.toHaveBeenCalled();
    expect(document.activeElement?.textContent).toBe(
      'Review: Deprecate: guitar',
    );
    expect(text(container)).toContain('Deprecate guitar (Guitar).');
    await click(buttonNamed(container, 'Back'));
    expect(() => buttonNamed(container, 'Deprecate permanently')).toThrow();
    await click(buttonNamed(container, 'Review the deprecation'));
    const form = container.querySelector(
      '.cms-term-action form',
    ) as HTMLElement;
    await act(async () => {
      form.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
    });
    expect(() => buttonNamed(container, 'Deprecate permanently')).toThrow();
    await click(buttonNamed(container, 'Review the deprecation'));
    await click(buttonNamed(container, 'Deprecate permanently'));
    await flush();
    expect(sentOf(submit)).toMatchObject({
      action: 'deprecate',
      termKey: 'guitar',
      labels: [{ locale: 'en', label: 'Guitar' }],
      aliases: [],
      survivorId: null,
    });
    expect(document.activeElement?.textContent).toBe('Term guitar deprecated');
  });
});

describe('CmsTaxonomyTermForm: merge', () => {
  it('requires a survivor, confirms the permanent redirect and shows the survivor redirect', async () => {
    const submit = submitStub(
      doneResult({
        version: '3',
        lifecycle: 'merged',
        successorId: SURVIVOR_ID,
      }),
    );
    const { container } = mount({ submit });
    await click(buttonNamed(container, 'Merge term guitar into another'));
    expect(text(container)).toContain('redirects permanently');
    await click(buttonNamed(container, 'Review the merge'));
    expect(submit).not.toHaveBeenCalled();
    expect(text(container)).toContain('Choose the term this one merges into.');
    const survivor = byLabel<HTMLSelectElement>(container, 'Merge into');
    expect(Array.from(survivor.options).map((o) => o.textContent)).toEqual([
      'Choose a term',
      'organ (Organ)',
      'strings (Strings)',
    ]);
    await choose(survivor, SURVIVOR_ID);
    await click(buttonNamed(container, 'Review the merge'));
    expect(text(container)).toContain(
      'Merge guitar (Guitar) into organ (Organ). The retired term “guitar” redirects permanently to “organ”',
    );
    expect(text(container)).toContain('This cannot be undone.');
    await click(buttonNamed(container, 'Merge permanently'));
    await flush();
    expect(sentOf(submit)).toEqual({
      taxonomyId: TAXONOMY_ID,
      action: 'merge',
      termKey: 'guitar',
      parentId: null,
      survivorId: SURVIVOR_ID,
      labels: [{ locale: 'en', label: 'Guitar' }],
      aliases: [],
      expectedVersion: '2',
    });
    expect(document.activeElement?.textContent).toBe('Term guitar merged');
    expect(text(container)).toContain(
      'guitar now redirects permanently to organ. Every use of it moved there.',
    );
  });

  it('does not offer the term itself as its own survivor', async () => {
    const { container } = mount();
    await click(buttonNamed(container, 'Merge term strings into another'));
    const options = Array.from(
      byLabel<HTMLSelectElement>(container, 'Merge into').options,
    ).map((o) => o.textContent);
    expect(options).not.toContain('strings (Strings)');
    expect(options).toContain('guitar (Guitar)');
  });
});

describe('CmsTaxonomyTermForm: a different action replaces the open form', () => {
  it('opens the next action fresh, without the previous entries', async () => {
    const { container } = mount();
    await click(buttonNamed(container, 'Create a term'));
    await typeInto(byLabel<HTMLInputElement>(container, 'Term key'), 'cello');
    await click(buttonNamed(container, 'Add an alias to term guitar'));
    expect(container.querySelectorAll('.cms-term-action')).toHaveLength(1);
    expect(document.activeElement?.textContent).toBe('Add an alias: guitar');
    expect(() => byLabel(container, 'Term key')).toThrow();
    await click(buttonNamed(container, 'Create a term'));
    expect(byLabel<HTMLInputElement>(container, 'Term key').value).toBe('');
    void PARENT_ID;
    void TERM_ID;
  });
});
