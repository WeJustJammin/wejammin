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
  expectListRefetches,
} from './composition-refetch.test-support';
import {
  diffOf,
  id,
  plainPath,
  row,
  selectorItem,
} from './composition.test-support';

/*
 * [P2-S12-AC-271] commandState loading (FE03 1048, DEC-241 extended, review V19 M3): a control that starts another
 * command stays disabled for the WHOLE command, including the reads that follow its answer (the entry, the instance
 * list, the diff): a second press during those reads must send nothing. Each row holds one of those reads and presses
 * the control again.
 */
beforeAll(enableReactAct);
afterAll(disableReactAct);

const hero = selectorItem('hero-block', 2);
const conflict = () =>
  refusal(409, 'COMPOSITION_VERSION_CONFLICT', { currentVersion: '11' });
const pending = (n: number) => row(n, { state: 'pending_diff', version: '3' });
const clean = (n: number) => json(diffOf(n, [plainPath()]), 200, '"3"');
const posts = (page: ReturnType<typeof mountPage>) =>
  page.calls.filter((call) => call.method === 'POST').length;
const placedRow = row(1, {
  path: '/main/hero1',
  patternVersion: 2,
  state: 'draft',
});
const detachedRow = (n: number) =>
  row(n, { version: '4', linkMode: 'detached', state: 'active' });

const fillAndPlace = async (page: ReturnType<typeof mountPage>) => {
  const c = page.container;
  await choose(pattern(c), hero.patternVersionId);
  await click(byLabel<HTMLInputElement>(c, /^Linked/u));
  await typeInto(byLabel<HTMLInputElement>(c, 'Slot path'), '/main');
  await click(buttonNamed(c, 'Place pattern'));
  await settle();
};

describe('a 409: the controls wait for the refetch', () => {
  it('[P2-S12-AC-271] commandState loading: Place pattern stays disabled and sends nothing while the entry is read after a 409', async () => {
    const held = heldReply();
    const page = mountPage({ [PLACE]: [conflict()], [ENTRY]: [held.reply] });
    await fillAndPlace(page);
    const c = page.container;
    expect(resultText(c)).toBe('Placing the pattern…');
    expect(buttonNamed(c, 'Place pattern').disabled).toBe(true);
    await click(buttonNamed(c, 'Place pattern'));
    expect(posts(page)).toBe(1);
    await answerHeld(held, entryDetail('11'));
    await settle();
    expect(buttonNamed(c, 'Place pattern').disabled).toBe(false);
    expect(posts(page)).toBe(1);
    expectListRefetches(page, 1);
  });

  it('[P2-S12-AC-271] commandState loading: Detach stays disabled and sends nothing while the entry is read after a 409', async () => {
    const held = heldReply();
    const page = mountPage(
      { [UPDATE]: [conflict()], [ENTRY]: [held.reply] },
      { instances: [row(1)] },
    );
    const c = page.container;
    await click(buttonNamed(c, 'Detach /main/row-1'));
    await settle();
    expect(buttonNamed(c, 'Detach /main/row-1').disabled).toBe(true);
    await click(buttonNamed(c, 'Detach /main/row-1'));
    expect(posts(page)).toBe(1);
    await answerHeld(held, entryDetail('11'));
    await settle();
    expect(buttonNamed(c, 'Detach /main/row-1').disabled).toBe(false);
    expectListRefetches(page, 1);
  });

  it('[P2-S12-AC-271] commandState loading: Accept stays disabled and sends nothing while the diff is read again after a 409', async () => {
    const held = heldReply();
    const page = mountPage(
      {
        [diffPath(id(1))]: [clean(1), held.reply],
        [UPDATE]: [conflict()],
        [ENTRY]: [entryDetail('11')],
      },
      { instances: [pending(1)] },
    );
    const c = page.container;
    await click(buttonNamed(c, 'Review update for /main/row-1'));
    await settle();
    await click(buttonNamed(c, 'Accept update'));
    await settle();
    expect(buttonNamed(c, 'Review update for /main/row-1').disabled).toBe(true);
    await click(buttonNamed(c, 'Review update for /main/row-1'));
    expect(
      page.calls.filter((call) => call.path.endsWith('/update-diff')),
    ).toHaveLength(2);
    await answerHeld(held, clean(1));
    await settle();
    expect(posts(page)).toBe(1);
    expect(buttonNamed(c, 'Accept update').disabled).toBe(false);
    expectListRefetches(page, 1);
  });

  it('[P2-S12-AC-271] commandState loading: Place selected blocks stays disabled and sends nothing while the entry is read after a 409', async () => {
    const held = heldReply();
    const withRoots = diffOf(1, [plainPath('/a')], {
      targetPatternVersion: 3,
      newRoots: [
        { rootPath: '/extra', blockKey: 'profile.header', blockVersion: 1 },
      ],
    });
    const page = mountPage(
      {
        [diffPath(id(1))]: [
          json(withRoots, 200, '"3"'),
          json(withRoots, 200, '"3"'),
        ],
        [PLACE]: [conflict()],
        [ENTRY]: [held.reply],
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
    expect(buttonNamed(c, 'Place selected blocks').disabled).toBe(true);
    await click(buttonNamed(c, 'Place selected blocks'));
    expect(posts(page)).toBe(1);
    await answerHeld(held, entryDetail('11'));
    await settle();
    expectListRefetches(page, 1);
  });

  it('[P2-S12-AC-271] commandState loading: Accept all selected updates stays disabled and sends nothing while the entry is read after a 409', async () => {
    const held = heldReply();
    const page = mountPage(
      {
        [diffPath(id(1))]: [clean(1), clean(1)],
        [diffPath(id(2))]: [clean(2), clean(2)],
        [UPDATE]: [conflict()],
        [ENTRY]: [held.reply],
      },
      { instances: [pending(1), pending(2)] },
    );
    const c = page.container;
    for (const n of [1, 2])
      await click(byLabel<HTMLInputElement>(c, `Select /main/row-${n}`));
    await click(buttonNamed(c, 'Review selected updates'));
    await settle();
    await click(buttonNamed(c, 'Accept all selected updates'));
    await settle();
    expect(buttonNamed(c, 'Accept all selected updates').disabled).toBe(true);
    await click(buttonNamed(c, 'Accept all selected updates'));
    expect(posts(page)).toBe(1);
    await answerHeld(held, entryDetail('11'));
    await settle();
    expectListRefetches(page, 1);
  });

  it('[P2-S12-AC-271] commandState loading: Detach selected stays disabled and sends nothing while the list is read after a 409', async () => {
    const held = heldReply();
    const page = mountPage(
      {
        [UPDATE]: [conflict()],
        [ENTRY]: [entryDetail('11')],
        [LIST]: [held.reply],
      },
      { instances: [row(1), row(2)] },
    );
    const c = page.container;
    for (const n of [1, 2])
      await click(byLabel<HTMLInputElement>(c, `Select /main/row-${n}`));
    await click(buttonNamed(c, 'Detach selected'));
    await settle();
    expect(buttonNamed(c, 'Detach selected').disabled).toBe(true);
    await click(buttonNamed(c, 'Detach selected'));
    expect(posts(page)).toBe(1);
    await answerHeld(held, listPage([row(1), row(2)]));
    await settle();
    expect(buttonNamed(c, 'Detach selected').disabled).toBe(false);
  });
});

describe('a success: the controls wait for the list refetch', () => {
  it('[P2-S12-AC-271] commandState loading: Place pattern stays disabled while the list is read after a verified placement', async () => {
    const held = heldReply();
    const page = mountPage({
      [PLACE]: [json({ items: [placedRow] }, 201, '"10"')],
      [LIST]: [held.reply],
    });
    await fillAndPlace(page);
    const c = page.container;
    expect(buttonNamed(c, 'Place pattern').disabled).toBe(true);
    await answerHeld(held, listPage([placedRow]));
    await settle();
    expect(buttonNamed(c, 'Place pattern').disabled).toBe(false);
  });

  it('[P2-S12-AC-271] commandState loading: the row commands stay disabled while the list is read after a verified detach', async () => {
    const held = heldReply();
    const page = mountPage(
      {
        [UPDATE]: [json({ items: [detachedRow(1)] }, 200, '"10"')],
        [LIST]: [held.reply],
      },
      { instances: [row(1), row(2)] },
    );
    const c = page.container;
    await click(buttonNamed(c, 'Detach /main/row-2'));
    await settle();
    expect(buttonNamed(c, 'Detach /main/row-2').disabled).toBe(true);
    await answerHeld(held, listPage([row(1), row(2)]));
    await settle();
  });

  it('[P2-S12-AC-271] commandState loading: a bulk sequence keeps its controls disabled while the entry is read between its requests', async () => {
    const held = heldReply();
    const rows33 = Array.from({ length: 33 }, (_, i) => row(i + 1));
    const detached32 = json(
      { items: Array.from({ length: 32 }, (_, i) => detachedRow(i + 1)) },
      200,
      '"10"',
    );
    const page = mountPage(
      { [UPDATE]: [detached32], [ENTRY]: [held.reply] },
      { instances: rows33 },
    );
    const c = page.container;
    for (const n of rows33.map((_, i) => i + 1))
      await click(byLabel<HTMLInputElement>(c, `Select /main/row-${n}`));
    await click(buttonNamed(c, 'Detach selected'));
    await settle();
    expect(posts(page)).toBe(1);
    expect(buttonNamed(c, 'Detach selected').disabled).toBe(true);
    await click(buttonNamed(c, 'Detach selected'));
    expect(posts(page)).toBe(1);
    await answerHeld(held, entryDetail('10'));
    await settle();
    expectListRefetches(page, 1);
  });
});
