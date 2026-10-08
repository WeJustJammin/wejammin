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
  press,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import {
  ENTRY_ID,
  apiError,
  revisionCreated,
} from './cms-editorial-editor-fixtures.test-support';
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

const ENTRIES = '/app/cms-content-modeling/entries';
const HISTORY = `/app/cms-content-modeling/entries/${ENTRY_ID}/revisions`;

const mountWithNavigation = (
  steps: Parameters<typeof setup>[0] = [],
  init?: Parameters<typeof setup>[1],
) => {
  const navigated: string[] = [];
  const view = setup(steps, init, {
    navigate: (href: string) => navigated.push(href),
  });
  return { ...view, navigated };
};

const anchor = (container: HTMLElement, name: string): HTMLAnchorElement => {
  const found = Array.from(container.querySelectorAll('a')).find(
    (candidate) => candidate.textContent?.trim().startsWith(name) === true,
  );
  if (found === undefined) throw new Error(`No link named ${name}`);
  return found;
};

/** Click a link and report whether the island took over the navigation. */
const clickLink = async (
  link: HTMLAnchorElement,
  init: MouseEventInit = {},
): Promise<boolean> => {
  let prevented = false;
  const observe = (event: Event): void => {
    prevented = event.defaultPrevented;
    // jsdom cannot navigate; the observation above is the assertion.
    event.preventDefault();
  };
  document.addEventListener('click', observe);
  await act(async () => {
    link.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        button: 0,
        ...init,
      }),
    );
  });
  document.removeEventListener('click', observe);
  return prevented;
};

const beforeUnload = (): Event => {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event;
};

const confirmation = (container: HTMLElement): HTMLElement | null =>
  container.querySelector('[data-cms-editorial-leave]');

/**
 * Codex review s10-ts-2, H2 (FE03 "Unsaved changes", "scoped draft before
 * commit"): leaving the editor with unsent work must never silently discard it.
 * The scoped draft is kept while the author decides: an inline leave
 * confirmation for in-app links, and `beforeunload` only while dirty.
 */
describe('H2: leaving the editor with unsent work is guarded', () => {
  it('takes over a link click while dirty, shows an inline confirmation with heading focus and keeps the draft', async () => {
    const { container, navigated } = mountWithNavigation();
    await typeInto(
      byLabel<HTMLInputElement>(container, 'Title (required)'),
      'Unsent title',
    );
    const taken = await clickLink(anchor(container, 'All entries'));
    expect(taken).toBe(true);
    expect(navigated).toEqual([]);
    const region = confirmation(container);
    expect(region).not.toBeNull();
    expect(region?.textContent).toContain('1 unsent change');
    const heading = region?.querySelector('h2');
    expect(document.activeElement).toBe(heading);
    expect(byLabel<HTMLInputElement>(container, 'Title (required)').value).toBe(
      'Unsent title',
    );
  });

  it('Keep editing closes the confirmation, returns focus to the link and keeps every value', async () => {
    const { container, navigated } = mountWithNavigation();
    await typeInto(
      byLabel<HTMLInputElement>(container, 'Title (required)'),
      'Unsent title',
    );
    const link = anchor(container, 'Revision history');
    await clickLink(link);
    await click(buttonNamed(container, 'Keep editing'));
    expect(confirmation(container)).toBeNull();
    expect(document.activeElement).toBe(link);
    expect(navigated).toEqual([]);
    expect(byLabel<HTMLInputElement>(container, 'Title (required)').value).toBe(
      'Unsent title',
    );
  });

  it('Escape cancels the confirmation before anything is committed', async () => {
    const { container, navigated } = mountWithNavigation();
    await typeInto(
      byLabel<HTMLInputElement>(container, 'Title (required)'),
      'Unsent title',
    );
    await clickLink(anchor(container, 'All entries'));
    const region = confirmation(container) as HTMLElement;
    await press(region.querySelector('h2') as HTMLElement, 'Escape');
    expect(confirmation(container)).toBeNull();
    expect(navigated).toEqual([]);
  });

  it('Leave without saving is the explicit discard: it navigates to the link target', async () => {
    const { container, navigated, calls } = mountWithNavigation();
    await typeInto(
      byLabel<HTMLInputElement>(container, 'Title (required)'),
      'Unsent title',
    );
    await clickLink(anchor(container, 'Revision history'));
    await click(buttonNamed(container, 'Leave without saving'));
    expect(navigated).toEqual([HISTORY]);
    expect(posts(calls)).toHaveLength(0);
  });

  it('Save draft and leave flushes the draft first and navigates only after the verified save', async () => {
    const { container, navigated, calls } = mountWithNavigation([
      revisionCreated({ revisionNumber: '3', entryVersion: '5' }),
    ]);
    await typeInto(
      byLabel<HTMLInputElement>(container, 'Title (required)'),
      'Unsent title',
    );
    await clickLink(anchor(container, 'All entries'));
    await click(buttonNamed(container, 'Save draft and leave'));
    await act(async () => {
      for (let tick = 0; tick < 40; tick += 1) await Promise.resolve();
    });
    expect(posts(calls)).toHaveLength(1);
    expect(navigated).toEqual([ENTRIES]);
  });

  it('Save draft and leave stays on the page, with the edits and the refusal, when the save is refused', async () => {
    const { container, navigated } = mountWithNavigation([
      apiError(422, 'VALIDATION_FAILED', {
        violations: [
          { path: '/changedPaths/0', code: 'invalid', message: 'x' },
        ],
      }),
    ]);
    await typeInto(
      byLabel<HTMLInputElement>(container, 'Title (required)'),
      'Unsent title',
    );
    await clickLink(anchor(container, 'All entries'));
    await click(buttonNamed(container, 'Save draft and leave'));
    await act(async () => {
      for (let tick = 0; tick < 40; tick += 1) await Promise.resolve();
    });
    expect(navigated).toEqual([]);
    expect(confirmation(container)).toBeNull();
    expect(byLabel<HTMLInputElement>(container, 'Title (required)').value).toBe(
      'Unsent title',
    );
  });

  it('does not touch a link click when nothing is unsent', async () => {
    const { container, navigated } = mountWithNavigation();
    const taken = await clickLink(anchor(container, 'All entries'));
    expect(taken).toBe(false);
    expect(confirmation(container)).toBeNull();
    expect(navigated).toEqual([]);
  });

  it('leaves new-tab and modified clicks alone even while dirty', async () => {
    const { container } = mountWithNavigation();
    await typeInto(
      byLabel<HTMLInputElement>(container, 'Title (required)'),
      'Unsent title',
    );
    const link = anchor(container, 'All entries');
    expect(await clickLink(link, { ctrlKey: true })).toBe(false);
    expect(await clickLink(link, { metaKey: true })).toBe(false);
    expect(await clickLink(link, { shiftKey: true })).toBe(false);
    expect(await clickLink(link, { button: 1 })).toBe(false);
    expect(confirmation(container)).toBeNull();
  });
});

describe('H2: beforeunload is armed only while there is unsent work', () => {
  it('is not armed for a clean editor', () => {
    mountWithNavigation();
    expect(beforeUnload().defaultPrevented).toBe(false);
  });

  it('is armed while dirty, and disarmed again once the verified save lands', async () => {
    const { container, advance } = mountWithNavigation([
      revisionCreated({ revisionNumber: '3', entryVersion: '5' }),
    ]);
    await typeInto(
      byLabel<HTMLInputElement>(container, 'Title (required)'),
      'Unsent title',
    );
    expect(beforeUnload().defaultPrevented).toBe(true);
    await advance(3_000);
    expect(beforeUnload().defaultPrevented).toBe(false);
  });

  it('stays armed while a save is in flight or its outcome is unknown', async () => {
    const { container, advance } = mountWithNavigation([
      new TypeError('Failed to fetch'),
    ]);
    await typeInto(
      byLabel<HTMLInputElement>(container, 'Title (required)'),
      'Unsent title',
    );
    await advance(3_000);
    expect(container.textContent).toContain('could not be confirmed');
    expect(beforeUnload().defaultPrevented).toBe(true);
  });

  it('is removed when the editor unmounts', async () => {
    const { container, unmount } = mountWithNavigation();
    await typeInto(
      byLabel<HTMLInputElement>(container, 'Title (required)'),
      'Unsent title',
    );
    expect(beforeUnload().defaultPrevented).toBe(true);
    unmount();
    expect(beforeUnload().defaultPrevented).toBe(false);
  });

  it('does not block the navigation the author chose with Leave without saving', async () => {
    const { container } = mountWithNavigation();
    await typeInto(
      byLabel<HTMLInputElement>(container, 'Title (required)'),
      'Unsent title',
    );
    await clickLink(anchor(container, 'All entries'));
    await click(buttonNamed(container, 'Leave without saving'));
    expect(beforeUnload().defaultPrevented).toBe(false);
  });
});

describe('H2: an expired session does not strand the unsent edits', () => {
  it('opens sign-in in a new tab so the edits stay in this page, and Save draft resumes after sign-in', async () => {
    const { container, advance, calls } = mountWithNavigation([
      apiError(401, 'UNAUTHENTICATED'),
      revisionCreated({ revisionNumber: '3', entryVersion: '5' }),
    ]);
    await typeInto(
      byLabel<HTMLInputElement>(container, 'Title (required)'),
      'Unsent title',
    );
    await advance(3_000);
    const signIn = anchor(container, 'Sign in again');
    expect(signIn.getAttribute('target')).toBe('_blank');
    expect(signIn.getAttribute('rel')).toContain('noopener');
    expect(byLabel<HTMLInputElement>(container, 'Title (required)').value).toBe(
      'Unsent title',
    );
    await click(buttonNamed(container, 'Save draft'));
    await act(async () => {
      for (let tick = 0; tick < 40; tick += 1) await Promise.resolve();
    });
    expect(posts(calls)).toHaveLength(2);
    expect(container.textContent).toContain('All changes saved');
  });
});
