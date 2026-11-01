// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buttonNamed,
  byLabel,
  choose,
  click,
  disableReactAct,
  enableReactAct,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import { pattern, resultText } from './composition-command-states.test-support';
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
} from './composition-refetch.test-support';
import {
  REVISION_ID,
  diffOf,
  id,
  plainPath,
  row,
  selectorItem,
} from './composition.test-support';

/*
 * [P2-S12-AC-271] commandState success and error (FE03 1047, 1049; DEC-242): after a verified command, and after a 409,
 * the instance list is refetched through the protected composition-instances read (DEC-206, the browser proxy
 * `GET /api/v1/cms/entries/{entryId}/compositions`) and replaced by the server's render order; a list that cannot be
 * read keeps the rows the island holds and says nothing false.
 */
beforeAll(enableReactAct);
afterAll(disableReactAct);

const hero = selectorItem('hero-block', 2);
const pending = (n: number) => row(n, { state: 'pending_diff', version: '3' });
const placedRow = row(1, {
  path: '/main/hero1',
  patternVersion: 2,
  state: 'draft',
  position: 5,
});
const placed = () => json({ items: [placedRow] }, 201, '"10"');
const detached = () =>
  json(
    {
      items: [row(1, { version: '4', linkMode: 'detached', state: 'active' })],
    },
    200,
    '"10"',
  );
const readDiff = (value = diffOf(1, [plainPath('/a')])) =>
  json(value, 200, `"${value.instance.version}"`);
const listCalls = (page: ReturnType<typeof mountPage>) => page.lists;

const place = async (page: ReturnType<typeof mountPage>) => {
  const c = page.container;
  await choose(pattern(c), hero.patternVersionId);
  await click(byLabel<HTMLInputElement>(c, /^Linked/u));
  await typeInto(byLabel<HTMLInputElement>(c, 'Slot path'), '/main');
  await click(buttonNamed(c, 'Place pattern'));
  await settle();
};

describe('composition page: the list is refetched from the protected read', () => {
  it('[P2-S12-AC-271] commandState success: a verified placement refetches the instance list and shows the server render order', async () => {
    const page = mountPage(
      {
        [PLACE]: [placed()],
        [LIST]: [listPage([row(7, { position: 0 }), placedRow])],
      },
      { instances: [row(2)] },
    );
    await place(page);
    expect(listedPaths(page.container)).toEqual(['/main/row-7', '/main/hero1']);
    const [call] = listCalls(page);
    expect(call?.search).toBe('?limit=50');
    expect(listCalls(page)).toHaveLength(1);
  });

  it('[P2-S12-AC-271] commandState success: a verified detach refetches the instance list and shows rows another session changed', async () => {
    const page = mountPage(
      {
        [UPDATE]: [detached()],
        [LIST]: [
          listPage([
            row(1, { version: '4', linkMode: 'detached' }),
            row(8, { position: 8 }),
          ]),
        ],
      },
      { instances: [row(1), row(2)] },
    );
    await click(buttonNamed(page.container, 'Detach /main/row-1'));
    await settle();
    expect(listedPaths(page.container)).toEqual(['/main/row-1', '/main/row-8']);
    expect(resultText(page.container)).toContain('Detached');
  });

  it('[P2-S12-AC-271] commandState success: a verified accept refetches the instance list once the update is applied', async () => {
    const page = mountPage(
      {
        [diffPath(id(1))]: [readDiff()],
        [UPDATE]: [detached()],
        [LIST]: [listPage([row(1, { version: '4' }), row(9, { position: 9 })])],
      },
      { instances: [pending(1)] },
    );
    await click(buttonNamed(page.container, 'Review update for /main/row-1'));
    await settle();
    await click(buttonNamed(page.container, 'Accept update'));
    await settle();
    expect(resultText(page.container)).toContain('Update applied');
    expect(listedPaths(page.container)).toEqual(['/main/row-1', '/main/row-9']);
  });

  it('[P2-S12-AC-271] commandState error: a 409 on a detach refreshes the entry and refetches the instance list before saying so', async () => {
    const page = mountPage(
      {
        [UPDATE]: [
          refusal(409, 'COMPOSITION_VERSION_CONFLICT', {
            currentVersion: '11',
          }),
        ],
        [ENTRY]: [entryDetail('11')],
        [LIST]: [listPage([row(1, { version: '6' }), row(4, { position: 4 })])],
      },
      { instances: [row(1)] },
    );
    await click(buttonNamed(page.container, 'Detach /main/row-1'));
    await settle();
    expect(listCalls(page)).toHaveLength(1);
    expect(listedPaths(page.container)).toEqual(['/main/row-1', '/main/row-4']);
    expect(resultText(page.container)).toContain('Not detached');
  });

  it('[P2-S12-AC-271] commandState error: a 409 on a placement refetches the instance list and keeps the typed fields', async () => {
    const page = mountPage(
      {
        [PLACE]: [
          refusal(409, 'COMPOSITION_VERSION_CONFLICT', {
            currentVersion: '11',
          }),
        ],
        [ENTRY]: [entryDetail('11')],
        [LIST]: [listPage([row(3, { position: 3 })])],
      },
      { instances: [row(2)] },
    );
    await place(page);
    expect(listedPaths(page.container)).toEqual(['/main/row-3']);
    expect(byLabel<HTMLInputElement>(page.container, 'Slot path').value).toBe(
      '/main',
    );
  });

  it('follows the cursor of the read until it ends', async () => {
    const page = mountPage(
      {
        [UPDATE]: [detached()],
        [LIST]: [
          listPage([row(1, { version: '4' })], 'next-page'),
          listPage([row(2, { position: 2 })]),
        ],
      },
      { instances: [row(1)] },
    );
    await click(buttonNamed(page.container, 'Detach /main/row-1'));
    await settle();
    expect(listCalls(page).map((call) => call.search)).toEqual([
      '?limit=50',
      '?limit=50&cursor=next-page',
    ]);
    expect(listedPaths(page.container)).toEqual(['/main/row-1', '/main/row-2']);
  });

  it.each([
    ['a failed read', () => refusal(503, 'DEPENDENCY_UNAVAILABLE')],
    ['a page of another revision', () => listPage([row(9)], null, id(77))],
    [
      'a page that is not the strict page',
      () => json({ revisionId: REVISION_ID, items: [{ path: 3 }] }),
    ],
  ])(
    'keeps the rows it holds, without a false error, when the refetch is %s',
    async (_name, reply) => {
      const page = mountPage(
        { [UPDATE]: [detached()], [LIST]: [reply()] },
        { instances: [row(1), row(2)] },
      );
      await click(buttonNamed(page.container, 'Detach /main/row-1'));
      await settle();
      expect(listedPaths(page.container)).toEqual([
        '/main/row-1',
        '/main/row-2',
      ]);
      expect(resultText(page.container)).toContain('Detached');
    },
  );
});

describe('a retired row survives the refetch (V19 m7, DEC-193)', () => {
  it('[P2-S12-AC-271] commandState success: a block an accept removed stays listed and detachable after the list is refetched', async () => {
    const retiredRow = row(1, { state: 'retired', version: '5' });
    const page = mountPage(
      {
        [UPDATE]: [json({ items: [detachedRowOf(2)] }, 200, '"10"')],
        [LIST]: [listPage([detachedRowOf(2)])],
      },
      { instances: [retiredRow, row(2)] },
    );
    await click(buttonNamed(page.container, 'Detach /main/row-2'));
    await settle();
    expect(listedPaths(page.container)).toEqual(['/main/row-1', '/main/row-2']);
    expect(page.container.textContent).toContain('Removed from the entry');
    expect(buttonNamed(page.container, 'Detach /main/row-1').disabled).toBe(
      false,
    );
  });
});

describe('a retired row of a previous draft revision is not kept (V20 m3, DEC-246 ruling 2)', () => {
  it('[P2-S12-AC-271] commandState error: a 409 whose entry read answers a new draft revision drops the retired row of the old one', async () => {
    const newRevision = id(91);
    const page = mountPage(
      {
        [UPDATE]: [
          refusal(409, 'COMPOSITION_VERSION_CONFLICT', {
            currentVersion: '11',
          }),
        ],
        [ENTRY]: [
          entryDetail('11', { revision: { id: newRevision, version: '3' } }),
        ],
        [LIST]: [
          listPage([row(2, { revisionId: newRevision })], null, newRevision),
        ],
      },
      { instances: [row(1, { state: 'retired', version: '5' }), row(2)] },
    );
    await click(buttonNamed(page.container, 'Detach /main/row-2'));
    await settle();
    expect(listedPaths(page.container)).toEqual(['/main/row-2']);
    expect(page.container.textContent).not.toContain('Removed from the entry');
  });
});

const detachedRowOf = (n: number) =>
  row(n, { version: '4', linkMode: 'detached', state: 'active' });
