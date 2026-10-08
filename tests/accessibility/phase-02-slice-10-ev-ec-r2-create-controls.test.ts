// @vitest-environment jsdom

import { createRequire } from 'node:module';

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import * as React from '../../apps/web/node_modules/react/index.js';

import CmsEditorialEntryCreateIsland from '../../apps/web/src/components/cms-editorial/CmsEditorialEntryCreateIsland';
import {
  disableReactAct,
  enableReactAct,
  mountElement,
} from '../../apps/web/src/components/cms-editorial-fields/cms-editor-dom.test-support';
import {
  allKindFields,
  selectedType,
} from '../../apps/web/src/components/cms-editorial-fields/cms-field-fixtures.test-support';

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

const UNAVAILABLE_KINDS: readonly string[] = ['relation', 'taxonomy', 'media'];

const mountCreate = (fields: ReturnType<typeof allKindFields>) => {
  document.documentElement.lang = 'en';
  document.title = 'Create entry | WeJammin';
  document.body.innerHTML = '<main id="cms-editorial-main"></main>';
  const mounted = mountElement(
    React.createElement(CmsEditorialEntryCreateIsland, {
      type: selectedType(),
      fields,
    }),
  );
  document.getElementById('cms-editorial-main')?.appendChild(mounted.container);
  return mounted.container;
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
  it('renders one named group per projected field, in the projection order, named by the projected label', () => {
    const projected = allKindFields();
    const rendered = groups(mountCreate(projected));
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

  it('gives every authorable kind a native control and every kind without a source a typed unavailable state with no control', () => {
    const projected = allKindFields();
    const rendered = groups(mountCreate(projected));
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
      'taxonomy',
      'media',
    ]);
    for (const field of authorable) {
      const group = rendered.find(
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
      const group = rendered.find(
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
  });

  it('uses no ARIA-only widget, no contenteditable and no positive tabindex', () => {
    const container = mountCreate(allKindFields());
    expect(container.querySelectorAll('[contenteditable]')).toHaveLength(0);
    expect(
      container.querySelectorAll(
        '[role="textbox"], [role="combobox"], [role="slider"]',
      ),
    ).toHaveLength(0);
    for (const node of Array.from(container.querySelectorAll('[tabindex]')))
      expect(Number(node.getAttribute('tabindex'))).toBeLessThanOrEqual(0);
  });

  it('drops exactly the group of a field the projection no longer carries', () => {
    const projected = allKindFields();
    const without = projected.filter((field) => field.key !== 'rating');
    const rendered = groups(mountCreate(without));
    expect(rendered).toHaveLength(projected.length - 1);
    expect(
      rendered.map((group) =>
        group.getAttribute('data-cms-editorial-field-key'),
      ),
    ).not.toContain('rating');
  });

  it('has no axe finding on the populated form', async () => {
    const container = mountCreate(allKindFields());
    expect(groups(container).length).toBeGreaterThanOrEqual(14);
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
