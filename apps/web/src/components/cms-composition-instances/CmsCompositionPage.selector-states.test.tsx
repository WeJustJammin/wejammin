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
  json,
  mountPage,
  refusal,
  settle,
} from './composition-page.test-support';
import {
  entryFacts,
  selectorItem,
  selectorPage,
} from './composition.test-support';
import { COMPOSITION_COPY } from './composition-copy';

/**
 * [P2-S12-AC-271] FE03 1042 to 1048, `selectorState` (CMS-03C-13), the seven states in order: idle,
 * loading, success, empty, error, degraded, disabled. Each cell is one test over the real island.
 */
beforeAll(enableReactAct);
afterAll(disableReactAct);
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const hero = selectorItem('hero-block', 2);
const side = selectorItem('side-note', 1);
const zebra = selectorItem('zebra', 1);
const withCursor = { selector: selectorPage([hero, side], 'cursor-1') };
const options = (container: HTMLElement): (string | null)[] =>
  Array.from(byLabel<HTMLSelectElement>(container, 'Pattern').options).map(
    (option) => option.textContent,
  );
const loadMore = async (page: ReturnType<typeof mountPage>) => {
  await click(buttonNamed(page.container, 'Load more patterns'));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  await settle();
};

describe('selectorState (CMS-03C-13)', () => {
  it('[P2-S12-AC-271] selectorState idle: the server-rendered first page is listed with no read', () => {
    const page = mountPage({}, withCursor);
    expect(options(page.container)).toEqual([
      'Choose a pattern',
      'hero-block version 2 (3 nodes)',
      'side-note version 1 (3 nodes)',
    ]);
    expect(page.container.textContent).toContain('2 compatible patterns');
    expect(page.calls).toEqual([]);
  });

  it('[P2-S12-AC-271] selectorState loading: a skeleton after 250 ms (not before) with the submit control off and the listed patterns kept', async () => {
    let answer: (value: Response) => void = () => undefined;
    const held = new Promise<Response>((resolve) => (answer = resolve));
    const page = mountPage(
      { [SELECTOR]: [(() => held) as unknown as () => Response] },
      withCursor,
    );
    await click(buttonNamed(page.container, 'Load more patterns'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(249);
    });
    expect(page.container.querySelector('.cms-loading-region')).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(
      page.container.querySelector('.cms-loading-region')?.textContent,
    ).toContain('Loading more patterns');
    expect(buttonNamed(page.container, 'Place pattern').disabled).toBe(true);
    expect(options(page.container)).toHaveLength(3);
    await act(async () => {
      answer(json(selectorPage([zebra], null)));
      await vi.advanceTimersByTimeAsync(0);
    });
  });

  it('[P2-S12-AC-271] selectorState success: a 200 page adds its patterns to the list and releases the submit control', async () => {
    const page = mountPage(
      { [SELECTOR]: [json(selectorPage([zebra], null))] },
      withCursor,
    );
    await loadMore(page);
    expect(options(page.container)).toContain('zebra version 1 (3 nodes)');
    expect(page.container.textContent).toContain('3 compatible patterns');
    expect(buttonNamed(page.container, 'Place pattern').disabled).toBe(false);
  });

  it('[P2-S12-AC-271] selectorState empty: no compatible pattern is active, stated, with the selector off', () => {
    const page = mountPage({}, { selector: selectorPage([], null) });
    expect(page.container.textContent).toContain(
      'No compatible pattern is active',
    );
    expect(byLabel<HTMLSelectElement>(page.container, 'Pattern').disabled).toBe(
      true,
    );
  });

  it.each([
    [
      'a 503 renders the fixed copy',
      () => refusal(503, 'DEPENDENCY_UNAVAILABLE'),
      'The pattern list could not be read right now.',
    ],
    [
      'a 403 renders the capability copy',
      () => refusal(403, 'COMPOSITION_FORBIDDEN'),
      'This account cannot edit the composition of this entry.',
    ],
    [
      'a 409 cursor conflict restarts from the first page and says so',
      () => refusal(409, 'COMPOSITION_VERSION_CONFLICT'),
      'it restarted from the first page',
    ],
  ])(
    '[P2-S12-AC-271] selectorState error: %s',
    async (_label, answer, copy) => {
      const page = mountPage(
        {
          [SELECTOR]: [
            answer,
            ...(copy.includes('restarted')
              ? [json(selectorPage([hero], null))]
              : []),
          ],
        },
        withCursor,
      );
      await loadMore(page);
      expect(page.container.textContent).toContain(copy);
    },
  );

  it('[P2-S12-AC-271] selectorState degraded (kept half): after a failed read the last verified page stays listed and a retry is offered', async () => {
    const page = mountPage(
      { [SELECTOR]: [refusal(503, 'DEPENDENCY_UNAVAILABLE')] },
      withCursor,
    );
    await loadMore(page);
    expect(options(page.container)).toHaveLength(3);
    expect(page.container.textContent).toContain('2 compatible patterns');
    expect(buttonNamed(page.container, 'Load more patterns').disabled).toBe(
      false,
    );
  });

  it('[P2-S12-AC-271] selectorState disabled: a draft that cannot be edited names the reason and turns the selector and submit off', () => {
    const page = mountPage({}, { entry: entryFacts({ editable: false }) });
    expect(page.container.textContent).toContain(COMPOSITION_COPY.notEditable);
    expect(byLabel<HTMLSelectElement>(page.container, 'Pattern').disabled).toBe(
      true,
    );
    expect(buttonNamed(page.container, 'Place pattern').disabled).toBe(true);
  });
});
