// @vitest-environment jsdom

/**
 * The connected CMS-03C-17 taxonomy field over a VERIFIED EMPTY page (P2-S12-AC-135; FE03
 * "Slice 12 governed definition, composition, taxonomy, locale and related-content
 * surfaces"). The shared host, control and selector read are used as they are, and only the
 * fetch boundary is faked.
 *
 * The defect these two cases pin: an empty 200 answer used to drop the page and render the
 * notice without the control, so a stored selection could never be cleared from the field.
 * The released behaviour keeps the verified empty page (stale false, with the empty notice
 * beside it): only the auth refusals still drop the page (401, 403, 404), and a scope change
 * drops it too.
 *
 * Intended failures today: the polite selection count is missing in both cases, because the
 * control that announces it is not rendered, and with it the explicit Clear selection command.
 */

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

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
  announcedCount,
  deferred,
  mountConnectedTaxonomy,
  noticeContains,
  recordingFetcher,
  selectedTermIds,
  servedPage,
  settle,
  termCheckboxes,
  termUid,
  writeKeys,
} from './cms-taxonomy-connected-fixtures.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);
afterEach(() => document.body.replaceChildren());

/** The leaf's own command: the one path that writes an empty list. */
const CLEAR_LABEL = 'Clear selection';

describe('the connected taxonomy field over a verified empty page', () => {
  it('[P2-S12-AC-135] keeps a stored selection announced and clearable when the first page is empty', async () => {
    const refetch = deferred<Response>();
    const fd = recordingFetcher([
      servedPage({ items: [] }),
      refetch.promise,
      servedPage({ items: [], pageVersion: '9' }),
    ]);
    const context = {
      typeKey: ENTRY_TYPE_KEY,
      locale: ENTRY_LOCALE,
      fetcher: fd.fetcher,
      refreshToken: 0,
    };
    const mounted = mountConnectedTaxonomy({
      context,
      value: { termIds: [termUid(1), termUid(2)] },
    });
    await settle();
    expect(fd.calls).toHaveLength(1);
    expect(noticeContains(mounted.container, CONNECTED_COPY.empty)).toBe(true);
    expect(termCheckboxes(mounted.container)).toHaveLength(0);
    expect(announcedCount(mounted.container)).toBe('2 terms selected.');
    const clear = buttonNamed(mounted.container, CLEAR_LABEL);
    expect(clear.disabled).toBe(false);
    expect(mounted.onValue).not.toHaveBeenCalled();
    mounted.rerender({ context: { ...context, refreshToken: 1 } });
    await settle();
    expect(fd.calls).toHaveLength(2);
    expect(mounted.onValue).not.toHaveBeenCalled();
    await settle(() =>
      refetch.resolve(servedPage({ items: [], pageVersion: '11' })),
    );
    expect(mounted.onValue).not.toHaveBeenCalled();
    expect(announcedCount(mounted.container)).toBe('2 terms selected.');
    expect(buttonNamed(mounted.container, CLEAR_LABEL).disabled).toBe(false);
    await click(buttonNamed(mounted.container, CLEAR_LABEL));
    expect(mounted.onValue).toHaveBeenCalledTimes(1);
    expect(mounted.emitted()).toEqual({ termIds: [] });
    expect(writeKeys(mounted.emitted())).toEqual(['termIds']);
    expect(fd.calls).toHaveLength(2);
  });

  it('[P2-S12-AC-135] keeps the stored selection when a reload answers with an empty verified page, until it is cleared', async () => {
    const fd = recordingFetcher([
      servedPage({
        items: [
          { n: 1, label: 'Alpha' },
          { n: 2, label: 'Beta' },
        ],
      }),
      servedPage({ items: [], pageVersion: '9' }),
    ]);
    const context = {
      typeKey: ENTRY_TYPE_KEY,
      locale: ENTRY_LOCALE,
      fetcher: fd.fetcher,
      refreshToken: 0,
    };
    const mounted = mountConnectedTaxonomy({
      context,
      value: { termIds: [termUid(1)] },
    });
    await settle();
    expect(byLabel<HTMLInputElement>(mounted.container, 'Alpha').checked).toBe(
      true,
    );
    expect(announcedCount(mounted.container)).toBe('1 term selected.');
    mounted.rerender({ context: { ...context, refreshToken: 1 } });
    await settle();
    expect(fd.calls).toHaveLength(2);
    expect(noticeContains(mounted.container, CONNECTED_COPY.empty)).toBe(true);
    expect(announcedCount(mounted.container)).toBe('1 term selected.');
    expect(selectedTermIds(mounted.currentValue())).toEqual([termUid(1)]);
    expect(mounted.onValue).not.toHaveBeenCalled();
    expect(buttonNamed(mounted.container, CLEAR_LABEL).disabled).toBe(false);
    await click(buttonNamed(mounted.container, CLEAR_LABEL));
    expect(mounted.onValue).toHaveBeenCalledTimes(1);
    expect(mounted.emitted()).toEqual({ termIds: [] });
    expect(fd.calls).toHaveLength(2);
  });
});
