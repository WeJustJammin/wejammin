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
  ENTRY,
  diffPath,
  entryDetail,
  json,
  scriptedFetch,
} from './composition-page.test-support';
import {
  answers,
  diffOf,
  entryFacts,
  id,
  propsPath,
} from './composition.test-support';
import { useCompositionSession } from './use-composition-session';
import { useCompositionUpdates } from './use-composition-updates';

/**
 * [P2-S12-AC-271] A command's completion works on what the author sees now (a ref), and falls back to what the command
 * was issued from only when no diff of that instance is open any more.
 */
beforeAll(enableReactAct);
afterAll(disableReactAct);

const diff = diffOf(1, [propsPath('/a')]);

describe('useCompositionUpdates: the completion of a refused command', () => {
  it('[P2-S12-AC-271] commandState error: a 409 reloads the diff with the choices it was issued from when no diff is open any more', async () => {
    const scripted = scriptedFetch({
      [ENTRY]: [entryDetail('11')],
      [diffPath(id(1))]: [json(diff, 200, `"${diff.instance.version}"`)],
    });
    let shown: Panel = NO_PANEL;
    let run: () => Promise<void> = async () => undefined;
    function Harness(): React.ReactElement {
      const session = useCompositionSession({
        entry: entryFacts(),
        instances: [],
        csrfToken: 'csrf-token',
        fetcher: scripted.fetcher,
      });
      const [panel, setPanel] = React.useState<Panel>(NO_PANEL);
      shown = panel;
      const updates = useCompositionUpdates(
        session,
        { panel, setPanel },
        { selected: new Set(), setSelected: () => undefined },
      );
      run = () =>
        updates.afterRefusal(
          {
            kind: 'refused',
            status: 409,
            reason: null,
            paths: [],
            currentVersion: '11',
          },
          'Update not applied',
          { diff, choices: answers(diff, 'theirs') },
        );
      return <p>harness</p>;
    }
    mountElement(<Harness />);
    await flush();
    await run();
    await flush();
    expect(shown).toMatchObject({
      kind: 'diff',
      choices: answers(diff, 'theirs'),
    });
  });
});
