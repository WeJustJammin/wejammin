// @vitest-environment jsdom

import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import ContentSchemaRegistryCreateForm from './ContentSchemaRegistryCreateForm';
import {
  buttonNamed,
  byText,
  choose,
  click,
  inputByLabel,
  mount,
  type,
  type Mounted,
} from './content-schema-registry-locale-fields.test-support';

/**
 * R8 proofs for FE03 "Locale configuration fields (OD-4)" (AC1234): every
 * button has a unique accessible name, and focus after Remove moves to the next
 * item or, when none remains, to that list's Add input - in the supported
 * language list and in each fallback order.
 */

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

const populated = (): Mounted => {
  const view = render();
  addTags(view, 'en-US', 'fr', 'es', 'fr-CA');
  choose(
    inputByLabel(
      view.container,
      'Source language',
    ) as unknown as HTMLSelectElement,
    'en-US',
  );
  choose(
    inputByLabel(
      view.container,
      'Default language',
    ) as unknown as HTMLSelectElement,
    'en-US',
  );
  return view;
};

const chain = (view: Mounted, target: string): HTMLFieldSetElement =>
  byText(view.container, 'legend', `Fallback order for ${target}`).closest(
    'fieldset',
  ) as HTMLFieldSetElement;

const addIntermediates = (view: Mounted, ...tags: string[]): void => {
  for (const tag of tags) {
    const picker = chain(view, 'fr-CA').querySelector(
      'select',
    ) as HTMLSelectElement;
    choose(picker, tag);
    click(
      buttonNamed(chain(view, 'fr-CA'), 'Add to the fallback order for fr-CA'),
    );
  }
};

describe('[P2-S09-AC-1234] focus after Remove', () => {
  it('[P2-S09-AC-1234] moves focus to the next supported language Remove button after a non-last Remove', () => {
    const view = populated();
    click(buttonNamed(view.container, 'Remove fr from supported languages'));
    expect(document.activeElement).toBe(
      buttonNamed(view.container, 'Remove es from supported languages'),
    );
  });

  it('[P2-S09-AC-1234] moves focus to the next fallback entry Remove button after a non-last Remove', () => {
    const view = populated();
    addIntermediates(view, 'fr', 'es');
    click(
      buttonNamed(
        view.container,
        'Remove fr from the fallback order for fr-CA',
      ),
    );
    expect(document.activeElement).toBe(
      buttonNamed(
        view.container,
        'Remove es from the fallback order for fr-CA',
      ),
    );
  });

  it('[P2-S09-AC-1234] moves focus to the fallback Add input after the last fallback entry is removed', () => {
    const view = populated();
    addIntermediates(view, 'fr');
    click(
      buttonNamed(
        view.container,
        'Remove fr from the fallback order for fr-CA',
      ),
    );
    expect(document.activeElement).toBe(
      chain(view, 'fr-CA').querySelector('select'),
    );
  });
});

describe('[P2-S09-AC-1234] unique button names', () => {
  it('[P2-S09-AC-1234] gives every button in the form a distinct accessible name', () => {
    const view = populated();
    addIntermediates(view, 'fr', 'es');
    const names = [...view.container.querySelectorAll('button')].map((button) =>
      (button.textContent ?? '').trim(),
    );
    expect(names.length).toBeGreaterThan(8);
    expect(new Set(names).size).toBe(names.length);
  });

  it('[P2-S09-AC-1234] names every entry button with its tag and every fallback button with its target', () => {
    const view = populated();
    addIntermediates(view, 'fr');
    const entry = chain(view, 'fr-CA').querySelector('li');
    const names = [...(entry?.querySelectorAll('button') ?? [])].map(
      (button) => button.textContent ?? '',
    );
    expect(names).toHaveLength(3);
    for (const name of names) {
      expect(name).toContain('fr');
      expect(name).toContain('fr-CA');
    }
  });
});
