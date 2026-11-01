// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  buttonNamed,
  byLabel,
  click,
  disableReactAct,
  enableReactAct,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import {
  answerHeld,
  heldReply,
  resultText,
} from './composition-command-states.test-support';
import {
  ENTRY,
  PLACE,
  UPDATE,
  diffPath,
  entryDetail,
  json,
  mountPage,
  refusal,
  settle,
} from './composition-page.test-support';
import {
  LIST,
  listPage,
  listedPaths,
  expectListRefetches,
} from './composition-refetch.test-support';
import { diffOf, id, plainPath, row } from './composition.test-support';

/*
 * [P2-S12-AC-271] The edges of the reconciling and refetching reads (FE03 1049, 1050): the reads of a page that has gone
 * away change nothing, a bulk sequence stops cleanly when the entry cannot be read between requests or a request is
 * refused, and the diffs a 409 re-reads report their own failure.
 */
beforeAll(enableReactAct);
afterAll(disableReactAct);

const unknown = () =>
  refusal(502, 'DEPENDENCY_UNAVAILABLE', { retryable: true });
const pending = (n: number) => row(n, { state: 'pending_diff', version: '3' });
const clean = (n: number) => json(diffOf(n, [plainPath()]), 200, '"3"');
const select = async (container: HTMLElement, numbers: readonly number[]) => {
  for (const n of numbers)
    await click(byLabel<HTMLInputElement>(container, `Select /main/row-${n}`));
};
const reviewAndAccept = async (
  page: ReturnType<typeof mountPage>,
  n: number,
) => {
  await select(
    page.container,
    Array.from({ length: n }, (_, i) => i + 1),
  );
  await click(buttonNamed(page.container, 'Review selected updates'));
  await settle();
  await click(buttonNamed(page.container, 'Accept all selected updates'));
  await settle();
};

// A page that has gone away asks for nothing more: its reconciling read answers late, and the list is not read for it
// (review refute8b BLIND rows 16-19: with the unmount guard removed these passed, as the list read happened either way).
describe('reads that outlive the page', () => {
  it('[P2-S12-AC-271] commandState degraded: a page that goes away while the entry is read back changes nothing and sends nothing more', async () => {
    const held = heldReply();
    const page = mountPage(
      { [UPDATE]: [unknown()], [ENTRY]: [held.reply] },
      { instances: [row(1)] },
    );
    await click(buttonNamed(page.container, 'Detach /main/row-1'));
    await settle();
    page.unmount();
    await answerHeld(held, entryDetail('9'));
    await settle();
    expect(page.calls.filter((call) => call.method === 'POST')).toHaveLength(1);
    expectListRefetches(page, 0);
  });

  it('[P2-S12-AC-271] commandState degraded: a bulk accept whose reconciling read outlives the page changes nothing', async () => {
    const held = heldReply();
    const page = mountPage(
      {
        [diffPath(id(1))]: [clean(1)],
        [diffPath(id(2))]: [clean(2)],
        [UPDATE]: [unknown()],
        [ENTRY]: [held.reply],
      },
      { instances: [pending(1), pending(2)] },
    );
    await reviewAndAccept(page, 2);
    page.unmount();
    await answerHeld(held, entryDetail('9'));
    await settle();
    expect(page.calls.filter((call) => call.method === 'POST')).toHaveLength(1);
    expectListRefetches(page, 0);
  });

  it('[P2-S12-AC-271] commandState degraded: new blocks whose reconciling read outlives the page change nothing', async () => {
    const held = heldReply();
    const withRoots = diffOf(1, [plainPath('/a')], {
      targetPatternVersion: 3,
      newRoots: [
        { rootPath: '/extra', blockKey: 'profile.header', blockVersion: 1 },
      ],
    });
    const page = mountPage(
      {
        [diffPath(id(1))]: [json(withRoots, 200, '"3"')],
        [PLACE]: [unknown()],
        [ENTRY]: [held.reply],
      },
      { instances: [pending(1)] },
    );
    await click(buttonNamed(page.container, 'Review update for /main/row-1'));
    await settle();
    await click(
      page.container.querySelector<HTMLInputElement>(
        '.cms-diff-new input[type="checkbox"]',
      ) as HTMLInputElement,
    );
    await click(buttonNamed(page.container, 'Place selected blocks'));
    await settle();
    page.unmount();
    await answerHeld(held, entryDetail('9'));
    await settle();
    expect(page.calls.filter((call) => call.method === 'POST')).toHaveLength(1);
    expectListRefetches(page, 0);
  });

  it('[P2-S12-AC-271] commandState degraded: an accept whose reconciling read outlives the page changes nothing', async () => {
    const held = heldReply();
    const page = mountPage(
      {
        [diffPath(id(1))]: [clean(1)],
        [UPDATE]: [unknown()],
        [ENTRY]: [held.reply],
      },
      { instances: [pending(1)] },
    );
    await click(buttonNamed(page.container, 'Review update for /main/row-1'));
    await settle();
    await click(buttonNamed(page.container, 'Accept update'));
    await settle();
    page.unmount();
    await answerHeld(held, entryDetail('9'));
    await settle();
    expect(page.calls.filter((call) => call.method === 'POST')).toHaveLength(1);
    expectListRefetches(page, 0);
  });
});

describe('the production wire', () => {
  it('[P2-S12-AC-271] commandState success: with no test seam the island reads the instance list through the global fetch', async () => {
    const page = mountPage(
      {
        [UPDATE]: [
          json(
            { items: [row(1, { version: '4', linkMode: 'detached' })] },
            200,
            '"10"',
          ),
        ],
        [LIST]: [listPage([row(1, { version: '4' }), row(5, { position: 5 })])],
      },
      { instances: [row(1)], fetcher: undefined },
    );
    vi.stubGlobal('fetch', page.fetcher);
    try {
      await click(buttonNamed(page.container, 'Detach /main/row-1'));
      await settle();
      expect(listedPaths(page.container)).toEqual([
        '/main/row-1',
        '/main/row-5',
      ]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('[P2-S12-AC-271] commandState degraded: with no test seam an unknown detach is reconciled through the global fetch', async () => {
    const page = mountPage(
      {
        [UPDATE]: [unknown()],
        [ENTRY]: [entryDetail('9')],
        [LIST]: [listPage([row(1)])],
      },
      { instances: [row(1)], fetcher: undefined },
    );
    vi.stubGlobal('fetch', page.fetcher);
    try {
      await click(buttonNamed(page.container, 'Detach /main/row-1'));
      await settle();
      expect(resultText(page.container)).toContain(
        'The entry is still at version 9.',
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('several new blocks', () => {
  it('[P2-S12-AC-271] commandState success: placing two new blocks names both and refetches the list', async () => {
    const two = diffOf(1, [plainPath('/a')], {
      targetPatternVersion: 3,
      newRoots: [
        { rootPath: '/extra', blockKey: 'profile.header', blockVersion: 1 },
        { rootPath: '/extra2', blockKey: 'profile.header', blockVersion: 1 },
      ],
    });
    const placedTwo = json(
      {
        items: [
          row(7, {
            path: '/main/extra',
            patternVersion: 3,
            state: 'draft',
            position: 9,
          }),
          row(8, {
            path: '/main/extra2',
            patternVersion: 3,
            state: 'draft',
            position: 10,
          }),
        ],
      },
      201,
      '"10"',
    );
    const page = mountPage(
      {
        [diffPath(id(1))]: [json(two, 200, '"3"'), json(two, 200, '"3"')],
        [PLACE]: [placedTwo],
      },
      { instances: [pending(1)] },
    );
    await click(buttonNamed(page.container, 'Review update for /main/row-1'));
    await settle();
    for (const box of page.container.querySelectorAll<HTMLInputElement>(
      '.cms-diff-new input[type="checkbox"]',
    ))
      await click(box);
    await click(buttonNamed(page.container, 'Place selected blocks'));
    await settle();
    expect(page.container.textContent).toContain(
      'Placed 2 blocks from pattern version 3.',
    );
    expect(page.lists).toHaveLength(1);
  });
});
