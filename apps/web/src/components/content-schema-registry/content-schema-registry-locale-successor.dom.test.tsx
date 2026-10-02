// @vitest-environment jsdom

import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ContentSchemaRegistrySuccessorForm } from './ContentSchemaRegistryVersionForms';
import {
  buttonNamed,
  click,
  hiddenValue,
  mount,
  submit,
  type Mounted,
} from './content-schema-registry-locale-fields.test-support';

/**
 * FE03 "Successor replacement choice (CMS-03A-09)": the form either keeps the
 * source configuration (both fields submit null) or replaces it (both present,
 * prefilled from the source). Source and default language are inherited and
 * are never editable here.
 */

const SOURCE = {
  sourceLocale: 'en-US',
  defaultLocale: 'en-US',
  supportedLocales: ['en-US', 'fr', 'fr-CA'],
  fallbackChains: { fr: ['en-US'], 'fr-CA': ['fr', 'en-US'] },
} as const;

let mounted: Mounted | null = null;
afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.restoreAllMocks();
});

const render = (): Mounted => {
  mounted = mount(
    React.createElement(ContentSchemaRegistrySuccessorForm, {
      action: '/app/cms-content-modeling/content-types/t/versions/v',
      contentTypeId: '30000000-0000-4000-8000-000000000003',
      versionId: '40000000-0000-4000-8000-000000000004',
      csrfToken: 'csrf-token-value',
      idempotencyKey: 'cms-schema-cms-03a-09-support',
      ifMatch: '"3"',
      expectedVersion: '3',
      sourceLocaleConfig: SOURCE,
    }),
  );
  return mounted;
};

const radio = (view: Mounted, value: string): HTMLInputElement =>
  view.container.querySelector(
    `input[type="radio"][name="localeChoice"][value="${value}"]`,
  ) as HTMLInputElement;

const choice = (view: Mounted, value: 'keep' | 'change'): void => {
  click(radio(view, value));
};

describe('CMS-03A-09 successor locale replacement choice', () => {
  it('defaults to keeping the current configuration and submits both null', () => {
    const view = render();
    const group = view.container.querySelector(
      'fieldset[data-locale-choice]',
    ) as HTMLFieldSetElement;
    expect(group.querySelector('legend')?.textContent).toBe(
      'Languages in the new version',
    );
    expect(radio(view, 'keep').checked).toBe(true);
    expect(view.container.textContent).toContain(
      'Keep the current languages and fallback orders',
    );
    expect(view.container.textContent).toContain(
      'Change languages and fallback orders',
    );
    expect(hiddenValue(view.form, 'supportedLocales')).toBe('null');
    expect(hiddenValue(view.form, 'fallbackChains')).toBe('null');
    expect(view.container.querySelector('[data-locale-fields]')).toBeNull();
    expect(submit(view.form)).toBe(true);
  });

  it('reveals the controls prefilled from the source when changing', () => {
    const view = render();
    choice(view, 'change');
    expect(view.container.querySelector('[data-locale-fields]')).not.toBeNull();
    expect(hiddenValue(view.form, 'supportedLocales')).toBe(
      '["en-US","fr","fr-CA"]',
    );
    expect(JSON.parse(hiddenValue(view.form, 'fallbackChains'))).toEqual(
      SOURCE.fallbackChains,
    );
    buttonNamed(view.container, 'Remove fr from supported languages');
  });

  it('shows the inherited source and default as fixed text, never as controls', () => {
    const view = render();
    choice(view, 'change');
    expect(view.form.elements.namedItem('sourceLocale')).toBeNull();
    expect(view.form.elements.namedItem('defaultLocale')).toBeNull();
    expect(view.container.textContent).toContain(
      'Source language: en-US (inherited, cannot change)',
    );
    expect(view.container.textContent).toContain(
      'Default language: en-US (inherited, cannot change)',
    );
    expect(
      [...view.container.querySelectorAll('button')].some(
        (button) =>
          button.textContent === 'Remove en-US from supported languages',
      ),
    ).toBe(false);
  });

  it('submits a replacement pair and the review lists the changes against the source', () => {
    const view = render();
    choice(view, 'change');
    click(buttonNamed(view.container, 'Remove fr from supported languages'));
    expect(JSON.parse(hiddenValue(view.form, 'supportedLocales'))).toEqual([
      'en-US',
      'fr-CA',
    ]);
    expect(JSON.parse(hiddenValue(view.form, 'fallbackChains'))).toEqual({
      'fr-CA': ['en-US'],
    });
    const review = view.container.querySelector(
      '[data-locale-review]',
    ) as HTMLElement;
    expect(review.textContent).toContain('Removed languages');
    expect(review.textContent).toContain('fr');
    expect(review.textContent).toContain(
      'Languages with a changed fallback order',
    );
    expect(review.textContent).toContain('fr-CA');
    expect(submit(view.form)).toBe(true);
  });

  it('keeps edits when the discard confirmation is declined', () => {
    const view = render();
    choice(view, 'change');
    click(buttonNamed(view.container, 'Remove fr from supported languages'));
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    choice(view, 'keep');
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(String(confirm.mock.calls[0]?.[0])).toContain('2 changed items');
    expect(radio(view, 'change').checked).toBe(true);
    expect(hiddenValue(view.form, 'supportedLocales')).not.toBe('null');
  });

  it('discards edits and submits both null when the confirmation is accepted', () => {
    const view = render();
    choice(view, 'change');
    click(buttonNamed(view.container, 'Remove fr from supported languages'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    choice(view, 'keep');
    expect(radio(view, 'keep').checked).toBe(true);
    expect(hiddenValue(view.form, 'supportedLocales')).toBe('null');
    expect(hiddenValue(view.form, 'fallbackChains')).toBe('null');
    choice(view, 'change');
    expect(hiddenValue(view.form, 'supportedLocales')).toBe(
      '["en-US","fr","fr-CA"]',
    );
  });

  it('switches back without a prompt when nothing changed', () => {
    const view = render();
    choice(view, 'change');
    const confirm = vi.spyOn(window, 'confirm');
    choice(view, 'keep');
    expect(confirm).not.toHaveBeenCalled();
    expect(radio(view, 'keep').checked).toBe(true);
  });
});
