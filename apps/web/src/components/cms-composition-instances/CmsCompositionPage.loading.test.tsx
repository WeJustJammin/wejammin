// @vitest-environment jsdom
import { act } from 'react';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  buttonNamed,
  byLabel,
  click,
  disableReactAct,
  enableReactAct,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import {
  SELECTOR,
  diffPath,
  json,
  mountPage,
} from './composition-page.test-support';
import {
  diffOf,
  id,
  propsPath,
  row,
  selectorItem,
  selectorPage,
} from './composition.test-support';

/*
 * FE03 1042 to 1048 (Slice 12 `selectorState` and `diffState`, loading: "Skeleton after 250 ms; the submit controls stay
 * disabled" and "Skeleton after 250 ms; accept and detach disabled"; P2-S12-AC-271): a read inside 250 ms shows nothing; one
 * past it shows a skeleton in a polite region while the listed content stays.
 */
beforeAll(enableReactAct);
afterAll(disableReactAct);
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const advance = async (ms: number): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};
/** A reply the test answers by hand, as a fetch that is still in flight. */
const pendingReply = () => {
  let answer: (value: Response) => void = () => undefined;
  const promise = new Promise<Response>((resolve) => (answer = resolve));
  return { reply: (() => promise) as unknown as () => Response, answer };
};
const skeleton = (container: HTMLElement): HTMLElement | null =>
  container.querySelector('.cms-loading-region');

describe('the pattern selector read over 250 ms', () => {
  const mountSelector = (reply: () => Response) =>
    mountPage(
      { [SELECTOR]: [reply] },
      {
        selector: selectorPage(
          [selectorItem('hero-block', 2), selectorItem('side-note', 1)],
          'cursor-1',
        ),
      },
    );

  it('shows nothing at 249 ms, then a skeleton at 250 ms with the submit control off and the listed patterns kept', async () => {
    const held = pendingReply();
    const page = mountSelector(held.reply);
    await click(buttonNamed(page.container, 'Load more patterns'));
    await advance(249);
    expect(skeleton(page.container)).toBeNull();
    await advance(1);
    const shown = skeleton(page.container) as HTMLElement;
    expect(shown.getAttribute('role')).toBe('status');
    expect(shown.textContent).toContain('Loading more patterns');
    expect(buttonNamed(page.container, 'Place pattern').disabled).toBe(true);
    expect(
      byLabel<HTMLSelectElement>(page.container, 'Pattern').options,
    ).toHaveLength(3);
    await act(async () => {
      held.answer(json(selectorPage([selectorItem('zebra', 1)], null)));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(skeleton(page.container)).toBeNull();
    expect(buttonNamed(page.container, 'Place pattern').disabled).toBe(false);
  });

  it('never shows a skeleton for a read that answers inside 250 ms', async () => {
    const held = pendingReply();
    const page = mountSelector(held.reply);
    await click(buttonNamed(page.container, 'Load more patterns'));
    await advance(100);
    await act(async () => {
      held.answer(json(selectorPage([selectorItem('zebra', 1)], null)));
      await vi.advanceTimersByTimeAsync(0);
    });
    await advance(1_000);
    expect(skeleton(page.container)).toBeNull();
  });
});

describe('the update diff read over 250 ms', () => {
  const diff = diffOf(1, [propsPath('/a')]);
  it('shows nothing at 249 ms, then a skeleton at 250 ms; the instance list stays', async () => {
    const held = pendingReply();
    const page = mountPage(
      { [diffPath(id(1))]: [held.reply] },
      { instances: [row(1, { state: 'pending_diff', version: '3' })] },
    );
    await click(buttonNamed(page.container, 'Review update for /main/row-1'));
    await advance(249);
    expect(skeleton(page.container)).toBeNull();
    expect(page.container.textContent).not.toContain('Reading the update');
    await advance(1);
    expect(skeleton(page.container)?.textContent).toContain(
      'Reading the update',
    );
    expect(page.container.textContent).toContain('Update available');
    await act(async () => {
      held.answer(json(diff, 200, `"${diff.instance.version}"`));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(skeleton(page.container)).toBeNull();
    expect(page.container.querySelector('.cms-diff')).not.toBeNull();
  });
});
