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
  resultHeading,
  resultRegion,
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
  diffOf,
  id,
  plainPath,
  row,
  selectorItem,
} from './composition.test-support';
import { expectListRefetches } from './composition-refetch.test-support';

/*
 * [P2-S12-AC-271] commandState degraded (FE03 1050, DEC-245(4)): an unknown outcome whose reconciling read could not
 * verify offers NO retry, for every composition command, until a read does verify: the commands stay disabled, "Check
 * again" reads the entry once more (it stays mounted and focused while it reads), and the outcome is announced.
 */
beforeAll(enableReactAct);
afterAll(disableReactAct);

const unknown = () =>
  refusal(502, 'DEPENDENCY_UNAVAILABLE', { retryable: true });
const unreadable = () => refusal(503, 'DEPENDENCY_UNAVAILABLE');
const hero = selectorItem('hero-block', 2);
const pending = (n: number) => row(n, { state: 'pending_diff', version: '3' });
const clean = (n: number) => json(diffOf(n, [plainPath()]), 200, '"3"');
const detachedRow = (n: number) =>
  row(n, { version: '4', linkMode: 'detached', state: 'active' });
const posts = (page: ReturnType<typeof mountPage>) =>
  page.calls.filter((call) => call.method === 'POST');
const CHECK = 'Check again';

/** The shared story: the unreadable entry holds the retry; Check again verifies and releases it. */
const holdThenRelease = async (
  page: ReturnType<typeof mountPage>,
  command: string,
  held: ReturnType<typeof heldReply>,
  heading = 'Result not known',
) => {
  const c = page.container;
  expect(resultHeading(c)).toBe(heading);
  expect(resultText(c)).toContain('The entry could not be read to check');
  expect(buttonNamed(c, command).disabled).toBe(true);
  await click(buttonNamed(c, command));
  expect(posts(page)).toHaveLength(1);
  const check = buttonNamed(c, CHECK);
  check.focus();
  await click(check);
  await settle();
  // The read is in flight: the control stays mounted, focused and disabled; the command stays off.
  expect(buttonNamed(c, CHECK)).toBe(check);
  expect(document.activeElement).toBe(check);
  expect(check.getAttribute('aria-disabled')).toBe('true');
  expect(buttonNamed(c, command).disabled).toBe(true);
  await answerHeld(held, unreadable());
  await settle();
  // Still unverified: same control, same focus, command still off.
  expect(buttonNamed(c, CHECK)).toBe(check);
  expect(document.activeElement).toBe(check);
  expect(check.getAttribute('aria-disabled')).not.toBe('true');
  expect(buttonNamed(c, command).disabled).toBe(true);
  expect(posts(page)).toHaveLength(1);
  await click(check);
  await settle();
  // Verified: the retry is offered and the outcome is announced at the result heading.
  expect(() => buttonNamed(c, CHECK)).toThrow();
  expect(resultText(c)).toContain('The entry is still at version 9.');
  expect(document.activeElement?.id).toBe('cms-composition-result-heading');
  expect(buttonNamed(c, command).disabled).toBe(false);
};

describe('composition commands hold the retry until a read verifies', () => {
  it('[P2-S12-AC-271] commandState degraded: a placement whose entry cannot be read offers no retry until Check again verifies', async () => {
    const held = heldReply();
    const page = mountPage({
      [PLACE]: [unknown(), json({ items: [] }, 201, '"10"')],
      [ENTRY]: [unreadable(), held.reply, entryDetail('9')],
    });
    const c = page.container;
    await choose(pattern(c), hero.patternVersionId);
    await click(byLabel<HTMLInputElement>(c, /^Linked/u));
    await typeInto(byLabel<HTMLInputElement>(c, 'Slot path'), '/main');
    await click(buttonNamed(c, 'Place pattern'));
    await settle();
    await holdThenRelease(page, 'Place pattern', held);
    expectListRefetches(page, 1);
  });

  it('[P2-S12-AC-271] commandState degraded: a detach whose entry cannot be read offers no retry until Check again verifies', async () => {
    const held = heldReply();
    const page = mountPage(
      {
        [UPDATE]: [unknown()],
        [ENTRY]: [unreadable(), held.reply, entryDetail('9')],
      },
      { instances: [row(1)] },
    );
    await click(buttonNamed(page.container, 'Detach /main/row-1'));
    await settle();
    await holdThenRelease(page, 'Detach /main/row-1', held);
    expectListRefetches(page, 1);
  });

  it('[P2-S12-AC-271] commandState degraded: an accept whose entry cannot be read offers no retry until Check again verifies', async () => {
    const held = heldReply();
    const page = mountPage(
      {
        [diffPath(id(1))]: [clean(1)],
        [UPDATE]: [unknown()],
        [ENTRY]: [unreadable(), held.reply, entryDetail('9')],
      },
      { instances: [pending(1)] },
    );
    const c = page.container;
    await click(buttonNamed(c, 'Review update for /main/row-1'));
    await settle();
    await click(buttonNamed(c, 'Accept update'));
    await settle();
    await holdThenRelease(page, 'Accept update', held);
    expectListRefetches(page, 1);
  });

  it('[P2-S12-AC-271] commandState degraded: new blocks whose entry cannot be read offer no retry until Check again verifies', async () => {
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
        [ENTRY]: [unreadable(), held.reply, entryDetail('9')],
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
    await holdThenRelease(page, 'Place selected blocks', held);
    expectListRefetches(page, 1);
  });

  it('[P2-S12-AC-271] commandState degraded: a bulk request whose entry cannot be read offers no retry until Check again verifies, and the progress stays stated', async () => {
    const held = heldReply();
    const page = mountPage(
      {
        [diffPath(id(1))]: [clean(1)],
        [diffPath(id(2))]: [clean(2)],
        [UPDATE]: [unknown()],
        [ENTRY]: [unreadable(), held.reply, entryDetail('9')],
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
    await holdThenRelease(
      page,
      'Accept all selected updates',
      held,
      'Updates stopped',
    );
    expect(resultText(c)).toContain('0 of 1 requests applied.');
    expectListRefetches(page, 1);
  });

  it('[P2-S12-AC-271] commandState degraded: after Check again verifies, the retry replays the same request under the same key', async () => {
    const page = mountPage(
      {
        [UPDATE]: [unknown(), json({ items: [detachedRow(1)] }, 200, '"10"')],
        [ENTRY]: [unreadable(), entryDetail('9')],
      },
      { instances: [row(1)] },
    );
    const c = page.container;
    await click(buttonNamed(c, 'Detach /main/row-1'));
    await settle();
    await click(buttonNamed(c, CHECK));
    await settle();
    await click(buttonNamed(c, 'Detach /main/row-1'));
    await settle();
    const sent = posts(page);
    expect(sent).toHaveLength(2);
    expect(sent[1]?.headers['idempotency-key']).toBe(
      sent[0]?.headers['idempotency-key'],
    );
    expect(sent[1]?.body).toEqual(sent[0]?.body);
    expectListRefetches(page, 2);
  });
});

describe('a repeated failed check is heard (V20 m5, DEC-246 ruling 3)', () => {
  it('[P2-S12-AC-271] commandState degraded: each failed Check again says a sentence that differs from the one before, and the live region is written', async () => {
    const page = mountPage(
      {
        [UPDATE]: [unknown()],
        [ENTRY]: [unreadable(), unreadable(), unreadable()],
      },
      { instances: [row(1)] },
    );
    const c = page.container;
    await click(buttonNamed(c, 'Detach /main/row-1'));
    await settle();
    const sentences = [resultText(c)];
    const written: string[] = [];
    const observer = new MutationObserver((records) => {
      for (const record of records)
        if (record.type !== 'attributes') written.push(record.type);
    });
    observer.observe(resultRegion(c) as HTMLElement, {
      subtree: true,
      childList: true,
      characterData: true,
    });
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      written.length = 0;
      await click(buttonNamed(c, CHECK));
      await settle();
      await Promise.resolve();
      sentences.push(resultText(c));
      expect(written.length).toBeGreaterThan(0);
    }
    observer.disconnect();
    expect(new Set(sentences).size).toBe(3);
    for (const sentence of sentences)
      expect(sentence).toContain('The entry could not be read to check');
    expect(buttonNamed(c, 'Detach /main/row-1').disabled).toBe(true);
  });
});
