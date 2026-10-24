// @vitest-environment jsdom

/**
 * The read-only taxonomy rendering of `CmsFieldValueView` (FE03 read-only value
 * view; BE03b "Value encodings by field kind": `taxonomy: { termIds: UUID[] <=
 * 128 }`). The view is protected and has no selector projection, so it shows the
 * stored preimage exactly: one native list item per stored term, the word `Term`
 * and the term id in a `<code>`, and never a guessed locale label, a JSON or
 * `[object Object]` dump, or an editable control.
 *
 * The distinct states this pins down:
 * - a valid non-empty `{ termIds: [...] }` renders the stored ids in order,
 *   duplicates included;
 * - a valid empty `{ termIds: [] }` reads "No selected terms";
 * - a JSON null keeps the existing absence semantics: "No value", or "Cleared"
 *   when the provenance is `explicit_null`;
 * - every malformed shape (a non-object, an extra key, an absent or non-array
 *   `termIds`, a bad id, more than 128 ids) reads "Not available" and echoes
 *   nothing of the malformed value;
 * - an unknown or out-of-page id is a valid UUID, so it is shown as that exact
 *   stored id, never relabelled and never called unavailable.
 */

import * as React from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import CmsFieldValueView from './CmsFieldValueView';
import {
  disableReactAct,
  enableReactAct,
  mountElement,
} from './cms-editor-dom.test-support';
import { describeCmsAuthoringFields } from './cms-field-descriptor-decode';
import type { CmsFieldDescriptor } from './cms-field-descriptor';
import { allKindFields, fieldUuid } from './cms-field-fixtures.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);
afterEach(() => document.body.replaceChildren());

const descriptor = (key: string): CmsFieldDescriptor => {
  const found = describeCmsAuthoringFields(allKindFields()).find(
    (entry) => entry.key === key,
  );
  if (found === undefined) throw new Error(`fixture missing ${key}`);
  return found;
};

/** A distinct, valid term id per fixture index. */
const termUid = (n: number): string => fieldUuid(0x800 + n);

const render = (value: unknown, provenance = 'authored'): HTMLElement =>
  mountElement(
    <CmsFieldValueView
      descriptor={descriptor('topics')}
      value={value as never}
      provenance={provenance}
    />,
  ).container;

const list = (container: HTMLElement): HTMLElement | null =>
  container.querySelector<HTMLElement>('ol, ul');

const items = (container: HTMLElement): readonly HTMLElement[] =>
  Array.from(container.querySelectorAll<HTMLElement>('li'));

const codeIds = (container: HTMLElement): readonly string[] =>
  Array.from(container.querySelectorAll<HTMLElement>('code')).map(
    (code) => code.textContent ?? '',
  );

/** The visible words of an item once the id codes are removed: the label only. */
const labelText = (item: HTMLElement): string => {
  const clone = item.cloneNode(true) as HTMLElement;
  for (const code of Array.from(clone.querySelectorAll('code'))) code.remove();
  return (clone.textContent ?? '').trim();
};

describe('CmsFieldValueView: taxonomy', () => {
  it('renders one native list item per stored term, naming the term and its exact id', () => {
    const container = render({ termIds: [termUid(1), termUid(2)] });
    expect(list(container)).not.toBeNull();
    const rows = items(container);
    expect(rows).toHaveLength(2);
    expect(rows.map(labelText)).toEqual(['Term', 'Term']);
    expect(rows.map((row) => row.querySelector('code')?.textContent)).toEqual([
      termUid(1),
      termUid(2),
    ]);
    // Never a JSON or object dump, and never an editable control.
    expect(container.textContent).not.toContain('[object Object]');
    expect(container.textContent).not.toContain('termIds');
    expect(
      container.querySelector('input, select, textarea, button'),
    ).toBeNull();
  });

  it('preserves the stored order and duplicates exactly as the shape allows', () => {
    const stored = [termUid(3), termUid(1), termUid(3), termUid(2)];
    const container = render({ termIds: stored });
    expect(codeIds(container)).toEqual(stored);
    expect(items(container)).toHaveLength(stored.length);
  });

  it('shows a valid id it cannot resolve as that exact id, inventing no label', () => {
    // The view has no selector projection, so an unknown or out-of-page id is
    // still the stored preimage: not "Not available", and no guessed label.
    const unknown = termUid(0x321);
    const container = render({ termIds: [unknown] });
    expect(codeIds(container)).toEqual([unknown]);
    expect(items(container).map(labelText)).toEqual(['Term']);
    expect(container.textContent).not.toContain('Not available');
  });

  it('reads a valid empty selection in words', () => {
    const container = render({ termIds: [] });
    expect(container.textContent).toContain('No selected terms');
    expect(list(container)).toBeNull();
    expect(container.textContent).not.toContain('[object Object]');
  });

  it('keeps the absence and explicit-clear semantics for a null value', () => {
    const missing = render(null, 'missing');
    expect(missing.textContent).toContain('No value');
    expect(missing.textContent).not.toContain('No selected terms');
    const cleared = render(null, 'explicit_null');
    expect(cleared.textContent).toContain('Cleared');
  });

  it('reads every malformed shape as not available and echoes nothing', () => {
    const malformed: readonly unknown[] = [
      { termIds: 'not-an-array' },
      { termIds: [termUid(1), 'not-a-uuid'] },
      { termIds: [1] },
      { termIds: [null] },
      { termIds: [], extra: 1 },
      {},
      42,
      ['term'],
      {
        termIds: Array.from({ length: 129 }, (_, index) => termUid(index + 1)),
      },
    ];
    for (const value of malformed) {
      const container = render(value);
      expect(container.textContent).toContain('Not available');
      expect(container.textContent).not.toContain('[object Object]');
      expect(container.textContent).not.toContain('termIds');
      expect(container.textContent).not.toContain('not-a-uuid');
      expect(list(container)).toBeNull();
    }
  });

  it('never reads an empty-looking object with an extra key as an empty selection', () => {
    const container = render({ termIds: [], extra: 1 });
    expect(container.textContent).toContain('Not available');
    expect(container.textContent).not.toContain('No selected terms');
  });
});
