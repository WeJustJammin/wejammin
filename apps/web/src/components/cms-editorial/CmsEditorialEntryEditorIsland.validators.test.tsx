// @vitest-environment jsdom

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

import {
  byLabel,
  disableReactAct,
  enableReactAct,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import {
  registerCmsFieldValidation,
  resetCmsFieldValidationForTest,
} from '../cms-editorial-fields/cms-field-validation';
import { validateCmsFieldValue } from '../cms-editorial-fields/cms-field-value';
import { RATING } from './cms-editorial-editor-fixtures.test-support';
import { preloadCmsEditorialTransports } from './cms-editorial-lazy-transports.test-support';
import {
  setup,
  unmountAll,
} from './CmsEditorialEntryEditorIsland.test-support';

/*
 * The value validators are not in the editor's cold load (`cms-field-validators-cold-load.test.ts`). A refused field shows
 * the validators' own message once the save has loaded them, and the server's message until then.
 */
beforeAll(enableReactAct);
beforeAll(preloadCmsEditorialTransports);
afterAll(disableReactAct);

beforeEach(() => {
  document.cookie = 'wj_csrf=csrf-token';
});
afterEach(() => {
  registerCmsFieldValidation(validateCmsFieldValue);
  unmountAll();
  document.body.replaceChildren();
  document.cookie = 'wj_csrf=; max-age=0';
});

const refuseRating = async (): Promise<string> => {
  const { container, advance } = setup([]);
  await typeInto(byLabel<HTMLInputElement>(container, 'Rating'), '11');
  await advance(3_000);
  const summary = container.querySelector<HTMLElement>(
    '[data-cms-editorial-validation-summary]',
  );
  expect(summary?.querySelector('a')?.getAttribute('href')).toBe(
    `#field-${RATING}`,
  );
  return container.querySelector(`#field-${RATING}-errors`)?.textContent ?? '';
};

describe('CmsEditorialEntryEditorIsland refused-field messages', () => {
  it('shows the validators’ own message when they are loaded', async () => {
    const message = await refuseRating();
    expect(message).not.toBe('');
  });

  it('shows the message the save gave when the validators are not loaded, and still marks the field', async () => {
    const loaded = await refuseRating();
    unmountAll();
    resetCmsFieldValidationForTest();
    const fallback = await refuseRating();
    expect(fallback).not.toBe('');
    expect(fallback).not.toBe(loaded);
  });
});
