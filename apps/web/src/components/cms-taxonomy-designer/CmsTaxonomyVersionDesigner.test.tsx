// @vitest-environment jsdom
import * as React from 'react';
import { act } from 'react';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buttonNamed,
  byLabel,
  click,
  disableReactAct,
  enableReactAct,
  flush,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import { TAXONOMY_ID } from '../../server/cms-taxonomy-platform.test-support';
import {
  checkbox,
  fillValid,
  mount,
  radio,
  sentOf,
  text,
} from './taxonomy-designer-form.test-support';
import CmsTaxonomyVersionDesigner from './CmsTaxonomyVersionDesigner';
import { summaryOf } from './CmsTaxonomyVersionList';
import {
  CSRF_TOKEN,
  createdFacts,
  fixtureVersions,
  submitStub,
  versionFacts,
} from './taxonomy-designer.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);

describe('CmsTaxonomyVersionDesigner: a new vocabulary', () => {
  it('starts with labelled controls and states which domains can be checked', () => {
    const { container } = mount();
    expect(container.querySelector('h2')?.textContent).toBe(
      'Define a vocabulary',
    );
    byLabel(container, 'Vocabulary key');
    byLabel(container, 'Content type keys');
    byLabel(container, 'Field keys');
    expect(text(container)).toContain('No content type keys added yet.');
    expect(text(container)).toContain('declares no canonical domain');
    const role = checkbox(container, 'Role');
    expect(
      document.getElementById(role.getAttribute('aria-describedby') as string)
        ?.textContent,
    ).toBe('Checks available');
    const gear = checkbox(container, 'Gear');
    expect(
      document.getElementById(gear.getAttribute('aria-describedby') as string)
        ?.textContent,
    ).toBe('Not available yet; this vocabulary cannot activate while declared');
    expect(buttonNamed(container, 'Create draft').disabled).toBe(false);
  });

  it('explains before submit that a declared unavailable domain blocks review and activation', async () => {
    const { container } = mount();
    await click(checkbox(container, 'Gear'));
    expect(text(container)).toContain('This vocabulary declares: Gear.');
    expect(text(container)).toContain('Not available yet: Gear.');
    expect(text(container)).toContain(
      'cannot be submitted for review or activated',
    );
    await click(checkbox(container, 'Gear'));
    expect(text(container)).toContain('declares no canonical domain');
    expect(text(container)).not.toContain('Not available yet: Gear.');
  });

  it('builds the exact request and shows the saved draft with a link to its page', async () => {
    const submit = submitStub({
      kind: 'created',
      resource: createdFacts({ taxonomyVersion: 1, version: '1' }),
    });
    const { container } = mount({ submit });
    await fillValid(container);
    await click(buttonNamed(container, 'Create draft'));
    await flush();
    expect(submit).toHaveBeenCalledTimes(1);
    expect(sentOf(submit)).toEqual({
      taxonomyKey: 'instruments',
      shape: 'hierarchical',
      allowedTypeKeys: ['article', 'profile'],
      allowedFieldKeys: ['tags'],
      canonicalOverlapDomains: ['role'],
      expectedVersion: null,
    });
    const args = submit.mock.calls[0] as unknown as [unknown, string, string];
    expect(args[1]).toBe(CSRF_TOKEN);
    expect(args[2]).toMatch(/^[0-9a-f-]{36}$/u);
    const heading = document.getElementById('cms-taxonomy-result-heading');
    expect(heading?.textContent).toBe('Vocabulary draft saved');
    expect(document.activeElement).toBe(heading);
    const link = container.querySelector(
      'a[href^="/app/cms-content-modeling/taxonomies/"]',
    );
    expect(link?.getAttribute('href')).toBe(
      `/app/cms-content-modeling/taxonomies/${TAXONOMY_ID}`,
    );
    expect(buttonNamed(container, 'Create draft').disabled).toBe(true);
  });

  it('names every problem, links each to its control and sends nothing', async () => {
    const submit = submitStub();
    const { container } = mount({ submit });
    await click(buttonNamed(container, 'Create draft'));
    expect(submit).not.toHaveBeenCalled();
    const heading = document.getElementById('cms-taxonomy-result-heading');
    expect(heading?.textContent).toBe('Check the vocabulary');
    expect(document.activeElement).toBe(heading);
    expect(text(container)).toContain('4 problems to fix; nothing was sent.');
    const links = Array.from(
      container.querySelectorAll('.cms-taxonomy-status a'),
    );
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '#cms-taxonomy-key',
      '#cms-taxonomy-shape',
      '#cms-taxonomy-types',
      '#cms-taxonomy-fields',
    ]);
    await click(links[2] as HTMLElement);
    expect(document.activeElement?.id).toBe('cms-taxonomy-types');
    expect(
      byLabel<HTMLInputElement>(container, 'Vocabulary key').getAttribute(
        'aria-invalid',
      ),
    ).toBe('true');
    expect(text(container)).toContain('Choose flat or hierarchical.');
  });

  it('ignores a second activation while the first is in flight', async () => {
    let finish: (value: Awaited<ReturnType<typeof submitStub>>) => void = () =>
      undefined;
    const slow = (() =>
      new Promise((resolve) => {
        finish = resolve as typeof finish;
      })) as unknown as NonNullable<
      React.ComponentProps<typeof CmsTaxonomyVersionDesigner>['submit']
    >;
    let calls = 0;
    const counted = (async (...args: Parameters<typeof slow>) => {
      calls += 1;
      return slow(...args);
    }) as typeof slow;
    const { container } = mount({ submit: counted });
    await fillValid(container);
    const form = container.querySelector('form') as HTMLFormElement;
    await click(buttonNamed(container, 'Create draft'));
    expect(buttonNamed(container, 'Saving…').matches(':disabled')).toBe(true);
    form.requestSubmit();
    await flush();
    expect(calls).toBe(1);
    finish({ kind: 'rejected', status: 422 } as never);
    await flush();
    expect(text(container)).toContain('The vocabulary was not saved');
  });
});

describe('CmsTaxonomyVersionDesigner: the key lists', () => {
  it('adds on Enter without submitting, splits pasted lists and keeps entry order', async () => {
    const submit = submitStub();
    const { container } = mount({ submit });
    const input = byLabel<HTMLInputElement>(container, 'Content type keys');
    await typeInto(input, 'profile, article');
    await act(async () => {
      input.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    expect(submit).not.toHaveBeenCalled();
    expect(
      Array.from(
        container.querySelectorAll(
          'ul[aria-label="Added content type keys"] code',
        ),
      ).map((code) => code.textContent),
    ).toEqual(['profile', 'article']);
    expect(text(container)).toContain('2 of 64 added.');
  });

  it('names an invalid or repeated key, keeps the invalid text for correction and adds the rest', async () => {
    const { container } = mount();
    const input = byLabel<HTMLInputElement>(container, 'Field keys');
    await typeInto(input, 'tags Tags tags');
    await click(buttonNamed(container, 'Add field key'));
    expect(text(container)).toContain('“Tags” is not a valid key.');
    expect(text(container)).toContain('“tags” is already in the list.');
    expect(input.value).toBe('Tags');
    expect(
      container.querySelectorAll('ul[aria-label="Added field keys"] li'),
    ).toHaveLength(1);
  });

  it('removes a key with a button named for it and returns focus to the entry', async () => {
    const { container } = mount({ latest: null });
    const input = byLabel<HTMLInputElement>(container, 'Content type keys');
    await typeInto(input, 'article profile');
    await click(buttonNamed(container, 'Add content type key'));
    await click(buttonNamed(container, 'Remove content type key article'));
    expect(
      Array.from(
        container.querySelectorAll(
          'ul[aria-label="Added content type keys"] code',
        ),
      ).map((code) => code.textContent),
    ).toEqual(['profile']);
    expect(document.activeElement).toBe(input);
  });

  it('adds typed text when the field loses focus, so an unsent key is not lost', async () => {
    const submit = submitStub({ kind: 'created', resource: createdFacts() });
    const { container } = mount({ submit });
    await typeInto(
      byLabel<HTMLInputElement>(container, 'Vocabulary key'),
      'moods',
    );
    await click(radio(container, /^Flat/u));
    const types = byLabel<HTMLInputElement>(container, 'Content type keys');
    await typeInto(types, 'article');
    await act(async () => {
      types.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });
    const fields = byLabel<HTMLInputElement>(container, 'Field keys');
    await typeInto(fields, 'topics');
    await act(async () => {
      fields.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });
    await click(buttonNamed(container, 'Create draft'));
    await flush();
    expect(sentOf(submit)).toMatchObject({
      allowedTypeKeys: ['article'],
      allowedFieldKeys: ['topics'],
      shape: 'flat',
    });
  });
});

describe('CmsTaxonomyVersionDesigner: a saved vocabulary', () => {
  const edit = (
    props: Partial<
      React.ComponentProps<typeof CmsTaxonomyVersionDesigner>
    > = {},
  ) =>
    mount({
      latest: versionFacts({
        version: '3',
        taxonomyVersion: 3,
        state: 'draft',
        id: '40000000-0000-4000-8000-000000000033',
      }),
      versions: fixtureVersions().map(summaryOf),
      ...props,
    });

  it('prefills the rules, keeps the key read-only and lists every version', () => {
    const { container } = edit();
    expect(container.querySelector('h2')?.textContent).toBe(
      'Rules of instruments',
    );
    const key = byLabel<HTMLInputElement>(container, 'Vocabulary key');
    expect(key.value).toBe('instruments');
    expect(key.readOnly).toBe(true);
    expect(radio(container, /^Hierarchical/u).checked).toBe(true);
    expect(checkbox(container, 'Role').checked).toBe(true);
    expect(text(container)).toContain('Editing from version 3.');
    const rows = Array.from(
      container.querySelectorAll('table.cms-taxonomy-versions tbody tr'),
    ).map((row) => row.textContent);
    expect(rows).toHaveLength(3);
    expect(rows[1]).toContain('Active');
    expect(buttonNamed(container, 'Save successor draft').disabled).toBe(false);
  });

  it('submits a successor naming the version it was read from', async () => {
    const submit = submitStub({
      kind: 'created',
      resource: createdFacts({ taxonomyVersion: 4, version: '4' }),
    });
    const { container } = edit({ submit });
    await click(checkbox(container, 'Role'));
    await click(checkbox(container, 'Place'));
    await click(buttonNamed(container, 'Save successor draft'));
    await flush();
    expect(sentOf(submit)).toEqual({
      taxonomyKey: 'instruments',
      shape: 'hierarchical',
      allowedTypeKeys: ['article', 'profile'],
      allowedFieldKeys: ['tags'],
      canonicalOverlapDomains: ['place'],
      expectedVersion: '3',
    });
  });
});
