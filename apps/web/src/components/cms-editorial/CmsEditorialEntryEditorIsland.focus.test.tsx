// @vitest-environment jsdom

import { act } from 'react';
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
  buttonNamed,
  byLabel,
  click,
  disableReactAct,
  enableReactAct,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import {
  apiError,
  revisionCreated,
} from './cms-editorial-editor-fixtures.test-support';
import { settleAsyncWork } from './cms-editorial-fake-clock.test-support';
import {
  posts,
  setup,
  unmountAll,
} from './CmsEditorialEntryEditorIsland.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);

beforeEach(() => {
  document.cookie = 'wj_csrf=csrf-token';
});
afterEach(() => {
  unmountAll();
  document.body.replaceChildren();
  document.cookie = 'wj_csrf=; max-age=0';
});

const held = () => {
  let release: (response: Response) => void = () => undefined;
  const step = () =>
    new Promise<Response>((resolve) => {
      release = resolve;
    });
  return { step, release: (response: Response) => release(response) };
};

const settle = async (): Promise<void> => {
  await act(async () => {
    await settleAsyncWork();
  });
};

/**
 * Lane P (real browser): disabling the focused "Save draft" button while the
 * save is in flight makes Chrome blur it, so the keyboard user lands on <body>
 * and starts again from the top of the page. FE03 (CMS-03B-01/10/11 row):
 * "retain unsent values and restore focus"; the control stays where it is.
 */
describe('editor island: keyboard focus survives Save draft', () => {
  it('keeps the Save draft button enabled (aria-busy, not disabled) while the save is in flight', async () => {
    const pending = held();
    const { container } = setup([pending.step]);
    await typeInto(
      byLabel<HTMLInputElement>(container, 'Title (required)'),
      'Edited title',
    );
    const save = buttonNamed(container, 'Save draft');
    save.focus();
    await click(save);
    expect(
      container.querySelector('[data-cms-editorial-status]')?.textContent,
    ).toContain('Saving');
    expect(save.disabled).toBe(false);
    expect(save.getAttribute('aria-busy')).toBe('true');
    expect(document.activeElement).toBe(save);
    pending.release(
      revisionCreated({ revisionNumber: '3', entryVersion: '5' }),
    );
    await settle();
    expect(save.getAttribute('aria-busy')).toBeNull();
    expect(document.activeElement).toBe(save);
  });

  it('sends one request however often Save draft is activated while a save is in flight', async () => {
    const pending = held();
    const { container, calls } = setup([pending.step]);
    await typeInto(
      byLabel<HTMLInputElement>(container, 'Title (required)'),
      'Edited title',
    );
    const save = buttonNamed(container, 'Save draft');
    await click(save);
    await click(save);
    await click(save);
    expect(posts(calls)).toHaveLength(1);
    pending.release(
      revisionCreated({ revisionNumber: '3', entryVersion: '5' }),
    );
    await settle();
    expect(posts(calls)).toHaveLength(1);
    expect(container.textContent).toContain('All changes saved');
  });

  it('moves focus to the alert, never to <body>, when the editor becomes read-only after a 401 or 403', async () => {
    for (const [status, code] of [
      [401, 'UNAUTHENTICATED'],
      [403, 'FORBIDDEN'],
    ] as const) {
      const { container, advance, unmount } = setup([apiError(status, code)]);
      const title = byLabel<HTMLInputElement>(container, 'Title (required)');
      title.focus();
      await typeInto(title, 'Edited title');
      await advance(3_000);
      const alert = container.querySelector<HTMLElement>('[role="alert"]');
      expect(alert, String(status)).not.toBeNull();
      expect(document.activeElement, String(status)).toBe(alert);
      unmount();
    }
  });
});
