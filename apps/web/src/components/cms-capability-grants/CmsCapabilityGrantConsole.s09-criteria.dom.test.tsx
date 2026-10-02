// @vitest-environment jsdom

import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const navigateTo = vi.hoisted(() => vi.fn());
vi.mock('./cms-capability-grant-navigation', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('./cms-capability-grant-navigation')
  >()),
  navigateTo,
}));
vi.mock('../../lib/client-binding', () => ({
  addClientBindingIdHeader: async (_input: unknown, init?: RequestInit) => init,
}));

import {
  GRANT_ID,
  grantListPage,
  grantResource,
} from '../../server/cms-capability-grant.test-support';
import {
  apiError,
  consoleProps,
  jsonResponse,
  sampleItems,
  successList,
} from './cms-capability-grant-console.test-support';
import {
  GRANT_UUID,
  click,
  fillGrantForm,
  mountConsole,
  scriptFetch,
  settle,
  submit,
  textOf,
  type Mounted,
} from './cms-capability-grant-dom.test-support';

/**
 * FE03 owner grant console criteria that need the live island: a lapsed
 * session removes protected data before it redirects, and the derived grant
 * state always comes from the server, never from the browser clock.
 */

let mounted: Mounted | null = null;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  window.sessionStorage.clear();
  window.history.replaceState(
    null,
    '',
    '/app/cms-content-modeling/capability-grants',
  );
  navigateTo.mockClear();
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('401 UNAUTHENTICATED on a command', () => {
  it('[P2-S09-AC-1001] removes the protected rows and person IDs and then performs the safe sign-in redirect', async () => {
    scriptFetch(() => jsonResponse(401, apiError('UNAUTHENTICATED')));
    mounted = mountConsole(consoleProps());
    const root = mounted.container;
    expect(root.querySelector('tr[data-grant-id]')).not.toBeNull();
    await submit(fillGrantForm(root));
    expect(navigateTo).toHaveBeenCalledWith(
      '/auth/sign-in?returnTo=%2Fapp%2Fcms-content-modeling%2Fcapability-grants',
    );
    expect(root.querySelector('tr[data-grant-id]')).toBeNull();
    expect(root.querySelector('form')).toBeNull();
    expect(textOf(root)).not.toContain(GRANT_UUID);
  });
});

describe('401 UNAUTHENTICATED on a list read', () => {
  it('[P2-S09-AC-1001] removes the protected rows before the safe sign-in redirect', async () => {
    scriptFetch(() => jsonResponse(401, apiError('UNAUTHENTICATED')));
    mounted = mountConsole(consoleProps());
    const root = mounted.container;
    const sort = root.querySelector<HTMLButtonElement>('th button');
    if (sort === null) throw new Error('RED: expected a sort button');
    click(sort);
    await vi.waitFor(() => expect(navigateTo).toHaveBeenCalled());
    expect(root.querySelector('tr[data-grant-id]')).toBeNull();
  });
});

describe('Back restores the list state', () => {
  it('[P2-S09-AC-1024] re-reads the list for the previous URL state when the history entry changes', async () => {
    const { calls } = scriptFetch(() =>
      jsonResponse(200, grantListPage(sampleItems())),
    );
    mounted = mountConsole(consoleProps());
    const root = mounted.container;
    const headers = [...root.querySelectorAll<HTMLButtonElement>('th button')];
    const validThrough = headers.find((button) =>
      /valid through/iu.test(button.textContent ?? ''),
    );
    if (validThrough === undefined)
      throw new Error('RED: expected sort button');
    click(validThrough);
    await settle();
    expect(window.location.search).toContain('sort=validThrough');
    const sortedReads = calls.length;
    await act(async () => {
      window.history.back();
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    await settle();
    expect(window.location.search).toBe('');
    expect(calls.length).toBeGreaterThan(sortedReads);
    const lastRead = new URL(calls.at(-1)?.url ?? '', 'https://app.test');
    expect(lastRead.searchParams.get('sort')).toBe('updatedAt');
    expect(lastRead.searchParams.get('direction')).toBe('desc');
    expect(
      root.querySelector(
        'th[aria-sort="ascending"], th[aria-sort="descending"]',
      )?.textContent,
    ).toMatch(/updated/iu);
  });
});

describe('focus on refetch', () => {
  it('[P2-S09-AC-1042] keeps focus on the control the owner used while the list is re-read', async () => {
    scriptFetch(() => jsonResponse(200, grantListPage(sampleItems())));
    mounted = mountConsole(consoleProps());
    const root = mounted.container;
    const sort = [...root.querySelectorAll<HTMLButtonElement>('th button')][0];
    if (sort === undefined) throw new Error('RED: expected sort button');
    sort.focus();
    click(sort);
    await settle();
    expect(document.activeElement).toBe(
      [...root.querySelectorAll<HTMLButtonElement>('th button')][0],
    );
  });
});

describe('derived grant state is server-owned', () => {
  it('[P2-S09-AC-1047] keeps an active row active after its end date passes on the browser clock', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.parse('2027-06-01T00:00:00.000Z'));
    mounted = mountConsole(
      consoleProps({
        initialList: successList([
          grantResource({ state: 'active', validThrough: '2026-10-31' }),
        ]),
      }),
    );
    const row = mounted.container.querySelector(
      `[data-grant-id="${GRANT_ID}"]`,
    );
    expect(textOf(row)).toMatch(/Active/u);
    expect(textOf(row)).not.toMatch(/Lapsed/u);
  });

  it('[P2-S09-AC-1047] keeps a lapsed row lapsed even when its end date is in the future on the browser clock', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.parse('2026-01-01T00:00:00.000Z'));
    mounted = mountConsole(
      consoleProps({
        initialList: successList([
          grantResource({ state: 'lapsed', validThrough: '2026-10-31' }),
        ]),
      }),
    );
    const row = mounted.container.querySelector(
      `[data-grant-id="${GRANT_ID}"]`,
    );
    expect(textOf(row)).toMatch(/Lapsed/u);
    expect(textOf(row)).not.toMatch(/Active/u);
  });
});
