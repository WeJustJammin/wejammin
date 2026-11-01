// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buttonNamed,
  byLabel,
  click,
  disableReactAct,
  enableReactAct,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import {
  answerHeld,
  expectPendingLabel,
  heldReply,
  resultHeading,
  resultRegion,
  resultText,
} from './composition-command-states.test-support';
import { UNKNOWN_OUTCOME_MESSAGE } from './composition-copy';
import {
  ENTRY,
  UPDATE,
  diffPath,
  entryDetail,
  json,
  mountPage,
  noListReads,
  refusal,
  settle,
} from './composition-page.test-support';
import {
  diffOf,
  entryFacts,
  id,
  plainPath,
  propsPath,
  row,
} from './composition.test-support';
import { expectListRefetches } from './composition-refetch.test-support';

/*
 * P2-S12-AC-271, `commandState` of FE03 "Slice 12 definition governance states", for CMS-03C-15 on a selection (bulk
 * accept, bulk detach; DEC-181) through the selected-updates panel of the composition page over a scripted wire.
 */
beforeAll(enableReactAct);
afterAll(disableReactAct);

const rows = () =>
  [1, 2].map((n) => row(n, { state: 'pending_diff', version: '3' }));
const clean = (n: number) => json(diffOf(n, [plainPath()]), 200, '"3"');
const appended = (version = '10') =>
  json(
    {
      items: [1, 2].map((n) => row(n, { version: '4', patternVersion: 2 })),
    },
    200,
    `"${version}"`,
  );
const detached = (version = '10') =>
  json(
    {
      items: [1, 2].map((n) =>
        row(n, { version: '4', linkMode: 'detached', state: 'active' }),
      ),
    },
    200,
    `"${version}"`,
  );
const select = async (container: HTMLElement) => {
  for (const n of [1, 2])
    await click(byLabel<HTMLInputElement>(container, `Select /main/row-${n}`));
};
const mount = (
  update: Array<Response | (() => Response)>,
  more: Record<string, Array<Response | (() => Response)>> = {},
) =>
  mountPage(
    {
      [diffPath(id(1))]: [clean(1)],
      [diffPath(id(2))]: [clean(2)],
      [UPDATE]: update,
      ...more,
    },
    { instances: rows() },
  );
const review = async (page: ReturnType<typeof mount>) => {
  await select(page.container);
  await click(buttonNamed(page.container, 'Review selected updates'));
  await settle();
};
const acceptAll = (container: HTMLElement) =>
  buttonNamed(container, 'Accept all selected updates');
const bulkAccept = async (page: ReturnType<typeof mount>) => {
  await review(page);
  await click(acceptAll(page.container));
  await settle();
};
const bulkDetach = async (page: ReturnType<typeof mount>) => {
  await select(page.container);
  await click(buttonNamed(page.container, 'Detach selected'));
  await settle();
};
const posts = (page: ReturnType<typeof mount>) =>
  page.calls.filter((call) => call.method === 'POST');

describe('CmsBulkUpdatePanel (CMS-03C-15 bulk accept and bulk detach) commandState', () => {
  it('[P2-S12-AC-271] commandState idle: no panel until a selection is reviewed; an unsent selection is kept and nothing is sent', async () => {
    const page = mount([appended()]);
    expect(page.container.querySelector('.cms-diff')).toBeNull();
    expect(
      buttonNamed(page.container, 'Review selected updates').disabled,
    ).toBe(true);
    expect(buttonNamed(page.container, 'Detach selected').disabled).toBe(true);
    await select(page.container);
    expect(page.container.textContent).toContain('2 selected');
    expect(
      buttonNamed(page.container, 'Review selected updates').disabled,
    ).toBe(false);
    expect(page.calls).toHaveLength(0);
    expect(resultRegion(page.container)).toBeNull();
    expect(window.sessionStorage.length).toBe(0);
  });

  it('[P2-S12-AC-271] commandState loading: a stable pending label per command and the commit control disabled, a second press sends nothing; selecting stays enabled and the controls that start another command (Review, Detach) stay disabled', async () => {
    const heldAccept = heldReply();
    const accepting = mount([heldAccept.reply]);
    await bulkAccept(accepting);
    expectPendingLabel(accepting.container, 'Updates applied: request 1 of 1…');
    expect(acceptAll(accepting.container).disabled).toBe(true);
    // FE03 1048 and DEC-241: selecting stays enabled; the controls that start another command stay disabled.
    expect(
      accepting.container.querySelectorAll('input[type="checkbox"]:disabled'),
    ).toHaveLength(0);
    expect(
      Array.from(accepting.container.querySelectorAll('button:disabled')).map(
        (control) => control.textContent,
      ),
    ).toEqual(
      expect.arrayContaining([
        'Review selected updates',
        'Detach selected',
        'Review update',
        'Detach',
      ]),
    );
    await click(acceptAll(accepting.container));
    expect(posts(accepting)).toHaveLength(1);
    await answerHeld(heldAccept, appended());
    await settle();
    expectListRefetches(accepting, 1);
    accepting.unmount();

    const heldDetach = heldReply();
    const detaching = mount([heldDetach.reply]);
    await bulkDetach(detaching);
    expectPendingLabel(detaching.container, 'Blocks detached: request 1 of 1…');
    expect(buttonNamed(detaching.container, 'Detach selected').disabled).toBe(
      true,
    );
    await click(buttonNamed(detaching.container, 'Detach selected'));
    expect(posts(detaching)).toHaveLength(1);
    await answerHeld(heldDetach, detached());
    await settle();
    expectListRefetches(detaching, 1);
  });

  it('[P2-S12-AC-271] commandState success (test correction, FE03 1047): the named outcome per instance, the panel and selection cleared, no entry read for a single request, and the instance list refetched', async () => {
    const accepting = mount([appended()]);
    await bulkAccept(accepting);
    expect(resultHeading(accepting.container)).toBe('Updates applied');
    expect(resultText(accepting.container)).toContain(
      '/main/row-1: Now on pattern version 2',
    );
    expect(resultText(accepting.container)).toContain(
      '/main/row-2: Now on pattern version 2',
    );
    expect(accepting.container.textContent).toContain('0 selected');
    expect(accepting.container.querySelector('.cms-diff')).toBeNull();
    expect(posts(accepting)[0]?.body).toMatchObject({
      action: 'accept',
      targetPatternVersion: 2,
      expectedVersion: '9',
    });
    expect(accepting.unexpected).toEqual([]);
    expect(accepting.lists).toHaveLength(1);
    accepting.unmount();

    const detaching = mount([detached()]);
    await bulkDetach(detaching);
    expect(detaching.lists).toHaveLength(1);
    expect(resultHeading(detaching.container)).toBe('Blocks detached');
    expect(resultText(detaching.container)).toContain(
      '/main/row-2: Local copy',
    );
    expect(detaching.container.textContent).toContain('0 selected');
  });

  it('[P2-S12-AC-271] commandState error: a 401 answer stops the sequence with the session-ended copy and the progress (STEP_UP_REQUIRED does not apply: BE03c requires no recent MFA for CMS-03C-15)', async () => {
    const page = mount([refusal(401, 'UNAUTHENTICATED')]);
    await bulkAccept(page);
    expect(resultHeading(page.container)).toBe('Updates stopped');
    expect(resultText(page.container)).toContain(
      'Your session ended. Sign in again to continue.',
    );
    expect(resultText(page.container)).toContain('0 of 1 requests applied.');
    expect(page.container.textContent).toContain('2 selected');
    noListReads(page);
  });

  it('[P2-S12-AC-271] commandState error: 403 renders the CapabilityGate with the fixed sentence in the result alert', async () => {
    const page = mount([refusal(403, 'COMPOSITION_FORBIDDEN')]);
    await bulkAccept(page);
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
    noListReads(page);
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
    '[P2-S12-AC-271] commandState error (test correction, FE03 1049): 409 %s renders fixed copy, keeps the selection, and refetches the entry, the instance list and the unapplied diffs',
    async (reasonCode, sentence) => {
      const page = mount(
        [
          refusal(
            409,
            'COMPOSITION_VERSION_CONFLICT',
            reasonCode === null ? { currentVersion: '11' } : { reasonCode },
          ),
        ],
        {
          [ENTRY]: [entryDetail('11')],
          [diffPath(id(1))]: [clean(1), clean(1)],
          [diffPath(id(2))]: [clean(2), clean(2)],
        },
      );
      await bulkAccept(page);
      expect(resultHeading(page.container)).toBe('Updates stopped');
      expect(resultText(page.container)).toContain(sentence);
      expect(resultText(page.container)).toContain('0 of 1 requests applied.');
      expect(page.container.textContent).toContain('2 selected');
      expect(
        page.calls.filter((call) => call.path === ENTRY.slice(4)),
      ).toHaveLength(1);
      expect(page.lists).toHaveLength(1);
      expect(
        page.calls.filter((call) => call.path.endsWith('/update-diff')),
      ).toHaveLength(4);
    },
  );

  it.each([
    [
      'pattern_version_not_active',
      'The newer pattern version is no longer active. Nothing was changed.',
    ],
    [
      'block_rules_violated',
      'These choices would break the composition rules of a block (a child it does not allow, or too many blocks or levels). Nothing was applied and your choices are kept; change them and try again.',
    ],
  ])(
    '[P2-S12-AC-271] commandState error: 422 %s renders fixed copy in the result alert (no field of this panel is named by it)',
    async (reasonCode, sentence) => {
      const page = mount([
        refusal(422, 'COMPOSITION_VALIDATION_FAILED', { reasonCode }),
      ]);
      await bulkAccept(page);
      expect(resultText(page.container)).toContain(sentence);
      expect(resultText(page.container)).not.toContain('composition operation');
      noListReads(page);
    },
  );

  it('[P2-S12-AC-271] commandState degraded (test correction, FE03 1050): an unknown outcome renders a pending label while the entry and the list are read, states that nothing is assumed, keeps the selection, and only then offers the retry under the same key', async () => {
    const heldEntry = heldReply();
    const page = mount(
      [refusal(502, 'DEPENDENCY_UNAVAILABLE', { retryable: true }), appended()],
      { [ENTRY]: [heldEntry.reply] },
    );
    await bulkAccept(page);
    expectPendingLabel(page.container, 'Checking the entry before any retry…');
    expect(acceptAll(page.container).disabled).toBe(true);
    await answerHeld(heldEntry, entryDetail('9'));
    await settle();
    expect(resultHeading(page.container)).toBe('Updates stopped');
    expect(resultText(page.container)).toContain(UNKNOWN_OUTCOME_MESSAGE);
    expect(resultText(page.container)).toContain(
      'The entry is still at version 9.',
    );
    expect(resultText(page.container)).not.toContain('Updates applied');
    expect(page.lists).toHaveLength(1);
    expect(page.container.textContent).toContain('2 selected');
    await click(acceptAll(page.container));
    await settle();
    const keys = posts(page).map((call) => call.headers['idempotency-key']);
    expect(keys[1]).toBe(keys[0]);
    expect(resultHeading(page.container)).toBe('Updates applied');
  });

  it('[P2-S12-AC-271] commandState disabled (kept half): a collision or an uneditable draft withholds the commit control and the panel says why; the island has no permittedNextActions input', async () => {
    const colliding = mountPage(
      {
        [diffPath(id(1))]: [clean(1)],
        [diffPath(id(2))]: [json(diffOf(2, [propsPath('/a')]), 200, '"3"')],
      },
      { instances: rows() },
    );
    await review(colliding);
    expect(acceptAll(colliding.container).disabled).toBe(true);
    expect(colliding.container.textContent).toContain(
      'Bulk acceptance is available only when no selected instance has a collision or lacks a newer version.',
    );
    expect(colliding.container.textContent).toContain('/main/row-2');
    colliding.unmount();

    const readOnly = mountPage(
      {},
      { instances: rows(), entry: entryFacts({ editable: false }) },
    );
    expect(readOnly.container.textContent).toContain('not an editable draft');
    await select(readOnly.container);
    expect(
      buttonNamed(readOnly.container, 'Review selected updates').disabled,
    ).toBe(true);
    expect(buttonNamed(readOnly.container, 'Detach selected').disabled).toBe(
      true,
    );
    expect(readOnly.calls).toHaveLength(0);
  });
});
