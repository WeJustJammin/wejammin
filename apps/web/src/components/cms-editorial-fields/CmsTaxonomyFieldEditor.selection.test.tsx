// @vitest-environment jsdom

/**
 * The CMS-03C-17 taxonomy field control: the selection count, the term bound
 * and the hierarchy (FE03 "Slice 12 governed definition, composition, taxonomy,
 * locale and related-content surfaces": "Labelled listbox or checkbox group;
 * selection count announced politely; hierarchical vocabularies show level
 * text"; P2-S12-AC-135; BE03b "Value encodings by field kind":
 * `taxonomy: { termIds: UUID[] <= 128 }`).
 *
 * Two properties of the paged selector contract shape the control:
 * - a page holds at most 100 terms, so the value may name selected terms the
 *   page does not list. Those ids stay in the value, are never dropped by an
 *   empty or refreshed page, and are never given an invented option: the only
 *   way to remove one is the `Clear selection` command, which writes exactly
 *   `{ termIds: [] }`;
 * - a `TaxonomySelectorTerm` carries `parentId` but no depth, so a level is
 *   derived only when the whole ancestry is on the page under the same
 *   `taxonomyKey`. The text is `Level 1` for a root, `Level n` for a term
 *   whose whole ancestry is known, and "Level unavailable" otherwise rather
 *   than an invented depth.
 *
 * The announced count is one polite atomic region reading `N term selected.`
 * for one and `N terms selected.` otherwise (0 and 128 included), and at 128
 * selected terms the page's unchecked terms are disabled so a 129th can never
 * be offered, since the contract bounds the value at 128.
 */

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  buttonNamed,
  byLabel,
  click,
  disableReactAct,
  enableReactAct,
} from './cms-editor-dom.test-support';
import {
  announcedCount,
  describedText,
  emittedTermIds,
  FOREIGN_TAXONOMY_ID,
  FOREIGN_TAXONOMY_VERSION_ID,
  liveRegion,
  mountTaxonomy,
  taxonomyPage,
  taxonomyValue,
  type TaxonomyMounted,
  termCheckboxes,
  termUid,
  writeKeys,
} from './cms-taxonomy-field-fixtures.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);
afterEach(() => document.body.replaceChildren());

describe('CmsTaxonomyFieldEditor: the polite selection count', () => {
  it('[P2-S12-AC-135] announces the count in one polite atomic status region', async () => {
    const mounted = mountTaxonomy({
      page: taxonomyPage([
        { n: 1, termKey: 'alpha', label: 'Alpha' },
        { n: 2, termKey: 'beta', label: 'Beta' },
      ]),
    });
    const region = liveRegion(mounted.container);
    expect(region?.getAttribute('aria-live')).toBe('polite');
    expect(region?.getAttribute('aria-atomic')).toBe('true');
    expect(announcedCount(mounted.container)).toBe('0 terms selected.');
    const alpha = byLabel<HTMLInputElement>(mounted.container, 'Alpha');
    const beta = byLabel<HTMLInputElement>(mounted.container, 'Beta');
    await click(alpha);
    expect(announcedCount(mounted.container)).toBe('1 term selected.');
    await click(beta);
    expect(announcedCount(mounted.container)).toBe('2 terms selected.');
  });
});

describe('CmsTaxonomyFieldEditor: selections the page does not list', () => {
  it('[P2-S12-AC-135] preserves a selected term the page does not list and offers no option for it', () => {
    const mounted = mountTaxonomy({
      page: taxonomyPage([{ n: 1, termKey: 'alpha', label: 'Alpha' }]),
      value: taxonomyValue([termUid(1), termUid(9)]),
    });
    const boxes = termCheckboxes(mounted.container);
    expect(boxes).toHaveLength(1);
    expect(boxes[0]?.value).toBe(termUid(1));
    expect(boxes[0]?.checked).toBe(true);
    expect(mounted.container.textContent).not.toContain(termUid(9));
    expect(announcedCount(mounted.container)).toBe('2 terms selected.');
    expect(mounted.onValue).not.toHaveBeenCalled();
  });

  it('[P2-S12-AC-135] keeps a value when a refreshed page returns no terms at all', () => {
    const mounted = mountTaxonomy({
      page: taxonomyPage([]),
      value: taxonomyValue([termUid(1), termUid(9)]),
    });
    expect(termCheckboxes(mounted.container)).toHaveLength(0);
    expect(announcedCount(mounted.container)).toBe('2 terms selected.');
    expect(mounted.onValue).not.toHaveBeenCalled();
    const clear = buttonNamed(mounted.container, 'Clear selection');
    expect(clear.disabled).toBe(false);
  });

  it('[P2-S12-AC-135] keeps a selection when a refreshed page no longer returns it', () => {
    const mounted = mountTaxonomy({
      page: taxonomyPage([
        { n: 1, termKey: 'alpha', label: 'Alpha' },
        { n: 2, termKey: 'beta', label: 'Beta' },
      ]),
      value: taxonomyValue([termUid(1), termUid(2)]),
    });
    mounted.rerender({
      page: taxonomyPage([{ n: 1, termKey: 'alpha', label: 'Alpha' }]),
    });
    const alpha = byLabel<HTMLInputElement>(mounted.container, 'Alpha');
    expect(alpha.checked).toBe(true);
    expect(termCheckboxes(mounted.container)).toHaveLength(1);
    expect(announcedCount(mounted.container)).toBe('2 terms selected.');
    expect(mounted.onValue).not.toHaveBeenCalled();
  });
});

describe('CmsTaxonomyFieldEditor: clearing the selection', () => {
  it('[P2-S12-AC-135] clears every selected term, including one the page does not list, writing exactly { termIds: [] }', async () => {
    const mounted = mountTaxonomy({
      page: taxonomyPage([{ n: 1, termKey: 'alpha', label: 'Alpha' }]),
      value: taxonomyValue([termUid(1), termUid(9)]),
    });
    const clear = buttonNamed(mounted.container, 'Clear selection');
    expect(clear.getAttribute('type')).toBe('button');
    expect(clear.disabled).toBe(false);
    expect(mounted.onValue).not.toHaveBeenCalled();
    await click(clear);
    expect(mounted.emitted()).toEqual({ termIds: [] });
    expect(writeKeys(mounted.emitted())).toEqual(['termIds']);
    expect(emittedTermIds(mounted)).toEqual([]);
    expect(announcedCount(mounted.container)).toBe('0 terms selected.');
    const alpha = byLabel<HTMLInputElement>(mounted.container, 'Alpha');
    expect(alpha.checked).toBe(false);
    expect(() => buttonNamed(mounted.container, 'Clear selection')).toThrow();
  });

  it('[P2-S12-AC-135] offers no clear control while nothing is selected', () => {
    const mounted = mountTaxonomy({
      page: taxonomyPage([{ n: 1, termKey: 'alpha', label: 'Alpha' }]),
    });
    expect(() => buttonNamed(mounted.container, 'Clear selection')).toThrow();
    expect(mounted.onValue).not.toHaveBeenCalled();
  });

  it('[P2-S12-AC-135] clears only on activation: rendering and refreshing never clear the value', () => {
    const mounted = mountTaxonomy({
      page: taxonomyPage([{ n: 1, termKey: 'alpha', label: 'Alpha' }]),
      value: taxonomyValue([termUid(1)]),
    });
    mounted.rerender({ page: taxonomyPage([]) });
    expect(mounted.onValue).not.toHaveBeenCalled();
    expect(announcedCount(mounted.container)).toBe('1 term selected.');
    expect(buttonNamed(mounted.container, 'Clear selection')).toBeDefined();
  });
});

describe('CmsTaxonomyFieldEditor: the 128 term bound', () => {
  const manySelected = (count: number): readonly string[] =>
    Array.from({ length: count }, (_, index) => termUid(3000 + index));
  const fieldPage = () =>
    taxonomyPage([
      { n: 1, termKey: 'alpha', label: 'Alpha' },
      { n: 2, termKey: 'beta', label: 'Beta' },
    ]);

  it('[P2-S12-AC-135] refuses to offer a 129th term, since the contract bounds the value at 128', () => {
    const atBound = mountTaxonomy({
      page: fieldPage(),
      value: taxonomyValue(manySelected(128)),
    });
    expect(announcedCount(atBound.container)).toBe('128 terms selected.');
    for (const box of termCheckboxes(atBound.container))
      expect(box.disabled).toBe(true);
    atBound.unmount();
    const below = mountTaxonomy({
      page: fieldPage(),
      value: taxonomyValue(manySelected(127)),
    });
    expect(announcedCount(below.container)).toBe('127 terms selected.');
    for (const box of termCheckboxes(below.container))
      expect(box.disabled).toBe(false);
  });
});

describe('CmsTaxonomyFieldEditor: a stored value that repeats a term', () => {
  const repeatedPage = () =>
    taxonomyPage([
      { n: 1, termKey: 'alpha', label: 'Alpha' },
      { n: 2, termKey: 'beta', label: 'Beta' },
    ]);

  it('[P2-S12-AC-135] preserves a repeated stored id and appends a newly chosen term after it', async () => {
    const mounted = mountTaxonomy({
      page: repeatedPage(),
      value: taxonomyValue([termUid(1), termUid(1)]),
    });
    const alpha = byLabel<HTMLInputElement>(mounted.container, 'Alpha');
    const beta = byLabel<HTMLInputElement>(mounted.container, 'Beta');
    expect(alpha.checked).toBe(true);
    expect(beta.checked).toBe(false);
    expect(announcedCount(mounted.container)).toBe('2 terms selected.');
    await click(beta);
    expect(mounted.emitted()).toEqual({
      termIds: [termUid(1), termUid(1), termUid(2)],
    });
    expect(emittedTermIds(mounted)).toEqual([
      termUid(1),
      termUid(1),
      termUid(2),
    ]);
  });

  it('[P2-S12-AC-135] counts every stored entry, so 128 repetitions fill the bound and leave the checked term removable', async () => {
    const repeated = Array.from({ length: 128 }, () => termUid(1));
    const mounted = mountTaxonomy({
      page: repeatedPage(),
      value: taxonomyValue(repeated),
    });
    expect(announcedCount(mounted.container)).toBe('128 terms selected.');
    const alpha = byLabel<HTMLInputElement>(mounted.container, 'Alpha');
    const beta = byLabel<HTMLInputElement>(mounted.container, 'Beta');
    expect(alpha.checked).toBe(true);
    expect(alpha.disabled).toBe(false);
    expect(beta.disabled).toBe(true);
    await click(alpha);
    expect(mounted.emitted()).toEqual({ termIds: [] });
    expect(announcedCount(mounted.container)).toBe('0 terms selected.');
  });
});

describe('CmsTaxonomyFieldEditor: hierarchical level text', () => {
  const levelOf = (mounted: TaxonomyMounted, name: string): string =>
    describedText(byLabel<HTMLInputElement>(mounted.container, name));
  const known = (
    n: number,
    termKey: string,
    label: string,
    parentId: string | null,
  ) => ({
    n,
    termKey,
    label,
    shape: 'hierarchical' as const,
    parentId,
  });

  it('[P2-S12-AC-135] derives the level of every term whose ancestry is on the page, the root at level 1', () => {
    const mounted = mountTaxonomy({
      page: taxonomyPage([
        known(1, 'music', 'Music', null),
        known(2, 'rock', 'Rock', termUid(1)),
        known(3, 'post-rock', 'Post-rock', termUid(2)),
        known(4, 'shoegaze', 'Shoegaze', termUid(2)),
      ]),
    });
    expect(levelOf(mounted, 'Music')).toBe('Level 1');
    expect(levelOf(mounted, 'Rock')).toBe('Level 2');
    expect(levelOf(mounted, 'Post-rock')).toBe('Level 3');
    expect(levelOf(mounted, 'Shoegaze')).toBe('Level 3');
  });

  it('[P2-S12-AC-135] states "Level unavailable" when the parent is not on this page', () => {
    const mounted = mountTaxonomy({
      page: taxonomyPage([known(5, 'orphan-tag', 'Orphan', termUid(999))]),
    });
    expect(levelOf(mounted, 'Orphan')).toBe('Level unavailable');
  });

  it('[P2-S12-AC-135] states "Level unavailable" for both terms of a parent cycle', () => {
    const mounted = mountTaxonomy({
      page: taxonomyPage([
        known(6, 'cycle-one', 'Cycle one', termUid(7)),
        known(7, 'cycle-two', 'Cycle two', termUid(6)),
      ]),
    });
    expect(levelOf(mounted, 'Cycle one')).toBe('Level unavailable');
    expect(levelOf(mounted, 'Cycle two')).toBe('Level unavailable');
  });

  it('[P2-S12-AC-135] states "Level unavailable" when an ancestor above the page is missing', () => {
    const mounted = mountTaxonomy({
      page: taxonomyPage([
        known(8, 'mid-branch', 'Mid branch', termUid(998)),
        known(9, 'leaf-tag', 'Leaf tag', termUid(8)),
      ]),
    });
    expect(levelOf(mounted, 'Mid branch')).toBe('Level unavailable');
    expect(levelOf(mounted, 'Leaf tag')).toBe('Level unavailable');
  });

  it('[P2-S12-AC-135] states "Level unavailable" for a parent in another vocabulary', () => {
    const mounted = mountTaxonomy({
      page: taxonomyPage([
        {
          n: 10,
          termKey: 'format-root',
          label: 'Format root',
          shape: 'hierarchical',
          taxonomyKey: 'format-tags',
        },
        known(11, 'genre-child', 'Genre child', termUid(10)),
      ]),
    });
    expect(levelOf(mounted, 'Genre child')).toBe('Level unavailable');
  });

  it('[P2-S12-AC-135] states "Level unavailable" when the same vocabulary key belongs to another identity', () => {
    const mounted = mountTaxonomy({
      page: taxonomyPage([
        {
          n: 12,
          termKey: 'genre-root',
          label: 'Genre root',
          shape: 'hierarchical',
          taxonomyId: FOREIGN_TAXONOMY_ID,
        },
        {
          n: 13,
          termKey: 'version-root',
          label: 'Version root',
          shape: 'hierarchical',
          taxonomyVersionId: FOREIGN_TAXONOMY_VERSION_ID,
        },
        known(14, 'genre-child', 'Genre child', termUid(12)),
        known(15, 'version-child', 'Version child', termUid(13)),
      ]),
    });
    expect(levelOf(mounted, 'Genre child')).toBe('Level unavailable');
    expect(levelOf(mounted, 'Version child')).toBe('Level unavailable');
  });

  it('[P2-S12-AC-135] shows no level text at all for a flat vocabulary', () => {
    const mounted = mountTaxonomy({
      page: taxonomyPage([{ n: 1, termKey: 'flat-tag', label: 'Flat tag' }]),
    });
    expect(mounted.container.textContent).not.toContain('Level');
    expect(levelOf(mounted, 'Flat tag')).toBe('');
  });
});
