// @vitest-environment jsdom
import * as React from 'react';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  disableReactAct,
  enableReactAct,
  flush,
  mountElement,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import { NO_PANEL, type Panel } from './composition-panel';
import {
  PLACE,
  diffPath,
  json,
  refusal,
  scriptedFetch,
} from './composition-page.test-support';
import { heldReply } from './composition-command-states.test-support';
import {
  diffOf,
  entryFacts,
  id,
  plainPath,
  row,
} from './composition.test-support';
import { useCompositionSession } from './use-composition-session';
import { useCompositionUpdates } from './use-composition-updates';
import type { InstanceRow } from './composition-types';

/**
 * [P2-S12-AC-271] The guards of the placement of new blocks (DEC-193): it sends nothing without an open diff, a listed
 * instance, a chosen root, or while another command runs or a wait is in force.
 */
beforeAll(enableReactAct);
afterAll(disableReactAct);

const withRoots = diffOf(1, [plainPath('/a')], {
  targetPatternVersion: 3,
  newRoots: [
    { rootPath: '/extra', blockKey: 'profile.header', blockVersion: 1 },
  ],
});

const harness = (
  script: Parameters<typeof scriptedFetch>[0],
  panel: Panel,
  instances: readonly InstanceRow[],
) => {
  const scripted = scriptedFetch(script, { rows: instances });
  let place: (roots: readonly string[]) => Promise<void> = async () =>
    undefined;
  function Harness(): React.ReactElement {
    const session = useCompositionSession({
      entry: entryFacts(),
      instances,
      csrfToken: 'csrf-token',
      fetcher: scripted.fetcher,
    });
    const [shown, setPanel] = React.useState<Panel>(panel);
    const updates = useCompositionUpdates(
      session,
      { panel: shown, setPanel },
      { selected: new Set(), setSelected: () => undefined },
    );
    place = updates.placeNewRoots;
    return <p>{session.status.kind}</p>;
  }
  const mounted = mountElement(<Harness />);
  return {
    ...scripted,
    mounted,
    place: (roots: readonly string[]) => place(roots),
  };
};

describe('useCompositionNewRoots guards', () => {
  it('[P2-S12-AC-271] sends nothing without an open diff, a listed instance or a chosen root', async () => {
    const noPanel = harness({}, NO_PANEL, [row(1)]);
    await noPanel.place(['/extra']);
    const noRow = harness(
      {},
      { kind: 'diff', diff: withRoots, choices: {} },
      [],
    );
    await noRow.place(['/extra']);
    const noRoot = harness({}, { kind: 'diff', diff: withRoots, choices: {} }, [
      row(1),
    ]);
    await noRoot.place([]);
    await flush();
    for (const run of [noPanel, noRow, noRoot]) expect(run.calls).toEqual([]);
  });

  it('[P2-S12-AC-271] sends one request at a time and stops quietly on a 429', async () => {
    const held = heldReply();
    const busy = harness(
      {
        [PLACE]: [held.reply],
        [diffPath(id(1))]: [json(withRoots, 200, '"3"')],
      },
      { kind: 'diff', diff: withRoots, choices: {} },
      [row(1)],
    );
    const first = busy.place(['/extra']);
    await busy.place(['/extra']);
    expect(busy.calls.filter((call) => call.method === 'POST')).toHaveLength(1);
    held.answer(
      refusal(
        429,
        'RATE_LIMITED',
        { retryAfterSeconds: 5 },
        { 'retry-after': '5' },
      ),
    );
    await first;
    await flush();
    expect(busy.mounted.container.textContent).toBe('error');
  });
});
