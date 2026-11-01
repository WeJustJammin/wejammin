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
  fieldInits,
  LEGAL,
  LOCALE,
  TITLE,
  BLURB,
  ENTRY_ID,
  HASH,
  SOURCE_REVISION_ID,
  resolution,
  variantInit,
} from './locale-variant.test-support';
import {
  mount,
  savedResult,
  sentRequest,
  submitStub,
  text,
} from './locale-variant-form.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);

const versionOf = (container: HTMLElement): string | undefined =>
  Array.from(container.querySelectorAll('dt')).find(
    (term) => term.textContent === 'Entry version',
  )?.nextElementSibling?.textContent ?? undefined;

const statusOf = (container: HTMLElement): string | undefined =>
  Array.from(container.querySelectorAll('dt')).find(
    (term) => term.textContent === 'Status',
  )?.nextElementSibling?.textContent ?? undefined;

describe('CmsLocaleVariantForm: what the page shows (FE03 :891, :1122, :1336)', () => {
  it('states the entry, the language and the read-only fallback order as "{target}: {a} → {default}"', () => {
    const { container } = mount();
    expect(text(container)).toContain('fr-CA: fr → en-US');
    expect(text(container)).toContain('Entry version');
    expect(container.querySelector('input[name*="fallback"]')).toBeNull();
    expect(container.querySelectorAll('input, textarea, select')).toHaveLength(
      3,
    );
  });

  it('states the default language as having no fallback order', () => {
    const { container } = mount({ fallbackChain: [] });
    expect(text(container)).toContain(
      'fr-CA: no fallback order, this is the default language',
    );
  });

  it('offers exactly the localizable fields, with the label and no "(required)", and each rule in words', () => {
    const { container } = mount();
    for (const label of ['Title', 'Legal notice', 'Blurb'])
      expect(byLabel(container, label)).toBeTruthy();
    expect(text(container)).not.toContain('(required)');
    expect(text(container)).toContain(
      'No fallback: this field is never shown in another language, and publishing this language needs it.',
    );
    expect(text(container)).toContain(
      'Fallback allowed: untranslated, it follows the fallback order.',
    );
  });

  it('never calls a translation required, even for a field the schema requires', async () => {
    const submit = submitStub(savedResult({ savedFieldIds: [TITLE] }));
    const { container } = mount({
      submit,
      fields: fieldInits().map((field) => ({
        ...field,
        descriptor: { ...field.descriptor, required: true },
      })),
    });
    expect(text(container)).not.toContain('(required)');
    await typeInto(byLabel(container, 'Title'), 'Un titre');
    await click(buttonNamed(container, 'Save translation'));
    await flush();
    // The other required fields are empty and are simply not translated.
    expect(sentRequest(submit).fields).toEqual([
      { fieldId: TITLE, value: 'Un titre' },
    ]);
  });

  it('shows the source text of a fallback-permitted field only, in its own language, never beside a no_fallback field', () => {
    const { container } = mount();
    const source = container.querySelector('[lang="en-US"]');
    expect(source?.textContent).toBe('Spring tour');
    expect(text(container)).not.toContain('All rights reserved');
    expect(text(container)).toContain(
      'The source text is not shown for a no-fallback field.',
    );
  });

  it('[P2-S12-AC-234] states the derived variant status in words, and the rule of a stale one', () => {
    const states = [
      ['untranslated', 'Untranslated'],
      ['draft', 'Draft'],
      ['review', 'In review'],
      ['approved', 'Approved'],
      ['stale', 'Out of date'],
    ] as const;
    for (const [state, words] of states) {
      const { container } = mount({ variant: variantInit({ state }) });
      expect(statusOf(container), state).toBe(words);
    }
  });

  it('never invents a status: with no resolution a field says nothing of itself', () => {
    const { container } = mount();
    expect(text(container)).not.toContain('Translated in this language');
    expect(text(container)).not.toContain('are not available on this page yet');
  });

  it('[P2-S12-AC-058] starts from the stored translation, so an untouched field is kept by the next save', async () => {
    const submit = submitStub(savedResult({ savedFieldIds: [TITLE, BLURB] }));
    const { container } = mount({
      submit,
      variant: variantInit({
        state: 'draft',
        values: { [TITLE]: 'Tournée', [BLURB]: 'Accroche' },
      }),
    });
    expect((byLabel(container, 'Title') as HTMLInputElement).value).toBe(
      'Tournée',
    );
    expect((byLabel(container, 'Blurb') as HTMLInputElement).value).toBe(
      'Accroche',
    );
    expect(
      (byLabel(container, 'Legal notice') as HTMLTextAreaElement).value,
    ).toBe('');
    await typeInto(byLabel(container, 'Blurb'), 'Nouvelle accroche');
    await click(buttonNamed(container, 'Save translation'));
    await flush();
    expect(sentRequest(submit).fields).toEqual([
      { fieldId: TITLE, value: 'Tournée' },
      { fieldId: BLURB, value: 'Nouvelle accroche' },
    ]);
  });

  it('[P2-S12-AC-058] saves an untouched stored translation as it is, with no edit at all', async () => {
    const submit = submitStub(savedResult({ savedFieldIds: [TITLE] }));
    const { container } = mount({
      submit,
      variant: variantInit({ state: 'draft', values: { [TITLE]: 'Tournée' } }),
    });
    await click(buttonNamed(container, 'Save translation'));
    await flush();
    expect(sentRequest(submit).fields).toEqual([
      { fieldId: TITLE, value: 'Tournée' },
    ]);
  });

  it('[P2-S12-AC-058] marks the fields the read named stale before any save and offers Revalidate', async () => {
    const submit = submitStub(savedResult({ savedFieldIds: [TITLE] }));
    const { container } = mount({
      submit,
      variant: variantInit({
        state: 'stale',
        values: { [TITLE]: 'Tournée' },
        staleFieldIds: [TITLE],
      }),
      resolutions: [resolution(TITLE, { stale: true })],
    });
    expect(statusOf(container)).toBe('Out of date');
    expect(text(container)).toContain(
      'Translated in this language, but the source changed since.',
    );
    await click(buttonNamed(container, 'Revalidate translation'));
    await flush();
    expect(submit).toHaveBeenCalledTimes(1);
    expect(sentRequest(submit).fields).toEqual([
      { fieldId: TITLE, value: 'Tournée' },
    ]);
  });

  it('marks a stale field from the read’s stale ids even when its resolution is not listed', () => {
    const { container } = mount({
      variant: variantInit({
        state: 'stale',
        values: { [TITLE]: 'Tournée' },
        staleFieldIds: [TITLE],
      }),
    });
    expect(text(container)).toContain(
      'The source changed since this was translated. Revalidate it.',
    );
    expect(buttonNamed(container, 'Revalidate translation')).toBeTruthy();
  });

  it('shows the status Draft after a save, whatever it was before', async () => {
    const submit = submitStub(savedResult({ savedFieldIds: [TITLE] }));
    const { container } = mount({
      submit,
      variant: variantInit({
        state: 'approved',
        values: { [TITLE]: 'Tournée' },
      }),
    });
    expect(statusOf(container)).toBe('Approved');
    await click(buttonNamed(container, 'Save translation'));
    await flush();
    expect(statusOf(container)).toBe('Draft');
  });

  it('shows each resolution as text and never another language’s text for a no_fallback field', () => {
    const { container } = mount({
      resolutions: [
        resolution(TITLE),
        resolution(BLURB, {
          provenance: 'localized_fallback',
          resolvedFromLocale: 'en-US',
        }),
        resolution(LEGAL, {
          mode: 'no_fallback',
          outcome: 'missing',
          provenance: 'missing',
          blocking: true,
          reasonCode: 'no_fallback_missing',
        }),
      ],
    });
    const t = text(container);
    expect(t).toContain('Translated in this language.');
    expect(t).toContain(
      'Not translated yet. Readers see the en-US version through the fallback order.',
    );
    expect(t).toContain(
      'Missing. This field never uses another language, so publishing this language is blocked until you translate it.',
    );
    expect(t).not.toContain('All rights reserved');
  });

  it('lists a localizable field this page cannot write, and offers no form when none can be written', () => {
    const { container } = mount({ unavailableFields: ['Body'] });
    expect(text(container)).toContain(
      'These localizable fields cannot be translated on this page yet: Body.',
    );
    const empty = mount({ fields: [] });
    expect(text(empty.container)).toContain(
      'This entry’s content type has no field that can be translated on this page.',
    );
    expect(() => buttonNamed(empty.container, 'Save translation')).toThrow();
  });

  it('warns before the first save that a save writes exactly what is on the page', () => {
    expect(text(mount().container)).toContain(
      'Saving writes a new draft of this language with exactly the translations on this page. A field you leave empty is not translated, even if an earlier save translated it.',
    );
  });
});

describe('CmsLocaleVariantForm: saving (CMS-03C-04)', () => {
  it('sends the exact request with the CSRF token and a fresh idempotency key, then shows the saved draft state', async () => {
    const submit = submitStub(savedResult({ savedFieldIds: [TITLE] }));
    const { container } = mount({ submit });
    await typeInto(byLabel(container, 'Title'), 'Tournée de printemps');
    await click(buttonNamed(container, 'Save translation'));
    await flush();
    expect(submit).toHaveBeenCalledTimes(1);
    expect(sentRequest(submit)).toEqual({
      entryId: ENTRY_ID,
      locale: LOCALE,
      sourceRevisionId: SOURCE_REVISION_ID,
      fields: [{ fieldId: TITLE, value: 'Tournée de printemps' }],
      fallbackChain: ['fr', 'en-US'],
      noFallbackFieldIds: [LEGAL],
      sourceHash: HASH,
      expectedVersion: '4',
    });
    expect(submit.mock.calls[0]?.[1]).toBe('csrf-token');
    expect(submit.mock.calls[0]?.[2]).toMatch(/^[0-9a-f-]{36}$/u);
    const heading = container.querySelector('#cms-locale-result-heading');
    expect(heading?.textContent).toBe('Translation saved as a draft');
    expect(document.activeElement).toBe(heading);
    expect(text(container)).toContain('State: Draft.');
    expect(versionOf(container)).toBe('5');
  });

  it('marks the saved field in its row, and uses the next version and a new key for the next save', async () => {
    const submit = submitStub(() => savedResult({ savedFieldIds: [TITLE] }));
    const { container } = mount({ submit });
    await typeInto(byLabel(container, 'Title'), 'Un');
    await click(buttonNamed(container, 'Save translation'));
    await flush();
    expect(text(container)).toContain('Saved in this draft.');
    await typeInto(byLabel(container, 'Title'), 'Deux');
    await click(buttonNamed(container, 'Save translation'));
    await flush();
    expect(sentRequest(submit, 1).expectedVersion).toBe('5');
    expect(submit.mock.calls[1]?.[2]).not.toBe(submit.mock.calls[0]?.[2]);
  });

  it('names a field that breaks its own limit and sends nothing', async () => {
    const submit = submitStub();
    const { container } = mount({ submit });
    await typeInto(byLabel(container, 'Title'), 'x'.repeat(41));
    await click(buttonNamed(container, 'Save translation'));
    await flush();
    expect(submit).not.toHaveBeenCalled();
    const heading = container.querySelector('#cms-locale-result-heading');
    expect(heading?.textContent).toBe('Check the translation');
    expect(document.activeElement).toBe(heading);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'Title',
    );
    expect(text(container)).toContain('1 problem to fix; nothing was sent.');
    // The summary link moves focus to the field it names.
    const link = container.querySelector<HTMLAnchorElement>('[role="alert"] a');
    await click(link as HTMLElement);
    expect(document.activeElement).toBe(byLabel(container, 'Title'));
  });

  it('refuses an empty form before any send', async () => {
    const submit = submitStub();
    const { container } = mount({ submit });
    await click(buttonNamed(container, 'Save translation'));
    await flush();
    expect(submit).not.toHaveBeenCalled();
    expect(text(container)).toContain(
      'Enter at least one translation before saving.',
    );
  });

  it('holds saves when there is no security token', async () => {
    const submit = submitStub();
    const noToken = mount({ submit, csrfToken: '' });
    expect(buttonNamed(noToken.container, 'Save translation').disabled).toBe(
      true,
    );
    expect(text(noToken.container)).toContain(
      'Saving is unavailable because this page has no security token. Reload the page.',
    );
    expect(submit).not.toHaveBeenCalled();
  });

  it('ignores a second activation while a save is in flight', async () => {
    let release: () => void = () => undefined;
    const submit = submitStub();
    submit.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve(savedResult());
        }),
    );
    const { container } = mount({ submit });
    await typeInto(byLabel(container, 'Title'), 'Un');
    await click(buttonNamed(container, 'Save translation'));
    expect(text(container)).toContain('Saving…');
    expect(
      container.querySelector<HTMLButtonElement>('button[type="submit"]')
        ?.disabled,
    ).toBe(true);
    container.querySelector('form')?.requestSubmit();
    release();
    await flush();
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it('offers an explicit Revalidate action when a field is stale, and none otherwise', () => {
    expect(() =>
      buttonNamed(mount().container, 'Revalidate translation'),
    ).toThrow();
    const { container } = mount({
      resolutions: [resolution(TITLE, { stale: true })],
      variant: variantInit({ state: 'stale', staleFieldIds: [TITLE] }),
    });
    expect(buttonNamed(container, 'Revalidate translation')).toBeTruthy();
    expect(text(container)).toContain(
      'Translated in this language, but the source changed since.',
    );
  });
});
