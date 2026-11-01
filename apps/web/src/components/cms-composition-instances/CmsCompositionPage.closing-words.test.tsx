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
import {
  answerHeld,
  heldReply,
  pattern,
  resultText,
} from './composition-command-states.test-support';
import {
  ENTRY,
  PLACE,
  SELECTOR,
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
  expectListRefetches,
  listPage,
  listedPaths,
} from './composition-refetch.test-support';
import {
  diffOf,
  id,
  plainPath,
  row,
  selectorItem,
  selectorPage,
} from './composition.test-support';

/*
 * [P2-S12-AC-271] the closing words of the Slice 12 state table (FE03 1042): "each [state] is server-authoritative and
 * `no-store`, and none is optimistic", for every read and command of the composition island. Each request is a
 * `no-store`, same-origin fetch; and while one is in flight the page shows what it showed before: rows, versions,
 * selected pattern and diff change only when the server answers.
 */
beforeAll(enableReactAct);
afterAll(disableReactAct);

const hero = selectorItem('hero-block', 2);
const pending = (n: number) => row(n, { state: 'pending_diff', version: '3' });
const detachedRow = row(1, { version: '4', linkMode: 'detached' });
const everyRequest = (page: ReturnType<typeof mountPage>) => [
  ...page.calls,
  ...page.lists,
];
const expectNoStore = (page: ReturnType<typeof mountPage>): void => {
  const requests = everyRequest(page);
  expect(requests.length).toBeGreaterThan(0);
  for (const request of requests) {
    expect(`${request.method} ${request.path}: ${request.cache}`).toBe(
      `${request.method} ${request.path}: no-store`,
    );
    expect(request.credentials).toBe('same-origin');
  }
};
const posts = (page: ReturnType<typeof mountPage>) =>
  page.calls.filter((call) => call.method === 'POST').length;

describe('composition reads: no-store, and the page keeps what it showed until the server answers', () => {
  it('[P2-S12-AC-271] selectorState and diffState and commandState closing words: the selector page, the diff, the entry and the list reads are no-store and change nothing before they answer', async () => {
    const more = heldReply();
    const diff = heldReply();
    const entry = heldReply();
    const list = heldReply();
    const page = mountPage(
      {
        [SELECTOR]: [more.reply],
        [diffPath(id(1))]: [diff.reply],
        [UPDATE]: [refusal(409, 'COMPOSITION_VERSION_CONFLICT', {})],
        [ENTRY]: [entry.reply],
        [LIST]: [list.reply],
      },
      {
        instances: [pending(1)],
        selector: selectorPage([hero], 'cursor-1'),
      },
    );
    const c = page.container;
    const options = (): number => pattern(c).options.length;
    await click(buttonNamed(c, 'Load more patterns'));
    expect(options()).toBe(2);
    await answerHeld(
      more,
      json(selectorPage([selectorItem('zebra', 1)]), 200, '"7"'),
    );
    await settle();
    expect(options()).toBe(3);

    await click(buttonNamed(c, 'Review update for /main/row-1'));
    await settle();
    expect(c.querySelector('.cms-diff')).toBeNull();
    await answerHeld(diff, json(diffOf(1, [plainPath()]), 200, '"3"'));
    await settle();
    expect(c.querySelector('.cms-diff')).not.toBeNull();

    // A refused accept reads the entry and then the list: the rows stay as they were until each answers.
    await click(buttonNamed(c, 'Accept update'));
    await settle();
    expect(listedPaths(c)).toEqual(['/main/row-1']);
    expect(c.textContent).toContain('Update available');
    await answerHeld(entry, entryDetail('11'));
    await settle();
    expect(listedPaths(c)).toEqual(['/main/row-1']);
    expect(c.textContent).toContain('Update available');
    await answerHeld(
      list,
      listPage([pending(1), row(2, { position: 2 })], null),
    );
    await settle();
    expect(listedPaths(c)).toEqual(['/main/row-1', '/main/row-2']);
    expectListRefetches(page, 1);
    expectNoStore(page);
  });
});

describe('composition commands: no-store, and never optimistic', () => {
  it('[P2-S12-AC-271] commandState closing words: a placement shows no row, no new version and no cleared field until the server answers, and the list refetch changes nothing before it answers', async () => {
    const placing = heldReply();
    const list = heldReply();
    const page = mountPage(
      { [PLACE]: [placing.reply], [LIST]: [list.reply] },
      { instances: [row(2)] },
    );
    const c = page.container;
    await choose(pattern(c), hero.patternVersionId);
    await click(byLabel<HTMLInputElement>(c, /^Linked/u));
    await typeInto(byLabel<HTMLInputElement>(c, 'Slot path'), '/main');
    await click(buttonNamed(c, 'Place pattern'));
    await settle();
    expect(posts(page)).toBe(1);
    expect(resultText(c)).toBe('Placing the pattern…');
    expect(listedPaths(c)).toEqual(['/main/row-2']);
    expect(pattern(c).value).toBe(hero.patternVersionId);
    await answerHeld(
      placing,
      json(
        {
          items: [
            row(1, { path: '/main/hero1', patternVersion: 2, state: 'draft' }),
          ],
        },
        201,
        '"10"',
      ),
    );
    await settle();
    // The placement is answered: its row is shown while the list refetch is still in flight.
    expect(listedPaths(c)).toContain('/main/hero1');
    expect(pattern(c).value).toBe('');
    expect(page.lists).toHaveLength(1);
    await answerHeld(list, listPage([row(2), row(7, { position: 7 })]));
    await settle();
    expect(listedPaths(c)).toEqual(['/main/row-2', '/main/row-7']);
    expectNoStore(page);
  });

  it('[P2-S12-AC-271] commandState closing words: a detach and an accept leave the row as the server last listed it until the server answers', async () => {
    const detaching = heldReply();
    const page = mountPage(
      { [UPDATE]: [detaching.reply] },
      { instances: [row(1)] },
    );
    const c = page.container;
    await click(buttonNamed(c, 'Detach /main/row-1'));
    await settle();
    expect(posts(page)).toBe(1);
    expect(c.textContent).toContain('Up to date');
    expect(c.textContent).not.toContain('Local copy');
    await answerHeld(detaching, json({ items: [detachedRow] }, 200, '"10"'));
    await settle();
    expect(c.textContent).toContain('Local copy');
    expectNoStore(page);

    const accepting = heldReply();
    const second = mountPage(
      {
        [diffPath(id(1))]: [json(diffOf(1, [plainPath()]), 200, '"3"')],
        [UPDATE]: [accepting.reply],
      },
      { instances: [pending(1)] },
    );
    const d = second.container;
    await click(buttonNamed(d, 'Review update for /main/row-1'));
    await settle();
    await click(buttonNamed(d, 'Accept update'));
    await settle();
    expect(posts(second)).toBe(1);
    expect(d.textContent).toContain('Update available');
    expect(d.querySelector('.cms-diff')).not.toBeNull();
    await answerHeld(
      accepting,
      json({ items: [row(1, { version: '4' })] }, 200, '"10"'),
    );
    await settle();
    expect(d.querySelector('.cms-diff')).toBeNull();
    expect(d.textContent).toContain('Up to date');
    expectNoStore(second);
  });
});
