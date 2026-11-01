// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buttonNamed,
  byLabel,
  choose,
  click,
  disableReactAct,
  enableReactAct,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import {
  SELECTOR,
  json,
  mountPage,
  noStrayRequests,
  refusal,
  settle,
} from './composition-page.test-support';
import { selectorItem, selectorPage } from './composition.test-support';

/*
 * FE03 1048 (Slice 12 definition governance states) and BE03c 1414 (CMS-03C-13: cursor/context mismatch is a 409): a
 * 409 cursor conflict restarts from the first page; P2-S12-AC-110. The cursor lives in component state only, so the
 * restart drops it, reads page one again, says so, and keeps a choice that is still listed.
 */
beforeAll(enableReactAct);
afterAll(disableReactAct);

const hero = selectorItem('hero-block', 2);
const side = selectorItem('side-note', 1);
const zebra = selectorItem('zebra', 1);
const optionsOf = (container: HTMLElement): (string | null)[] =>
  Array.from(byLabel<HTMLSelectElement>(container, 'Pattern').options).map(
    (option) => option.textContent,
  );
const conflict = () => refusal(409, 'COMPOSITION_VERSION_CONFLICT');
const RESTART_NOTE =
  'The list of patterns changed while you were loading it, so it restarted from the first page.';

describe('the pattern selector after a cursor conflict', () => {
  it('drops the cursor, reads the first page again, replaces the list and says so', async () => {
    const page = mountPage(
      {
        [SELECTOR]: [
          conflict(),
          json(selectorPage([hero, zebra], 'cursor-2'), 200, '"7"'),
        ],
      },
      { selector: selectorPage([hero, side], 'cursor-1') },
    );
    await click(buttonNamed(page.container, 'Load more patterns'));
    await settle();
    expect(page.calls).toHaveLength(2);
    expect(page.calls[0]?.search).toContain('cursor=cursor-1');
    expect(page.calls[1]?.search).not.toContain('cursor=');
    expect(optionsOf(page.container)).toEqual([
      'Choose a pattern',
      'hero-block version 2 (3 nodes)',
      'zebra version 1 (3 nodes)',
    ]);
    expect(page.container.textContent).toContain(RESTART_NOTE);
    expect(page.container.querySelector('[role="alert"]')).toBeNull();
    // The new first page has its own cursor: the next press continues from it.
    expect(buttonNamed(page.container, 'Load more patterns').disabled).toBe(
      false,
    );
    noStrayRequests(page.unexpected);
  });

  it('keeps a choice that the first page still lists', async () => {
    const page = mountPage(
      {
        [SELECTOR]: [conflict(), json(selectorPage([hero, zebra], null))],
      },
      { selector: selectorPage([hero, side], 'cursor-1') },
    );
    await choose(
      byLabel<HTMLSelectElement>(page.container, 'Pattern'),
      hero.patternVersionId,
    );
    await click(buttonNamed(page.container, 'Load more patterns'));
    await settle();
    expect(byLabel<HTMLSelectElement>(page.container, 'Pattern').value).toBe(
      hero.patternVersionId,
    );
  });

  it('clears a choice the first page no longer lists, so a stale pin is never sent', async () => {
    const page = mountPage(
      {
        [SELECTOR]: [conflict(), json(selectorPage([hero, zebra], null))],
      },
      { selector: selectorPage([hero, side], 'cursor-1') },
    );
    await choose(
      byLabel<HTMLSelectElement>(page.container, 'Pattern'),
      side.patternVersionId,
    );
    await click(buttonNamed(page.container, 'Load more patterns'));
    await settle();
    expect(byLabel<HTMLSelectElement>(page.container, 'Pattern').value).toBe(
      '',
    );
    expect(page.container.textContent).toContain(RESTART_NOTE);
    expect(page.container.textContent).toContain('Choose the pattern again.');
  });

  it('names a restart read that fails and keeps the patterns already listed', async () => {
    const page = mountPage(
      { [SELECTOR]: [conflict(), refusal(503, 'DEPENDENCY_UNAVAILABLE')] },
      { selector: selectorPage([hero, side], 'cursor-1') },
    );
    await click(buttonNamed(page.container, 'Load more patterns'));
    await settle();
    expect(optionsOf(page.container)).toContain(
      'side-note version 1 (3 nodes)',
    );
    expect(page.container.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('restarts only once per press: a second conflict on the first page is a plain failure', async () => {
    const page = mountPage(
      { [SELECTOR]: [conflict(), conflict()] },
      { selector: selectorPage([hero, side], 'cursor-1') },
    );
    await click(buttonNamed(page.container, 'Load more patterns'));
    await settle();
    expect(page.calls).toHaveLength(2);
    expect(page.container.querySelector('[role="alert"]')).not.toBeNull();
  });
});
