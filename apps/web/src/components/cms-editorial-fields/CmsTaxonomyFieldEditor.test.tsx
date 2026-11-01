// @vitest-environment jsdom

/**
 * The CMS-03C-17 taxonomy field control, `CmsTaxonomyFieldEditor` (FE03
 * "Slice 12 governed definition, composition, taxonomy, locale and
 * related-content surfaces" and "Complete component contracts"; P2-S12-AC-135;
 * BE03b "Value encodings by field kind":
 * `taxonomy: { termIds: UUID[] <= 128 }`).
 *
 * The DOM contract these tests pin down:
 * - the control is the field frame's group: a `fieldset` whose `legend` is the
 *   field label, holding one native `input[type=checkbox]` per page term;
 * - a checkbox takes its accessible name from the term `label`, or from the
 *   term `termKey` when the contract's label is null, and its `value` is that
 *   term's id;
 * - a hierarchical page wires the derived level as the checkbox description
 *   (see `CmsTaxonomyFieldEditor.selection.test.tsx`);
 * - `error` is an alert, and `issues`/help/hint are linked by the frame;
 * - every command is native: the checkboxes and one `Clear selection` button.
 *   The control adds no key handler, composite role or unknown-term option.
 */

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  buttonNamed,
  byLabel,
  click,
  disableReactAct,
  enableReactAct,
  press,
} from './cms-editor-dom.test-support';
import {
  announcedCount,
  blurOut,
  describedText,
  emittedTermIds,
  mountTaxonomy,
  taxonomyDescriptor,
  taxonomyPage,
  taxonomyValue,
  termCheckboxes,
  termUid,
  writeKeys,
} from './cms-taxonomy-field-fixtures.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);
afterEach(() => document.body.replaceChildren());

describe('CmsTaxonomyFieldEditor: the labelled checkbox group', () => {
  it('[P2-S12-AC-135] offers one native checkbox per page term, named by its label or by its term key when the label is null', () => {
    const mounted = mountTaxonomy({
      page: taxonomyPage([
        { n: 1, termKey: 'post-rock', label: 'Post-rock' },
        { n: 2, termKey: 'krautrock', label: null },
      ]),
    });
    const boxes = termCheckboxes(mounted.container);
    expect(boxes).toHaveLength(2);
    for (const box of boxes) {
      expect(box.getAttribute('type')).toBe('checkbox');
      expect(box.getAttribute('role')).toBeNull();
      expect(box.tabIndex).toBe(0);
      expect(box.checked).toBe(false);
    }
    const named = byLabel<HTMLInputElement>(mounted.container, 'Post-rock');
    const fallback = byLabel<HTMLInputElement>(mounted.container, 'krautrock');
    expect(named.value).toBe(termUid(1));
    expect(fallback.value).toBe(termUid(2));
    expect(mounted.container.querySelector('fieldset')).not.toBeNull();
    const composite = mounted.container.querySelector(
      '[role="listbox"], [role="option"], [aria-activedescendant]',
    );
    expect(composite).toBeNull();
    // A flat vocabulary states no level at all.
    expect(mounted.container.textContent).not.toContain('Level');
  });

  it('[P2-S12-AC-135] frames the group with the field legend and links the required mark, help and issues', () => {
    const mounted = mountTaxonomy({
      descriptor: taxonomyDescriptor({
        required: true,
        helpText: 'Pick the genres this release belongs to.',
      }),
      page: taxonomyPage([{ n: 1, termKey: 'post-rock', label: 'Post-rock' }]),
      issues: [
        {
          code: 'term_unavailable',
          message: 'This term is no longer available.',
        },
      ],
    });
    const group = mounted.container.querySelector<HTMLElement>('fieldset');
    if (group === null) throw new Error('the field has no group');
    const legend = group.querySelector('legend');
    expect(legend?.textContent).toBe('Topics (required)');
    const description = describedText(group);
    expect(description).toContain('Pick the genres this release belongs to.');
    expect(description).toContain('This term is no longer available.');
    const box = byLabel<HTMLInputElement>(mounted.container, 'Post-rock');
    expect(box.checked).toBe(false);
  });

  it('[P2-S12-AC-135] announces the typed refusal as an alert and invents no option for an unknown term', () => {
    const refusal = 'That term is no longer available in this vocabulary.';
    const mounted = mountTaxonomy({
      page: taxonomyPage([{ n: 1, termKey: 'post-rock', label: 'Post-rock' }]),
      value: taxonomyValue([termUid(1), termUid(9)]),
      error: refusal,
    });
    const alert = mounted.container.querySelector('[role="alert"]');
    expect(alert?.textContent).toBe(refusal);
    const boxes = termCheckboxes(mounted.container);
    expect(boxes).toHaveLength(1);
    expect(boxes[0]?.value).toBe(termUid(1));
    expect(mounted.container.textContent).not.toContain(termUid(9));
  });

  it('[P2-S12-AC-135] toggles through the checkbox itself and adds no key handler of its own', async () => {
    const mounted = mountTaxonomy({
      page: taxonomyPage([{ n: 1, termKey: 'post-rock', label: 'Post-rock' }]),
    });
    const box = byLabel<HTMLInputElement>(mounted.container, 'Post-rock');
    await press(box, ' ');
    expect(mounted.emitted()).toBeUndefined();
    await click(box);
    expect(mounted.emitted()).toEqual({ termIds: [termUid(1)] });
    await click(box);
    expect(mounted.emitted()).toEqual({ termIds: [] });
  });
});

describe('CmsTaxonomyFieldEditor: writing the value', () => {
  it('[P2-S12-AC-135] writes exactly { termIds } and keeps the order the value already has', async () => {
    const mounted = mountTaxonomy({
      page: taxonomyPage([
        { n: 1, termKey: 'alpha', label: 'Alpha' },
        { n: 2, termKey: 'beta', label: 'Beta' },
        { n: 3, termKey: 'gamma', label: 'Gamma' },
      ]),
      value: taxonomyValue([termUid(2)]),
    });
    const alpha = byLabel<HTMLInputElement>(mounted.container, 'Alpha');
    const beta = byLabel<HTMLInputElement>(mounted.container, 'Beta');
    const gamma = byLabel<HTMLInputElement>(mounted.container, 'Gamma');
    await click(alpha);
    expect(mounted.emitted()).toEqual({ termIds: [termUid(2), termUid(1)] });
    expect(writeKeys(mounted.emitted())).toEqual(['termIds']);
    expect(emittedTermIds(mounted)).toEqual([termUid(2), termUid(1)]);
    await click(gamma);
    expect(emittedTermIds(mounted)).toEqual([
      termUid(2),
      termUid(1),
      termUid(3),
    ]);
    await click(beta);
    expect(emittedTermIds(mounted)).toEqual([termUid(1), termUid(3)]);
  });

  it('[P2-S12-AC-135] mounts read-only: the stored value sets the checked state and no write happens by itself', () => {
    const mounted = mountTaxonomy({
      page: taxonomyPage([
        { n: 1, termKey: 'alpha', label: 'Alpha' },
        { n: 2, termKey: 'beta', label: 'Beta' },
      ]),
      value: taxonomyValue([termUid(2)]),
    });
    const alpha = byLabel<HTMLInputElement>(mounted.container, 'Alpha');
    const beta = byLabel<HTMLInputElement>(mounted.container, 'Beta');
    expect(alpha.checked).toBe(false);
    expect(beta.checked).toBe(true);
    expect(mounted.onValue).not.toHaveBeenCalled();
  });

  it('[P2-S12-AC-135] disables every checkbox and the clear control when the host marks the field disabled', () => {
    const mounted = mountTaxonomy({
      page: taxonomyPage([
        { n: 1, termKey: 'alpha', label: 'Alpha' },
        { n: 2, termKey: 'beta', label: 'Beta' },
      ]),
      value: taxonomyValue([termUid(1)]),
      disabled: true,
    });
    for (const box of termCheckboxes(mounted.container))
      expect(box.hasAttribute('disabled')).toBe(true);
    const clear = buttonNamed(mounted.container, 'Clear selection');
    expect(clear.getAttribute('type')).toBe('button');
    expect(clear.hasAttribute('disabled')).toBe(true);
    expect(mounted.onValue).not.toHaveBeenCalled();
  });

  it('[P2-S12-AC-135] reports a blur of a term control to the host', async () => {
    const mounted = mountTaxonomy({
      page: taxonomyPage([{ n: 1, termKey: 'alpha', label: 'Alpha' }]),
    });
    const box = byLabel<HTMLInputElement>(mounted.container, 'Alpha');
    await blurOut(box);
    expect(mounted.onBlur).toHaveBeenCalledTimes(1);
  });

  it('[P2-S12-AC-135] renders a page with no term as an empty group with no invented option', () => {
    const mounted = mountTaxonomy({ page: taxonomyPage([]) });
    expect(termCheckboxes(mounted.container)).toHaveLength(0);
    expect(mounted.container.querySelector('fieldset')).not.toBeNull();
    expect(announcedCount(mounted.container)).toBe('0 terms selected.');
  });
});
