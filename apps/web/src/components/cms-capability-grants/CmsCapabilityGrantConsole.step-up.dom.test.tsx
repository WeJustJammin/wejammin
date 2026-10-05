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

import { grantListPage } from '../../server/cms-capability-grant.test-support';
import {
  consoleProps,
  jsonResponse,
  sampleItems,
} from './cms-capability-grant-console.test-support';
import {
  click,
  mountConsole,
  query,
  scriptFetch,
  settle,
  textOf,
  type Mounted,
} from './cms-capability-grant-dom.test-support';

/**
 * FE03 owner grant console step-up gating: the commit controls are enabled
 * only while the step-up disclosure is `verified`; otherwise they are disabled
 * and the step-up recovery is offered (FE03 role matrix, DEC-119).
 */

const NOW = Date.parse('2026-10-02T12:00:00.000Z');
const FRESH_UNTIL = '2026-10-02T12:05:00.000Z';
const CONSOLE_PATH = '/app/cms-content-modeling/capability-grants';

let mounted: Mounted | null = null;
const mount = (overrides = {}) => {
  mounted = mountConsole(consoleProps(overrides));
  return mounted.container;
};
const commitControls = (root: HTMLElement): HTMLButtonElement[] => [
  ...root.querySelectorAll<HTMLButtonElement>(
    'form[data-operation-id="CMS-03A-15"] button[type="submit"], button[data-action="renew"], button[data-action="revoke"], button[data-action="grant-again"]',
  ),
];

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers({
    toFake: [
      'Date',
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
    ],
  });
  vi.setSystemTime(NOW);
  window.sessionStorage.clear();
  window.history.replaceState(null, '', CONSOLE_PATH);
  navigateTo.mockClear();
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('[P2-S09-AC-990] grant console commit controls follow the step-up disclosure', () => {
  it('[P2-S09-AC-990] [P2-S09-AC-1057] enables every commit control while the step-up disclosure is verified', () => {
    const root = mount({
      contextEvidence: {
        actingContextLabel: 'Northwind Collective',
        stepUpState: 'verified',
        stepUpFreshUntil: FRESH_UNTIL,
      },
    });
    const controls = commitControls(root);
    expect(controls.length).toBeGreaterThan(3);
    for (const control of controls) expect(control.disabled).toBe(false);
    expect(root.querySelector('[data-step-up-recovery]')).toBeNull();
    expect(textOf(root)).toContain('Verified until 12:05 UTC');
  });

  it('[P2-S09-AC-1023] [P2-S09-AC-990] [P2-S09-AC-999] [P2-S09-AC-1057] disables every commit control with the step-up recovery when step-up is required', () => {
    const root = mount({
      contextEvidence: { stepUpState: 'required' },
    });
    const controls = commitControls(root);
    expect(controls.length).toBeGreaterThan(3);
    for (const control of controls) expect(control.disabled).toBe(true);
    const recovery = query(root, '[data-step-up-recovery]');
    expect(textOf(recovery)).toContain(
      'Verify your identity to change CMS access.',
    );
    const link = recovery.querySelector('a');
    expect(link?.textContent).toBe('Verify identity');
    expect(link?.getAttribute('href')).toBe(
      `/step-up?returnTo=${encodeURIComponent(CONSOLE_PATH)}`,
    );
    // Reading the console never needs step-up: the list is still rendered.
    expect(root.querySelector('tr[data-grant-id]')).not.toBeNull();
  });

  it('[P2-S09-AC-990] [P2-S09-AC-1057] treats a verified window that is already past as step-up required', () => {
    const root = mount({
      contextEvidence: {
        stepUpState: 'verified',
        stepUpFreshUntil: '2026-10-02T11:59:00.000Z',
      },
    });
    for (const control of commitControls(root))
      expect(control.disabled).toBe(true);
    expect(root.querySelector('[data-step-up-recovery]')).not.toBeNull();
  });

  it('[P2-S09-AC-990] [P2-S09-AC-1043] re-evaluates the disclosure on expiry and disables the commit controls without a reload', () => {
    const root = mount({
      contextEvidence: {
        stepUpState: 'verified',
        stepUpFreshUntil: FRESH_UNTIL,
      },
    });
    for (const control of commitControls(root))
      expect(control.disabled).toBe(false);
    act(() => {
      vi.setSystemTime(NOW + 6 * 60 * 1000);
      vi.advanceTimersByTime(31_000);
    });
    for (const control of commitControls(root))
      expect(control.disabled).toBe(true);
    expect(textOf(root)).toContain(
      'Verify your identity to change CMS access.',
    );
    expect(textOf(root)).toContain('Step-up required before commit');
  });
});

describe('[P2-S09-AC-994] grant console loading', () => {
  it('[P2-S09-AC-994] shows a skeleton with a polite region only after 250 ms and keeps the rows', async () => {
    let release: (response: Response) => void = () => undefined;
    const { calls } = scriptFetch(
      () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    );
    const root = mount();
    click(query(root, 'th button[data-sort="validThrough"]'));
    await settle();
    expect(root.querySelector('[data-list-loading]')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(249);
    });
    expect(root.querySelector('[data-list-loading]')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(2);
    });
    const loading = query(root, '[data-list-loading]');
    expect(textOf(loading)).toContain('Loading current grants');
    expect(
      loading.querySelector('[role="status"][aria-live="polite"]'),
    ).not.toBeNull();
    expect(loading.querySelector('[aria-hidden="true"]')).not.toBeNull();
    expect(root.querySelector('tr[data-grant-id]')).not.toBeNull();
    expect(calls).toHaveLength(1);
    release(jsonResponse(200, grantListPage(sampleItems())));
    await vi.waitFor(() =>
      expect(root.querySelector('[data-list-loading]')).toBeNull(),
    );
  });

  it('[P2-S09-AC-994] never shows the skeleton for a read that finishes inside 250 ms', async () => {
    scriptFetch(() => jsonResponse(200, grantListPage(sampleItems())));
    const root = mount();
    click(query(root, 'th button[data-sort="validThrough"]'));
    await settle();
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(root.querySelector('[data-list-loading]')).toBeNull();
  });
});

describe('[P2-S09-AC-1042] grant list result count and filter summary', () => {
  it('[P2-S09-AC-1042] announces the result count politely', () => {
    const root = mount();
    const summary = query(root, '[data-list-summary]');
    expect(summary.getAttribute('role')).toBe('status');
    expect(summary.getAttribute('aria-live')).toBe('polite');
    expect(textOf(summary)).toContain('3 grants shown');
    expect(textOf(summary)).toContain('No filters applied');
  });

  it('[P2-S09-AC-1042] summarizes the active capability and state filters', () => {
    const root = mount({
      query: {
        limit: 25,
        sort: 'updatedAt',
        direction: 'desc',
        capability: 'cms.editor',
        state: 'lapsed',
      },
    });
    const text = textOf(query(root, '[data-list-summary]'));
    expect(text).toContain('Filtered by capability Edit and return entries');
    expect(text).toContain('state Lapsed');
  });
});

describe('[P2-S09-AC-1024] grant console URL normalization', () => {
  it('[P2-S09-AC-1024] replaces an invalid address with the validated query without adding history', () => {
    window.history.replaceState(
      null,
      '',
      `${CONSOLE_PATH}?state=pending&limit=0&sort=capability`,
    );
    const before = window.history.length;
    mount();
    expect(`${window.location.pathname}${window.location.search}`).toBe(
      CONSOLE_PATH,
    );
    expect(window.history.length).toBe(before);
  });

  it('[P2-S09-AC-1024] leaves an already canonical address untouched', () => {
    window.history.replaceState(null, '', `${CONSOLE_PATH}?sort=validThrough`);
    const replace = vi.spyOn(window.history, 'replaceState');
    mount({
      query: { limit: 25, sort: 'validThrough', direction: 'desc' },
    });
    expect(replace).not.toHaveBeenCalled();
  });
});
