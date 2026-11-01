// @vitest-environment jsdom
import * as React from 'react';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  disableReactAct,
  enableReactAct,
  flush,
  mountElement,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import {
  heldReply,
  answerHeld,
} from './composition-command-states.test-support';
import {
  ENTRY,
  entryDetail,
  refusal,
  scriptedFetch,
} from './composition-page.test-support';
import { failure, IDLE, restated } from './composition-status';
import {
  LIST,
  expectListRefetches,
  listPage,
} from './composition-refetch.test-support';
import { REVISION_ID, entryFacts, id, row } from './composition.test-support';
import { keepRetired } from './composition-rows';
import {
  useCompositionSession,
  type CompositionSession,
} from './use-composition-session';

/**
 * [P2-S12-AC-271] FE03 1047, 1049: the instance list a refetch answers replaces the rows only while it is the latest
 * answer of the latest generation; and it never drops a `retired` head the author may still detach (DEC-193, V19 m7).
 */
beforeAll(enableReactAct);
afterAll(disableReactAct);

const harness = (script: Parameters<typeof scriptedFetch>[0]) => {
  const scripted = scriptedFetch(script, { rows: [row(1)] });
  let session: CompositionSession | null = null;
  function Harness(): React.ReactElement {
    session = useCompositionSession({
      entry: entryFacts(),
      instances: [row(1)],
      csrfToken: 'csrf-token',
      fetcher: scripted.fetcher,
    });
    return <p>{session.rows.map((r) => r.path).join(',')}</p>;
  }
  const mounted = mountElement(<Harness />);
  return {
    mounted,
    lists: scripted.lists,
    now: (): CompositionSession => session as unknown as CompositionSession,
    shown: (): string => mounted.container.textContent ?? '',
  };
};

describe('refreshList: only the latest answer replaces the rows', () => {
  it('[P2-S12-AC-271] commandState success: an older list answer that arrives last does not replace the newer one', async () => {
    const first = heldReply();
    const second = heldReply();
    const h = harness({ [LIST]: [first.reply, second.reply] });
    const older = h.now().refreshList();
    const newer = h.now().refreshList();
    await answerHeld(second, listPage([row(1), row(7, { position: 7 })]));
    await newer;
    await answerHeld(first, listPage([row(1), row(5, { position: 5 })]));
    await older;
    await flush();
    expect(h.shown()).toBe('/main/row-1,/main/row-7');
  });

  it('[P2-S12-AC-271] commandState success: a list answer that began before a command added rows is dropped', async () => {
    const held = heldReply();
    const h = harness({ [LIST]: [held.reply] });
    const refreshing = h.now().refreshList();
    h.now().addRows([row(9, { position: 9 })]);
    await flush();
    await answerHeld(held, listPage([row(1)]));
    expect(await refreshing).toBe(false);
    expect(h.shown()).toBe('/main/row-1,/main/row-9');
  });
});

describe('keepRetired', () => {
  const retired = (n: number) => row(n, { state: 'retired' });

  it('[P2-S12-AC-271] keeps a retired row the read does not list, after the row that preceded it', () => {
    const held = [row(1), retired(2), row(3)];
    const listed = [row(1, { version: '5' }), row(3, { version: '5' })];
    expect(keepRetired(listed, held, REVISION_ID).map((r) => r.path)).toEqual([
      '/main/row-1',
      '/main/row-2',
      '/main/row-3',
    ]);
  });

  it('[P2-S12-AC-271] puts a retired row with no listed predecessor first, drops a vanished live row, and lets the read win for a listed path', () => {
    const held = [retired(1), row(2), retired(3)];
    expect(keepRetired([row(9)], held, REVISION_ID).map((r) => r.path)).toEqual(
      ['/main/row-1', '/main/row-3', '/main/row-9'],
    );
    expect(
      keepRetired([row(1, { version: '8' })], [retired(1)], REVISION_ID).map(
        (r) => r.state,
      ),
    ).toEqual(['active']);
  });

  it('[P2-S12-AC-271] commandState success: keeps only the retired rows of the draft revision the list answered (V20 m3, DEC-246 ruling 2)', () => {
    const older = row(1, { state: 'retired', revisionId: id(70) });
    const current = row(2, { state: 'retired' });
    const listed = [row(3)];
    expect(
      keepRetired(listed, [older, current], REVISION_ID).map((r) => r.path),
    ).toEqual(['/main/row-2', '/main/row-3']);
    expect(keepRetired(listed, [older], REVISION_ID)).toEqual(listed);
  });
});

describe('recheck', () => {
  it('[P2-S12-AC-271] commandState degraded: with nothing unconfirmed it reads nothing', async () => {
    const h = harness({});
    await h.now().recheck();
    await flush();
    expect(h.shown()).toBe('/main/row-1');
  });

  it('[P2-S12-AC-271] commandState degraded: a page that goes away while it reads changes nothing', async () => {
    const held = heldReply();
    const h = harness({
      [ENTRY]: [refusal(503, 'DEPENDENCY_UNAVAILABLE'), held.reply],
    });
    await h.now().reconcileUnknown('9', 'update');
    await flush();
    expect(h.now().unconfirmed).toBe(true);
    const checking = h.now().recheck();
    h.mounted.unmount();
    await answerHeld(held, entryDetail('9'));
    await checking;
    // The page was gone when the entry read verified: no list is read for it and the unconfirmed outcome is untouched.
    expectListRefetches(h, 0);
    expect(h.now().unconfirmed).toBe(true);
    expect(h.now().rows.map((r) => r.path)).toEqual(['/main/row-1']);
  });
});

describe('restated', () => {
  it('[P2-S12-AC-271] commandState degraded: says the new sentence of a refusal, refocusing only on request, and leaves any other status alone', () => {
    const base = failure('Result not known', 'old');
    expect(restated(IDLE, 'new', true)).toBe(IDLE);
    const kept = restated(base, 'new', false);
    expect(kept).toMatchObject({ message: 'new' });
    expect((kept as { nonce: number }).nonce).toBe(
      (base as { nonce: number }).nonce,
    );
    expect(
      (restated(base, 'new', true) as { nonce: number }).nonce,
    ).toBeGreaterThan((base as { nonce: number }).nonce);
  });
});
