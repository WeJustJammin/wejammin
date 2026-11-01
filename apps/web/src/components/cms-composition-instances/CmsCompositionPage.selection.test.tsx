// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buttonNamed,
  click,
  disableReactAct,
  enableReactAct,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import {
  answerHeld,
  heldReply,
} from './composition-command-states.test-support';
import {
  UPDATE,
  json,
  mountPage,
  settle,
} from './composition-page.test-support';
import { id, row } from './composition.test-support';
import { expectListRefetches } from './composition-refetch.test-support';

/*
 * [P2-S12-AC-271] commandState loading and success (FE03 1048; V17 N1, DEC-241 extended): the row selection is an input,
 * so it stays editable while a command runs, and a row ticked meanwhile survives the command's completion; only the
 * instances the command applied leave the selection.
 */
beforeAll(enableReactAct);
afterAll(disableReactAct);

const detachedRows = (numbers: readonly number[]) =>
  json(
    {
      items: numbers.map((n) =>
        row(n, { version: '4', linkMode: 'detached', state: 'active' }),
      ),
    },
    200,
    '"10"',
  );
const selectedCount = (container: HTMLElement): string =>
  container.querySelector('.cms-instances .cms-composition-actions span')
    ?.textContent ?? '';
const check = (container: HTMLElement, n: number): HTMLInputElement =>
  container.querySelector<HTMLInputElement>(
    `#cms-instance-${id(n)}-select`,
  ) as HTMLInputElement;

describe('composition page: a row ticked while a command runs', () => {
  it('[P2-S12-AC-271] commandState success: a row ticked while a single detach is in flight stays selected when the detach completes', async () => {
    const held = heldReply();
    const page = mountPage(
      { [UPDATE]: [held.reply] },
      { instances: [row(1), row(2)] },
    );
    const c = page.container;
    await click(check(c, 1));
    await click(buttonNamed(c, 'Detach /main/row-1'));
    await settle();
    expect(check(c, 2).disabled).toBe(false);
    await click(check(c, 2));
    expect(selectedCount(c)).toBe('2 selected');
    await answerHeld(held, detachedRows([1]));
    await settle();
    expect(check(c, 1).checked).toBe(false);
    expect(check(c, 2).checked).toBe(true);
    expect(selectedCount(c)).toBe('1 selected');
    expectListRefetches(page, 1);
  });

  it('[P2-S12-AC-271] commandState success: a row ticked while a bulk detach is in flight stays selected when it completes, and the applied rows leave the selection', async () => {
    const held = heldReply();
    const page = mountPage(
      { [UPDATE]: [held.reply] },
      { instances: [row(1), row(2), row(3)] },
    );
    const c = page.container;
    await click(check(c, 1));
    await click(check(c, 2));
    await click(buttonNamed(c, 'Detach selected'));
    await settle();
    await click(check(c, 3));
    expect(selectedCount(c)).toBe('3 selected');
    await answerHeld(held, detachedRows([1, 2]));
    await settle();
    expect(check(c, 1).checked).toBe(false);
    expect(check(c, 2).checked).toBe(false);
    expect(check(c, 3).checked).toBe(true);
    expect(selectedCount(c)).toBe('1 selected');
    expectListRefetches(page, 1);
  });
});
