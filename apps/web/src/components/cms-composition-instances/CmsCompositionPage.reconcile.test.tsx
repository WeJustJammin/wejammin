// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buttonNamed,
  byLabel,
  click,
  disableReactAct,
  enableReactAct,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import {
  answerHeld,
  expectPendingLabel,
  heldReply,
  resultHeading,
  resultText,
} from './composition-command-states.test-support';
import { UNKNOWN_OUTCOME_MESSAGE } from './composition-copy';
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
import {
  ENTRY_ID,
  diffOf,
  id,
  plainPath,
  row,
} from './composition.test-support';

/*
 * [P2-S12-AC-271] commandState degraded (FE03 1050, DEC-242) and error (FE03 1049) for the update commands (CMS-03C-15
 * accept, detach, bulk): an unknown outcome renders pending and is reconciled by refetching the entry and the instance
 * list BEFORE any retry is offered; a 409 refetches the entry, the list and the unapplied diffs and keeps the selection.
 */
beforeAll(enableReactAct);
afterAll(disableReactAct);

const ENTRY_PATH = `/api/v1/cms/entries/${ENTRY_ID}`;
const unknown = () =>
  refusal(502, 'DEPENDENCY_UNAVAILABLE', { retryable: true });
const pending = (n: number) => row(n, { state: 'pending_diff', version: '3' });
const clean = (n: number) => json(diffOf(n, [plainPath()]), 200, '"3"');
const detached = (n: number, version = '10') =>
  json(
    {
      items: [row(n, { version: '4', linkMode: 'detached', state: 'active' })],
    },
    200,
    `"${version}"`,
  );
const keysOf = (page: ReturnType<typeof mountPage>): unknown[] =>
  page.calls
    .filter((call) => call.method === 'POST')
    .map((call) => call.headers['idempotency-key']);

describe('detach: an unknown outcome is reconciled before any retry', () => {
  it('[P2-S12-AC-271] commandState degraded: an unknown detach renders pending while the entry and the list are read, then offers the identical retry', async () => {
    const heldEntry = heldReply();
    const page = mountPage(
      {
        [UPDATE]: [unknown(), detached(1)],
        [ENTRY]: [heldEntry.reply],
        [LIST]: [listPage([row(1), row(6, { position: 6 })])],
      },
      { instances: [row(1)] },
    );
    const c = page.container;
    await click(buttonNamed(c, 'Detach /main/row-1'));
    await settle();
    expectPendingLabel(c, 'Checking the entry before any retry…');
    // No retry is offered while the reconciling read is in flight.
    expect(buttonNamed(c, 'Detach /main/row-1').disabled).toBe(true);
    await answerHeld(heldEntry, entryDetail('9'));
    await settle();
    expect(resultHeading(c)).toBe('Result not known');
    expect(resultText(c)).toContain(UNKNOWN_OUTCOME_MESSAGE);
    expect(resultText(c)).toContain('The entry is still at version 9.');
    expect(page.lists).toHaveLength(1);
    expect(listedPaths(c)).toEqual(['/main/row-1', '/main/row-6']);
    expect(buttonNamed(c, 'Detach /main/row-1').disabled).toBe(false);
    await click(buttonNamed(c, 'Detach /main/row-1'));
    await settle();
    const keys = keysOf(page);
    expect(keys).toHaveLength(2);
    expect(keys[1]).toBe(keys[0]);
    expect(resultHeading(c)).toBe('Detached');
  });

  it('[P2-S12-AC-271] commandState degraded (test correction, FE03 1050, DEC-245(4)): when the entry moved the reconciliation says the change may have been applied, and an unreadable entry is said not to be known and holds the retry behind Check again', async () => {
    const moved = mountPage(
      { [UPDATE]: [unknown()], [ENTRY]: [entryDetail('10')] },
      { instances: [row(1)] },
    );
    await click(buttonNamed(moved.container, 'Detach /main/row-1'));
    await settle();
    expect(resultText(moved.container)).toContain(
      'The entry has moved to version 10 since the request was sent, so the change may have been applied.',
    );
    expectListRefetches(moved, 1);
    moved.unmount();
    const unread = mountPage(
      {
        [UPDATE]: [unknown()],
        [ENTRY]: [refusal(503, 'DEPENDENCY_UNAVAILABLE')],
      },
      { instances: [row(1)] },
    );
    await click(buttonNamed(unread.container, 'Detach /main/row-1'));
    await settle();
    expect(resultText(unread.container)).toContain(
      'The entry could not be read to check, so nothing more is known.',
    );
    expect(buttonNamed(unread.container, 'Detach /main/row-1').disabled).toBe(
      true,
    );
    buttonNamed(unread.container, 'Check again');
    // The entry could not be read, so there is nothing to list the revision of: no list read.
    expectListRefetches(unread, 0);
  });
});

describe('new blocks: an unknown outcome and a 409 are reconciled', () => {
  const withRoots = diffOf(1, [plainPath('/a')], {
    targetPatternVersion: 3,
    newRoots: [
      { rootPath: '/extra', blockKey: 'profile.header', blockVersion: 1 },
    ],
  });
  const place = async (reply: Response, more = {}) => {
    const page = mountPage(
      {
        [diffPath(id(1))]: [
          json(withRoots, 200, '"3"'),
          json(withRoots, 200, '"3"'),
        ],
        [PLACE]: [reply],
        ...more,
      },
      { instances: [pending(1)] },
    );
    const c = page.container;
    await click(buttonNamed(c, 'Review update for /main/row-1'));
    await settle();
    await click(
      c.querySelector<HTMLInputElement>(
        '.cms-diff-new input[type="checkbox"]',
      ) as HTMLInputElement,
    );
    await click(buttonNamed(c, 'Place selected blocks'));
    await settle();
    return page;
  };

  it('[P2-S12-AC-271] commandState degraded: an unknown placement of new blocks reads the entry and the list before saying the result is not known', async () => {
    const page = await place(unknown(), { [ENTRY]: [entryDetail('9')] });
    expect(resultHeading(page.container)).toBe('Result not known');
    expect(resultText(page.container)).toContain(
      'The entry is still at version 9.',
    );
    expect(page.lists).toHaveLength(1);
    expect(buttonNamed(page.container, 'Place selected blocks').disabled).toBe(
      false,
    );
  });

  it('[P2-S12-AC-271] commandState error: a 409 on placing new blocks refetches the instance list as well as the entry and the diff', async () => {
    const page = await place(
      refusal(409, 'COMPOSITION_VERSION_CONFLICT', { currentVersion: '11' }),
      { [ENTRY]: [entryDetail('11')] },
    );
    expect(page.lists).toHaveLength(1);
    expect(
      page.calls.filter((call) => call.path.endsWith('/update-diff')),
    ).toHaveLength(2);
  });
});

describe('bulk: an unknown outcome and a 409 refetch', () => {
  const rows = () => [pending(1), pending(2)];
  const mount = (update: Array<Response>, more = {}) =>
    mountPage(
      {
        [diffPath(id(1))]: [clean(1)],
        [diffPath(id(2))]: [clean(2)],
        [UPDATE]: update,
        ...more,
      },
      { instances: rows() },
    );
  const bulkAccept = async (page: ReturnType<typeof mount>) => {
    for (const n of [1, 2])
      await click(
        byLabel<HTMLInputElement>(page.container, `Select /main/row-${n}`),
      );
    await click(buttonNamed(page.container, 'Review selected updates'));
    await settle();
    await click(buttonNamed(page.container, 'Accept all selected updates'));
    await settle();
  };

  it('[P2-S12-AC-271] commandState degraded: an unknown bulk accept renders pending, reconciles by reading the entry and the list, keeps the selection and retries under the same key', async () => {
    const heldEntry = heldReply();
    const applied = json(
      {
        items: [1, 2].map((n) => row(n, { version: '4', patternVersion: 2 })),
      },
      200,
      '"10"',
    );
    const page = mount([unknown(), applied], {
      [ENTRY]: [heldEntry.reply],
      [LIST]: [listPage(rows())],
    });
    for (const n of [1, 2])
      await click(
        byLabel<HTMLInputElement>(page.container, `Select /main/row-${n}`),
      );
    await click(buttonNamed(page.container, 'Review selected updates'));
    await settle();
    await click(buttonNamed(page.container, 'Accept all selected updates'));
    await settle();
    expectPendingLabel(page.container, 'Checking the entry before any retry…');
    expect(
      buttonNamed(page.container, 'Accept all selected updates').disabled,
    ).toBe(true);
    await answerHeld(heldEntry, entryDetail('9'));
    await settle();
    expect(resultHeading(page.container)).toBe('Updates stopped');
    expect(resultText(page.container)).toContain(UNKNOWN_OUTCOME_MESSAGE);
    expect(resultText(page.container)).toContain(
      'The entry is still at version 9.',
    );
    expect(page.lists).toHaveLength(1);
    expect(page.container.textContent).toContain('2 selected');
    await click(buttonNamed(page.container, 'Accept all selected updates'));
    await settle();
    expect(keysOf(page)[1]).toBe(keysOf(page)[0]);
    expect(resultHeading(page.container)).toBe('Updates applied');
  });

  it('[P2-S12-AC-271] commandState error: a 409 on a bulk accept refetches the entry, the list and the unapplied diffs and keeps the selection', async () => {
    const page = mount(
      [
        refusal(409, 'COMPOSITION_VERSION_CONFLICT', {
          reasonCode: 'diff_has_collisions',
        }),
      ],
      {
        [ENTRY]: [entryDetail('11')],
        [LIST]: [listPage([...rows(), row(8, { position: 8 })])],
        // The review read each diff once; the 409 reads both again.
        [diffPath(id(1))]: [clean(1), clean(1)],
        [diffPath(id(2))]: [clean(2), clean(2)],
      },
    );
    await bulkAccept(page);
    expect(resultHeading(page.container)).toBe('Updates stopped');
    expect(page.calls.filter((call) => call.path === ENTRY_PATH)).toHaveLength(
      1,
    );
    expect(page.lists).toHaveLength(1);
    expect(listedPaths(page.container)).toEqual([
      '/main/row-1',
      '/main/row-2',
      '/main/row-8',
    ]);
    expect(
      page.calls.filter((call) => call.path.endsWith('/update-diff')),
    ).toHaveLength(4);
    expect(page.container.textContent).toContain('2 selected');
    expect(page.container.querySelector('.cms-diff')?.textContent).toContain(
      '2 updates selected.',
    );
  });
});
