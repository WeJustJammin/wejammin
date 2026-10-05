// @vitest-environment jsdom

import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/client-binding', () => ({
  addClientBindingIdHeader: async (_input: unknown, init?: RequestInit) => init,
}));

import {
  grantListPage,
  GRANT_ID,
} from '../../server/cms-capability-grant.test-support';
import {
  LAPSED_ID,
  apiError,
  consoleProps,
  jsonResponse,
  renderConsoleDocument,
  rowFor,
  sampleItems,
  successList,
} from './cms-capability-grant-console.test-support';
import {
  fillGrantForm,
  mountConsole,
  query,
  scriptFetch,
  settle,
  submit,
  textOf,
  type Mounted,
} from './cms-capability-grant-dom.test-support';
import { DEGRADED_REASON_ID } from './cms-capability-grant-reasons';

/**
 * FE03 grant console AsyncState rows `degraded` (CMS-03A-18) and the 429 row of
 * the DEC-119 command table, plus the row-action accessible names.
 */

let mounted: Mounted | null = null;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  window.sessionStorage.clear();
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const VERIFIED_AT = '2026-10-02T11:59:00.000Z';
const REASON =
  'The grants could not be refreshed. Every change is disabled until the list is current.';

const degradedDocument = () => {
  const list = successList();
  return renderConsoleDocument(
    consoleProps({
      initialList: {
        status: 'degraded',
        data: list.status === 'success' ? list.data : null,
        requestId: 'req-1',
        lastVerifiedAt: VERIFIED_AT,
        retryable: true,
        httpStatus: 503,
      },
    }),
  );
};

const commandControls = (root: Document | HTMLElement): HTMLButtonElement[] => [
  ...root.querySelectorAll<HTMLButtonElement>(
    'button[data-action="renew"], button[data-action="revoke"], button[data-action="grant-again"], form[data-operation-id="CMS-03A-15"] button[type="submit"]',
  ),
];

describe('[DEC-119] degraded grant list', () => {
  it('[P2-S09-AC-998] keeps the last verified rows and shows the exact lastVerifiedAt', () => {
    const doc = degradedDocument();
    expect(rowFor(doc, GRANT_ID)).not.toBeNull();
    expect(rowFor(doc, LAPSED_ID)).not.toBeNull();
    const time = doc.querySelector(`#${DEGRADED_REASON_ID} time`);
    expect(time?.getAttribute('datetime')).toBe(VERIFIED_AT);
    expect(textOf(time)).toBe(VERIFIED_AT);
    expect(textOf(doc.getElementById(DEGRADED_REASON_ID))).toBe(
      `${REASON} Last verified ${VERIFIED_AT}.`,
    );
  });

  it('[P2-S09-AC-998] disables every command control and ties each to the visible reason', () => {
    const doc = degradedDocument();
    const controls = commandControls(doc);
    // Active row (renew, revoke), lapsed row (renew, revoke), revoked row (grant again), grant submit.
    expect(controls).toHaveLength(6);
    for (const control of controls) {
      expect(control.disabled).toBe(true);
      expect(
        (control.getAttribute('aria-describedby') ?? '').split(' '),
      ).toContain(DEGRADED_REASON_ID);
    }
    expect(textOf(doc.getElementById(DEGRADED_REASON_ID))).toContain(
      'Every change is disabled',
    );
  });

  it('[P2-S09-AC-998] a current list enables the same controls and names no reason (control)', () => {
    const doc = renderConsoleDocument(consoleProps());
    const controls = commandControls(doc);
    expect(controls).toHaveLength(6);
    for (const control of controls) {
      expect(control.disabled).toBe(false);
      expect(control.getAttribute('aria-describedby') ?? '').not.toContain(
        DEGRADED_REASON_ID,
      );
    }
    expect(doc.getElementById(DEGRADED_REASON_ID)).toBeNull();
  });

  it('[P2-S09-AC-998] an unknown mutation outcome renders pending, refetches the list before any retry, and a failed refetch degrades with commands disabled until a good read', async () => {
    const { calls } = scriptFetch(
      () => jsonResponse(503, apiError('DEPENDENCY_UNAVAILABLE')),
      () => jsonResponse(503, apiError('DEPENDENCY_UNAVAILABLE')),
      () => jsonResponse(503, apiError('DEPENDENCY_UNAVAILABLE')),
      () => jsonResponse(200, grantListPage(sampleItems())),
    );
    mounted = mountConsole(consoleProps());
    const root = mounted.container;
    await submit(fillGrantForm(root));
    // Pending, never a guessed success.
    expect(textOf(root)).toContain(
      'The result of this change is not confirmed yet. Checking the current grants before you retry.',
    );
    expect(textOf(root)).not.toContain('Capability granted');
    // The command is replayed once under the same Idempotency-Key, then the
    // list is read before any further command: POST, POST, GET and no third POST.
    expect(calls.map((call) => call.method)).toStrictEqual([
      'POST',
      'POST',
      'GET',
    ]);
    const keys = calls
      .slice(0, 2)
      .map((call) => call.body?.get('idempotency-key') ?? null);
    expect(keys[0]).not.toBeNull();
    expect(keys[1]).toBe(keys[0]);
    // The refetch failed, so the list is degraded and every command is disabled with the reason.
    const reason = root.querySelector(`#${DEGRADED_REASON_ID}`);
    expect(textOf(reason)).toContain('Every change is disabled');
    const controls = commandControls(root);
    expect(controls.length).toBeGreaterThan(0);
    for (const control of controls) expect(control.disabled).toBe(true);
    // Retry reads the list again (GET only); a good read re-enables the commands.
    const retry = query<HTMLAnchorElement>(
      root,
      `#${DEGRADED_REASON_ID} ~ a[data-cms-retry-control], a[data-cms-retry-control]`,
    );
    await act(async () => {
      retry.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true }),
      );
    });
    await settle();
    expect(calls.map((call) => call.method)).toStrictEqual([
      'POST',
      'POST',
      'GET',
      'GET',
    ]);
    expect(root.querySelector(`#${DEGRADED_REASON_ID}`)).toBeNull();
    for (const control of commandControls(root))
      expect(control.disabled).toBe(false);
  });
});

describe('[DEC-119] 429 on a grant command', () => {
  it('[P2-S09-AC-1006] counts down from Retry-After once a second, never resets the typed input, and ends at try again now', async () => {
    vi.useFakeTimers();
    scriptFetch(() =>
      jsonResponse(429, apiError('RATE_LIMITED'), { 'retry-after': '3' }),
    );
    mounted = mountConsole(consoleProps());
    const root = mounted.container;
    const form = fillGrantForm(root, { reason: 'Quarterly access review' });
    await submit(form);
    const timer = (): string => textOf(root.querySelector('[role="timer"]'));
    const keptInput = (): string[] => [
      query<HTMLInputElement>(root, 'input[name="subjectPersonId"]').value,
      query<HTMLSelectElement>(root, 'select[name="capability"]').value,
      query<HTMLInputElement>(root, 'input[name="validThrough"]').value,
      query<HTMLTextAreaElement>(root, 'textarea[name="reason"]').value,
    ];
    const expectedInput = [
      'f08a3c62-91d4-7b5e-a620-4c7e1d9b08f3',
      'cms.author',
      '2026-12-30',
      'Quarterly access review',
    ];
    expect(textOf(root)).toContain('Too many requests. Try again shortly.');
    expect(timer()).toBe('You can try again in 3 seconds.');
    expect(keptInput()).toStrictEqual(expectedInput);
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(timer()).toBe('You can try again in 2 seconds.');
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(timer()).toBe('You can try again in 1 second.');
    expect(keptInput()).toStrictEqual(expectedInput);
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(timer()).toBe('You can try again now.');
    expect(keptInput()).toStrictEqual(expectedInput);
  });
});

describe('[DEC-119] row action accessible names', () => {
  it('[P2-S09-AC-1044] names Renew and Revoke with the capability label and the end date and describes both by the row person cell', () => {
    const doc = renderConsoleDocument(consoleProps());
    const cases = [
      [GRANT_ID, 'Author entries', '2026-10-31'],
      [LAPSED_ID, 'Edit and return entries', '2026-09-01'],
    ] as const;
    for (const [grantId, label, date] of cases) {
      const row = rowFor(doc, grantId);
      const person = row?.querySelector('[data-person-cell]');
      expect(person).not.toBeNull();
      for (const verb of ['Renew', 'Revoke'] as const) {
        const button = row?.querySelector<HTMLButtonElement>(
          `button[data-action="${verb.toLowerCase()}"]`,
        );
        expect(button?.getAttribute('aria-label')).toBe(
          `${verb} ${label} grant ending ${date}`,
        );
        // Enabled controls are described by the person cell only.
        const describedBy = button?.getAttribute('aria-describedby') ?? '';
        expect(doc.getElementById(describedBy)).toBe(person);
      }
    }
  });
});
