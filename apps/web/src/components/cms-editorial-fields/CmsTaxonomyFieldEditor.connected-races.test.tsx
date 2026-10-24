// @vitest-environment jsdom

/**
 * The connected CMS-03C-17 taxonomy field selector's read fencing and its 429 wait
 * (P2-S12-AC-135; FE03 "Network and retry contract", "Slice 12 governed definition,
 * composition, taxonomy, locale and related-content surfaces").
 *
 * A scope, locale or refreshToken change aborts the read whose answer is no longer the
 * current one and fences its late result; an unmount aborts the in-flight read too; and a
 * 429 announces its stated wait, dispatches nothing until the wait has elapsed and never
 * retries by itself.
 *
 * Fake timers run for the whole file, because the 429 wait and the announced countdown are
 * timers and no test here needs a real clock. Only fetch is faked, through the injected
 * context.
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

import { rateLimitMessage } from '../../lib/safe-read-retry';
import {
  byLabel,
  buttonNamed,
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

const REFUSED_REFRESHES: readonly [number, string][] = [
  [401, CONNECTED_COPY.signedOut],
  [403, CONNECTED_COPY.forbidden],
];

describe('the connected taxonomy selector: read fencing', () => {
  it('[P2-S12-AC-135] aborts the earlier read and never shows its late page when the scope and the locale change', async () => {
    const stale = deferred<Response>();
    const fd = recordingFetcher([
      stale.promise,
      servedPage({ items: [{ n: 3, label: 'Fresh' }] }),
    ]);
    const mounted = mountConnectedTaxonomy({ context: context(fd.fetcher) });
    await settle();
    expect(fd.calls).toHaveLength(1);
    mounted.rerender({
      context: {
        typeKey: 'release_note',
        locale: 'fr-FR',
        fetcher: fd.fetcher,
        refreshToken: 0,
      },
    });
    await settle();
    expect(fd.calls).toHaveLength(2);
    expect(readQuery(fd.calls, 1).get('typeKey')).toBe('release_note');
    expect(readQuery(fd.calls, 1).get('locale')).toBe('fr-FR');
    expect(readQuery(fd.calls, 1).has('cursor')).toBe(false);
    expect(fd.calls[0]?.signal?.aborted).toBe(true);
    await settle(() =>
      stale.resolve(servedPage({ items: [{ n: 1, label: 'Stale' }] })),
    );
    expect(labelTexts(mounted.container)).not.toContain('Stale');
    expect(byLabel<HTMLInputElement>(mounted.container, 'Fresh').value).toBe(
      termUid(3),
    );
  });

  it('[P2-S12-AC-135] reloads the first page on a same-scope refreshToken change, drops the stale cursor and fences the superseded page', async () => {
    const stalled = deferred<Response>();
    const fd = recordingFetcher([
      servedPage({
        items: [{ n: 1, label: 'First' }],
        nextCursor: 'cursor-one',
      }),
      stalled.promise,
      servedPage({ items: [{ n: 9, label: 'Fresh' }], pageVersion: '9' }),
    ]);
    const mounted = mountConnectedTaxonomy({
      context: context(fd.fetcher, 0),
    });
    await settle();
    await click(buttonNamed(mounted.container, LOAD_NEXT_LABEL));
    await settle();
    expect(fd.calls).toHaveLength(2);
    expect(readQuery(fd.calls, 1).get('cursor')).toBe('cursor-one');
    mounted.rerender({ context: context(fd.fetcher, 1) });
    await settle();
    expect(fd.calls).toHaveLength(3);
    expect(readQuery(fd.calls, 2).has('cursor')).toBe(false);
    expect(fd.calls[1]?.signal?.aborted).toBe(true);
    expect(labelTexts(mounted.container)).toEqual(['Fresh']);
    await settle(() =>
      stalled.resolve(
        servedPage({
          items: [{ n: 2, label: 'Superseded' }],
          nextCursor: 'cursor-two',
          pageVersion: '8',
        }),
      ),
    );
    expect(labelTexts(mounted.container)).not.toContain('Superseded');
    expect(labelTexts(mounted.container)).toEqual(['Fresh']);
  });

  it('[P2-S12-AC-135] keeps the last verified page, the selection and the announced count when a refresh fails', async () => {
    const fd = recordingFetcher([
      servedPage({
        items: [
          { n: 1, label: 'Alpha' },
          { n: 2, label: 'Beta' },
        ],
      }),
      failureResponse(503),
    ]);
    const mounted = mountConnectedTaxonomy({
      context: context(fd.fetcher, 0),
      value: { termIds: [termUid(2)] },
    });
    await settle();
    expect(byLabel<HTMLInputElement>(mounted.container, 'Beta').checked).toBe(
      true,
    );
    mounted.rerender({ context: context(fd.fetcher, 1) });
    await settle();
    expect(noticeContains(mounted.container, CONNECTED_COPY.degraded)).toBe(
      true,
    );
    expect(labelTexts(mounted.container)).toEqual(['Alpha', 'Beta']);
    expect(byLabel<HTMLInputElement>(mounted.container, 'Beta').checked).toBe(
      true,
    );
    // The last verified page stays visible, but no unverified new choice is possible.
    for (const box of termCheckboxes(mounted.container))
      expect(box.disabled).toBe(true);
    expect(announcedCount(mounted.container)).toMatch(/\b1 terms? selected\b/u);
    expect(mounted.onValue).not.toHaveBeenCalled();
  });

  it('[P2-S12-AC-135] aborts the in-flight read and ignores its late page when the field unmounts', async () => {
    const pending = deferred<Response>();
    const fd = recordingFetcher([pending.promise]);
    const mounted = mountConnectedTaxonomy({ context: context(fd.fetcher) });
    await settle();
    const signal = fd.calls[0]?.signal ?? null;
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(signal?.aborted).toBe(false);
    mounted.unmount();
    expect(signal?.aborted).toBe(true);
    await settle(() =>
      pending.resolve(servedPage({ items: [{ n: 1, label: 'Late' }] })),
    );
    expect(mounted.container.textContent).not.toContain('Late');
  });
});

describe('the connected taxonomy selector: a scope change and a refused refresh', () => {
  it('[P2-S12-AC-135] never shows the previous scope page again when the new scope cannot be read, and keeps the value', async () => {
    const fd = recordingFetcher([
      servedPage({ items: [{ n: 1, label: 'Stale one' }] }),
      failureResponse(503),
    ]);
    const mounted = mountConnectedTaxonomy({
      context: context(fd.fetcher),
      value: { termIds: [termUid(1)] },
    });
    await settle();
    expect(labelTexts(mounted.container)).toEqual(['Stale one']);
    mounted.rerender({
      context: {
        typeKey: 'release_note',
        locale: 'fr-FR',
        fetcher: fd.fetcher,
        refreshToken: 0,
      },
    });
    await settle();
    expect(fd.calls).toHaveLength(2);
    expect(readQuery(fd.calls, 1).get('typeKey')).toBe('release_note');
    expect(noticeContains(mounted.container, CONNECTED_COPY.degraded)).toBe(
      true,
    );
    expect(labelTexts(mounted.container)).not.toContain('Stale one');
    expect(termCheckboxes(mounted.container)).toHaveLength(0);
    expect(mounted.currentValue()).toEqual({ termIds: [termUid(1)] });
    expect(mounted.onValue).not.toHaveBeenCalled();
  });

  it.each(REFUSED_REFRESHES)(
    '[P2-S12-AC-135] hides the loaded options and writes nothing when a same-scope refresh is refused with %i',
    async (status, copy) => {
      const fd = recordingFetcher([
        servedPage({
          items: [
            { n: 1, label: 'Alpha' },
            { n: 2, label: 'Beta' },
          ],
        }),
        failureResponse(status),
      ]);
      const mounted = mountConnectedTaxonomy({
        context: context(fd.fetcher, 0),
        value: { termIds: [termUid(2)] },
      });
      await settle();
      expect(termCheckboxes(mounted.container)).toHaveLength(2);
      mounted.rerender({ context: context(fd.fetcher, 1) });
      await settle();
      expect(fd.calls).toHaveLength(2);
      expect(noticeContains(mounted.container, copy)).toBe(true);
      expect(labelTexts(mounted.container)).not.toContain('Alpha');
      expect(labelTexts(mounted.container)).not.toContain('Beta');
      expect(termCheckboxes(mounted.container)).toHaveLength(0);
      expect(mounted.currentValue()).toEqual({ termIds: [termUid(2)] });
      expect(mounted.onValue).not.toHaveBeenCalled();
    },
  );
});

describe('the connected taxonomy selector: a 429 read', () => {
  it('[P2-S12-AC-135] announces the stated wait, dispatches nothing until it elapses and never retries by itself', async () => {
    const fd = recordingFetcher([
      failureResponse(429, { retryAfterSeconds: 30 }),
      servedPage({ items: [{ n: 1, label: 'Guitar' }] }),
    ]);
    const mounted = mountConnectedTaxonomy({ context: context(fd.fetcher) });
    await settle();
    expect(fd.calls).toHaveLength(1);
    expect(noticeContains(mounted.container, rateLimitMessage(30))).toBe(true);
    const retry = buttonNamed(mounted.container, TRY_AGAIN_LABEL);
    expect(retry.disabled).toBe(true);
    await click(retry);
    await settle();
    expect(fd.calls).toHaveLength(1);
    await advanceTimers(29_000);
    expect(fd.calls).toHaveLength(1);
    expect(buttonNamed(mounted.container, TRY_AGAIN_LABEL).disabled).toBe(true);
    await advanceTimers(1_000);
    expect(buttonNamed(mounted.container, TRY_AGAIN_LABEL).disabled).toBe(
      false,
    );
    await click(buttonNamed(mounted.container, TRY_AGAIN_LABEL));
    await settle();
    expect(fd.calls).toHaveLength(2);
    expect(termCheckboxes(mounted.container)).toHaveLength(1);
    expect(noticeContains(mounted.container, rateLimitMessage(30))).toBe(false);
  });

  it('[P2-S12-AC-135] announces the remaining wait as it counts down', async () => {
    const fd = recordingFetcher([
      failureResponse(429, { retryAfterSeconds: 30 }),
    ]);
    const mounted = mountConnectedTaxonomy({ context: context(fd.fetcher) });
    await settle();
    expect(noticeContains(mounted.container, rateLimitMessage(30))).toBe(true);
    await advanceTimers(1_000);
    expect(noticeContains(mounted.container, rateLimitMessage(29))).toBe(true);
  });
});
