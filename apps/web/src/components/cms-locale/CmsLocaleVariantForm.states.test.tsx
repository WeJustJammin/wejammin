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
import {
  mount,
  refreshStub,
  savedResult,
  sentRequest,
  submitStub,
  text,
} from './locale-variant-form.test-support';
import type { LocaleSubmitResult } from './locale-variant-submit';
import { PAGE_PATH, TITLE } from './locale-variant.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);

/**
 * Slice 12 definition governance states, `commandState` column (FE03 1043-1049), for the locale variant
 * form (CMS-03C-04). `loading` is proven in CmsLocaleVariantForm.pending.test.tsx; `empty` is "Not
 * applicable" in the spec (no test).
 */
const READY_SOURCE = {
  kind: 'ready',
  snapshot: {
    version: '9',
    sourceRevisionId: '018f0c45-73fe-7dc2-9c09-68f7ecf132ff',
    sourceHash: 'c'.repeat(64),
    texts: { [TITLE]: 'Autumn tour' },
  },
} as const;

const saveWith = async (
  result: LocaleSubmitResult | ((call: number) => LocaleSubmitResult),
  extra: Parameters<typeof mount>[0] = {},
) => {
  const submit = submitStub(result);
  const view = mount({ submit, ...extra });
  await typeInto(byLabel(view.container, 'Title'), 'Un titre');
  await click(buttonNamed(view.container, 'Save translation'));
  await flush();
  return { submit, ...view };
};
const heading = (container: HTMLElement): string =>
  container.querySelector('#cms-locale-result-heading')?.textContent ?? '';
const commit = (container: HTMLElement): HTMLButtonElement =>
  container.querySelector<HTMLButtonElement>('button[type="submit"]')!;

describe('CmsLocaleVariantForm (CMS-03C-04) commandState', () => {
  it('[P2-S12-AC-271] commandState idle: no result region is shown, the unsent scoped draft is kept and nothing is sent (CMS-03C-04)', async () => {
    const submit = submitStub();
    const { container } = mount({ submit });
    expect(container.querySelector('.cms-locale-status')).toBeNull();
    expect(commit(container).disabled).toBe(false);
    await typeInto(byLabel(container, 'Title'), 'Un titre');
    expect(byLabel<HTMLInputElement>(container, 'Title').value).toBe(
      'Un titre',
    );
    expect(container.querySelector('.cms-locale-status')).toBeNull();
    expect(commit(container).disabled).toBe(false);
    expect(submit).not.toHaveBeenCalled();
  });

  it('[P2-S12-AC-271] commandState success (kept half): names the saved draft and raises the entry version for the next save; the source is NOT refetched (D4) (CMS-03C-04)', async () => {
    const refresh = refreshStub(READY_SOURCE);
    const { submit, container } = await saveWith(
      savedResult({ version: '5', savedFieldIds: [TITLE] }),
      { refresh },
    );
    expect(heading(container)).toBe('Translation saved as a draft');
    const region = container.querySelector('.cms-locale-status') as HTMLElement;
    expect(region.getAttribute('role')).toBe('status');
    expect(region.textContent).toContain(
      'State: Draft. 1 field saved in fr-CA.',
    );
    expect(text(container)).toContain('Entry version5');
    expect(text(container)).toContain('StatusDraft');
    expect(document.activeElement?.id).toBe('cms-locale-result-heading');
    // The next save is based on the saved version: the draft is now the stored translation.
    await click(buttonNamed(container, 'Save translation'));
    await flush();
    expect(sentRequest(submit, 1).expectedVersion).toBe('5');
  });

  describe('commandState error', () => {
    it('[P2-S12-AC-271] commandState error: a 401 offers sign-in returning to this page and never a step-up route (CMS-03C-04 lists no STEP_UP_REQUIRED row)', async () => {
      const { container } = await saveWith({ kind: 'rejected', status: 401 });
      expect(heading(container)).toBe('Sign in again');
      const link = Array.from(container.querySelectorAll('a')).find(
        (a) => a.textContent === 'Sign in',
      );
      expect(link?.getAttribute('href')).toBe(
        `/auth/sign-in?returnTo=${encodeURIComponent(PAGE_PATH)}`,
      );
      expect(container.querySelector('a[href*="step-up"]')).toBeNull();
      expect(byLabel<HTMLInputElement>(container, 'Title').value).toBe(
        'Un titre',
      );
    });

    it('[P2-S12-AC-271] commandState error (kept half): a 403 renders the fixed edit-authority copy as an alert, no step-up route; no CapabilityGate element (D1) (CMS-03C-04)', async () => {
      const { container } = await saveWith({ kind: 'rejected', status: 403 });
      expect(heading(container)).toBe('Not allowed');
      expect(
        container.querySelector('.cms-locale-status')?.getAttribute('role'),
      ).toBe('alert');
      expect(text(container)).toContain(
        'This account cannot edit this entry, so it cannot save translations for it. Nothing was saved.',
      );
      expect(container.querySelector('a[href*="step-up"]')).toBeNull();
      expect(byLabel<HTMLInputElement>(container, 'Title').value).toBe(
        'Un titre',
      );
    });

    it.each([
      [
        { kind: 'conflict', currentVersion: '9' } as const,
        'This entry changed',
        'The entry or its source changed after this page loaded. Your translations are kept.',
      ],
      [
        { kind: 'limit_reached' } as const,
        'No more languages can be added',
        'This entry already has translations in 32 languages, the most it can have. Nothing was saved.',
      ],
    ])(
      '[P2-S12-AC-271] commandState error: a 409 %j renders fixed copy and refetches the source before the save is offered again (CMS-03C-04)',
      async (result, expectedHeading, copy) => {
        const refresh = refreshStub(READY_SOURCE);
        const { container } = await saveWith(result, { refresh });
        expect(heading(container)).toBe(expectedHeading);
        expect(text(container)).toContain(copy);
        expect(refresh).toHaveBeenCalledTimes(1);
        expect(commit(container).disabled).toBe(true);
        expect(byLabel<HTMLInputElement>(container, 'Title').value).toBe(
          'Un titre',
        );
      },
    );

    it('[P2-S12-AC-271] commandState error (kept half): a 409 FALLBACK_CHAIN_MISMATCH renders fixed copy and adopts the active order the 409 carries; the entry is NOT refetched (D2) (CMS-03C-04)', async () => {
      const refresh = refreshStub(READY_SOURCE);
      const { container } = await saveWith(
        {
          kind: 'chain_mismatch',
          activeFallbackChain: ['fr', 'de', 'en-US'],
        },
        { refresh },
      );
      expect(heading(container)).toBe('Fallback order changed');
      expect(text(container)).toContain(
        'The fallback order for fr-CA changed. Reload the current order and review your translation before saving.',
      );
      expect(text(container)).toContain('fr-CA: fr → de → en-US');
      expect(refresh).not.toHaveBeenCalled();
    });

    it('[P2-S12-AC-271] commandState error (kept half): a 422 renders the fixed refused copy in the result region and keeps every value; the server reason is NOT shown at a field (D6) (CMS-03C-04)', async () => {
      const { container } = await saveWith({ kind: 'rejected', status: 422 });
      expect(heading(container)).toBe('Could not save');
      expect(
        container.querySelector('.cms-locale-status')?.getAttribute('role'),
      ).toBe('alert');
      expect(text(container)).toContain(
        'A translation was refused. Check each value against the limit shown beside its field, then save again.',
      );
      expect(document.activeElement?.id).toBe('cms-locale-result-heading');
      expect(byLabel<HTMLInputElement>(container, 'Title').value).toBe(
        'Un titre',
      );
    });
  });

  it('[P2-S12-AC-271] commandState degraded (kept half): an unknown outcome claims no success and replays the same Idempotency-Key; the entry is NOT refetched before the retry (D3) (CMS-03C-04)', async () => {
    const refresh = refreshStub(READY_SOURCE);
    const { submit, container } = await saveWith(
      (call) =>
        call === 0
          ? { kind: 'uncertain' }
          : savedResult({ savedFieldIds: [TITLE] }),
      { refresh },
    );
    expect(heading(container)).toBe('Save not confirmed');
    expect(text(container)).toContain(
      'We could not confirm whether the save went through. Saving again is safe: the same request is never applied twice.',
    );
    expect(text(container)).not.toContain('Translation saved as a draft');
    await click(buttonNamed(container, 'Save translation'));
    await flush();
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[1]?.[2]).toBe(submit.mock.calls[0]?.[2]);
    expect(heading(container)).toBe('Translation saved as a draft');
  });

  describe('commandState disabled', () => {
    it('[P2-S12-AC-271] commandState disabled: without a security token the reason is stated and the commit control is off; the island takes no permittedNextActions (CMS-03C-04)', async () => {
      const submit = submitStub();
      const { container } = mount({ csrfToken: '', submit });
      expect(text(container)).toContain(
        'Saving is unavailable because this page has no security token. Reload the page.',
      );
      expect(commit(container).disabled).toBe(true);
      await click(commit(container));
      expect(submit).not.toHaveBeenCalled();
    });

    it('[P2-S12-AC-271] commandState disabled: after a 409 the commit control is off until the refetched source is used, and a 429 holds it for the stated wait (CMS-03C-04)', async () => {
      const conflict = await saveWith(
        { kind: 'conflict', currentVersion: '9' },
        { refresh: refreshStub(READY_SOURCE) },
      );
      expect(commit(conflict.container).disabled).toBe(true);
      expect(text(conflict.container)).toContain('Use the current source');
      conflict.unmount();
      const limited = await saveWith({
        kind: 'rejected',
        status: 429,
        retryAfterSeconds: 30,
      });
      expect(commit(limited.container).disabled).toBe(true);
      expect(text(limited.container)).toContain(
        'Waiting before you can save again.',
      );
    });
  });
});
