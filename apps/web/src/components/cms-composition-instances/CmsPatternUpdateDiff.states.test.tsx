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
  expectPendingLabel,
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
  entryFacts,
  id,
  plainPath,
  propsPath,
  removedPath,
  row,
  structurePath,
} from './composition.test-support';
import { UNKNOWN_OUTCOME_MESSAGE } from './composition-copy';

/*
 * P2-S12-AC-271, `commandState` of FE03 "Slice 12 definition governance states", for CMS-03C-15 on one instance
 * (accept, detach) and for the DEC-193 Place of the blocks a newer version adds (CMS-03C-02 `roots`), driven through the
 * update diff of the composition page over a scripted wire.
 */
beforeAll(enableReactAct);
afterAll(disableReactAct);

const pending = (n: number) => row(n, { state: 'pending_diff', version: '3' });
const diff = diffOf(1, [
  propsPath('/a'),
  removedPath('/b'),
  structurePath('/c'),
]);
const withRoots = diffOf(1, [plainPath('/a')], {
  targetPatternVersion: 3,
  newRoots: [
    { rootPath: '/extra', blockKey: 'profile.header', blockVersion: 1 },
  ],
});
const read = (value = diff) => json(value, 200, `"${value.instance.version}"`);
const updated = (version = '10', rowVersion = '4') =>
  json(
    {
      items: [
        row(1, {
          version: rowVersion,
          patternVersion: 2,
          linkMode: 'detached',
          state: 'active',
        }),
      ],
    },
    200,
    `"${version}"`,
  );
const updatedLinked = (version: string) =>
  json(
    { items: [row(1, { version: '4', patternVersion: 2, state: 'active' })] },
    200,
    `"${version}"`,
  );
const radio = (container: HTMLElement, path: string, value: string) =>
  container.querySelector<HTMLInputElement>(
    `input[name="choice-${path}"][value="${value}"]`,
  ) as HTMLInputElement;
const accept = (container: HTMLElement) =>
  buttonNamed(container, 'Accept update');
const detach = (container: HTMLElement) =>
  buttonNamed(container, 'Detach as a local copy');
const open = async (page: ReturnType<typeof mountPage>) => {
  await click(buttonNamed(page.container, 'Review update for /main/row-1'));
  await settle();
};
const answerAll = async (container: HTMLElement) => {
  await click(radio(container, '/a', 'yours'));
  await click(radio(container, '/b', 'theirs'));
  await click(radio(container, '/c', 'yours'));
};
const accepting = async (page: ReturnType<typeof mountPage>) => {
  await open(page);
  await answerAll(page.container);
  await click(accept(page.container));
  await settle();
};
const script = (update: Array<Response | (() => Response)>, more = {}) => ({
  [diffPath(id(1))]: [read(), read(), read()],
  [UPDATE]: update,
  ...more,
});
const mount = (update: Array<Response | (() => Response)>, more = {}) =>
  mountPage(script(update, more), { instances: [pending(1)] });

describe('CmsPatternUpdateDiff (CMS-03C-15 accept, detach; DEC-193 Place) commandState', () => {
  it('[P2-S12-AC-271] commandState idle: no diff open until an instance is reviewed, then an unsent answer is kept and nothing is sent', async () => {
    const page = mount([updated()]);
    expect(page.container.querySelector('.cms-diff')).toBeNull();
    expect(resultRegion(page.container)).toBeNull();
    await open(page);
    await click(radio(page.container, '/a', 'yours'));
    expect(radio(page.container, '/a', 'yours').checked).toBe(true);
    expect(accept(page.container).disabled).toBe(false);
    expect(page.calls.map((call) => call.method)).toEqual(['GET']);
    expect(resultRegion(page.container)).toBeNull();
    expect(window.sessionStorage.length).toBe(0);
  });

  it('[P2-S12-AC-271] commandState loading (kept half): a stable pending label per command and the commit controls disabled, a second press sends nothing; the answers are disabled as well (C4)', async () => {
    const heldAccept = heldReply();
    const accepting1 = mount([heldAccept.reply]);
    await accepting(accepting1);
    expectPendingLabel(accepting1.container, 'Accepting the update…');
    expect(accept(accepting1.container).disabled).toBe(true);
    expect(detach(accepting1.container).disabled).toBe(true);
    await click(accept(accepting1.container));
    expect(
      accepting1.calls.filter((call) => call.method === 'POST'),
    ).toHaveLength(1);
    await answerHeld(heldAccept, updated());
    accepting1.unmount();

    const heldDetach = heldReply();
    const detaching = mount([heldDetach.reply]);
    await open(detaching);
    await click(detach(detaching.container));
    await settle();
    expectPendingLabel(detaching.container, 'Detaching the block…');
    expect(detach(detaching.container).disabled).toBe(true);
    expect(accept(detaching.container).disabled).toBe(true);
    await answerHeld(heldDetach, updated());
    detaching.unmount();

    const heldPlace = heldReply();
    const placing = mountPage(
      {
        [diffPath(id(1))]: [read(withRoots), read(withRoots)],
        [PLACE]: [heldPlace.reply],
      },
      { instances: [pending(1)] },
    );
    await open(placing);
    await click(
      placing.container.querySelector<HTMLInputElement>(
        '.cms-diff-new input[type="checkbox"]',
      ) as HTMLInputElement,
    );
    await click(buttonNamed(placing.container, 'Place selected blocks'));
    await settle();
    expectPendingLabel(placing.container, 'Placing the new blocks…');
    expect(
      buttonNamed(placing.container, 'Place selected blocks').disabled,
    ).toBe(true);
    await answerHeld(heldPlace, refusal(502, 'DEPENDENCY_UNAVAILABLE'));
  });

  it('[P2-S12-AC-271] commandState success (kept half): the named outcome per instance, the panel and answers cleared and the next command at the committed version; no refetch of the entry or list is made (C5)', async () => {
    const page = mount([updatedLinked('10'), updated('11', '5')]);
    await accepting(page);
    expect(resultHeading(page.container)).toBe('Update applied');
    expect(resultText(page.container)).toContain(
      '/main/row-1: Now on pattern version 2',
    );
    expect(page.container.querySelector('.cms-diff')).toBeNull();
    expect(
      page.container.querySelectorAll('input[type="radio"]:checked'),
    ).toHaveLength(0);
    await click(buttonNamed(page.container, 'Detach /main/row-1'));
    await settle();
    expect(
      page.calls.filter((call) => call.method === 'POST').at(-1)?.headers[
        'if-match'
      ],
    ).toBe('"10"');
    expect(resultHeading(page.container)).toBe('Detached');
    expect(resultText(page.container)).toContain('/main/row-1: Local copy');
    expect(page.unexpected).toEqual([]);
  });

  it('[P2-S12-AC-271] commandState success: placing the new blocks names the placement and reads the diff again', async () => {
    const page = mountPage(
      {
        [diffPath(id(1))]: [read(withRoots), read(withRoots)],
        [PLACE]: [
          json(
            {
              items: [
                row(7, {
                  path: '/main/extra',
                  patternVersion: 3,
                  state: 'draft',
                  position: 9,
                }),
              ],
            },
            201,
            '"10"',
          ),
        ],
      },
      { instances: [pending(1)] },
    );
    await open(page);
    await click(
      page.container.querySelector<HTMLInputElement>(
        '.cms-diff-new input[type="checkbox"]',
      ) as HTMLInputElement,
    );
    await click(buttonNamed(page.container, 'Place selected blocks'));
    await settle();
    expect(resultHeading(page.container)).toBe('New blocks placed');
    expect(resultText(page.container)).toContain(
      'Placed 1 block from pattern version 3.',
    );
    expect(
      page.calls.filter((call) => call.path.endsWith('/update-diff')),
    ).toHaveLength(2);
  });

  it('[P2-S12-AC-271] commandState error: a 401 answer renders the session-ended copy (STEP_UP_REQUIRED does not apply: BE03c requires no recent MFA for CMS-03C-15)', async () => {
    const page = mount([refusal(401, 'UNAUTHENTICATED')]);
    await accepting(page);
    expect(resultHeading(page.container)).toBe('Update not applied');
    expect(resultText(page.container)).toContain(
      'Your session ended. Sign in again to continue.',
    );
    expect(radio(page.container, '/a', 'yours').checked).toBe(true);
  });

  it('[P2-S12-AC-271] commandState error: 403 renders the fixed sentence in the result alert (kept half: no CapabilityGate component is used, C6)', async () => {
    const page = mount([refusal(403, 'COMPOSITION_FORBIDDEN')]);
    await accepting(page);
    expect(resultRegion(page.container)?.getAttribute('role')).toBe('alert');
    expect(resultText(page.container)).toContain(
      'This account cannot edit the composition of this entry.',
    );
  });

  it.each([
    [
      'diff_has_collisions',
      'The pattern changed again: this update now has collisions. The diff was reloaded and your choices on unchanged paths are kept.',
    ],
    [
      null,
      'The entry or the instance changed since this page loaded. The page reloaded them; your choices are kept, so check them and try again.',
    ],
  ])(
    '[P2-S12-AC-271] commandState error: 409 %s renders fixed copy, refetches the entry and the diff and keeps the answers',
    async (reasonCode, sentence) => {
      const page = mount(
        [
          refusal(
            409,
            'COMPOSITION_VERSION_CONFLICT',
            reasonCode === null ? { currentVersion: '11' } : { reasonCode },
          ),
        ],
        { [ENTRY]: [entryDetail('11')] },
      );
      await accepting(page);
      expect(resultText(page.container)).toContain(sentence);
      expect(
        page.calls.filter((call) =>
          call.path.startsWith('/api/v1/cms/entries/'),
        ),
      ).toHaveLength(1);
      expect(
        page.calls.filter((call) => call.path.endsWith('/update-diff')),
      ).toHaveLength(2);
      expect(radio(page.container, '/a', 'yours').checked).toBe(true);
    },
  );

  it.each([
    [
      'pattern_version_not_active',
      'The newer pattern version is no longer active. Nothing was changed.',
    ],
    [
      'pattern_incompatible',
      "The newer pattern is not compatible with this entry's content type. Nothing was changed.",
    ],
    [
      'nested_pattern_not_active',
      'A pattern nested inside the newer version is no longer active. Nothing was changed.',
    ],
    [
      'block_rules_violated',
      'These choices would break the composition rules of a block (a child it does not allow, or too many blocks or levels). Nothing was applied and your choices are kept; change them and try again.',
    ],
  ])(
    '[P2-S12-AC-271] commandState error: 422 %s renders fixed copy in the result alert (no field of this form is named by it) and keeps the answers',
    async (reasonCode, sentence) => {
      const page = mount([
        refusal(422, 'COMPOSITION_VALIDATION_FAILED', { reasonCode }),
      ]);
      await accepting(page);
      expect(resultText(page.container)).toContain(sentence);
      expect(resultText(page.container)).not.toContain('composition operation');
      expect(radio(page.container, '/c', 'yours').checked).toBe(true);
    },
  );

  it('[P2-S12-AC-271] commandState degraded (kept half): an unknown outcome renders a pending, never a guessed, result and the retry reuses the same key; no entry refetch precedes the retry (C7)', async () => {
    const page = mount([
      refusal(502, 'DEPENDENCY_UNAVAILABLE', { retryable: true }),
      updated(),
    ]);
    await accepting(page);
    expect(resultHeading(page.container)).toBe('Result not known');
    expect(resultText(page.container)).toContain(UNKNOWN_OUTCOME_MESSAGE);
    expect(resultText(page.container)).not.toContain('Update applied');
    expect(radio(page.container, '/a', 'yours').checked).toBe(true);
    await click(accept(page.container));
    await settle();
    const keys = page.calls
      .filter((call) => call.method === 'POST')
      .map((call) => call.headers['idempotency-key']);
    expect(keys[1]).toBe(keys[0]);
    expect(resultHeading(page.container)).toBe('Update applied');
  });

  it('[P2-S12-AC-271] commandState disabled (kept half): no newer version, an uneditable draft or a missing session withholds the commit controls and says why; the island has no permittedNextActions input', async () => {
    const none = diffOf(1, [], {
      targetPatternVersion: 1,
      bulkEligible: false,
    });
    const noNewer = mountPage(
      { [diffPath(id(1))]: [read(none)] },
      { instances: [pending(1)] },
    );
    await open(noNewer);
    expect(accept(noNewer.container).disabled).toBe(true);
    const reason = accept(noNewer.container).getAttribute('aria-describedby');
    expect(document.getElementById(reason as string)?.textContent).toBe(
      'No newer compatible pattern version.',
    );
    noNewer.unmount();

    const readOnly = mountPage(
      { [diffPath(id(1))]: [read()] },
      { instances: [pending(1)], entry: entryFacts({ editable: false }) },
    );
    expect(readOnly.container.textContent).toContain('not an editable draft');
    expect(
      buttonNamed(readOnly.container, 'Review update for /main/row-1').disabled,
    ).toBe(true);
    readOnly.unmount();

    const signedOut = mountPage({}, { instances: [pending(1)], csrfToken: '' });
    expect(signedOut.container.textContent).toContain(
      'Sign in again to continue.',
    );
    expect(
      buttonNamed(signedOut.container, 'Detach /main/row-1').disabled,
    ).toBe(true);
  });
});
