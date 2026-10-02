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
  REVOKED_ID,
  apiError,
  consoleProps,
  jsonResponse,
  sampleItems,
} from './cms-capability-grant-console.test-support';
import {
  click,
  mountConsole,
  query,
  scriptFetch,
  submit,
  textOf,
  typeInto,
  type Mounted,
} from './cms-capability-grant-dom.test-support';

/**
 * FE03 owner grant console interactions: local validation, the pending ->
 * result-heading flow, the refetch-after-command rule, and every error row of
 * the DEC-119 command table. No person identifier is announced or stored.
 */

let mounted: Mounted | null = null;
const mount = (overrides = {}) => {
  mounted = mountConsole(consoleProps(overrides));
  return mounted.container;
};
const grantListResponse = () => jsonResponse(200, grantListPage(sampleItems()));

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  window.sessionStorage.clear();
  navigateTo.mockClear();
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('[DEC-119] renew and revoke', () => {
  it('[P2-S09-AC-995] opens an inline renew form on the row and posts the strong If-Match and version', async () => {
    const { calls } = scriptFetch(
      () =>
        jsonResponse(
          200,
          grantResource({ version: '3', lastAction: 'renewed' }),
        ),
      () => grantListResponse(),
    );
    const root = mount();
    click(
      query(
        root,
        'tr[data-grant-id="6d1e8b24-5c93-7a0f-8e47-b2d6c9f13a85"] button[data-action="renew"]',
      ),
    );
    const form = query<HTMLFormElement>(
      root,
      'form[data-operation-id="CMS-03A-16"]',
    );
    expect(new FormData(form).get('if-match')).toBe('"2"');
    expect(new FormData(form).get('expectedVersion')).toBe('2');
    typeInto(query(form, 'input[name="validThrough"]'), '2026-12-01');
    await submit(form);
    expect(calls[0]).toMatchObject({
      url: '/api/v1/cms/capability-grants/6d1e8b24-5c93-7a0f-8e47-b2d6c9f13a85/renewals',
      method: 'POST',
    });
    expect(calls[0]?.body?.get('validThrough')).toBe('2026-12-01');
    expect(textOf(query(root, '#cms-grants-result-heading'))).toBe(
      'Grant renewed',
    );
  });

  it('[P2-S09-AC-1043] refuses a renewal date outside the window locally', async () => {
    const { fetchMock } = scriptFetch(() => grantListResponse());
    const root = mount();
    click(
      query(
        root,
        'tr[data-grant-id="6d1e8b24-5c93-7a0f-8e47-b2d6c9f13a85"] button[data-action="renew"]',
      ),
    );
    const form = query<HTMLFormElement>(
      root,
      'form[data-operation-id="CMS-03A-16"]',
    );
    typeInto(query(form, 'input[name="validThrough"]'), '2027-03-01');
    await submit(form);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(textOf(form)).toContain(
      'Choose an end date from 2026-10-02 through 2026-12-30 (UTC).',
    );
  });

  it('[P2-S09-AC-1012] [P2-S09-AC-1043] asks for confirmation naming the consequence; Escape cancels without a commit', async () => {
    const { fetchMock } = scriptFetch(() => grantListResponse());
    const root = mount();
    const trigger = query<HTMLButtonElement>(
      root,
      'tr[data-grant-id="6d1e8b24-5c93-7a0f-8e47-b2d6c9f13a85"] button[data-action="revoke"]',
    );
    click(trigger);
    const confirmation = query(root, '[data-revoke-confirmation]');
    expect(textOf(confirmation)).toContain(
      'Revoke Author entries now. It takes effect immediately and cannot be undone; grant it again to restore it.',
    );
    expect(document.activeElement).toBe(query(confirmation, 'h3'));
    const commit = query<HTMLButtonElement>(
      confirmation,
      'button[type="submit"]',
    );
    expect(commit.disabled).toBe(true);
    const { act } = await import('react');
    act(() => {
      confirmation.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
    });
    expect(root.querySelector('[data-revoke-confirmation]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('revokes only after the acknowledgement and refetches the list', async () => {
    const { calls } = scriptFetch(
      () =>
        jsonResponse(
          200,
          grantResource({
            state: 'revoked',
            lastAction: 'revoked',
            version: '3',
          }),
        ),
      () => grantListResponse(),
    );
    const root = mount();
    click(
      query(
        root,
        'tr[data-grant-id="6d1e8b24-5c93-7a0f-8e47-b2d6c9f13a85"] button[data-action="revoke"]',
      ),
    );
    const form = query<HTMLFormElement>(
      root,
      'form[data-operation-id="CMS-03A-17"]',
    );
    click(query(form, 'input[type="checkbox"][name="confirmed"]'));
    expect(
      query<HTMLButtonElement>(form, 'button[type="submit"]').disabled,
    ).toBe(false);
    await submit(form);
    expect(calls[0]).toMatchObject({
      url: '/api/v1/cms/capability-grants/6d1e8b24-5c93-7a0f-8e47-b2d6c9f13a85/revocations',
      method: 'POST',
    });
    expect(calls[0]?.body?.get('expectedVersion')).toBe('2');
    expect(textOf(query(root, '#cms-grants-result-heading'))).toBe(
      'Grant revoked',
    );
    expect(calls[1]?.method).toBe('GET');
  });

  it('explains a changed or missing grant and refetches the canonical list', async () => {
    const { calls } = scriptFetch(
      () => jsonResponse(409, apiError('CONFLICT')),
      () => grantListResponse(),
    );
    const root = mount();
    click(
      query(
        root,
        'tr[data-grant-id="6d1e8b24-5c93-7a0f-8e47-b2d6c9f13a85"] button[data-action="renew"]',
      ),
    );
    const form = query<HTMLFormElement>(
      root,
      'form[data-operation-id="CMS-03A-16"]',
    );
    typeInto(query(form, 'input[name="validThrough"]'), '2026-12-01');
    await submit(form);
    expect(textOf(root)).toContain(
      'This grant changed. Review the current term and try again.',
    );
    expect(calls.at(-1)?.method).toBe('GET');
  });

  it('offers "Grant again" on a revoked row and prefills the grant form from the held row', () => {
    const root = mount();
    click(
      query(
        root,
        `tr[data-grant-id="${REVOKED_ID}"] button[data-action="grant-again"]`,
      ),
    );
    const form = query<HTMLFormElement>(
      root,
      'form[data-operation-id="CMS-03A-15"]',
    );
    expect(
      query<HTMLSelectElement>(form, 'select[name="capability"]').value,
    ).toBe('cms.reviewer.legal');
    expect(
      query<HTMLInputElement>(form, 'input[name="subjectPersonId"]').value,
    ).toBe('f08a3c62-91d4-7b5e-a620-4c7e1d9b08f3');
  });
});
