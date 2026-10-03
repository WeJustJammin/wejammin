// @vitest-environment jsdom

import * as React from 'react';
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import ContentSchemaRegistryCreateForm from './ContentSchemaRegistryCreateForm';
import {
  blur,
  buttonNamed,
  byText,
  choose,
  click,
  hiddenValue,
  inputByLabel,
  mount,
  pressEnter,
  submit,
  type,
  type Mounted,
} from './content-schema-registry-locale-fields.test-support';

/**
 * FE03 "Locale configuration fields (OD-4)" for the CMS-03A-01 create form:
 * tag list, source/default selects, per-language fallback order editors,
 * per-field validation with the exact BE03a messages, and a review step.
 */

const CANONICAL = 'locale tag must be a canonical-case BCP 47 tag';
let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

const render = (): Mounted => {
  mounted = mount(
    React.createElement(ContentSchemaRegistryCreateForm, {
      action: '/app/cms-content-modeling',
      csrfToken: 'csrf-token-value',
      idempotencyKey: 'cms-schema-cms-03a-01-support',
    }),
  );
  return mounted;
};

const addTags = (view: Mounted, ...tags: string[]): void => {
  const input = inputByLabel(view.container, 'Add a language tag');
  for (const tag of tags) {
    type(input, tag);
    click(buttonNamed(view.container, 'Add'));
  }
};

const select = (view: Mounted, label: string): HTMLSelectElement => {
  const control = inputByLabel(view.container, label) as unknown;
  return control as HTMLSelectElement;
};

const fieldsetFor = (view: Mounted, target: string): HTMLFieldSetElement => {
  const legend = byText(
    view.container,
    'legend',
    `Fallback order for ${target}`,
  );
  return legend.closest('fieldset') as HTMLFieldSetElement;
};

const live = (view: Mounted): string =>
  view.container.querySelector('[data-locale-live]')?.textContent ?? '';

const config = (view: Mounted) => ({
  supported: JSON.parse(hiddenValue(view.form, 'supportedLocales')) as string[],
  chains: JSON.parse(hiddenValue(view.form, 'fallbackChains')) as Record<
    string,
    string[]
  >,
});

describe('supported languages tag list', () => {
  it('[P2-S09-AC-1236] [P2-S09-AC-1207] [P2-S09-AC-1210] renders the persistent label, help, input attributes and counter', () => {
    const view = render();
    const input = inputByLabel(view.container, 'Add a language tag');
    expect(input.getAttribute('autocomplete')).toBe('off');
    expect(input.getAttribute('autocapitalize')).toBe('none');
    expect(input.getAttribute('spellcheck')).toBe('false');
    expect(input.name).toBe('');
    expect(view.container.textContent).toContain(
      'For example en, fr-CA, zh-Hans-CN',
    );
    expect(view.container.textContent).toContain('0 of 32');
    expect(view.container.textContent).toContain('Add at least one language');
    expect(input.getAttribute('aria-describedby')).toContain(
      'locale-tags-count',
    );
  });

  it('[P2-S09-AC-1209] [P2-S09-AC-1234] adds a canonical tag to a native list with a uniquely named Remove button', () => {
    const view = render();
    addTags(view, 'en-US', 'fr');
    const items = view.container.querySelectorAll('ul[data-locale-tags] > li');
    expect(items).toHaveLength(2);
    expect(items[0]?.textContent).toContain('en-US');
    buttonNamed(view.container, 'Remove en-US from supported languages');
    expect(view.container.textContent).toContain('2 of 32');
    expect(inputByLabel(view.container, 'Add a language tag').value).toBe('');
    expect(config(view).supported).toEqual(['en-US', 'fr']);
  });

  it('[P2-S09-AC-1208] activates Add on Enter and never submits the form', () => {
    const view = render();
    let submitted = false;
    view.form.addEventListener('submit', () => {
      submitted = true;
    });
    const input = inputByLabel(view.container, 'Add a language tag');
    type(input, 'de');
    const allowed = pressEnter(input);
    expect(allowed).toBe(false);
    expect(submitted).toBe(false);
    expect(config(view).supported).toEqual(['de']);
  });

  it('[P2-S09-AC-1211] offers the canonical spelling without silently correcting', () => {
    const view = render();
    addTags(view, 'EN-us');
    expect(view.container.textContent).toContain(CANONICAL);
    expect(config(view).supported).toEqual([]);
    click(buttonNamed(view.container, 'Use en-US'));
    expect(inputByLabel(view.container, 'Add a language tag').value).toBe(
      'en-US',
    );
    expect(config(view).supported).toEqual([]);
    click(buttonNamed(view.container, 'Add'));
    expect(config(view).supported).toEqual(['en-US']);
  });

  it('[P2-S09-AC-1212] shows the exact unique message for a repeat', () => {
    const view = render();
    addTags(view, 'en', 'en');
    expect(view.container.textContent).toContain(
      'supportedLocales must be unique',
    );
    expect(config(view).supported).toEqual(['en']);
  });

  it('[P2-S09-AC-1210] disables Add with its reason at 32 languages', () => {
    const view = render();
    const tags = Array.from(
      { length: 32 },
      (_unused, index) =>
        `${String.fromCharCode(97 + Math.floor(index / 26))}${String.fromCharCode(97 + (index % 26))}`,
    );
    addTags(view, ...tags);
    expect(view.container.textContent).toContain('32 of 32');
    expect(view.container.textContent).toContain('Maximum 32 languages');
    expect(buttonNamed(view.container, 'Add').disabled).toBe(true);
  });

  it('[P2-S09-AC-1234] moves focus to the Add input after the last Remove', () => {
    const view = render();
    addTags(view, 'en');
    click(buttonNamed(view.container, 'Remove en from supported languages'));
    expect(document.activeElement).toBe(
      inputByLabel(view.container, 'Add a language tag'),
    );
  });
});

describe('source, default and fallback groups', () => {
  const populated = (): Mounted => {
    const view = render();
    addTags(view, 'en-US', 'fr', 'fr-CA');
    choose(select(view, 'Source language'), 'en-US');
    choose(select(view, 'Default language'), 'en-US');
    return view;
  };

  it('[P2-S09-AC-1214] [P2-S09-AC-1215] lists only supported tags in the source and default selects', () => {
    const view = populated();
    const options = [
      ...select(view, 'Source language').querySelectorAll('option'),
    ].map((option) => option.value);
    expect(options).toEqual(['', 'en-US', 'fr', 'fr-CA']);
    expect(select(view, 'Source language').required).toBe(true);
    expect(select(view, 'Default language').required).toBe(true);
    expect(view.container.textContent).toContain(
      'The language every fallback order ends at',
    );
    expect(hiddenValue(view.form, 'sourceLocale')).toBe('en-US');
  });

  it('[P2-S09-AC-1236] [P2-S09-AC-1217] renders one fieldset per non-default language with a fixed final default', () => {
    const view = populated();
    expect(
      view.container.querySelectorAll('fieldset[data-locale-chain]'),
    ).toHaveLength(2);
    expect(() => fieldsetFor(view, 'en-US')).toThrow();
    const group = fieldsetFor(view, 'fr-CA');
    const items = group.querySelectorAll('ol > li');
    expect(items).toHaveLength(1);
    expect(items[0]?.textContent).toBe('en-US (always last)');
    expect(group.querySelector('li button')).toBeNull();
  });

  it('[P2-S09-AC-1218] [P2-S09-AC-1219] [P2-S09-AC-1234] adds, orders and removes intermediate entries with named buttons', () => {
    const view = populated();
    addTags(view, 'es');
    const group = fieldsetFor(view, 'fr-CA');
    const picker = group.querySelector('select') as HTMLSelectElement;
    expect(group.querySelector(`label[for="${picker.id}"]`)?.textContent).toBe(
      'Add a fallback language',
    );
    expect(
      [...picker.querySelectorAll('option')].map((option) => option.value),
    ).toEqual(['', 'fr', 'es']);
    choose(picker, 'fr');
    click(buttonNamed(group, 'Add to the fallback order for fr-CA'));
    const second = fieldsetFor(view, 'fr-CA').querySelector(
      'select',
    ) as HTMLSelectElement;
    choose(second, 'es');
    click(
      buttonNamed(
        fieldsetFor(view, 'fr-CA'),
        'Add to the fallback order for fr-CA',
      ),
    );
    expect(config(view).chains['fr-CA']).toEqual(['fr', 'es', 'en-US']);
    click(
      buttonNamed(
        view.container,
        'Move es earlier in the fallback order for fr-CA',
      ),
    );
    expect(config(view).chains['fr-CA']).toEqual(['es', 'fr', 'en-US']);
    expect(live(view)).toBe('es is now 1 of 3 in the fallback order for fr-CA');
    expect(
      (
        buttonNamed(
          view.container,
          'Move es earlier in the fallback order for fr-CA',
        ) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    click(
      buttonNamed(
        view.container,
        'Move es later in the fallback order for fr-CA',
      ),
    );
    expect(config(view).chains['fr-CA']).toEqual(['fr', 'es', 'en-US']);
    click(
      buttonNamed(
        view.container,
        'Remove fr from the fallback order for fr-CA',
      ),
    );
    expect(config(view).chains['fr-CA']).toEqual(['es', 'en-US']);
  });

  it('[P2-S09-AC-1224] removes a language from every group in one announced action', () => {
    const view = populated();
    const group = fieldsetFor(view, 'fr-CA');
    choose(group.querySelector('select') as HTMLSelectElement, 'fr');
    click(buttonNamed(group, 'Add to the fallback order for fr-CA'));
    click(buttonNamed(view.container, 'Remove fr from supported languages'));
    expect(live(view)).toBe('Removed fr from the fallback order for fr-CA');
    expect(config(view).chains).toEqual({ 'fr-CA': ['en-US'] });
  });

  it('[P2-S09-AC-1216] re-renders the groups when the default changes and keeps valid entries', () => {
    const view = populated();
    choose(select(view, 'Default language'), 'fr');
    expect(() => fieldsetFor(view, 'fr')).toThrow();
    expect(fieldsetFor(view, 'en-US').textContent).toContain(
      'fr (always last)',
    );
    expect(config(view).chains).toEqual({
      'en-US': ['fr'],
      'fr-CA': ['fr'],
    });
  });
});

describe('validation and review', () => {
  it('[P2-S09-AC-1227] shows nothing before the first blur or submit', () => {
    const view = render();
    expect(view.container.querySelector('[data-locale-summary]')).toBeNull();
    expect(view.container.querySelector('[role="alert"]')).toBeNull();
  });

  it('keeps the Add control still while a typed tag is waiting (blur does not push it down)', () => {
    const view = render();
    const input = inputByLabel(view.container, 'Add a language tag');
    type(input, 'en-US');
    blur(input);
    expect(view.container.querySelector('[data-locale-summary]')).toBeNull();
    click(buttonNamed(view.container, 'Add'));
    expect(
      view.container.querySelector('[data-locale-tags-field]')?.textContent,
    ).toContain('1 of 32');
  });

  it('still reveals the summary when the tag input blurs empty', () => {
    const view = render();
    blur(inputByLabel(view.container, 'Add a language tag'));
    expect(
      view.container.querySelector('[data-locale-summary]'),
    ).not.toBeNull();
  });

  it('[P2-S09-AC-1213] [P2-S09-AC-1228] blocks submit, lists exact messages with paths and focuses the summary', () => {
    const view = render();
    const allowed = submit(view.form);
    expect(allowed).toBe(false);
    const summary = view.container.querySelector(
      '[data-locale-summary]',
    ) as HTMLElement;
    expect(summary.textContent).toContain(
      'supportedLocales must contain 1 to 32 locales',
    );
    expect(summary.textContent).toContain(
      'supportedLocales must include sourceLocale',
    );
    expect(summary.textContent).toContain(
      'supportedLocales must include defaultLocale',
    );
    expect(document.activeElement).toBe(summary);
    const links = [...summary.querySelectorAll('a')].map((link) =>
      link.getAttribute('href'),
    );
    expect(links.every((href) => href?.startsWith('#'))).toBe(true);
  });

  it('[P2-S09-AC-1228] moves focus to the control each summary link names when it is activated', () => {
    const view = render();
    submit(view.form);
    const summary = view.container.querySelector(
      '[data-locale-summary]',
    ) as HTMLElement;
    const links = [...summary.querySelectorAll<HTMLAnchorElement>('a')];
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      const target = view.container.querySelector<HTMLElement>(
        `#${(link.getAttribute('href') ?? '').slice(1)}`,
      );
      expect(target).not.toBeNull();
      click(link);
      expect(document.activeElement).toBe(target);
    }
  });

  it('[P2-S09-AC-1214] [P2-S09-AC-1215] marks the source and default selects invalid after a blur without a value', () => {
    const view = render();
    addTags(view, 'en');
    blur(select(view, 'Source language'));
    expect(select(view, 'Source language').getAttribute('aria-invalid')).toBe(
      'true',
    );
    expect(view.container.textContent).toContain(
      'supportedLocales must include sourceLocale',
    );
  });

  it('[P2-S09-AC-1221] names the languages on a cycle and focuses the first group involved', () => {
    const view = render();
    addTags(view, 'en', 'aa', 'bb');
    choose(select(view, 'Source language'), 'en');
    choose(select(view, 'Default language'), 'en');
    const first = fieldsetFor(view, 'aa');
    choose(first.querySelector('select') as HTMLSelectElement, 'bb');
    click(buttonNamed(first, 'Add to the fallback order for aa'));
    const second = fieldsetFor(view, 'bb');
    choose(second.querySelector('select') as HTMLSelectElement, 'aa');
    click(buttonNamed(second, 'Add to the fallback order for bb'));
    expect(submit(view.form)).toBe(false);
    const summary = view.container.querySelector(
      '[data-locale-summary]',
    ) as HTMLElement;
    expect(summary.textContent).toContain(
      'fallback chains must not form a cycle',
    );
    expect(summary.textContent).toContain('aa, bb');
    click(summary.querySelector('a[data-locale-cycle]') as HTMLElement);
    expect(document.activeElement).toBe(fieldsetFor(view, 'aa'));
  });

  it('allows a valid submit and carries the configuration natively', () => {
    const view = render();
    addTags(view, 'en-US', 'fr');
    choose(select(view, 'Source language'), 'en-US');
    choose(select(view, 'Default language'), 'en-US');
    expect(submit(view.form)).toBe(true);
    expect(hiddenValue(view.form, 'supportedLocales')).toBe('["en-US","fr"]');
    expect(hiddenValue(view.form, 'fallbackChains')).toBe('{"fr":["en-US"]}');
    expect(hiddenValue(view.form, 'defaultLocale')).toBe('en-US');
  });

  it('[P2-S09-AC-1225] [P2-S09-AC-1226] lists added languages and the breaking-change sentence in the review', () => {
    const view = render();
    addTags(view, 'en-US', 'fr');
    const review = view.container.querySelector(
      '[data-locale-review]',
    ) as HTMLElement;
    expect(review.textContent).toContain('Review changes');
    expect(review.textContent).toContain('Added languages');
    expect(review.textContent).toContain('en-US');
    expect(review.textContent).toContain(
      'Removing a language or changing a retained fallback order is treated as a breaking change and needs a migration plan at dry run',
    );
  });

  it('[P2-S09-AC-1229] makes every locale control read-only while pending', () => {
    mounted = mount(
      React.createElement(ContentSchemaRegistryCreateForm, {
        action: '/app/cms-content-modeling',
        csrfToken: 'csrf-token-value',
        idempotencyKey: 'cms-schema-cms-03a-01-support',
        state: 'pending',
      }),
    );
    const input = inputByLabel(mounted.container, 'Add a language tag');
    expect(input.closest('fieldset')?.disabled).toBe(true);
    expect(
      mounted.container
        .querySelector('[data-locale-fields]')
        ?.getAttribute('aria-disabled'),
    ).toBe('true');
    act(() => undefined);
  });
});
