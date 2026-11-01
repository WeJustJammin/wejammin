// @vitest-environment jsdom

/**
 * The connected CMS-03C-17 taxonomy selector, `commandState` degraded and the closing words of the state table
 * (P2-S12-AC-271; FE03 1620: "degraded; no optimistic state", "server-authoritative, no-store").
 *
 * Degraded is a page read that fails AFTER a first page was verified: the last verified page, the selection and the
 * announced count stay, nothing is written, and the retry asks for the same page again. Every read of the selector is
 * a no-store GET, and nothing on the page changes before the server has answered one.
 */

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

import {
  buttonNamed,
  byLabel,
  click,
  disableReactAct,
  enableReactAct,
} from './cms-editor-dom.test-support';
import {
  CONNECTED_COPY,
  ENTRY_LOCALE,
  ENTRY_TYPE_KEY,
  LOAD_NEXT_LABEL,
  TRY_AGAIN_LABEL,
  advanceTimers,
  announcedCount,
  deferred,
  failureResponse,
  labelTexts,
  mountConnectedTaxonomy,
  noticeContains,
  readQuery,
  recordingFetcher,
  servedPage,
  settle,
  termCheckboxes,
  termUid,
} from './cms-taxonomy-connected-fixtures.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

const context = (fetcher: typeof fetch, refreshToken = 0) => ({
  typeKey: ENTRY_TYPE_KEY,
  locale: ENTRY_LOCALE,
  fetcher,
  refreshToken,
});
const first = () =>
  servedPage({
    items: [
      { n: 1, label: 'Alpha' },
      { n: 2, label: 'Beta' },
    ],
    nextCursor: 'cursor-one',
  });

describe('the connected taxonomy selector: degraded', () => {
  it('[P2-S12-AC-271] commandState degraded: a first page followed by a 503 keeps the last verified page, the selection and the announced count, writes nothing and asks for the same page again', async () => {
    const fd = recordingFetcher([
      first(),
      failureResponse(503),
      servedPage({ items: [{ n: 3, label: 'Gamma' }] }),
    ]);
    const mounted = mountConnectedTaxonomy({
      context: context(fd.fetcher),
      value: { termIds: [termUid(2)] },
    });
    await settle();
    expect(labelTexts(mounted.container)).toEqual(['Alpha', 'Beta']);
    await click(buttonNamed(mounted.container, LOAD_NEXT_LABEL));
    await settle();
    expect(fd.calls).toHaveLength(2);
    expect(readQuery(fd.calls, 1).get('cursor')).toBe('cursor-one');
    // Degraded, not empty and not signed out: the notice says so, and the verified page is still there.
    expect(noticeContains(mounted.container, CONNECTED_COPY.degraded)).toBe(
      true,
    );
    expect(labelTexts(mounted.container)).toEqual(['Alpha', 'Beta']);
    expect(termCheckboxes(mounted.container)).toHaveLength(2);
    expect(byLabel<HTMLInputElement>(mounted.container, 'Beta').checked).toBe(
      true,
    );
    expect(announcedCount(mounted.container)).toMatch(/\b1 terms? selected\b/u);
    expect(mounted.onValue).not.toHaveBeenCalled();
    // The retry asks for the page that failed, not for the first page, and only on the person's press.
    expect(fd.calls).toHaveLength(2);
    await click(buttonNamed(mounted.container, TRY_AGAIN_LABEL));
    await settle();
    expect(fd.calls).toHaveLength(3);
    expect(readQuery(fd.calls, 2).get('cursor')).toBe('cursor-one');
    expect(mounted.onValue).not.toHaveBeenCalled();
  });
});

describe('the connected taxonomy selector: no-store and never optimistic', () => {
  it('[P2-S12-AC-271] commandState closing words: every read (first page, next page, retry, refresh) is a no-store same-origin GET', async () => {
    const fd = recordingFetcher([
      first(),
      failureResponse(503),
      servedPage({ items: [{ n: 3, label: 'Gamma' }] }),
      servedPage({ items: [{ n: 4, label: 'Delta' }] }),
    ]);
    const mounted = mountConnectedTaxonomy({ context: context(fd.fetcher) });
    await settle();
    await click(buttonNamed(mounted.container, LOAD_NEXT_LABEL));
    await settle();
    await click(buttonNamed(mounted.container, TRY_AGAIN_LABEL));
    await settle();
    mounted.rerender({ context: context(fd.fetcher, 1) });
    await settle();
    expect(fd.calls).toHaveLength(4);
    for (const call of fd.calls)
      expect(call).toMatchObject({
        method: 'GET',
        cache: 'no-store',
        credentials: 'same-origin',
      });
  });

  it('[P2-S12-AC-271] commandState closing words: nothing on the field changes, and nothing is written, before the server answers a read', async () => {
    const next = deferred<Response>();
    const fd = recordingFetcher([first(), next.promise]);
    const mounted = mountConnectedTaxonomy({
      context: context(fd.fetcher),
      value: { termIds: [termUid(1)] },
    });
    await settle();
    await click(buttonNamed(mounted.container, LOAD_NEXT_LABEL));
    // The read is in flight: the page, the checked state and the count are the server's last answer, unchanged.
    expect(labelTexts(mounted.container)).toEqual(['Alpha', 'Beta']);
    expect(byLabel<HTMLInputElement>(mounted.container, 'Alpha').checked).toBe(
      true,
    );
    expect(announcedCount(mounted.container)).toMatch(/\b1 terms? selected\b/u);
    expect(mounted.onValue).not.toHaveBeenCalled();
    expect(mounted.container.innerHTML.includes('Gamma')).toBe(false);
    await settle(() =>
      next.resolve(servedPage({ items: [{ n: 3, label: 'Gamma' }] })),
    );
    expect(labelTexts(mounted.container)).toEqual(['Gamma']);
    expect(mounted.onValue).not.toHaveBeenCalled();
  });
});

describe('the connected taxonomy selector: a read that never answers', () => {
  it('[P2-S12-AC-271] commandState degraded: a first page that never answers ends at the shared 8,000 ms deadline in the degraded cell, and Try again asks again', async () => {
    const hung = (): Promise<Response> =>
      new Promise<Response>(() => undefined);
    const fd = recordingFetcher([
      hung(),
      servedPage({ items: [{ n: 3, label: 'Gamma' }] }),
    ]);
    const mounted = mountConnectedTaxonomy({ context: context(fd.fetcher) });
    await settle();
    expect(fd.calls).toHaveLength(1);
    await advanceTimers(7_999);
    expect(noticeContains(mounted.container, CONNECTED_COPY.degraded)).toBe(
      false,
    );
    await advanceTimers(1);
    expect(noticeContains(mounted.container, CONNECTED_COPY.degraded)).toBe(
      true,
    );
    expect(fd.calls[0]?.signal?.aborted).toBe(true);
    expect(mounted.onValue).not.toHaveBeenCalled();
    await click(buttonNamed(mounted.container, TRY_AGAIN_LABEL));
    await settle();
    expect(fd.calls).toHaveLength(2);
    expect(labelTexts(mounted.container)).toEqual(['Gamma']);
  });

  it('[P2-S12-AC-271] commandState degraded: a next page that never answers keeps the last verified page and ends in the degraded cell', async () => {
    const hung = (): Promise<Response> =>
      new Promise<Response>(() => undefined);
    const fd = recordingFetcher([first(), hung()]);
    const mounted = mountConnectedTaxonomy({ context: context(fd.fetcher) });
    await settle();
    await click(buttonNamed(mounted.container, LOAD_NEXT_LABEL));
    await advanceTimers(8_000);
    expect(noticeContains(mounted.container, CONNECTED_COPY.degraded)).toBe(
      true,
    );
    expect(labelTexts(mounted.container)).toEqual(['Alpha', 'Beta']);
    expect(mounted.onValue).not.toHaveBeenCalled();
  });
});
