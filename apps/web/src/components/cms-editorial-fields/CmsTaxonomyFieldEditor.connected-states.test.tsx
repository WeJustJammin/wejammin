// @vitest-environment jsdom

/**
 * [P2-S12-AC-271] FE03 1042 to 1048, `selectorState` for the connected taxonomy selector
 * (CMS-03C-17), the seven states in order: idle, loading, success, empty, error, degraded,
 * disabled. Each cell is one test over the real editor, faking only fetch.
 */

import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  buttonNamed,
  click,
  disableReactAct,
  enableReactAct,
} from './cms-editor-dom.test-support';
import {
  CONNECTED_COPY,
  ENTRY_LOCALE,
  ENTRY_TYPE_KEY,
  LOADING_PATTERN,
  LOAD_NEXT_LABEL,
  START_AGAIN_LABEL,
  TRY_AGAIN_LABEL,
  deferred,
  failureResponse,
  hasButton,
  mountConnectedTaxonomy,
  noticeContains,
  noticeMatches,
  recordingFetcher,
  servedPage,
  settle,
  termCheckboxes,
} from './cms-taxonomy-connected-fixtures.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

const entryContext = (fetcher: typeof fetch) => ({
  typeKey: ENTRY_TYPE_KEY,
  locale: ENTRY_LOCALE,
  fetcher,
});
const twoTerms = [
  { n: 1, label: 'Alpha' },
  { n: 2, label: 'Beta' },
];

describe('selectorState (CMS-03C-17, connected taxonomy field)', () => {
  it('[P2-S12-AC-271] selectorState idle: the first verified page is offered as one checkbox per term and the read writes no value', async () => {
    const fd = recordingFetcher([servedPage({ items: twoTerms })]);
    const mounted = mountConnectedTaxonomy({
      context: entryContext(fd.fetcher),
    });
    await settle();
    expect(fd.calls).toHaveLength(1);
    expect(termCheckboxes(mounted.container)).toHaveLength(2);
    expect(mounted.onValue).not.toHaveBeenCalled();
  });

  it('[P2-S12-AC-271] selectorState loading: a first read in flight states it politely, offers no term and writes no value', async () => {
    const pending = deferred<Response>();
    const fd = recordingFetcher([pending.promise]);
    const mounted = mountConnectedTaxonomy({
      context: entryContext(fd.fetcher),
    });
    await settle();
    expect(noticeMatches(mounted.container, LOADING_PATTERN)).toBe(true);
    expect(termCheckboxes(mounted.container)).toHaveLength(0);
    expect(mounted.onValue).not.toHaveBeenCalled();
    await settle(() => pending.resolve(servedPage({ items: twoTerms })));
  });

  it('[P2-S12-AC-271] selectorState loading (reload): a same-scope reload keeps the page listed with every choice off until it answers', async () => {
    const pending = deferred<Response>();
    const fd = recordingFetcher([
      servedPage({ items: twoTerms, nextCursor: 'c1' }),
      pending.promise,
    ]);
    const mounted = mountConnectedTaxonomy({
      context: entryContext(fd.fetcher),
    });
    await settle();
    await click(buttonNamed(mounted.container, LOAD_NEXT_LABEL));
    await settle();
    expect(termCheckboxes(mounted.container)).toHaveLength(2);
    for (const box of termCheckboxes(mounted.container))
      expect(box.disabled).toBe(true);
    await settle(() =>
      pending.resolve(servedPage({ items: [{ n: 3, label: 'Gamma' }] })),
    );
    expect(termCheckboxes(mounted.container)).toHaveLength(1);
    expect(termCheckboxes(mounted.container)[0]?.disabled).toBe(false);
  });

  it('[P2-S12-AC-271] selectorState success: a 200 page replaces the list and a cursor offers the next page', async () => {
    const fd = recordingFetcher([
      servedPage({ items: twoTerms, nextCursor: 'c1' }),
    ]);
    const mounted = mountConnectedTaxonomy({
      context: entryContext(fd.fetcher),
    });
    await settle();
    expect(termCheckboxes(mounted.container)).toHaveLength(2);
    expect(hasButton(mounted.container, LOAD_NEXT_LABEL)).toBe(true);
    expect(hasButton(mounted.container, START_AGAIN_LABEL)).toBe(false);
  });

  it('[P2-S12-AC-271] selectorState empty: a page with no term says no vocabulary lists the field; an absent key is not disclosed', async () => {
    const empty = recordingFetcher([servedPage({ items: [] })]);
    const first = mountConnectedTaxonomy({
      context: entryContext(empty.fetcher),
    });
    await settle();
    expect(noticeContains(first.container, CONNECTED_COPY.empty)).toBe(true);
    expect(termCheckboxes(first.container)).toHaveLength(0);
    const absent = recordingFetcher([failureResponse(404)]);
    const second = mountConnectedTaxonomy({
      context: entryContext(absent.fetcher),
    });
    await settle();
    expect(noticeContains(second.container, CONNECTED_COPY.notFound)).toBe(
      true,
    );
  });

  it.each([
    [401, CONNECTED_COPY.signedOut],
    [403, CONNECTED_COPY.forbidden],
    [404, CONNECTED_COPY.notFound],
  ])(
    '[P2-S12-AC-271] selectorState error: a typed %i refusal shows its one fixed sentence and no term',
    async (status, copy) => {
      const fd = recordingFetcher([failureResponse(status)]);
      const mounted = mountConnectedTaxonomy({
        context: entryContext(fd.fetcher),
      });
      await settle();
      expect(noticeContains(mounted.container, copy)).toBe(true);
      expect(termCheckboxes(mounted.container)).toHaveLength(0);
    },
  );

  it('[P2-S12-AC-271] selectorState degraded: a dependency failure keeps the selection, says so, and offers a retry', async () => {
    const fd = recordingFetcher([failureResponse(503)]);
    const mounted = mountConnectedTaxonomy({
      context: entryContext(fd.fetcher),
      value: { termIds: ['028f0c45-73fe-7dc2-9c09-000000000701'] },
    });
    await settle();
    expect(noticeContains(mounted.container, CONNECTED_COPY.degraded)).toBe(
      true,
    );
    expect(hasButton(mounted.container, TRY_AGAIN_LABEL)).toBe(true);
    expect(mounted.onValue).not.toHaveBeenCalled();
  });

  it('[P2-S12-AC-271] selectorState disabled: without a taxonomy context the typed unavailable reason is shown and no read is made', async () => {
    const mounted = mountConnectedTaxonomy({ context: undefined });
    await settle();
    expect(mounted.container.textContent).toContain(CONNECTED_COPY.noContext);
    expect(termCheckboxes(mounted.container)).toHaveLength(0);
  });
});
