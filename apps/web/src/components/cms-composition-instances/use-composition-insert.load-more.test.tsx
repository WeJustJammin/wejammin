// @vitest-environment jsdom
import * as React from 'react';
import { act } from 'react';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  disableReactAct,
  enableReactAct,
  flush,
  mountElement,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import {
  answerHeld,
  heldReply,
} from './composition-command-states.test-support';
import { entryDetail, json, refusal } from './composition-page.test-support';
import {
  entryFacts,
  selectorItem,
  selectorPage,
} from './composition.test-support';
import { useCompositionInsert } from './use-composition-insert';
import { useCompositionSession } from './use-composition-session';

/*
 * [P2-S12-AC-271] selectorState (FE03 1048): the guards of `loadMore` that the button cannot reach, because it is
 * disabled while a read runs and absent without a cursor: a second call while one runs is dropped, a call without a
 * cursor reads nothing, and a stale list (the block registry changed, DEC-246 ruling 5) is read again from the first page
 * with the browser's own `fetch` when the island is given none.
 */
beforeAll(enableReactAct);
afterAll(disableReactAct);
afterEach(() => vi.unstubAllGlobals());

const hero = selectorItem('hero-block', 2);
const harness = (
  selector: ReturnType<typeof selectorPage>,
  fetcher?: typeof fetch,
) => {
  let insert: ReturnType<typeof useCompositionInsert> | null = null;
  function Harness(): React.ReactElement {
    const session = useCompositionSession({
      entry: entryFacts(),
      instances: [],
      csrfToken: 'csrf-token',
      fetcher,
    });
    insert = useCompositionInsert(session, selector);
    return <p>{insert.page.items.length}</p>;
  }
  const mounted = mountElement(<Harness />);
  return {
    mounted,
    now: () => insert as unknown as ReturnType<typeof useCompositionInsert>,
  };
};

describe('useCompositionInsert loadMore guards', () => {
  it('drops a second call while a read runs, and reads nothing without a cursor', async () => {
    const held = heldReply();
    const fetcher = vi.fn(async () => held.reply()) as unknown as typeof fetch;
    const withCursor = harness(selectorPage([hero], 'cursor-1'), fetcher);
    const first = withCursor.now().loadMore();
    await withCursor.now().loadMore();
    expect(fetcher).toHaveBeenCalledTimes(1);
    await answerHeld(held, json(selectorPage([selectorItem('zebra', 1)]), 200));
    await first;
    withCursor.mounted.unmount();

    const noCursor = vi.fn() as unknown as typeof fetch;
    const without = harness(selectorPage([hero], null), noCursor);
    await without.now().loadMore();
    expect(noCursor).not.toHaveBeenCalled();
  });

  it('reads the first page again with the global fetch when the island is given none', async () => {
    const calls: string[] = [];
    const FRESH = 'd'.repeat(64);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input), 'https://app.example.test');
        calls.push(`${init?.method ?? 'GET'} ${url.pathname}`);
        if (init?.method === 'POST')
          return refusal(409, 'COMPOSITION_VERSION_CONFLICT', {
            reasonCode: 'block_registry_digest_mismatch',
          });
        if (url.pathname === '/api/v1/cms/patterns/selector')
          return json(
            selectorPage([{ ...hero, blockRegistryDigest: FRESH }]),
            200,
          );
        return entryDetail('12');
      }),
    );
    const page = harness(selectorPage([hero]));
    await act(async () => {
      page.now().change({ item: hero, linkMode: 'linked', slotPath: '/main' });
    });
    await act(async () => {
      await page.now().submit();
    });
    await flush();
    expect(calls).toContain('GET /api/v1/cms/patterns/selector');
    expect(page.now().page.items[0]?.blockRegistryDigest).toBe(FRESH);
    expect(page.now().fields.item?.blockRegistryDigest).toBe(FRESH);
  });
});
