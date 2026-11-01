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
  resultRegion,
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
  propsPath,
  row,
  selectorItem,
} from './composition.test-support';
import { expectListRefetches } from './composition-refetch.test-support';

/**
 * [P2-S12-AC-271] FE03 1046 commandState loading with root's reading of DEC-241: while a command is in flight a
 * control that starts ANOTHER command (Review, Accept, Detach) stays disabled, inputs stay editable, and a value typed
 * during the command survives its completion (the late-edit rule).
 */
beforeAll(enableReactAct);
afterAll(disableReactAct);

const hero = selectorItem('hero-block', 2);
const side = selectorItem('side-note', 1);
const pending = (n: number) => row(n, { state: 'pending_diff', version: '3' });
const read = (value: ReturnType<typeof diffOf>) =>
  json(value, 200, `"${value.instance.version}"`);
const placed = () =>
  json(
    {
      items: [
        row(1, { path: '/main/hero1', patternVersion: 2, state: 'draft' }),
      ],
    },
    201,
    '"10"',
  );
const updated = () =>
  json(
    {
      items: [
        row(1, {
          version: '4',
          patternVersion: 2,
          linkMode: 'detached',
          state: 'active',
        }),
      ],
    },
    200,
    '"10"',
  );
const radio = (container: HTMLElement, path: string, value: string) =>
  container.querySelector<HTMLInputElement>(
    `input[name="choice-${path}"][value="${value}"]`,
  ) as HTMLInputElement;
const slot = (container: HTMLElement) =>
  byLabel<HTMLInputElement>(container, 'Slot path');
const overrides = (container: HTMLElement) =>
  byLabel<HTMLTextAreaElement>(container, 'Overrides (JSON, optional)');

describe('composition page: a command in flight', () => {
  it('[P2-S12-AC-271] commandState loading: Review stays disabled while an accept is in flight, a click reads no diff, the pending label holds and Review is enabled again after the answer', async () => {
    const held = heldReply();
    const diff1 = diffOf(1, [plainPath('/a')]);
    const diff2 = diffOf(2, [plainPath('/b')]);
    const page = mountPage(
      {
        [diffPath(id(1))]: [read(diff1)],
        [diffPath(id(2))]: [read(diff2)],
        [UPDATE]: [held.reply],
      },
      { instances: [pending(1), pending(2)] },
    );
    const c = page.container;
    await click(buttonNamed(c, 'Review update for /main/row-1'));
    await settle();
    await click(buttonNamed(c, 'Accept update'));
    await settle();
    expect(resultRegion(c)?.textContent).toBe('Accepting the update…');
    const reviewTwo = buttonNamed(c, 'Review update for /main/row-2');
    expect(reviewTwo.disabled).toBe(true);
    await click(reviewTwo);
    await settle();
    expect(resultRegion(c)?.textContent).toBe('Accepting the update…');
    expect(
      page.calls.filter(
        (call) => `${call.method} ${call.path}` === diffPath(id(2)),
      ),
    ).toEqual([]);
    await answerHeld(held, updated());
    await settle();
    expect(resultRegion(c)?.textContent).toContain('Update applied');
    expect(buttonNamed(c, 'Review update for /main/row-2').disabled).toBe(
      false,
    );
    expectListRefetches(page, 1);
  });

  it('[P2-S12-AC-271] commandState loading: insert fields edited after dispatch survive the placement answer', async () => {
    const held = heldReply();
    const page = mountPage({ [PLACE]: [held.reply] });
    const c = page.container;
    await choose(pattern(c), hero.patternVersionId);
    await click(byLabel<HTMLInputElement>(c, /^Linked/u));
    await typeInto(slot(c), '/main');
    await click(buttonNamed(c, 'Place pattern'));
    await settle();
    expect(resultRegion(c)?.textContent).toBe('Placing the pattern…');
    await typeInto(slot(c), '/late-slot');
    await choose(pattern(c), side.patternVersionId);
    await typeInto(overrides(c), '{"/x": {"a": 1}}');
    await answerHeld(held, placed());
    await settle();
    expect({
      slot: slot(c).value,
      pattern: pattern(c).value,
      overrides: overrides(c).value,
    }).toEqual({
      slot: '/late-slot',
      pattern: side.patternVersionId,
      overrides: '{"/x": {"a": 1}}',
    });
    expectListRefetches(page, 1);
  });

  it('[P2-S12-AC-271] commandState loading: fields that were not edited after dispatch are still cleared by a verified placement', async () => {
    const held = heldReply();
    const page = mountPage({ [PLACE]: [held.reply] });
    const c = page.container;
    await choose(pattern(c), hero.patternVersionId);
    await click(byLabel<HTMLInputElement>(c, /^Linked/u));
    await typeInto(slot(c), '/main');
    await typeInto(overrides(c), '{"/x": {"a": 1}}');
    await click(buttonNamed(c, 'Place pattern'));
    await settle();
    await answerHeld(held, placed());
    await settle();
    expect(pattern(c).value).toBe('');
    expect(overrides(c).value).toBe('');
    expect(slot(c).value).toBe('/main');
    expectListRefetches(page, 1);
  });

  it('[P2-S12-AC-271] commandState loading: an answer changed while the accept is in flight is the one kept when the accept is refused 409 and the diff reloaded', async () => {
    const held = heldReply();
    const diff = diffOf(1, [propsPath('/a')]);
    const page = mountPage(
      {
        [diffPath(id(1))]: [read(diff), read(diff)],
        [UPDATE]: [held.reply],
        [ENTRY]: [entryDetail('11')],
      },
      { instances: [pending(1)] },
    );
    const c = page.container;
    await click(buttonNamed(c, 'Review update for /main/row-1'));
    await settle();
    await click(radio(c, '/a', 'yours'));
    await click(buttonNamed(c, 'Accept update'));
    await settle();
    await click(radio(c, '/a', 'theirs'));
    await answerHeld(
      held,
      refusal(409, 'COMPOSITION_VERSION_CONFLICT', { currentVersion: '11' }),
    );
    await settle();
    expect({
      yours: radio(c, '/a', 'yours').checked,
      theirs: radio(c, '/a', 'theirs').checked,
    }).toEqual({ yours: false, theirs: true });
    expectListRefetches(page, 1);
  });
});

const withRoots = diffOf(1, [plainPath('/a')], {
  targetPatternVersion: 3,
  newRoots: [
    { rootPath: '/extra', blockKey: 'profile.header', blockVersion: 1 },
  ],
});

describe('composition page: placing the blocks a newer version adds (DEC-193)', () => {
  const placeRoots = async (
    reply: Response,
    more: Record<string, Response[]> = {},
  ) => {
    const page = mountPage(
      {
        [diffPath(id(1))]: [read(withRoots), read(withRoots)],
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

  it('[P2-S12-AC-271] commandState error: a 403 on placing new blocks renders the CapabilityGate in the result alert', async () => {
    const page = await placeRoots(refusal(403, 'COMPOSITION_FORBIDDEN'));
    const c = page.container;
    expect(resultRegion(c)?.getAttribute('role')).toBe('alert');
    expect(
      resultRegion(c)?.querySelector('[data-cms-editorial-capability-gate]'),
    ).not.toBeNull();
    expect(resultRegion(c)?.textContent).toContain('Blocks not placed');
    expect(page.container.querySelector('a[href*="step-up"]')).toBeNull();
  });

  it('[P2-S12-AC-271] commandState error: a 409 on placing new blocks refreshes the entry and reloads the diff before saying so', async () => {
    const page = await placeRoots(
      refusal(409, 'COMPOSITION_VERSION_CONFLICT', { currentVersion: '11' }),
      { [ENTRY]: [entryDetail('11')] },
    );
    const c = page.container;
    expect(
      page.calls.filter((call) => `${call.method} ${call.path}` === ENTRY),
    ).toHaveLength(1);
    expect(
      page.calls.filter(
        (call) => `${call.method} ${call.path}` === diffPath(id(1)),
      ),
    ).toHaveLength(2);
    expect(resultRegion(c)?.textContent).toContain('Blocks not placed');
    expectListRefetches(page, 1);
  });

  it('[P2-S12-AC-271] commandState degraded: an unknown outcome on placing new blocks says so without claiming a result', async () => {
    const page = await placeRoots(refusal(502, 'DEPENDENCY_UNAVAILABLE'));
    expect(resultRegion(page.container)?.textContent).toContain(
      'Result not known',
    );
  });
});
