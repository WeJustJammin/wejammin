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
  expectPendingLabel,
} from './composition-command-states.test-support';
import {
  ENTRY,
  PLACE,
  entryDetail,
  json,
  mountPage,
  refusal,
  settle,
} from './composition-page.test-support';
import { entryFacts, row, selectorItem } from './composition.test-support';

/*
 * P2-S12-AC-271, `commandState` of FE03 "Slice 12 definition governance states", for CMS-03C-02 (place a pattern) on the
 * composition page. The real island runs over a scripted wire; a refusal is the BE03c catalog answer.
 */
beforeAll(enableReactAct);
afterAll(disableReactAct);

const hero = selectorItem('hero-block', 2);
const fill = async (container: HTMLElement) => {
  await choose(pattern(container), hero.patternVersionId);
  await click(byLabel<HTMLInputElement>(container, /^Linked/u));
  await typeInto(byLabel<HTMLInputElement>(container, 'Slot path'), '/main');
};
const overrides = (container: HTMLElement) =>
  byLabel<HTMLTextAreaElement>(container, 'Overrides (JSON, optional)');
const place = (container: HTMLElement) =>
  buttonNamed(container, 'Place pattern');
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
const send = async (container: HTMLElement) => {
  await fill(container);
  await click(place(container));
  await settle();
};

describe('CmsPatternInsertForm (CMS-03C-02 place) commandState', () => {
  it('[P2-S12-AC-271] commandState idle: a form with an unsent draft keeps it, sends nothing and stores nothing', async () => {
    const page = mountPage({ [PLACE]: [placed()] });
    expect(resultRegion(page.container)).toBeNull();
    await fill(page.container);
    await typeInto(overrides(page.container), '{"/hero": {"title": "mine"}}');
    expect(page.calls).toHaveLength(0);
    expect(resultRegion(page.container)).toBeNull();
    expect(place(page.container).disabled).toBe(false);
    expect(overrides(page.container).value).toBe(
      '{"/hero": {"title": "mine"}}',
    );
    expect(pattern(page.container).value).toBe(hero.patternVersionId);
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it('[P2-S12-AC-271] commandState loading: a stable pending label and only the commit control disabled, a second press sends nothing; the fields stay editable', async () => {
    const held = heldReply();
    const page = mountPage({ [PLACE]: [held.reply] });
    await send(page.container);
    expect(page.calls).toHaveLength(1);
    expectPendingLabel(page.container, 'Placing the pattern…');
    expect(place(page.container).disabled).toBe(true);
    expect(place(page.container).textContent).toBe('Place pattern');
    // FE03 1048: only the commit control is disabled; every field stays editable.
    expect(
      Array.from(
        page.container.querySelectorAll<HTMLElement>(
          '.cms-insert select, .cms-insert input, .cms-insert textarea, .cms-insert button',
        ),
      )
        .filter(
          (control) =>
            control.matches(':disabled') &&
            control.textContent !== 'Place pattern',
        )
        .map((control) => control.id || control.textContent),
    ).toEqual([]);
    await click(place(page.container));
    expect(page.calls).toHaveLength(1);
    await answerHeld(held, placed());
    await settle();
    expect(resultHeading(page.container)).toBe('Pattern placed');
  });

  it('[P2-S12-AC-271] commandState success (kept half): the named resource, the draft cleared and the next command at the committed version; no refetch of the entry or list is made (C5)', async () => {
    const page = mountPage({ [PLACE]: [placed()] });
    await fill(page.container);
    await typeInto(overrides(page.container), '{"/hero": {"title": "mine"}}');
    await click(place(page.container));
    await settle();
    expect(resultHeading(page.container)).toBe('Pattern placed');
    expect(resultText(page.container)).toContain(
      'Placed 1 row pinned to hero-block version 2, linked.',
    );
    expect(
      page.container.querySelectorAll('ul.cms-instance-rows > li'),
    ).toHaveLength(1);
    // The draft (the chosen pattern and the overrides) is cleared; slot path and link mode are the form's defaults.
    expect(pattern(page.container).value).toBe('');
    expect(overrides(page.container).value).toBe('');
    expect(page.unexpected).toEqual([]);
  });

  it('[P2-S12-AC-271] commandState error: a 401 answer renders the session-ended copy (STEP_UP_REQUIRED does not apply: BE03c requires no recent MFA for CMS-03C-02)', async () => {
    const page = mountPage({
      [PLACE]: [refusal(401, 'UNAUTHENTICATED')],
    });
    await send(page.container);
    expect(resultHeading(page.container)).toBe('Pattern not placed');
    expect(resultText(page.container)).toContain(
      'Your session ended. Sign in again to continue.',
    );
    expect(pattern(page.container).value).toBe(hero.patternVersionId);
    expect(page.unexpected).toEqual([]);
  });

  it('[P2-S12-AC-271] commandState error: 403 renders the CapabilityGate with the fixed sentence in the result alert', async () => {
    const page = mountPage({
      [PLACE]: [refusal(403, 'COMPOSITION_FORBIDDEN')],
    });
    await send(page.container);
    expect(resultRegion(page.container)?.getAttribute('role')).toBe('alert');
    expect(resultText(page.container)).toContain(
      'This account cannot edit the composition of this entry.',
    );
    expect(
      resultRegion(page.container)?.querySelector(
        '[data-cms-editorial-capability-gate]',
      ),
    ).not.toBeNull();
    // FE03 "focus summary/field": the gate's heading is the focused named result.
    expect(document.activeElement).toBe(
      document.querySelector('[data-cms-editorial-capability-gate] h2'),
    );
    expect(page.container.querySelector('a[href*="step-up"]')).toBeNull();
  });

  it.each([
    [
      'revision_not_editable',
      "This entry's draft is no longer editable here. Your input is kept; reload the page to continue.",
    ],
    [
      null,
      'The entry changed since this page loaded. The page read its new version; check your input and place again.',
    ],
  ])(
    '[P2-S12-AC-271] commandState error: 409 %s renders fixed copy, refetches the entry and keeps the input',
    async (reasonCode, sentence) => {
      const page = mountPage({
        [PLACE]: [
          refusal(
            409,
            'COMPOSITION_VERSION_CONFLICT',
            reasonCode === null ? { currentVersion: '12' } : { reasonCode },
          ),
        ],
        [ENTRY]: [entryDetail('12')],
      });
      await send(page.container);
      expect(resultText(page.container)).toContain(sentence);
      expect(page.calls.filter((call) => call.method === 'GET')).toHaveLength(
        1,
      );
      expect(page.calls.at(-1)?.path).toContain('/api/v1/cms/entries/');
      expect(byLabel<HTMLInputElement>(page.container, 'Slot path').value).toBe(
        '/main',
      );
      expect(pattern(page.container).value).toBe(hero.patternVersionId);
    },
  );

  it.each([
    [
      'pattern_version_not_active',
      'This pattern version is no longer active. Choose another pattern; your input is kept.',
    ],
    [
      'pattern_incompatible',
      "This pattern is not compatible with this entry's content type. Choose another pattern.",
    ],
    [
      'block_registry_digest_mismatch',
      'The block registry changed since this pattern was listed. Reload the page and choose the pattern again.',
    ],
    [
      'block_rules_violated',
      'This pattern breaks the composition rules of one of its blocks, so it cannot be placed. Choose another pattern; your input is kept.',
    ],
  ])(
    '[P2-S12-AC-271] commandState error: 422 %s renders fixed copy and marks the pattern field',
    async (reasonCode, sentence) => {
      const page = mountPage({
        [PLACE]: [
          refusal(422, 'COMPOSITION_VALIDATION_FAILED', {
            reasonCode,
            violations: [{ path: '/patternVersion', code: 'invalid' }],
          }),
        ],
      });
      await send(page.container);
      expect(resultText(page.container)).toContain(sentence);
      expect(resultText(page.container)).not.toContain('composition operation');
      expect(pattern(page.container).getAttribute('aria-invalid')).toBe('true');
      expect(page.container.textContent).toContain(
        'The server did not accept this pattern. Choose it again.',
      );
    },
  );

  it('[P2-S12-AC-271] commandState degraded: an unknown outcome renders pending and reconciles by refetching the entry before any retry', async () => {
    const heldEntry = heldReply();
    const page = mountPage({
      [PLACE]: [
        refusal(502, 'DEPENDENCY_UNAVAILABLE', { retryable: true }),
        placed(),
      ],
      [ENTRY]: [heldEntry.reply],
    });
    await send(page.container);
    // Pending while the entry is being read: nothing is claimed and nothing can be sent.
    expectPendingLabel(page.container, 'Checking the entry before any retry…');
    expect(page.calls.at(-1)?.path).toContain('/api/v1/cms/entries/');
    expect(place(page.container).disabled).toBe(true);
    expect(page.calls.filter((call) => call.method === 'POST')).toHaveLength(1);
    await answerHeld(heldEntry, entryDetail('9'));
    await settle();
    expect(resultHeading(page.container)).toBe('Result not known');
    expect(resultText(page.container)).toContain(
      'The entry is still at version 9. Sending again retries the same request and cannot place twice.',
    );
    expect(resultText(page.container)).not.toContain('Pattern placed');
    await click(place(page.container));
    await settle();
    const keys = page.calls
      .filter((call) => call.method === 'POST')
      .map((call) => call.headers['idempotency-key']);
    expect(keys[1]).toBe(keys[0]);
    expect(resultHeading(page.container)).toBe('Pattern placed');
  });

  it('[P2-S12-AC-271] commandState disabled (kept half): an uneditable draft or a missing session withholds the commit control and the page says why; the island has no permittedNextActions input', async () => {
    const readOnly = mountPage(
      {},
      { entry: { ...entryFacts(), editable: false } },
    );
    expect(readOnly.container.textContent).toContain(
      "This entry's current revision is not an editable draft, so patterns cannot be inserted or updated here.",
    );
    expect(place(readOnly.container).disabled).toBe(true);
    await click(place(readOnly.container));
    expect(readOnly.calls).toHaveLength(0);
    readOnly.unmount();

    const signedOut = mountPage({}, { csrfToken: '' });
    expect(signedOut.container.textContent).toContain(
      'Your session token is missing, so patterns cannot be inserted or updated here. Sign in again to continue.',
    );
    expect(place(signedOut.container).disabled).toBe(true);
    await click(place(signedOut.container));
    expect(signedOut.calls).toHaveLength(0);
  });
});
