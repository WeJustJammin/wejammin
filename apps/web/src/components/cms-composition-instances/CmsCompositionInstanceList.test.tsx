// @vitest-environment jsdom
import { act } from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  buttonNamed,
  byLabel,
  click,
  disableReactAct,
  enableReactAct,
  mountElement,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import CmsCompositionInstanceList from './CmsCompositionInstanceList';
import type { InstanceRow } from './composition-types';
import { id, row } from './composition.test-support';
import { ROW_HEIGHT_PX } from './composition-windowing';

/*
 * FE03 887, 1509; P2-S12-AC-123: the instance list shows each row's state ("Update available" for pending_diff) beside
 * its pinned version, in the stored position order, one in-page collection with stable ids, the count announced
 * politely and virtualization above 100 rows.
 */
beforeAll(enableReactAct);
afterAll(disableReactAct);

const mount = (
  rows: readonly InstanceRow[],
  props: Partial<React.ComponentProps<typeof CmsCompositionInstanceList>> = {},
) => {
  const handlers = {
    onToggle: vi.fn(),
    onReview: vi.fn(),
    onDetach: vi.fn(),
    onBulkReview: vi.fn(),
    onBulkDetach: vi.fn(),
  };
  const mounted = mountElement(
    <CmsCompositionInstanceList
      rows={rows}
      selected={new Set()}
      reviewingId={null}
      busy={false}
      disabled={false}
      {...handlers}
      {...props}
    />,
  );
  return { ...mounted, ...handlers };
};
const items = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('ul.cms-instance-rows > li'));

describe('CmsCompositionInstanceList: rows', () => {
  // The order the instance list read answers (DEC-206: slot, stored position, path): the list shows it as it comes.
  const rows = [
    row(1, { position: 0, patternVersion: 3 }),
    row(2, { position: 1, state: 'pending_diff' }),
    row(3, { position: 2, linkMode: 'detached' }),
    row(4, { position: 3, state: 'retired' }),
  ];

  it('lists the rows in the render order the read answered, never re-sorted by position alone', () => {
    // main (slot 1) rows carry higher positions than the side row: only the server order puts them first.
    const { container } = mount([
      row(1, { path: '/main/a', position: 4 }),
      row(2, { path: '/main/b', position: 5 }),
      row(3, { path: '/side/c', position: 0 }),
    ]);
    expect(items(container).map((item) => item.id)).toEqual([
      `cms-instance-${id(1)}`,
      `cms-instance-${id(2)}`,
      `cms-instance-${id(3)}`,
    ]);
  });

  it('lists the rows with state and pinned version in words', () => {
    const { container } = mount(rows);
    const text = items(container).map((item) => item.textContent ?? '');
    expect(text[0]).toContain('/main/row-1');
    expect(text[0]).toContain('Up to date');
    expect(text[0]).toContain('Pinned to pattern version 3');
    expect(text[1]).toContain('Update available');
    expect(text[1]).toContain('Pinned to pattern version 1');
    expect(text[2]).toContain('Local copy');
    expect(text[3]).toContain('Removed from the entry');
  });

  it('announces the row count politely and gives every row a stable id', () => {
    const { container } = mount(rows);
    const status = container.querySelector('[data-row-count]');
    expect(status?.getAttribute('aria-live')).toBe('polite');
    expect(status?.textContent).toBe('4 rows');
    expect(items(container).map((item) => item.id)).toEqual([
      `cms-instance-${id(1)}`,
      `cms-instance-${id(2)}`,
      `cms-instance-${id(3)}`,
      `cms-instance-${id(4)}`,
    ]);
    expect(
      mount([row(1)]).container.querySelector('[data-row-count]')?.textContent,
    ).toBe('1 row');
  });

  it('shows an empty list in words', () => {
    const { container } = mount([]);
    expect(container.textContent).toContain(
      'No pattern instances are listed yet.',
    );
    expect(items(container)).toHaveLength(0);
  });

  it('offers Review update only on a linked pending_diff row, and Detach on linked rows only', () => {
    const { container } = mount(rows);
    expect(() =>
      buttonNamed(container, 'Review update for /main/row-2'),
    ).not.toThrow();
    expect(() =>
      buttonNamed(container, 'Review update for /main/row-1'),
    ).toThrow();
    expect(() => buttonNamed(container, 'Detach /main/row-1')).not.toThrow();
    expect(() => buttonNamed(container, 'Detach /main/row-4')).not.toThrow();
    expect(() => buttonNamed(container, 'Detach /main/row-3')).toThrow();
  });

  it('reports the row commands and the selection', async () => {
    const { container, onReview, onDetach, onToggle } = mount(rows);
    await click(buttonNamed(container, 'Review update for /main/row-2'));
    expect(onReview).toHaveBeenCalledWith(id(2));
    await click(buttonNamed(container, 'Detach /main/row-1'));
    expect(onDetach).toHaveBeenCalledWith(id(1));
    await click(byLabel<HTMLInputElement>(container, 'Select /main/row-1'));
    expect(onToggle).toHaveBeenCalledWith(id(1));
  });

  it('marks the row being reviewed', () => {
    const { container } = mount(rows, { reviewingId: id(2) });
    expect(items(container)[1]?.getAttribute('aria-current')).toBe('true');
    expect(items(container)[0]?.hasAttribute('aria-current')).toBe(false);
  });

  it('disables the row commands while busy or unavailable', () => {
    const { container } = mount(rows, { busy: true });
    expect(buttonNamed(container, 'Detach /main/row-1').disabled).toBe(true);
    expect(
      buttonNamed(container, 'Review update for /main/row-2').disabled,
    ).toBe(true);
  });
});

describe('CmsCompositionInstanceList: selection commands', () => {
  const rows = [
    row(1, { state: 'pending_diff' }),
    row(2, { state: 'pending_diff' }),
    row(3),
  ];

  it('counts the selection and enables bulk review only when every selected row has an update', async () => {
    const none = mount(rows);
    expect(
      buttonNamed(none.container, 'Review selected updates').disabled,
    ).toBe(true);
    const both = mount(rows, { selected: new Set([id(1), id(2)]) });
    expect(both.container.textContent).toContain('2 selected');
    expect(
      buttonNamed(both.container, 'Review selected updates').disabled,
    ).toBe(false);
    await click(buttonNamed(both.container, 'Review selected updates'));
    expect(both.onBulkReview).toHaveBeenCalledTimes(1);
    const mixed = mount(rows, { selected: new Set([id(1), id(3)]) });
    expect(
      buttonNamed(mixed.container, 'Review selected updates').disabled,
    ).toBe(true);
    expect(buttonNamed(mixed.container, 'Detach selected').disabled).toBe(
      false,
    );
  });

  it('keeps a selection that scrolled out of view counted', () => {
    const { container } = mount(rows, { selected: new Set([id(1), id(99)]) });
    expect(container.textContent).toContain('2 selected');
  });
});

describe('CmsCompositionInstanceList: more than 100 rows', () => {
  const many = Array.from({ length: 300 }, (_, i) => row(i + 1));

  it('keeps the DOM bounded, the count and the set size true, and the row ids stable', () => {
    const { container } = mount(many);
    const rendered = items(container);
    expect(rendered.length).toBeLessThanOrEqual(40);
    expect(container.querySelector('[data-row-count]')?.textContent).toBe(
      '300 rows',
    );
    expect(rendered[0]?.getAttribute('aria-setsize')).toBe('300');
    expect(rendered[0]?.getAttribute('aria-posinset')).toBe('1');
    expect(rendered[0]?.id).toBe(`cms-instance-${id(1)}`);
  });

  it('renders the rows around a scroll offset with the same stable ids', async () => {
    const { container } = mount(many);
    const scroller = container.querySelector<HTMLElement>(
      '.cms-instance-scroll',
    )!;
    expect(scroller.tabIndex).toBe(0);
    scroller.scrollTop = 150 * ROW_HEIGHT_PX;
    await act(async () => {
      scroller.dispatchEvent(new Event('scroll', { bubbles: true }));
    });
    const ids = items(container).map((item) => item.id);
    expect(ids).toContain(`cms-instance-${id(151)}`);
    expect(ids).not.toContain(`cms-instance-${id(1)}`);
    const first = items(container)[0]!;
    expect(Number(first.getAttribute('aria-posinset'))).toBeGreaterThan(100);
  });

  it('does not window a list of 100', () => {
    const { container } = mount(many.slice(0, 100));
    expect(items(container)).toHaveLength(100);
    expect(
      container
        .querySelector('.cms-instance-scroll')
        ?.getAttribute('data-windowed'),
    ).toBe('false');
  });
});
