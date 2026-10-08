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
  CONFLICT_ID,
  ENTRY_ID,
  RATING,
  RELATED,
  TITLE,
  apiError,
  draftDetail,
  editorInit,
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

describe('CmsEditorialEntryEditorIsland: the edit surface', () => {
  it('renders the stored values in native labelled controls and the entry facts as text', () => {
    const { container } = setup([]);
    expect(byLabel<HTMLInputElement>(container, 'Title (required)').value).toBe(
      'Release notes',
    );
    expect(byLabel<HTMLInputElement>(container, 'Rating').tagName).toBe(
      'INPUT',
    );
    expect(container.textContent).toContain('Related entries');
    const facts = container.querySelector('dl')?.textContent ?? '';
    for (const text of ['active', 'draft', 'en-US', 'valid', '2'])
      expect(facts).toContain(text);
    for (const area of Array.from(container.querySelectorAll('textarea')))
      expect(area.value.trim().startsWith('{')).toBe(false);
  });

  it('links to the revision history and the entry list with native links', () => {
    const { container } = setup([]);
    const hrefs = Array.from(container.querySelectorAll('a')).map((anchor) =>
      anchor.getAttribute('href'),
    );
    expect(hrefs).toContain(
      `/app/cms-content-modeling/entries/${ENTRY_ID}/revisions`,
    );
    expect(hrefs).toContain('/app/cms-content-modeling/entries');
  });

  it('announces dirty and saved through one polite status region and never moves focus', async () => {
    const { container, advance, status, calls } = setup([
      revisionCreated({ revisionNumber: '3', entryVersion: '5' }),
    ]);
    const region = container.querySelector('[data-cms-editorial-status]');
    expect(region?.getAttribute('role')).toBe('status');
    expect(region?.getAttribute('aria-live')).toBe('polite');
    const title = byLabel<HTMLInputElement>(container, 'Title (required)');
    title.focus();
    await typeInto(title, 'Release notes v2');
    expect(status()).toBe('Unsaved changes. Autosave runs shortly.');
    await advance(3_000);
    expect(posts(calls)).toHaveLength(1);
    expect(posts(calls)[0]?.headers.get('if-match')).toBe('"4"');
    expect(status()).toBe('All changes saved.');
    expect(document.activeElement).toBe(title);
  });

  it('saves at once when the author chooses Save draft', async () => {
    const { container, calls, status } = setup([
      revisionCreated({ revisionNumber: '3', entryVersion: '5' }),
    ]);
    await typeInto(
      byLabel<HTMLInputElement>(container, 'Title (required)'),
      'Now',
    );
    await click(buttonNamed(container, 'Save draft'));
    await act(async () => {
      await settleAsyncWork();
    });
    expect(posts(calls)).toHaveLength(1);
    expect(status()).toBe('All changes saved.');
  });
});

describe('CmsEditorialEntryEditorIsland: refusals keep the work', () => {
  it('refuses an invalid value locally, links the summary to it, and only an explicit save takes focus', async () => {
    const { container, advance, calls } = setup([]);
    const rating = byLabel<HTMLInputElement>(container, 'Rating');
    await typeInto(rating, '11');
    await advance(3_000);
    expect(calls).toHaveLength(0);
    const summary = container.querySelector<HTMLElement>(
      '[data-cms-editorial-validation-summary]',
    );
    expect(summary?.textContent).toContain('Rating');
    // Autosave is advisory and never steals focus.
    expect(document.activeElement).not.toBe(summary);
    expect(rating.getAttribute('aria-invalid')).toBe('true');
    expect(rating.value).toBe('11');
    await click(buttonNamed(container, 'Save draft'));
    expect(document.activeElement).toBe(summary);
    const link = summary?.querySelector('a');
    expect(link?.getAttribute('href')).toBe(`#field-${RATING}`);
  });

  it('after a lost response keeps the typed value and replays the identical request on its own', async () => {
    const { container, advance, calls, status } = setup([
      new TypeError('Failed to fetch'),
      revisionCreated({ revisionNumber: '3', entryVersion: '5' }),
    ]);
    const title = byLabel<HTMLInputElement>(container, 'Title (required)');
    await typeInto(title, 'Survives the outage');
    await advance(3_000);
    expect(status()).toContain('could not be confirmed');
    expect(title.value).toBe('Survives the outage');
    await advance(2_000);
    expect(posts(calls)).toHaveLength(2);
    expect(posts(calls)[1]?.body).toBe(posts(calls)[0]?.body);
    expect(posts(calls)[1]?.headers.get('idempotency-key')).toBe(
      posts(calls)[0]?.headers.get('idempotency-key'),
    );
    expect(status()).toBe('All changes saved.');
  });

  it('offers a manual retry once the automatic replays are exhausted', async () => {
    const lost = new TypeError('Failed to fetch');
    const { container, advance, calls, status } = setup([
      lost,
      lost,
      lost,
      lost,
      revisionCreated({ revisionNumber: '3', entryVersion: '5' }),
    ]);
    await typeInto(
      byLabel<HTMLInputElement>(container, 'Title (required)'),
      'Flaky',
    );
    await advance(3_000);
    await advance(20_000);
    expect(status()).toContain('Retry save');
    await click(buttonNamed(container, 'Retry save'));
    await act(async () => {
      await settleAsyncWork();
    });
    expect(posts(calls)).toHaveLength(5);
    expect(status()).toBe('All changes saved.');
  });

  it('keeps the work and offers sign-in with a safe return when the session expires', async () => {
    const { container, advance } = setup([apiError(401, 'UNAUTHENTICATED')]);
    const title = byLabel<HTMLInputElement>(container, 'Title (required)');
    await typeInto(title, 'Unsent after expiry');
    await advance(3_000);
    const signIn = Array.from(container.querySelectorAll('a')).find((anchor) =>
      anchor.textContent?.includes('Sign in again'),
    );
    expect(signIn?.getAttribute('href')).toMatch(
      /^\/auth\/sign-in\?returnTo=/u,
    );
    expect(title.value).toBe('Unsent after expiry');
    expect(container.querySelector('fieldset[disabled]')).not.toBeNull();
  });

  it('shows the revoked-authority message and keeps the unsent value readable', async () => {
    const { container, advance, status } = setup([apiError(403, 'FORBIDDEN')]);
    const title = byLabel<HTMLInputElement>(container, 'Title (required)');
    await typeInto(title, 'Unsent after revocation');
    await advance(3_000);
    // A revoked authority interrupts: an alert, not a polite status.
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'kept in this browser only',
    );
    expect(status()).toBe('');
    expect(title.value).toBe('Unsent after revocation');
    expect(container.querySelector('fieldset[disabled]')).not.toBeNull();
  });
});

describe('CmsEditorialEntryEditorIsland: conflicts', () => {
  it('shows the durable open conflict from the draft as a banner with a link to resolve it', () => {
    const { container } = setup(
      [],
      editorInit({ openConflict: { conflictId: CONFLICT_ID, version: '1' } }),
    );
    const link = Array.from(container.querySelectorAll('a')).find((anchor) =>
      anchor.textContent?.includes('Resolve the conflict'),
    );
    expect(link?.getAttribute('href')).toBe(
      `/app/cms-content-modeling/entries/${ENTRY_ID}/conflicts/${CONFLICT_ID}`,
    );
  });

  it('on a 409 opens the sync-conflict alert with focus, keeps the unsent value and links to resolution', async () => {
    const { container, advance } = setup([
      apiError(409, 'CONFLICT', { conflict: 'VERSION_MISMATCH' }),
      draftDetail({
        entryVersion: '6',
        revisionNumber: '3',
        values: { [TITLE]: 'Theirs' },
        openConflict: { conflictId: CONFLICT_ID, version: '1' },
      }),
    ]);
    const title = byLabel<HTMLInputElement>(container, 'Title (required)');
    await typeInto(title, 'Mine');
    await advance(3_000);
    const alert = container.querySelector<HTMLElement>(
      '[data-cms-editorial-sync-conflict]',
    );
    expect(alert).not.toBeNull();
    expect(alert?.textContent).toContain('Nothing was overwritten');
    expect(
      document.activeElement === alert?.parentElement ||
        alert?.parentElement?.contains(document.activeElement) === true,
    ).toBe(true);
    expect(title.value).toBe('Mine');
    expect(
      Array.from(container.querySelectorAll('a')).some(
        (anchor) =>
          anchor.getAttribute('href') ===
          `/app/cms-content-modeling/entries/${ENTRY_ID}/conflicts/${CONFLICT_ID}`,
      ),
    ).toBe(true);
  });

  it('offers to load the current version, discarding unsent edits only when asked to', async () => {
    const { container, advance, calls } = setup([
      apiError(409, 'CONFLICT', { conflict: 'VERSION_MISMATCH' }),
      draftDetail({
        entryVersion: '6',
        revisionNumber: '3',
        values: { [TITLE]: 'Theirs' },
      }),
      draftDetail({
        entryVersion: '6',
        revisionNumber: '3',
        values: { [TITLE]: 'Theirs' },
      }),
    ]);
    await typeInto(
      byLabel<HTMLInputElement>(container, 'Title (required)'),
      'Mine',
    );
    await advance(3_000);
    await click(
      buttonNamed(container, 'Discard my changes and load the current version'),
    );
    await act(async () => {
      await settleAsyncWork();
    });
    expect(calls.filter((call) => call.method === 'GET')).toHaveLength(2);
    expect(byLabel<HTMLInputElement>(container, 'Title (required)').value).toBe(
      'Theirs',
    );
    expect(
      container.querySelector('[data-cms-editorial-sync-conflict]'),
    ).toBeNull();
  });
});

describe('CmsEditorialEntryEditorIsland: what cannot be edited', () => {
  it('is read-only with a stated reason when the entry is not active', () => {
    const { container } = setup([], editorInit({ lifecycle: 'archived' }));
    expect(container.querySelector('fieldset[disabled]')).not.toBeNull();
    expect(container.textContent).toContain('cannot be edited');
    expect(
      Array.from(container.querySelectorAll('button')).some(
        (button) => button.textContent === 'Save draft' && !button.disabled,
      ),
    ).toBe(false);
  });

  it('states why a relation with unavailable targets is read-only', () => {
    const { container } = setup(
      [],
      editorInit({
        readOnlyNotices: {
          [RELATED]:
            '1 linked entry is unavailable to you, so this relation cannot be edited here.',
        },
      }),
    );
    expect(container.textContent).toContain(
      '1 linked entry is unavailable to you',
    );
    expect(container.querySelector(`#field-${RELATED}-group input`)).toBeNull();
  });
});

describe('CmsEditorialEntryEditorIsland: text the database cannot store', () => {
  it('shows the field message on an explicit save and sends nothing', async () => {
    const { container, calls } = setup([]);
    await typeInto(
      byLabel<HTMLInputElement>(container, 'Title (required)'),
      'broken \uD800 title',
    );
    await click(buttonNamed(container, 'Save draft'));
    await act(async () => {
      await settleAsyncWork();
    });
    expect(posts(calls)).toHaveLength(0);
    expect(container.textContent).toContain(
      'This text contains a character that cannot be saved.',
    );
    expect(byLabel<HTMLInputElement>(container, 'Title (required)').value).toBe(
      'broken \uD800 title',
    );
  });
});
