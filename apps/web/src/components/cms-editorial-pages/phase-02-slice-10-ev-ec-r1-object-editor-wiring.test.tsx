// @vitest-environment jsdom

import * as React from 'react';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import CmsEditorialEntryCreateIsland from '../cms-editorial/CmsEditorialEntryCreateIsland';
import { json } from '../cms-editorial/cms-editorial-editor-fixtures.test-support';
import {
  CONTENT_TYPE_VERSION_ID,
  OBJECT_STRUCTURE,
  authoringField,
  fieldUuid,
  selectedType,
} from '../cms-editorial-fields/cms-field-fixtures.test-support';
import {
  disableReactAct,
  enableReactAct,
  mountElement,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import type { CmsEditorialPageReads } from './cms-editorial-page-reads';
import { loadEntryCreatePage } from './load-entry-create-page';

/**
 * Slice 10 evidence lane EC, remediation R1 (P2-S10-AC-081). The native object editor is driven
 * from the REAL CMS-03B-14 projection path: a projection document is parsed by the production
 * page loader (`loadEntryCreatePage`, the code behind `new.astro`) and the loader's `selected`
 * type and `fields` are handed to the create island exactly as `CmsEditorialEntryCreateForm.astro`
 * does. EVERY declared property must then appear with its persistent label, its required mark, the
 * description derived from its declared constraints and the control its kind calls for - the
 * rich_text property included - and nothing the structure does not declare.
 */

beforeAll(enableReactAct);
afterAll(disableReactAct);
afterEach(() => document.body.replaceChildren());

const META = fieldUuid(2);

const projection = () => ({
  creatableTypes: [selectedType()],
  selectedType: selectedType(),
  fields: [
    authoringField({
      n: 1,
      key: 'title',
      kind: 'short_text',
      label: 'Title',
      required: true,
    }),
    authoringField({
      n: 2,
      key: 'meta',
      kind: 'object',
      label: 'Meta',
      constraints: { objectStructure: OBJECT_STRUCTURE },
    }),
  ],
});

const load = async (document_: unknown) => {
  const outcome = await loadEntryCreatePage({
    request: new Request(
      `https://web.test/app/cms-content-modeling/entries/new?contentTypeVersionId=${CONTENT_TYPE_VERSION_ID}`,
    ),
    reads: {
      authoringContext: async () => json(200, document_),
    } as unknown as CmsEditorialPageReads,
  });
  if (outcome.kind !== 'view') throw new Error('the projection must load');
  return outcome.view;
};

describe('EC-081 the object editor renders every declared property from the loaded projection', () => {
  it('shows one labelled group per declared property with its required mark, description and native control', async () => {
    const view = await load(projection());
    expect(view.selected).not.toBeNull();
    const { container } = mountElement(
      <CmsEditorialEntryCreateIsland
        type={view.selected as NonNullable<typeof view.selected>}
        fields={view.fields}
        fetcher={vi.fn() as unknown as typeof fetch}
      />,
    );
    const group = container.querySelector(`#field-${META}-group`);
    expect(group).not.toBeNull();
    const properties = Array.from(
      group?.querySelectorAll(':scope > fieldset') ?? [],
    ) as HTMLElement[];
    // One group per declared property, in declaration order, and no other group.
    expect(
      properties.map((entry) => entry.querySelector('legend')?.textContent),
    ).toEqual([
      'Headline (required)',
      'Priority',
      'Tone (required)',
      'Summary',
    ]);
    const described = (entry: HTMLElement): string =>
      entry.querySelector('p[id$="-description"]')?.textContent ?? '';
    // Descriptions come from the declared constraints, for every property kind.
    expect(described(properties[0] as HTMLElement)).toContain(
      'Between 3 and 20 characters.',
    );
    expect(described(properties[1] as HTMLElement)).toMatch(/1.*5/u);
    expect(described(properties[2] as HTMLElement)).toBe('Required.');
    expect(described(properties[3] as HTMLElement)).toMatch(/200/u);
    // The control each kind calls for.
    expect(
      (properties[0] as HTMLElement).querySelector('input'),
    ).not.toBeNull();
    expect(
      (properties[1] as HTMLElement).querySelector('input'),
    ).not.toBeNull();
    const choices = Array.from(
      (properties[2] as HTMLElement).querySelectorAll('option'),
    ).map((option) => option.value);
    expect(choices.filter((value) => value !== '')).toEqual([
      'formal',
      'casual',
    ]);
    expect(
      (properties[3] as HTMLElement).querySelector('.cms-rich-text-editor'),
    ).not.toBeNull();
    // The rich_text property is labelled once and its description is announced with the group.
    expect(
      (properties[3] as HTMLElement).querySelector('textarea'),
    ).not.toBeNull();
    expect(container.textContent).not.toMatch(
      /objectStructure|properties\[\]/u,
    );
  });

  it('declares no property the structure does not declare, and never a JSON box', async () => {
    const view = await load({
      ...projection(),
      fields: [
        authoringField({
          n: 2,
          key: 'meta',
          kind: 'object',
          label: 'Meta',
          constraints: {
            objectStructure: {
              properties: [
                {
                  key: 'only',
                  kind: 'scalar',
                  required: false,
                  constraints: {},
                },
              ],
            },
          },
        }),
      ],
    });
    const { container } = mountElement(
      <CmsEditorialEntryCreateIsland
        type={view.selected as NonNullable<typeof view.selected>}
        fields={view.fields}
        fetcher={vi.fn() as unknown as typeof fetch}
      />,
    );
    const group = container.querySelector(`#field-${META}-group`);
    expect(
      Array.from(group?.querySelectorAll(':scope > fieldset legend') ?? []).map(
        (entry) => entry.textContent,
      ),
    ).toEqual(['Only']);
    for (const area of Array.from(container.querySelectorAll('textarea')))
      expect(area.value.trim().startsWith('{')).toBe(false);
  });

  it('fails closed on a projection whose object field has no usable structure instead of rendering a JSON editor', async () => {
    const broken = projection();
    const view = await load({
      ...broken,
      fields: [
        authoringField({
          n: 2,
          key: 'meta',
          kind: 'object',
          label: 'Meta',
          constraints: {},
        }),
      ],
    });
    const { container } = mountElement(
      <CmsEditorialEntryCreateIsland
        type={view.selected as NonNullable<typeof view.selected>}
        fields={view.fields}
        fetcher={vi.fn() as unknown as typeof fetch}
      />,
    );
    expect(container.querySelector(`#field-${META}-group fieldset`)).toBeNull();
    expect(container.querySelectorAll('textarea')).toHaveLength(0);
  });
});
