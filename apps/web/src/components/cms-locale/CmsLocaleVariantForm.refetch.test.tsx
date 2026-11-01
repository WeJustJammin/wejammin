// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buttonNamed,
  byLabel,
  click,
  disableReactAct,
  enableReactAct,
  flush,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import type { LocaleSourceRefreshResult } from './locale-source-refresh';
import {
  mount,
  refreshStub,
  savedResult,
  sentRequest,
  submitStub,
  text,
} from './locale-variant-form.test-support';
import type { LocaleSubmitResult } from './locale-variant-submit';
import { HASH, SOURCE_REVISION_ID, TITLE } from './locale-variant.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);

/**
 * FE03 1048 `commandState` (CMS-03C-04) with DEC-242 item 3: an unknown outcome "reconciles by refetching ...
 * before any retry" and a success refetches what the form shows (the source), both by themselves. The locale
 * FALLBACK_CHAIN_MISMATCH keeps adopting the 409 body (DEC-242 item 2), so it is not part of this file.
 */
const ready = (
  version: string,
  extra: Partial<{ sourceRevisionId: string; sourceHash: string }> = {},
): LocaleSourceRefreshResult => ({
  kind: 'ready',
  snapshot: {
    version,
    sourceRevisionId: SOURCE_REVISION_ID,
    sourceHash: HASH,
    texts: { [TITLE]: 'Spring tour' },
    ...extra,
  },
});
const MOVED = { sourceHash: 'c'.repeat(64) };

const saveWith = async (
  result: LocaleSubmitResult | ((call: number) => LocaleSubmitResult),
  refresh: ReturnType<typeof refreshStub>,
) => {
  const submit = submitStub(result);
  const view = mount({ submit, refresh });
  await typeInto(byLabel(view.container, 'Title'), 'Un titre');
  await click(buttonNamed(view.container, 'Save translation'));
  await flush();
  return { submit, ...view };
};
const commit = (container: HTMLElement): HTMLButtonElement =>
  container.querySelector<HTMLButtonElement>('button[type="submit"]')!;
const title = (container: HTMLElement): string =>
  byLabel<HTMLInputElement>(container, 'Title').value;

describe('CmsLocaleVariantForm unknown outcome (CMS-03C-04), FE03 1048', () => {
  it('[P2-S12-AC-271] commandState degraded: an unknown outcome reads the entry by itself, and an unchanged entry lets the same request be replayed with its key', async () => {
    const refresh = refreshStub(ready('4'));
    const { submit, container } = await saveWith(
      (call) =>
        call === 0
          ? { kind: 'uncertain' }
          : savedResult({ savedFieldIds: [TITLE] }),
      refresh,
    );
    expect(text(container)).toContain('We could not confirm');
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(commit(container).disabled).toBe(false);
    expect(title(container)).toBe('Un titre');
    await click(buttonNamed(container, 'Save translation'));
    await flush();
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[1]?.[2]).toBe(submit.mock.calls[0]?.[2]);
    expect(text(container)).toContain('Translation saved as a draft');
  });

  it('[P2-S12-AC-271] commandState degraded: while the read has not verified, no retry is possible, and the control repeats a failed read', async () => {
    const answers: LocaleSourceRefreshResult[] = [
      { kind: 'failed', status: 503 },
      ready('4'),
    ];
    const refresh = refreshStub({ kind: 'failed', status: null });
    refresh.mockImplementation(
      async () => answers.shift() ?? { kind: 'failed', status: null },
    );
    const { submit, container } = await saveWith(
      { kind: 'uncertain' },
      refresh,
    );
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(commit(container).disabled).toBe(true);
    await click(commit(container));
    expect(submit).toHaveBeenCalledTimes(1);
    await click(buttonNamed(container, 'Reload the source'));
    await flush();
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(commit(container).disabled).toBe(false);
    expect(title(container)).toBe('Un titre');
  });

  it.each([
    ['only the entry version moved', ready('5')],
    ['the source moved', ready('5', MOVED)],
  ])(
    '[P2-S12-AC-271] commandState degraded: when %s, the unknown outcome is reported and the retry is the identical request under the same key and If-Match (DEC-244 3)',
    async (_name, answer) => {
      const refresh = refreshStub(answer);
      const { submit, container } = await saveWith(
        (call) =>
          call === 0
            ? { kind: 'uncertain' }
            : savedResult({ version: '5', savedFieldIds: [TITLE] }),
        refresh,
      );
      expect(refresh).toHaveBeenCalledTimes(1);
      // Reported, never adopted: the status stays, the entry version stays, no review gate stands in the way.
      expect(text(container)).toContain('Save not confirmed');
      expect(text(container)).toContain(
        'The entry changed after this page loaded, so the translation may have been saved. Sending again retries the same request and cannot save it twice.',
      );
      expect(text(container)).toContain('Entry version4');
      expect(text(container)).not.toContain('Use the current source');
      expect(commit(container).disabled).toBe(false);
      await click(buttonNamed(container, 'Save translation'));
      await flush();
      // No second, different write can occur: same body, same key, same If-Match operand.
      expect(submit).toHaveBeenCalledTimes(2);
      expect(JSON.stringify(sentRequest(submit, 1))).toBe(
        JSON.stringify(sentRequest(submit, 0)),
      );
      expect(sentRequest(submit, 1).expectedVersion).toBe('4');
      expect(submit.mock.calls[1]?.[2]).toBe(submit.mock.calls[0]?.[2]);
      expect(text(container)).toContain('Translation saved as a draft');
    },
  );
});

describe('CmsLocaleVariantForm commandState success (CMS-03C-04), FE03 1048', () => {
  it('[P2-S12-AC-271] commandState success: a verified save refetches the source by itself and, when it did not move, changes nothing the person sees', async () => {
    const refresh = refreshStub(ready('5'));
    const { container } = await saveWith(
      savedResult({ version: '5', savedFieldIds: [TITLE] }),
      refresh,
    );
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(text(container)).toContain('Translation saved as a draft');
    expect(text(container)).toContain('Entry version5');
    expect(text(container)).not.toContain('Use the current source');
    expect(commit(container).disabled).toBe(false);
  });

  it('[P2-S12-AC-271] commandState success: a source that moved while saving puts the review of the current source in front of the next save, and keeps the saved translation', async () => {
    const refresh = refreshStub(ready('5', MOVED));
    const { container } = await saveWith(
      savedResult({ version: '5', savedFieldIds: [TITLE] }),
      refresh,
    );
    expect(text(container)).toContain('Translation saved as a draft');
    expect(text(container)).toContain('Use the current source');
    expect(commit(container).disabled).toBe(true);
    expect(title(container)).toBe('Un titre');
  });

  it('[P2-S12-AC-271] commandState success: an entry version that moved with the same source is adopted for the next save, with no review', async () => {
    const refresh = refreshStub(ready('8'));
    const { container } = await saveWith(
      savedResult({ version: '5', savedFieldIds: [TITLE] }),
      refresh,
    );
    expect(text(container)).toContain('Entry version8');
    expect(text(container)).not.toContain('Use the current source');
    expect(commit(container).disabled).toBe(false);
  });

  it('[P2-S12-AC-271] commandState success: an older entry version than the one the save returned is never adopted (review V19 m2)', async () => {
    const refresh = refreshStub(ready('4'));
    const { submit, container } = await saveWith(
      savedResult({ version: '5', savedFieldIds: [TITLE] }),
      refresh,
    );
    expect(text(container)).toContain('Entry version5');
    await click(buttonNamed(container, 'Save translation'));
    await flush();
    expect(sentRequest(submit, 1).expectedVersion).toBe('5');
  });

  it('[P2-S12-AC-271] commandState success: a refetch that fails leaves the confirmed save and the form as they are', async () => {
    const refresh = refreshStub({ kind: 'failed', status: 503 });
    const { container } = await saveWith(
      savedResult({ version: '5', savedFieldIds: [TITLE] }),
      refresh,
    );
    expect(text(container)).toContain('Translation saved as a draft');
    expect(text(container)).toContain('Entry version5');
    expect(commit(container).disabled).toBe(false);
  });
});
