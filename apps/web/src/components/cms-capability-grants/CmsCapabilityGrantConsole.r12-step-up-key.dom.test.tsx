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
 * AC1031 for CMS-03A-15 through CMS-03A-17 (DEC-111 step-up recovery): a 401
 * STEP_UP_REQUIRED reserved no idempotency record and created no domain state,
 * so the draft is retried with its ORIGINAL Idempotency-Key. Each command is
 * driven through the real console form: first refusal routes to /step-up with
 * the console as returnTo, then the same draft is confirmed again and sends the
 * identical key.
 */

const ROW = 'tr[data-grant-id="6d1e8b24-5c93-7a0f-8e47-b2d6c9f13a85"]';
const RETURN_TO = '/app/cms-content-modeling/capability-grants';
const STEP_UP_HREF = `/step-up?returnTo=${encodeURIComponent(RETURN_TO)}`;

let mounted: Mounted | null = null;
const mount = () => {
  mounted = mountConsole(consoleProps());
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

const recovery = (root: HTMLElement) =>
  query<HTMLAnchorElement>(root, 'a[data-action="verify-identity"]');

describe('[P2-S09-AC-1031] CMS-03A-15..17 step-up recovery keeps the original Idempotency-Key', () => {
  it('[P2-S09-AC-1031] CMS-03A-15 grant: 401 routes to /step-up, the retry reuses the key and succeeds', async () => {
    const { calls } = scriptFetch(
      () => stepUp(),
      () => jsonResponse(201, grantResource()),
      () => list(),
    );
    const root = mount();
    const form = fillGrantForm(root);
    await submit(form);
    expect(recovery(root).getAttribute('href')).toBe(STEP_UP_HREF);
    const original = calls[0]?.body?.get('idempotency-key');
    expect(typeof original).toBe('string');
    expect((original as string).length).toBeGreaterThanOrEqual(8);
    await submit(form);
    expect(calls[1]?.body?.get('idempotency-key')).toBe(original);
    expect(calls[1]?.url).toBe('/api/v1/cms/capability-grants');
    expect(textOf(query(root, '#cms-grants-result-heading'))).toBe(
      'Capability granted',
    );
  });

  it('[P2-S09-AC-1031] CMS-03A-16 renewal: 401 routes to /step-up, the retry reuses the key and the strong If-Match', async () => {
    const { calls } = scriptFetch(
      () => stepUp(),
      () =>
        jsonResponse(
          200,
          grantResource({ version: '3', lastAction: 'renewed' }),
        ),
      () => list(),
    );
    const root = mount();
    click(query(root, `${ROW} button[data-action="renew"]`));
    const form = query<HTMLFormElement>(
      root,
      'form[data-operation-id="CMS-03A-16"]',
    );
    typeInto(query(form, 'input[name="validThrough"]'), '2026-12-01');
    await submit(form);
    expect(recovery(root).getAttribute('href')).toBe(STEP_UP_HREF);
    const original = calls[0]?.body?.get('idempotency-key');
    expect(typeof original).toBe('string');
    await submit(form);
    expect(calls[1]?.body?.get('idempotency-key')).toBe(original);
    expect(calls[1]?.body?.get('if-match')).toBe(
      calls[0]?.body?.get('if-match'),
    );
    expect(calls[1]?.body?.get('expectedVersion')).toBe('2');
    expect(textOf(query(root, '#cms-grants-result-heading'))).toBe(
      'Grant renewed',
    );
  });

  it('[P2-S09-AC-1031] CMS-03A-17 revocation: 401 routes to /step-up, the retry reuses the key', async () => {
    const { calls } = scriptFetch(
      () => stepUp(),
      () =>
        jsonResponse(
          200,
          grantResource({
            state: 'revoked',
            lastAction: 'revoked',
            version: '3',
          }),
        ),
      () => list(),
    );
    const root = mount();
    click(query(root, `${ROW} button[data-action="revoke"]`));
    const form = query<HTMLFormElement>(
      root,
      'form[data-operation-id="CMS-03A-17"]',
    );
    click(query(form, 'input[type="checkbox"][name="confirmed"]'));
    await submit(form);
    expect(recovery(root).getAttribute('href')).toBe(STEP_UP_HREF);
    const original = calls[0]?.body?.get('idempotency-key');
    expect(typeof original).toBe('string');
    await submit(form);
    expect(calls[1]?.body?.get('idempotency-key')).toBe(original);
    expect(textOf(query(root, '#cms-grants-result-heading'))).toBe(
      'Grant revoked',
    );
  });
});
