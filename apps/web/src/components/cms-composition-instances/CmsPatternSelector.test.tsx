// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  buttonNamed,
  byLabel,
  choose,
  click,
  disableReactAct,
  enableReactAct,
  mountElement,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import CmsPatternSelector from './CmsPatternSelector';
import { selectorItem, selectorPage } from './composition.test-support';

/*
 * FE03 886, 1508; P2-S12-AC-111: a native select over the entry's compatible active patterns, the result count
 * announced politely, the empty state, the cursor in component state only.
 */
beforeAll(enableReactAct);
afterAll(disableReactAct);

const items = [
  selectorItem('hero-block', 3),
  selectorItem('hero-block', 2),
  selectorItem('side-note', 1, { nodeCount: 1 }),
];
const mount = (
  props: Partial<React.ComponentProps<typeof CmsPatternSelector>> = {},
) => {
  const onSelect = vi.fn();
  const onLoadMore = vi.fn();
  const mounted = mountElement(
    <CmsPatternSelector
      page={selectorPage(items, null)}
      state={{ kind: 'idle' }}
      selectedId={null}
      onSelect={onSelect}
      onLoadMore={onLoadMore}
      {...props}
    />,
  );
  return { ...mounted, onSelect, onLoadMore };
};
const select = (container: HTMLElement) =>
  byLabel<HTMLSelectElement>(container, 'Pattern');

describe('CmsPatternSelector', () => {
  it('is a native select with a placeholder, nothing preselected, one option per pattern version', () => {
    const { container } = mount();
    const control = select(container);
    expect(control.tagName).toBe('SELECT');
    expect(control.value).toBe('');
    expect(
      Array.from(control.options).map((option) => option.textContent),
    ).toEqual([
      'Choose a pattern',
      'hero-block version 3 (3 nodes)',
      'hero-block version 2 (3 nodes)',
      'side-note version 1 (1 node)',
    ]);
  });

  it('announces the result count politely', () => {
    const { container } = mount();
    const status = container.querySelector('[role="status"]');
    expect(status?.getAttribute('aria-live')).toBe('polite');
    expect(status?.textContent).toBe('3 compatible patterns');
    const one = mount({ page: selectorPage([items[0]!], null) });
    expect(one.container.querySelector('[role="status"]')?.textContent).toBe(
      '1 compatible pattern',
    );
  });

  it('reports the chosen item, and none again when the placeholder is chosen', async () => {
    const { container, onSelect } = mount();
    await choose(select(container), items[1]!.patternVersionId);
    expect(onSelect).toHaveBeenLastCalledWith(items[1]);
    await choose(select(container), '');
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });

  it('shows the chosen item and marks the field invalid with its message', () => {
    const { container } = mount({
      selectedId: items[2]!.patternVersionId,
      invalid: 'Choose a pattern to insert.',
    });
    expect(select(container).value).toBe(items[2]!.patternVersionId);
    expect(select(container).getAttribute('aria-invalid')).toBe('true');
    const described = select(container).getAttribute('aria-describedby') ?? '';
    expect(
      described
        .split(' ')
        .some(
          (id) =>
            document.getElementById(id)?.textContent ===
            'Choose a pattern to insert.',
        ),
    ).toBe(true);
  });

  it('states the empty state and disables the control', () => {
    const { container } = mount({ page: selectorPage([], null) });
    expect(container.textContent).toContain('No compatible pattern is active');
    expect(select(container).disabled).toBe(true);
    expect(container.querySelector('[role="status"]')?.textContent).toBe(
      '0 compatible patterns',
    );
  });

  it('offers Load more only while a cursor remains, and disables it while loading', async () => {
    const withCursor = mount({ page: selectorPage(items, 'next') });
    expect(
      buttonNamed(withCursor.container, 'Load more patterns').disabled,
    ).toBe(false);
    await click(buttonNamed(withCursor.container, 'Load more patterns'));
    expect(withCursor.onLoadMore).toHaveBeenCalledTimes(1);
    const loading = mount({
      page: selectorPage(items, 'next'),
      state: { kind: 'loading' },
    });
    expect(buttonNamed(loading.container, 'Load more patterns').disabled).toBe(
      true,
    );
    const done = mount();
    expect(() => buttonNamed(done.container, 'Load more patterns')).toThrow();
  });

  it('names a failed or rate-limited page read and keeps the patterns already listed', () => {
    const failed = mount({
      page: selectorPage(items, 'next'),
      state: { kind: 'failed', status: 503, reason: null },
    });
    expect(failed.container.textContent).toContain(
      'The pattern list could not be read right now.',
    );
    expect(select(failed.container).options).toHaveLength(4);
    const limited = mount({
      page: selectorPage(items, 'next'),
      state: { kind: 'rate_limited', retryAfterSeconds: 6 },
    });
    expect(limited.container.textContent).toContain('Try again in 6 seconds');
  });

  it('is disabled as a whole when the commands are unavailable', () => {
    const { container } = mount({ disabled: true });
    expect(select(container).disabled).toBe(true);
  });
});
