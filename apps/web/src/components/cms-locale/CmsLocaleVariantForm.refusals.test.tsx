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
import type { LocaleSubmitResult } from './locale-variant-submit';
import {
  HASH,
  PAGE_PATH,
  SOURCE_REVISION_ID,
  TITLE,
} from './locale-variant.test-support';
import {
  mount,
  refreshStub,
  savedResult,
  sentRequest,
  submitStub,
  text,
} from './locale-variant-form.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);

const NEW_REVISION = '018f0c45-73fe-7dc2-9c09-68f7ecf132ff';
const NEW_HASH = 'c'.repeat(64);

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

describe('CmsLocaleVariantForm: 409 FALLBACK_CHAIN_MISMATCH (FE03 :1336)', () => {
  it('shows the fixed copy, replaces the order with the active one, keeps the values and submits the new order next', async () => {
    const { submit, container } = await saveWith((call) =>
      call === 0
        ? { kind: 'chain_mismatch', activeFallbackChain: ['fr', 'de', 'en-US'] }
        : savedResult({ savedFieldIds: [TITLE] }),
    );
    expect(heading(container)).toBe('Fallback order changed');
    expect(text(container)).toContain(
      'The fallback order for fr-CA changed. Reload the current order and review your translation before saving.',
    );
    expect(text(container)).toContain('fr-CA: fr → de → en-US');
    expect(byLabel<HTMLInputElement>(container, 'Title').value).toBe(
      'Un titre',
    );
    expect(document.activeElement).toBe(
      container.querySelector('#cms-locale-result-heading'),
    );
    await click(buttonNamed(container, 'Save translation'));
    await flush();
    expect(sentRequest(submit, 1).fallbackChain).toEqual(['fr', 'de', 'en-US']);
    expect(submit.mock.calls[1]?.[2]).not.toBe(submit.mock.calls[0]?.[2]);
  });
});

describe('CmsLocaleVariantForm: 409 conflict and locale_limit_reached', () => {
  it.each([
    [
      { kind: 'conflict', currentVersion: '9' } as const,
      'This entry changed',
      'The entry or its source changed after this page loaded. Your translations are kept. Review the current source, then use it before you save again.',
    ],
    [
      { kind: 'limit_reached' } as const,
      'No more languages can be added',
      'This entry already has translations in 32 languages, the most it can have. Nothing was saved.',
    ],
  ])(
    'shows %j as fixed copy, refetches the source and blocks saving until it is used',
    async (result, expectedHeading, copy) => {
      const refresh = refreshStub({
        kind: 'ready',
        snapshot: {
          version: '9',
          sourceRevisionId: NEW_REVISION,
          sourceHash: NEW_HASH,
          texts: { [TITLE]: 'Autumn tour' },
        },
      });
      const { submit, container } = await saveWith(
        (call) => (call === 0 ? result : savedResult({ version: '10' })),
        { refresh },
      );
      expect(heading(container)).toBe(expectedHeading);
      expect(text(container)).toContain(copy);
      expect(refresh).toHaveBeenCalledTimes(1);
      expect(
        container.querySelector<HTMLButtonElement>('button[type="submit"]')
          ?.disabled,
      ).toBe(true);
      // The refreshed source is visible but nothing is adopted until the person says so.
      expect(text(container)).toContain('Autumn tour');
      await click(buttonNamed(container, 'Use the current source'));
      expect(
        container.querySelector<HTMLButtonElement>('button[type="submit"]')
          ?.disabled,
      ).toBe(false);
      await click(buttonNamed(container, 'Save translation'));
      await flush();
      expect(submit.mock.calls[1]?.[0]).toMatchObject({
        expectedVersion: '9',
        sourceRevisionId: NEW_REVISION,
        sourceHash: NEW_HASH,
      });
      expect(byLabel<HTMLInputElement>(container, 'Title').value).toBe(
        'Un titre',
      );
    },
  );

  it('keeps the old source and offers a retry when the refetch fails, never enabling a blind save', async () => {
    const refresh = refreshStub({ kind: 'failed', status: 503 });
    const { submit, container } = await saveWith(
      { kind: 'conflict', currentVersion: null },
      { refresh },
    );
    expect(text(container)).toContain(
      'The current source could not be verified. Your translations are kept. Try again; nothing was applied.',
    );
    expect(
      container.querySelector<HTMLButtonElement>('button[type="submit"]')
        ?.disabled,
    ).toBe(true);
    expect(() => buttonNamed(container, 'Use the current source')).toThrow();
    await click(buttonNamed(container, 'Reload the source'));
    await flush();
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(sentRequest(submit).sourceHash).toBe(HASH);
    expect(sentRequest(submit).sourceRevisionId).toBe(SOURCE_REVISION_ID);
  });
});

describe('CmsLocaleVariantForm: typed refusals keep the input and say one fixed thing each', () => {
  it.each([
    [
      403,
      'Not allowed',
      'This account cannot edit this entry, so it cannot save translations for it. Nothing was saved.',
    ],
    [
      404,
      'Entry not available',
      'This entry or its source revision is not available to this account. Nothing was saved.',
    ],
    [
      400,
      'Invalid request',
      'This request could not be read. Reload the page and try again.',
    ],
    [
      415,
      'Could not save',
      'The request could not be sent. Reload the page and try again.',
    ],
    [
      422,
      'Could not save',
      'A translation was refused. Check each value against the limit shown beside its field, then save again.',
    ],
    [
      500,
      'Could not save',
      'The translation could not be saved. Nothing was confirmed. Try again shortly.',
    ],
    [
      503,
      'Temporarily unavailable',
      'The translation service is not responding. Nothing was confirmed. Try again shortly.',
    ],
  ] as const)(
    'maps %s to its own heading and copy',
    async (status, expectedHeading, copy) => {
      const { container } = await saveWith({ kind: 'rejected', status });
      expect(heading(container)).toBe(expectedHeading);
      expect(text(container)).toContain(copy);
      expect(byLabel<HTMLInputElement>(container, 'Title').value).toBe(
        'Un titre',
      );
      expect(document.activeElement).toBe(
        container.querySelector('#cms-locale-result-heading'),
      );
      expect(container.querySelector('[role="alert"]')).not.toBeNull();
    },
  );

  it('keeps the 403 and the 404 apart', async () => {
    const forbidden = await saveWith({ kind: 'rejected', status: 403 });
    const missing = await saveWith({ kind: 'rejected', status: 404 });
    expect(heading(forbidden.container)).not.toBe(heading(missing.container));
  });

  it('sends the person to sign in with this page as the return target on a 401', async () => {
    const { container } = await saveWith({ kind: 'rejected', status: 401 });
    expect(heading(container)).toBe('Sign in again');
    const link = Array.from(container.querySelectorAll('a')).find(
      (a) => a.textContent === 'Sign in',
    );
    expect(link?.getAttribute('href')).toBe(
      `/auth/sign-in?returnTo=${encodeURIComponent(PAGE_PATH)}`,
    );
  });

  it('never prints anything the server said', async () => {
    const { container } = await saveWith({ kind: 'rejected', status: 503 });
    expect(text(container)).not.toMatch(/Server text|requestId|DEPENDENCY/u);
  });
});

describe('CmsLocaleVariantForm: rate limit and unknown outcome', () => {
  it('states the wait on a 429, keeps the input and holds the save for the wait', async () => {
    const { container } = await saveWith({
      kind: 'rejected',
      status: 429,
      retryAfterSeconds: 30,
    });
    expect(heading(container)).toBe('Too many requests');
    expect(text(container)).toContain(
      'Too many requests. Try again in 30 seconds.',
    );
    expect(text(container)).toContain('Waiting before you can save again.');
    expect(
      container.querySelector<HTMLButtonElement>('button[type="submit"]')
        ?.disabled,
    ).toBe(true);
    expect(byLabel<HTMLInputElement>(container, 'Title').value).toBe(
      'Un titre',
    );
  });

  it('keeps the idempotency key and replays the identical request while the outcome is unknown, and changes it with the request', async () => {
    const { submit, container } = await saveWith((call) =>
      call < 2
        ? { kind: 'uncertain' }
        : savedResult({ savedFieldIds: [TITLE] }),
    );
    expect(heading(container)).toBe('Save not confirmed');
    expect(text(container)).toContain(
      'We could not confirm whether the save went through. Saving again is safe: the same request is never applied twice.',
    );
    await click(buttonNamed(container, 'Save translation'));
    await flush();
    expect(submit.mock.calls[1]?.[2]).toBe(submit.mock.calls[0]?.[2]);
    await typeInto(byLabel(container, 'Title'), 'Un autre titre');
    await click(buttonNamed(container, 'Save translation'));
    await flush();
    expect(submit.mock.calls[2]?.[2]).not.toBe(submit.mock.calls[0]?.[2]);
  });
});
