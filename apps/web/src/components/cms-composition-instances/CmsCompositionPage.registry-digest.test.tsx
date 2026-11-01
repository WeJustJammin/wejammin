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
  entryDetail,
  json,
  mountPage,
  noListReads,
  refusal,
  settle,
} from './composition-page.test-support';
import {
  CONTENT_TYPE_ID,
  row,
  selectorItem,
  selectorPage,
} from './composition.test-support';
import { expectListRefetches } from './composition-refetch.test-support';

/*
 * [P2-S12-AC-271] commandState error (FE03 1049, DEC-246 ruling 5, review V20 m9): the placement sends the digest the
 * pattern selector listed; a well-formed digest the server no longer holds is a 409 `block_registry_digest_mismatch`
 * (BE03c 388, DEC-186). The island reads the selector's first page again, like the template and pattern designers read
 * their block choices (DEC-245(1)), so the next placement carries the current digest, and keeps what was typed.
 */
beforeAll(enableReactAct);
afterAll(disableReactAct);

const STALE = 'a'.repeat(64);
const FRESH = 'd'.repeat(64);
const hero = selectorItem('hero-block', 2);
const freshHero = selectorItem('hero-block', 2, { blockRegistryDigest: FRESH });
const side = selectorItem('side-note', 1);
const mismatch = (status = 409) =>
  refusal(
    status,
    status === 409
      ? 'COMPOSITION_VERSION_CONFLICT'
      : 'COMPOSITION_VALIDATION_FAILED',
    { reasonCode: 'block_registry_digest_mismatch' },
  );
const placed = () =>
  json(
    {
      items: [
        row(1, { path: '/main/hero1', patternVersion: 2, state: 'draft' }),
      ],
    },
    201,
    '"13"',
  );
const selectorCalls = (page: ReturnType<typeof mountPage>) =>
  page.calls.filter((call) => call.path === '/api/v1/cms/patterns/selector');
const place = async (page: ReturnType<typeof mountPage>) => {
  const c = page.container;
  await choose(pattern(c), hero.patternVersionId);
  await click(byLabel<HTMLInputElement>(c, /^Linked/u));
  await typeInto(byLabel<HTMLInputElement>(c, 'Slot path'), '/main');
  await typeInto(
    byLabel<HTMLTextAreaElement>(c, 'Overrides (JSON, optional)'),
    '{"/hero": {"title": "mine"}}',
  );
  await click(buttonNamed(c, 'Place pattern'));
  await settle();
};
const mount = (script: Parameters<typeof mountPage>[0]) =>
  mountPage(script, {
    selector: selectorPage([
      selectorItem('hero-block', 2, { blockRegistryDigest: STALE }),
      side,
    ]),
  });

describe('a placement refused for a changed block registry', () => {
  it('[P2-S12-AC-271] commandState error: a 409 digest refusal reads the selector again, keeps the typed values and sends the current digest next', async () => {
    const page = mount({
      [PLACE]: [mismatch(), placed()],
      [ENTRY]: [entryDetail('12')],
      [SELECTOR]: [json(selectorPage([freshHero, side]), 200, '"8"')],
    });
    await place(page);
    const c = page.container;
    expect(selectorCalls(page)).toHaveLength(1);
    expect(selectorCalls(page)[0]?.search).toBe(
      `?contentTypeId=${CONTENT_TYPE_ID}&limit=25`,
    );
    expect(resultText(c)).toContain('read again');
    expect(resultText(c)).not.toContain('Reload');
    expect(byLabel<HTMLInputElement>(c, 'Slot path').value).toBe('/main');
    expect(
      byLabel<HTMLTextAreaElement>(c, 'Overrides (JSON, optional)').value,
    ).toBe('{"/hero": {"title": "mine"}}');
    expect(pattern(c).value).toBe(hero.patternVersionId);
    await click(buttonNamed(c, 'Place pattern'));
    await settle();
    const posts = page.calls.filter((call) => call.method === 'POST');
    expect(posts).toHaveLength(2);
    expect(posts[1]?.body).toMatchObject({
      blockRegistryDigest: FRESH,
      expectedVersion: '12',
    });
    expect(posts[0]?.body).toMatchObject({ blockRegistryDigest: STALE });
    expectListRefetches(page, 2);
  });

  it('[P2-S12-AC-271] commandState error: a pattern the first page no longer lists is cleared, said, and the rest of the input is kept', async () => {
    const page = mount({
      [PLACE]: [mismatch()],
      [ENTRY]: [entryDetail('12')],
      [SELECTOR]: [json(selectorPage([side]), 200, '"8"')],
    });
    await place(page);
    const c = page.container;
    expect(pattern(c).value).toBe('');
    expect(resultText(c)).toContain('no longer');
    expect(resultText(c)).toContain('choose another pattern');
    expect(byLabel<HTMLInputElement>(c, 'Slot path').value).toBe('/main');
    expect(page.calls.filter((call) => call.method === 'POST')).toHaveLength(1);
    expectListRefetches(page, 1);
  });

  it('[P2-S12-AC-271] selectorState degraded: a selector that cannot be read again keeps the input, holds the placement and offers to read the patterns again', async () => {
    const page = mount({
      [PLACE]: [mismatch(), placed()],
      [ENTRY]: [entryDetail('12')],
      [SELECTOR]: [
        refusal(503, 'DEPENDENCY_UNAVAILABLE'),
        json(selectorPage([freshHero, side]), 200, '"8"'),
      ],
    });
    await place(page);
    const c = page.container;
    expect(resultText(c)).toContain('could not be read again');
    expect(resultText(c)).not.toContain('was read again');
    expect(c.textContent).toContain('The pattern list could not be read');
    expect(byLabel<HTMLInputElement>(c, 'Slot path').value).toBe('/main');
    expect(pattern(c).value).toBe(hero.patternVersionId);
    expect(buttonNamed(c, 'Place pattern').disabled).toBe(true);
    await click(buttonNamed(c, 'Place pattern'));
    expect(page.calls.filter((call) => call.method === 'POST')).toHaveLength(1);
    await click(buttonNamed(c, 'Read the patterns again'));
    await settle();
    expect(selectorCalls(page)).toHaveLength(2);
    expect(selectorCalls(page)[1]?.search).toBe(
      `?contentTypeId=${CONTENT_TYPE_ID}&limit=25`,
    );
    expect(resultText(c)).toContain('was read again');
    expect(() => buttonNamed(c, 'Read the patterns again')).toThrow();
    expect(buttonNamed(c, 'Place pattern').disabled).toBe(false);
    await click(buttonNamed(c, 'Place pattern'));
    await settle();
    expect(
      page.calls.filter((call) => call.method === 'POST')[1]?.body,
    ).toMatchObject({ blockRegistryDigest: FRESH });
    expectListRefetches(page, 2);
  });

  it('[P2-S12-AC-271] commandState error: a digest refusal answered 422 reads the selector but no entry or list', async () => {
    const page = mount({
      [PLACE]: [mismatch(422)],
      [SELECTOR]: [json(selectorPage([freshHero, side]), 200, '"8"')],
    });
    await place(page);
    expect(selectorCalls(page)).toHaveLength(1);
    expect(page.calls.some((call) => call.path.includes(ENTRY.slice(4)))).toBe(
      false,
    );
    noListReads(page);
    expect(resultText(page.container)).toContain('read again');
  });

  it('[P2-S12-AC-271] commandState error: a plain 409 version conflict does not read the selector', async () => {
    const page = mount({
      [PLACE]: [refusal(409, 'COMPOSITION_VERSION_CONFLICT', {})],
      [ENTRY]: [entryDetail('12')],
    });
    await place(page);
    expect(selectorCalls(page)).toHaveLength(0);
    expectListRefetches(page, 1);
    expect(page.unexpected).toEqual([]);
  });

  it('[P2-S12-AC-271] selectorState degraded: a Read the patterns again that fails again keeps the placement off and the earlier sentence; a choice cleared meanwhile is read as no choice', async () => {
    const page = mount({
      [PLACE]: [mismatch()],
      [ENTRY]: [entryDetail('12')],
      [SELECTOR]: [
        refusal(503, 'DEPENDENCY_UNAVAILABLE'),
        refusal(503, 'DEPENDENCY_UNAVAILABLE'),
        json(selectorPage([freshHero, side]), 200, '"8"'),
      ],
    });
    await place(page);
    const c = page.container;
    const sentence = resultText(c);
    await click(buttonNamed(c, 'Read the patterns again'));
    await settle();
    expect(selectorCalls(page)).toHaveLength(2);
    expect(buttonNamed(c, 'Place pattern').disabled).toBe(true);
    expect(resultText(c)).toBe(sentence);
    // The author clears the pattern; the list is then read without a choice to carry over.
    await choose(pattern(c), '');
    await click(buttonNamed(c, 'Read the patterns again'));
    await settle();
    expect(selectorCalls(page)).toHaveLength(3);
    expect(() => buttonNamed(c, 'Read the patterns again')).toThrow();
    expect(pattern(c).value).toBe('');
    expect(pattern(c).options).toHaveLength(3);
    expect(resultText(c)).toContain('was read again');
    expectListRefetches(page, 1);
  });

  it('[P2-S12-AC-271] commandState error: a page that goes away while the selector is read again changes nothing and asks for nothing more', async () => {
    const held = heldReply();
    const page = mount({
      [PLACE]: [mismatch()],
      [ENTRY]: [entryDetail('12')],
      [SELECTOR]: [held.reply],
    });
    await place(page);
    page.unmount();
    await answerHeld(held, json(selectorPage([freshHero, side]), 200, '"8"'));
    await settle();
    expect(selectorCalls(page)).toHaveLength(1);
    expect(page.calls.filter((call) => call.method === 'POST')).toHaveLength(1);
    expectListRefetches(page, 1);
  });
});
