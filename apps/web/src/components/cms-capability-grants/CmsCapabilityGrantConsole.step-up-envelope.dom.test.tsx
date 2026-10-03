// @vitest-environment jsdom

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
  grantListPage,
  grantResource,
} from '../../server/cms-capability-grant.test-support';
import {
  apiError,
  consoleProps,
  jsonResponse,
  sampleItems,
} from './cms-capability-grant-console.test-support';
import {
  click,
  fillGrantForm,
  mountConsole,
  query,
  scriptFetch,
  submit,
  textOf,
  typeInto,
  type Mounted,
} from './cms-capability-grant-dom.test-support';

/**
 * AC1031 (DEC-111 step-up recovery) across the REAL redirect: the 401
 * STEP_UP_REQUIRED reserved no idempotency record, so the interrupted command
 * is retried with its ORIGINAL Idempotency-Key. The console is a server-rendered
 * page, so /step-up leaves the page entirely: the island unmounts, the page
 * comes back with a fresh server request id and a fresh epoch, and only
 * tab-scoped storage survives. Each test drives that exact cycle.
 */

const ROW = 'tr[data-grant-id="6d1e8b24-5c93-7a0f-8e47-b2d6c9f13a85"]';
const RETURN_TO = '/app/cms-content-modeling/capability-grants';
const STEP_UP_HREF = `/step-up?returnTo=${encodeURIComponent(RETURN_TO)}`;
const SECOND_REQUEST_ID = '0b9d7e5a-4c61-4f6e-9a3d-2f8c1e7b5d40';
const OTHER_PERSON = '3f6b2d91-8c4e-7a15-b9d0-6e2a4c8f1b73';

let mounted: Mounted | null = null;
const mount = (requestId?: string) => {
  mounted?.unmount();
  mounted = mountConsole(
    consoleProps(requestId === undefined ? {} : { requestId }),
  );
  return mounted.container;
};
const stepUp = () =>
  jsonResponse(
    401,
    apiError('STEP_UP_REQUIRED', {
      recoveryAction: 'step_up',
      allowedMethods: ['totp'],
    }),
  );
const list = () => jsonResponse(200, grantListPage(sampleItems()));
const renewed = () =>
  jsonResponse(200, grantResource({ version: '3', lastAction: 'renewed' }));

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  window.sessionStorage.clear();
  window.history.replaceState(null, '', RETURN_TO);
  navigateTo.mockClear();
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.unstubAllGlobals();
});

/** Click "Verify identity" the way the browser does, then leave the page. */
const leaveForStepUp = (root: HTMLElement): void => {
  const link = query<HTMLAnchorElement>(
    root,
    'a[data-action="verify-identity"]',
  );
  expect(link.getAttribute('href')).toBe(STEP_UP_HREF);
  link.addEventListener('click', (event) => event.preventDefault());
  click(link);
  mounted?.unmount();
  mounted = null;
  window.history.replaceState(null, '', '/step-up?returnTo=x');
  window.history.replaceState(null, '', RETURN_TO);
};

const openRenew = (root: HTMLElement): HTMLFormElement => {
  click(query(root, `${ROW} button[data-action="renew"]`));
  const form = query<HTMLFormElement>(
    root,
    'form[data-operation-id="CMS-03A-16"]',
  );
  typeInto(query(form, 'input[name="validThrough"]'), '2026-12-01');
  return form;
};

const openRevoke = (root: HTMLElement): HTMLFormElement => {
  click(query(root, `${ROW} button[data-action="revoke"]`));
  const form = query<HTMLFormElement>(
    root,
    'form[data-operation-id="CMS-03A-17"]',
  );
  click(query(form, 'input[type="checkbox"][name="confirmed"]'));
  return form;
};

describe('[P2-S09-AC-1031] grant console step-up pending command survives the real /step-up redirect', () => {
  it('[P2-S09-AC-1031] CMS-03A-15 grant: the remounted page (new request id, empty form) sends the ORIGINAL Idempotency-Key', async () => {
    const { calls } = scriptFetch(
      () => stepUp(),
      () => jsonResponse(201, grantResource()),
      () => list(),
    );
    const first = mount();
    await submit(fillGrantForm(first));
    const original = calls[0]?.body?.get('idempotency-key');
    expect(typeof original).toBe('string');
    leaveForStepUp(first);

    const back = mount(SECOND_REQUEST_ID);
    expect(textOf(back)).toContain('Your entries were not saved.');
    expect(
      query<HTMLInputElement>(back, 'input[name="subjectPersonId"]').value,
    ).toBe('');
    await submit(fillGrantForm(back, { person: OTHER_PERSON }));
    expect(calls[1]?.url).toBe('/api/v1/cms/capability-grants');
    expect(calls[1]?.body?.get('idempotency-key')).toBe(original);
  });

  it('[P2-S09-AC-1031] CMS-03A-16 renewal: a refusal after an earlier success keeps its own key, not the fresh page key that the earlier success already used', async () => {
    const { calls } = scriptFetch(
      () => renewed(),
      () => list(),
      () => stepUp(),
      () => renewed(),
      () => list(),
    );
    const first = mount();
    await submit(openRenew(first));
    const earlier = calls[0]?.body?.get('idempotency-key');
    await submit(openRenew(first));
    const original = calls[2]?.body?.get('idempotency-key');
    expect(original).not.toBe(earlier);
    leaveForStepUp(first);

    const back = mount(SECOND_REQUEST_ID);
    await submit(openRenew(back));
    expect(calls[3]?.body?.get('idempotency-key')).toBe(original);
    expect(calls[3]?.body?.get('idempotency-key')).not.toBe(earlier);
  });

  it('[P2-S09-AC-1031] CMS-03A-17 revocation: a refusal after an earlier success keeps its own key across the remount', async () => {
    const revoked = () =>
      jsonResponse(
        200,
        grantResource({
          state: 'revoked',
          lastAction: 'revoked',
          version: '3',
        }),
      );
    const { calls } = scriptFetch(
      () => revoked(),
      () => list(),
      () => stepUp(),
      () => revoked(),
      () => list(),
    );
    const first = mount();
    await submit(openRevoke(first));
    const earlier = calls[0]?.body?.get('idempotency-key');
    await submit(openRevoke(first));
    const original = calls[2]?.body?.get('idempotency-key');
    expect(original).not.toBe(earlier);
    leaveForStepUp(first);

    const back = mount(SECOND_REQUEST_ID);
    await submit(openRevoke(back));
    expect(calls[3]?.body?.get('idempotency-key')).toBe(original);
  });

  it('[P2-S09-AC-1031] the pending command is scoped to its command and used once: another command takes its own key, the matching command takes the original, the one after takes a new key', async () => {
    const { calls } = scriptFetch(
      () => stepUp(),
      () => jsonResponse(201, grantResource()),
      () => list(),
      () => renewed(),
      () => list(),
      () => renewed(),
      () => list(),
    );
    const first = mount();
    await submit(openRenew(first));
    const original = calls[0]?.body?.get('idempotency-key');
    leaveForStepUp(first);

    const back = mount(SECOND_REQUEST_ID);
    await submit(fillGrantForm(back));
    const other = calls[1]?.body?.get('idempotency-key');
    expect(other).toMatch(/^cms-grant-15-/u);
    expect(other).not.toBe(original);
    await submit(openRenew(back));
    expect(calls[3]?.body?.get('idempotency-key')).toBe(original);
    await submit(openRenew(back));
    expect(calls[5]?.body?.get('idempotency-key')).not.toBe(original);
  });

  it('[P2-S09-AC-1031] without clicking Verify identity nothing is stored: the next page load shows no notice and no stale key', async () => {
    const { calls } = scriptFetch(
      () => stepUp(),
      () => renewed(),
      () => list(),
    );
    const first = mount();
    await submit(openRenew(first));
    const refused = calls[0]?.body?.get('idempotency-key');
    expect(window.sessionStorage.length).toBe(0);
    mounted?.unmount();
    mounted = null;
    const back = mount(SECOND_REQUEST_ID);
    expect(textOf(back)).not.toContain('Your entries were not saved.');
    await submit(openRenew(back));
    // A page that was never sent through /step-up has no pending command, so
    // the retry takes the page's own key (deterministic for a renewal).
    expect(calls[1]?.body?.get('idempotency-key')).toBe(refused);
  });
});
