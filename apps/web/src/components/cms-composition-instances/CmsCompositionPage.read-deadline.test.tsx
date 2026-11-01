// @vitest-environment jsdom
import { act } from 'react';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { BROWSER_READ_DEADLINE_MS } from '../../lib/read-deadline';
import {
  buttonNamed,
  click,
  disableReactAct,
  enableReactAct,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import {
  heldReply,
  resultText,
} from './composition-command-states.test-support';
import {
  ENTRY,
  SELECTOR,
  UPDATE,
  diffPath,
  entryDetail,
  json,
  mountPage,
  refusal,
} from './composition-page.test-support';
import {
  LIST,
  listedPaths,
  expectListRefetches,
} from './composition-refetch.test-support';
import {
  id,
  row,
  selectorItem,
  selectorPage,
} from './composition.test-support';

/*
 * [P2-S12-AC-271] commandState loading and degraded (FE03 "Network and retry contract", DEC-246 ruling 1, review V20
 * m10): every composition read ends at the shared 8,000 ms deadline and answers its failed cell. The hold that keeps
 * the controls off while a command's reads run ends with it, so a read that never settles cannot freeze the island.
 */
beforeAll(enableReactAct);
afterAll(disableReactAct);
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const advance = async (ms: number): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};
const conflict = () =>
  refusal(409, 'COMPOSITION_VERSION_CONFLICT', { currentVersion: '11' });
const unreadable = () => refusal(503, 'DEPENDENCY_UNAVAILABLE');
const detachedRow = row(1, { version: '4', linkMode: 'detached' });

describe('a read that never answers releases the island at the deadline', () => {
  it('[P2-S12-AC-271] commandState loading: a 409 whose entry read never answers keeps the controls off for 8,000 ms and then frees them with the refusal said', async () => {
    const page = mountPage(
      { [UPDATE]: [conflict()], [ENTRY]: [heldReply().reply] },
      { instances: [row(1)] },
    );
    const c = page.container;
    await click(buttonNamed(c, 'Detach /main/row-1'));
    await advance(BROWSER_READ_DEADLINE_MS - 1);
    expect(buttonNamed(c, 'Detach /main/row-1').disabled).toBe(true);
    await advance(1);
    expect(buttonNamed(c, 'Detach /main/row-1').disabled).toBe(false);
    expect(resultText(c)).toContain('Not detached');
    expectListRefetches(page, 1);
    expect(page.calls.filter((call) => call.method === 'POST')).toHaveLength(1);
  });

  it('[P2-S12-AC-271] commandState degraded: an unknown outcome whose entry read never answers offers Check again, and no retry, once the deadline passes', async () => {
    const page = mountPage(
      {
        [UPDATE]: [refusal(502, 'DEPENDENCY_UNAVAILABLE', { retryable: true })],
        [ENTRY]: [heldReply().reply, entryDetail('9')],
      },
      { instances: [row(1)] },
    );
    const c = page.container;
    await click(buttonNamed(c, 'Detach /main/row-1'));
    await advance(BROWSER_READ_DEADLINE_MS);
    expect(resultText(c)).toContain('The entry could not be read to check');
    expect(buttonNamed(c, 'Detach /main/row-1').disabled).toBe(true);
    await click(buttonNamed(c, 'Check again'));
    await advance(0);
    expect(buttonNamed(c, 'Detach /main/row-1').disabled).toBe(false);
    expectListRefetches(page, 1);
  });

  it('[P2-S12-AC-271] commandState degraded: a verified detach whose list refetch never answers keeps the rows and frees the controls at the deadline', async () => {
    const page = mountPage(
      {
        [UPDATE]: [json({ items: [detachedRow] }, 200, '"10"')],
        [LIST]: [heldReply().reply],
      },
      { instances: [row(1), row(2)] },
    );
    const c = page.container;
    await click(buttonNamed(c, 'Detach /main/row-1'));
    await advance(BROWSER_READ_DEADLINE_MS - 1);
    expect(buttonNamed(c, 'Detach /main/row-2').disabled).toBe(true);
    await advance(1);
    expect(buttonNamed(c, 'Detach /main/row-2').disabled).toBe(false);
    expect(listedPaths(c)).toEqual(['/main/row-1', '/main/row-2']);
    expect(resultText(c)).toContain('Detached');
  });

  it('[P2-S12-AC-271] diffState degraded: an update diff that never answers shows the unreadable-update sentence at the deadline and frees the review control', async () => {
    const page = mountPage(
      { [diffPath(id(1))]: [heldReply().reply] },
      { instances: [row(1, { state: 'pending_diff', version: '3' })] },
    );
    const c = page.container;
    await click(buttonNamed(c, 'Review update for /main/row-1'));
    await advance(BROWSER_READ_DEADLINE_MS);
    expect(c.textContent).toContain('The update could not be read right now.');
    expect(buttonNamed(c, 'Review update for /main/row-1').disabled).toBe(
      false,
    );
  });

  it('[P2-S12-AC-271] selectorState degraded: a Load more read that never answers says the list could not be read at the deadline and keeps the listed patterns', async () => {
    const page = mountPage(
      { [SELECTOR]: [heldReply().reply] },
      {
        selector: selectorPage([selectorItem('hero-block', 2)], 'cursor-1'),
      },
    );
    const c = page.container;
    await click(buttonNamed(c, 'Load more patterns'));
    await advance(BROWSER_READ_DEADLINE_MS);
    expect(c.textContent).toContain('The pattern list could not be read');
    expect(buttonNamed(c, 'Load more patterns').disabled).toBe(false);
    expect(c.querySelectorAll('select option')).toHaveLength(2);
  });

  it('[P2-S12-AC-271] diffState degraded: a diff read answered 503 is not delayed to the deadline', async () => {
    const page = mountPage(
      { [diffPath(id(1))]: [unreadable()] },
      { instances: [row(1, { state: 'pending_diff', version: '3' })] },
    );
    await click(buttonNamed(page.container, 'Review update for /main/row-1'));
    await advance(0);
    expect(page.container.textContent).toContain(
      'The update could not be read right now.',
    );
  });
});
