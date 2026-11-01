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
import { pattern } from './composition-command-states.test-support';
import {
  PLACE,
  UPDATE,
  diffPath,
  json,
  mountPage,
  noListReads,
  refusal,
  settle,
} from './composition-page.test-support';
import {
  diffOf,
  id,
  plainPath,
  row,
  selectorItem,
} from './composition.test-support';

/*
 * [P2-S12-AC-271] FE03 1047 and 1049 refetch the lists after a verified success and after a 409, nothing else: a 401,
 * 403, 404, 422 or 429 refusal, a refused diff read and an open review ask for no instance list. (The harness answers an
 * unscripted list read with a failure that keeps the rows, so these rows are the proof that no read was made.)
 */
beforeAll(enableReactAct);
afterAll(disableReactAct);

const hero = selectorItem('hero-block', 2);
const REFUSALS = [
  ['401', () => refusal(401, 'UNAUTHENTICATED')],
  ['403', () => refusal(403, 'COMPOSITION_FORBIDDEN')],
  ['404', () => refusal(404, 'COMPOSITION_NOT_FOUND')],
  ['422', () => refusal(422, 'COMPOSITION_VALIDATION_FAILED', {})],
  [
    '429',
    () =>
      refusal(
        429,
        'RATE_LIMITED',
        { retryAfterSeconds: 5 },
        { 'retry-after': '5' },
      ),
  ],
] as const;
const pending = (n: number) => row(n, { state: 'pending_diff', version: '3' });

describe('refusals that ask for no list', () => {
  it.each(REFUSALS)(
    '[P2-S12-AC-271] commandState error: a %s refusal of a detach asks for no instance list',
    async (_status, reply) => {
      const page = mountPage({ [UPDATE]: [reply()] }, { instances: [row(1)] });
      await click(buttonNamed(page.container, 'Detach /main/row-1'));
      await settle();
      noListReads(page);
      expect(page.calls.filter((call) => call.method === 'GET')).toEqual([]);
    },
  );

  it.each(REFUSALS)(
    '[P2-S12-AC-271] commandState error: a %s refusal of a placement asks for no instance list',
    async (_status, reply) => {
      const page = mountPage({ [PLACE]: [reply()] });
      const c = page.container;
      await choose(pattern(c), hero.patternVersionId);
      await click(byLabel<HTMLInputElement>(c, /^Linked/u));
      await typeInto(byLabel<HTMLInputElement>(c, 'Slot path'), '/main');
      await click(buttonNamed(c, 'Place pattern'));
      await settle();
      noListReads(page);
    },
  );

  it.each(REFUSALS)(
    '[P2-S12-AC-271] commandState error: a %s refusal of an accept asks for no instance list',
    async (_status, reply) => {
      const page = mountPage(
        {
          [diffPath(id(1))]: [json(diffOf(1, [plainPath()]), 200, '"3"')],
          [UPDATE]: [reply()],
        },
        { instances: [pending(1)] },
      );
      await click(buttonNamed(page.container, 'Review update for /main/row-1'));
      await settle();
      await click(buttonNamed(page.container, 'Accept update'));
      await settle();
      noListReads(page);
    },
  );

  it.each(REFUSALS)(
    '[P2-S12-AC-271] commandState error: a %s refusal of a bulk detach asks for no instance list',
    async (_status, reply) => {
      const page = mountPage(
        { [UPDATE]: [reply()] },
        { instances: [row(1), row(2)] },
      );
      for (const n of [1, 2])
        await click(
          byLabel<HTMLInputElement>(page.container, `Select /main/row-${n}`),
        );
      await click(buttonNamed(page.container, 'Detach selected'));
      await settle();
      noListReads(page);
    },
  );

  it('[P2-S12-AC-271] diffState error: a review that opens, and a diff that is refused, ask for no instance list', async () => {
    const page = mountPage(
      {
        [diffPath(id(1))]: [
          refusal(422, 'COMPOSITION_VALIDATION_FAILED', {
            reasonCode: 'diff_too_large',
          }),
        ],
      },
      { instances: [pending(1)] },
    );
    await click(buttonNamed(page.container, 'Review update for /main/row-1'));
    await settle();
    noListReads(page);
    expect(page.calls).toHaveLength(1);
  });

  it('[P2-S12-AC-271] commandState error: a 409 asks for the list once, and the harness would see a read it was not told about', async () => {
    const page = mountPage(
      { [UPDATE]: [refusal(409, 'COMPOSITION_VERSION_CONFLICT', {})] },
      { instances: [row(1)] },
    );
    await click(buttonNamed(page.container, 'Detach /main/row-1'));
    await settle();
    expect(page.lists).toHaveLength(1);
    expect(page.unscriptedLists).toHaveLength(1);
    expect(() => noListReads(page)).toThrow();
  });
});
