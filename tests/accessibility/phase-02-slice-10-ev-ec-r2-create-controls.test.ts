// @vitest-environment jsdom

import { createRequire } from 'node:module';

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import * as React from '../../apps/web/node_modules/react/index.js';

import { describeCmsAuthoringFields } from '../../apps/web/src/components/cms-editorial-fields/cms-field-descriptor-decode';
import CmsEditorialEntryCreateIsland from '../../apps/web/src/components/cms-editorial/CmsEditorialEntryCreateIsland';
import {
  byLabel,
  click,
  disableReactAct,
  enableReactAct,
  flush,
  mountElement,
} from '../../apps/web/src/components/cms-editorial-fields/cms-editor-dom.test-support';
import {
  allKindFields,
  selectedType,
} from '../../apps/web/src/components/cms-editorial-fields/cms-field-fixtures.test-support';
import {
  taxonomyPage,
  termUid,
} from '../../apps/web/src/components/cms-editorial-fields/cms-taxonomy-field-fixtures.test-support';

/**
 * Slice 10 evidence lane EC, remediation R2 (P2-S10-AC-105). The create surface CONSUMES the
 * CMS-03B-14 projection to render accessible NATIVE controls. The existing axe test only proves
 * the absence of violations on whatever was rendered; this one proves what was rendered:
 *
 *   - one field group per projected field, in the projection's order, none invented and none
 *     dropped (removing a field from the projection removes exactly its group);
 *   - every group has an accessible name taken from the projected label and at least one NATIVE
 *     control (input, select, textarea or button), with no ARIA-only widget, no contenteditable
 *     and no positive tabindex;
 *   - axe reports no finding on that DOM, and the DOM is the populated one, not an empty form.
 */
const requireFromPlaywright = createRequire(
  createRequire(import.meta.url).resolve('@axe-core/playwright'),
);
const axe = requireFromPlaywright('axe-core') as {
  run: (
    context: Element | Document,
    options: Record<string, unknown>,
  ) => Promise<{ violations: Array<{ id: string; impact: string | null }> }>;
};

beforeAll(enableReactAct);
afterAll(disableReactAct);
afterEach(() => {
  document.body.replaceChildren();
});

const UNAVAILABLE_KINDS: readonly string[] = ['relation', 'media'];

const SELECTOR_PATH = '/api/v1/cms/taxonomies/selector';
const TAXONOMY_FIELD_KEY = 'topics';

interface RecordedCall {
  readonly url: string;
  readonly method: string;
}

const pathOf = (url: string): string => {
  const index = url.indexOf('?');
  return index === -1 ? url : url.slice(0, index);
};

const searchOf = (url: string): Record<string, string> =>
  Object.fromEntries(new URLSearchParams(url.slice(url.indexOf('?') + 1)));

const TAXONOMY_PAGE = taxonomyPage([
  { n: 1, termKey: 'guitar', label: 'Guitar' },
]);

const taxonomyGroup = (container: HTMLElement): HTMLElement | null =>
  container.querySelector<HTMLElement>(
    `[data-cms-editorial-field-key="${TAXONOMY_FIELD_KEY}"]`,
  );

const taxonomyCheckboxes = (container: HTMLElement): HTMLInputElement[] => {
  const group = taxonomyGroup(container);
  return group === null
    ? []
    : Array.from(
        group.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
      );
};

/**
 * The only answer the create's own selector read may receive: the strict
 * `no-store` page of THIS request whose quoted ETag IS its `pageVersion`. Every
 * other request is a defect of the surface under test, so it is refused.
 */
const taxonomyPageResponse = (): Response =>
  new Response(JSON.stringify(TAXONOMY_PAGE), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      etag: '"7"',
      'cache-control': 'no-store',
    },
  });

const mountCreate = async (fields: ReturnType<typeof allKindFields>) => {
  document.documentElement.lang = 'en';
  document.title = 'Create entry | WeJammin';
  document.body.innerHTML = '<main id="cms-editorial-main"></main>';
  const calls: RecordedCall[] = [];
  const fetcher = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    calls.push({ url, method });
    if (method !== 'GET' || pathOf(url) !== SELECTOR_PATH)
      throw new Error(`unexpected request ${method} ${url}`);
    return taxonomyPageResponse();
  };
  const mounted = mountElement(
    React.createElement(CmsEditorialEntryCreateIsland, {
      type: selectedType(),
      fields,
      descriptors: describeCmsAuthoringFields(fields),
      fetcher,
    }),
  );
  document.getElementById('cms-editorial-main')?.appendChild(mounted.container);
  // The taxonomy field is a real native control only once the verified first
  // page of this create's own read has loaded: wait for that checkbox, never
  // for a status line or a retry button.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await flush();
    if (taxonomyCheckboxes(mounted.container).length > 0) break;
  }
  return { ...mounted, calls };
};

const groups = (container: HTMLElement): HTMLElement[] =>
  Array.from(
    container.querySelectorAll<HTMLElement>('[data-cms-editorial-field]'),
  );

const accessibleName = (group: HTMLElement): string => {
  const id = group.getAttribute('data-cms-editorial-field') ?? '';
  const label = group.querySelector(`label[for="field-${id}"]`);
  const legend = group.querySelector(':scope > legend');
  const grouped = group.querySelector('fieldset[aria-label]');
  return (
    label?.textContent ??
    legend?.textContent ??
    grouped?.getAttribute('aria-label') ??
    ''
  );
};

describe('EC-105 the create surface renders the projected fields as accessible native controls', () => {
  it('renders one named group per projected field, in the projection order, named by the projected label', async () => {
    const projected = allKindFields();
    const { container } = await mountCreate(projected);
    const rendered = groups(container);
    expect(
      rendered.map((group) => group.getAttribute('data-cms-editorial-field')),
    ).toEqual(projected.map((field) => field.stableFieldId));
    projected.forEach((field, index) => {
      expect(
        accessibleName(rendered[index] as HTMLElement),
        field.key,
      ).toContain(field.editorConfig.label);
    });
  });

  it('gives every authorable kind a native control and every kind without a source a typed unavailable state with no control', async () => {
    const projected = allKindFields();
    const { container: rendered, calls } = await mountCreate(projected);
    const renderedGroups = groups(rendered);
    const authorable = projected.filter(
      (field) => !UNAVAILABLE_KINDS.includes(field.kind),
    );
    const unavailable = projected.filter((field) =>
      UNAVAILABLE_KINDS.includes(field.kind),
    );
    // The split is real: both populations exist, so neither branch can pass vacuously.
    expect(authorable.length).toBeGreaterThanOrEqual(10);
    expect(unavailable.map((field) => field.kind)).toEqual([
      'relation',
      'media',
    ]);
    for (const field of authorable) {
      const group = renderedGroups.find(
        (candidate) =>
          candidate.getAttribute('data-cms-editorial-field') ===
          field.stableFieldId,
      ) as HTMLElement;
      expect(
        group.querySelectorAll('input, select, textarea, button').length,
        field.key,
      ).toBeGreaterThan(0);
      expect(
        group.hasAttribute('data-cms-editorial-field-unavailable'),
        field.key,
      ).toBe(false);
    }
    for (const field of unavailable) {
      const group = renderedGroups.find(
        (candidate) =>
          candidate.getAttribute('data-cms-editorial-field') ===
          field.stableFieldId,
      ) as HTMLElement;
      // A kind with no source yet is a typed, explained unavailable state - never a fake control.
      expect(
        group.getAttribute('data-cms-editorial-field-unavailable'),
        field.key,
      ).toBe(field.kind);
      expect(
        group.querySelectorAll('input, select, textarea, button').length,
        field.key,
      ).toBe(0);
      expect((group.textContent ?? '').length, field.key).toBeGreaterThan(
        field.editorConfig.label.length,
      );
    }
    // The taxonomy group is not merely "some control": it is the real connected
    // control over the verified first page of this create's own read scope.
    const gets = calls.filter((call) => call.method === 'GET');
    expect(calls.filter((call) => call.method !== 'GET')).toEqual([]);
    expect(gets).toHaveLength(1);
    expect(pathOf(gets[0]!.url)).toBe(SELECTOR_PATH);
    expect(searchOf(gets[0]!.url)).toEqual({
      typeKey: selectedType().typeKey,
      fieldKey: TAXONOMY_FIELD_KEY,
      locale: selectedType().defaultLocale,
      limit: '50',
    });
    expect(taxonomyCheckboxes(rendered).length).toBeGreaterThan(0);
    const guitar = byLabel<HTMLInputElement>(rendered, 'Guitar');
    expect(guitar.getAttribute('type')).toBe('checkbox');
    expect(guitar.value).toBe(termUid(1));
    expect(guitar.checked).toBe(false);
    // Only the author's own activation changes the selected value.
    await click(guitar);
    expect(guitar.checked).toBe(true);
    expect(
      taxonomyGroup(rendered)?.querySelector(
        '[role="status"][aria-live="polite"]',
      )?.textContent,
    ).toBe('1 term selected.');
    expect(calls.filter((call) => call.method !== 'GET')).toEqual([]);
    expect(calls.filter((call) => call.method === 'GET')).toHaveLength(1);
  });

  it('uses no ARIA-only widget, no contenteditable and no positive tabindex', async () => {
    const { container } = await mountCreate(allKindFields());
    expect(container.querySelectorAll('[contenteditable]')).toHaveLength(0);
    expect(
      container.querySelectorAll(
        '[role="textbox"], [role="combobox"], [role="slider"]',
      ),
    ).toHaveLength(0);
    for (const node of Array.from(container.querySelectorAll('[tabindex]')))
      expect(Number(node.getAttribute('tabindex'))).toBeLessThanOrEqual(0);
  });

  it('drops exactly the group of a field the projection no longer carries', async () => {
    const projected = allKindFields();
    const without = projected.filter((field) => field.key !== 'rating');
    const { container } = await mountCreate(without);
    const rendered = groups(container);
    expect(rendered).toHaveLength(projected.length - 1);
    expect(
      rendered.map((group) =>
        group.getAttribute('data-cms-editorial-field-key'),
      ),
    ).not.toContain('rating');
  });

  it('has no axe finding on the populated form', async () => {
    const { container } = await mountCreate(allKindFields());
    expect(groups(container).length).toBeGreaterThanOrEqual(14);
    expect(taxonomyCheckboxes(container).length).toBeGreaterThan(0);
    expect(
      container.querySelectorAll('input, select, textarea').length,
    ).toBeGreaterThan(14);
    const result = await axe.run(document, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'],
      },
      rules: {
        'color-contrast': { enabled: false },
        'target-size': { enabled: false },
      },
    });
    expect(result.violations.map((violation) => violation.id)).toEqual([]);
  });
});
