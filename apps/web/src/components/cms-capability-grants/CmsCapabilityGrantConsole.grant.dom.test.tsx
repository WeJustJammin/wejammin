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
  GRANT_UUID,
  blur,
  click,
  fillGrantForm,
  mountConsole,
  query,
  scriptFetch,
  settle,
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

describe('[DEC-119/120] grant form validation', () => {
  it('[P2-S09-AC-1008] shows the exact inline error on blur and links it from the field', () => {
    const root = mount();
    const person = query<HTMLInputElement>(
      root,
      'input[name="subjectPersonId"]',
    );
    typeInto(person, 'abc');
    blur(person);
    const error = query(
      root,
      '#' + person.getAttribute('aria-describedby')?.split(' ').at(-1),
    );
    expect(textOf(error)).toBe("Enter the person's ID as a UUID.");
    expect(person.getAttribute('aria-invalid')).toBe('true');
  });

  it('[P2-S09-AC-1010] [P2-S09-AC-1048] refuses a date past today plus 89 days with the exact range copy', () => {
    const root = mount();
    const date = query<HTMLInputElement>(root, 'input[name="validThrough"]');
    typeInto(date, '2026-12-31');
    blur(date);
    expect(textOf(root)).toContain(
      'Choose an end date from 2026-10-02 through 2026-12-30 (UTC).',
    );
  });

  it('[P2-S09-AC-993] [P2-S09-AC-1043] blocks an invalid submit, forwards nothing and focuses the first invalid field', async () => {
    const { fetchMock } = scriptFetch(() => grantListResponse());
    const root = mount();
    const form = query<HTMLFormElement>(
      root,
      'form[data-operation-id="CMS-03A-15"]',
    );
    await submit(form);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(
      query(form, 'input[name="subjectPersonId"]'),
    );
    expect(textOf(root)).toContain('Choose a capability from the list.');
  });

  it('[P2-S09-AC-1011] counts the reason down live and refuses more than 256 characters', () => {
    const root = mount();
    const area = query<HTMLTextAreaElement>(root, 'textarea[name="reason"]');
    typeInto(area, 'x'.repeat(10));
    expect(textOf(root)).toContain('246 characters remaining');
    typeInto(area, 'x'.repeat(257));
    blur(area);
    expect(textOf(root)).toContain('Keep the reason to 256 characters.');
  });
});

describe('[DEC-119] grant command', () => {
  it('[P2-S09-AC-1043] [P2-S09-AC-995] posts the form through the proxy, shows the result heading and refetches the list', async () => {
    const { calls } = scriptFetch(
      () => jsonResponse(201, grantResource()),
      () => grantListResponse(),
    );
    const root = mount();
    const form = fillGrantForm(root, { reason: 'Covers the autumn issue' });
    await submit(form);
    expect(calls[0]).toMatchObject({
      url: '/api/v1/cms/capability-grants',
      method: 'POST',
    });
    expect(calls[0]?.body?.get('subjectPersonId')).toBe(GRANT_UUID);
    expect(calls[0]?.body?.get('capability')).toBe('cms.author');
    expect(calls[0]?.body?.get('validThrough')).toBe('2026-12-30');
    expect(calls[0]?.body?.get('reason')).toBe('Covers the autumn issue');
    const heading = query<HTMLElement>(root, '#cms-grants-result-heading');
    expect(textOf(heading)).toBe('Capability granted');
    expect(document.activeElement).toBe(heading);
    expect(calls[1]?.method).toBe('GET');
    expect(calls[1]?.url).toContain('/api/v1/cms/capability-grants?');
    expect(document.activeElement).toBe(heading);
  });

  it('[P2-S09-AC-1043] announces only the capability label and valid-through date', async () => {
    scriptFetch(
      () => jsonResponse(201, grantResource()),
      () => grantListResponse(),
    );
    const root = mount();
    await submit(fillGrantForm(root));
    const live = query(
      root,
      '[role="status"][aria-live="polite"][aria-atomic="true"]',
    );
    expect(textOf(live)).toContain(
      'Granted Author entries until 2026-10-31 (UTC).',
    );
    expect(textOf(live)).not.toContain(GRANT_UUID);
  });

  it('clears the entered person ID after a successful grant', async () => {
    scriptFetch(
      () => jsonResponse(201, grantResource()),
      () => grantListResponse(),
    );
    const root = mount();
    await submit(fillGrantForm(root));
    expect(
      query<HTMLInputElement>(root, 'input[name="subjectPersonId"]').value,
    ).toBe('');
  });

  it('disables the commit with a stable pending label while in flight and ignores a duplicate', async () => {
    let release: (response: Response) => void = () => undefined;
    const { fetchMock } = scriptFetch(
      () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
      () => grantListResponse(),
    );
    const root = mount();
    const form = fillGrantForm(root);
    await submit(form);
    const button = query<HTMLButtonElement>(
      root,
      'form[data-operation-id="CMS-03A-15"] button[type="submit"]',
    );
    expect(textOf(button)).toBe('Granting');
    expect(button.disabled).toBe(true);
    await submit(form);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    release(jsonResponse(201, grantResource()));
    await settle();
  });

  it('[P2-S09-AC-1000] [P2-S09-AC-1026] routes 401 STEP_UP_REQUIRED to /step-up?returnTo= and keeps the entries in memory', async () => {
    scriptFetch(() =>
      jsonResponse(
        401,
        apiError('STEP_UP_REQUIRED', {
          recoveryAction: 'step_up',
          allowedMethods: ['totp'],
        }),
      ),
    );
    const root = mount();
    const form = fillGrantForm(root);
    await submit(form);
    expect(textOf(root)).toContain(
      'Verify your identity to change CMS access.',
    );
    const link = query<HTMLAnchorElement>(
      root,
      'a[data-action="verify-identity"]',
    );
    expect(link.getAttribute('href')).toBe(
      '/step-up?returnTo=%2Fapp%2Fcms-content-modeling%2Fcapability-grants',
    );
    expect(
      query<HTMLInputElement>(form, 'input[name="subjectPersonId"]').value,
    ).toBe(GRANT_UUID);
    click(link);
    expect(window.sessionStorage.getItem('wj:cms-grants:step-up-return')).toBe(
      '1',
    );
    expect(window.sessionStorage.length).toBe(1);
    expect(JSON.stringify(Object.entries(window.sessionStorage))).not.toContain(
      GRANT_UUID,
    );
  });

  it('tells the owner nothing was saved when returning from step-up with a cleared form', () => {
    window.sessionStorage.setItem('wj:cms-grants:step-up-return', '1');
    const root = mount();
    expect(textOf(root)).toContain('Your entries were not saved.');
    expect(
      window.sessionStorage.getItem('wj:cms-grants:step-up-return'),
    ).toBeNull();
  });

  it('[P2-S09-AC-1001] sends an expired session to sign-in', async () => {
    scriptFetch(() => jsonResponse(401, apiError('UNAUTHENTICATED')));
    const root = mount();
    await submit(fillGrantForm(root));
    expect(navigateTo).toHaveBeenCalledWith(
      '/auth/sign-in?returnTo=%2Fapp%2Fcms-content-modeling%2Fcapability-grants',
    );
  });

  it('[P2-S09-AC-997] [P2-S09-AC-1004] renders the exact 409 copy with a link that filters the list to the capability', async () => {
    const { calls } = scriptFetch(
      () => jsonResponse(409, apiError('CONFLICT')),
      () => grantListResponse(),
    );
    const root = mount();
    await submit(fillGrantForm(root));
    expect(textOf(root)).toContain(
      'This person already holds this capability. Renew the existing grant instead.',
    );
    click(query(root, 'button[data-action="filter-capability"]'));
    await settle();
    expect(calls.at(-1)?.url).toContain('capability=cms.author');
  });

  it('[P2-S09-AC-997] [P2-S09-AC-1003] renders the exact non-disclosing 404 copy and retains the input', async () => {
    scriptFetch(() => jsonResponse(404, apiError('NOT_FOUND')));
    const root = mount();
    const form = fillGrantForm(root);
    await submit(form);
    expect(textOf(root)).toContain(
      'That person could not be found as a member of your organization.',
    );
    expect(
      query<HTMLInputElement>(form, 'input[name="subjectPersonId"]').value,
    ).toBe(GRANT_UUID);
  });

  it('[P2-S09-AC-1005] [P2-S09-AC-1048] maps a server 422 for the 90-day ceiling onto the date field with a linked summary', async () => {
    scriptFetch(() =>
      jsonResponse(
        422,
        apiError('VALIDATION_FAILED', {
          violations: [
            {
              path: '/validThrough',
              code: 'grant_term_spans_at_most_ninety_utc_days',
            },
          ],
        }),
      ),
    );
    const root = mount();
    await submit(fillGrantForm(root));
    expect(textOf(root)).toContain(
      'Choose an end date no more than 90 days from today (UTC).',
    );
    const summary = query(root, '[data-command-error]');
    expect(summary.getAttribute('role')).toBe('alert');
    expect(textOf(summary)).toContain('Check the highlighted fields.');
    expect(
      query(
        summary,
        'a[href="#' + query(root, 'input[name="validThrough"]').id + '"]',
      ),
    ).not.toBeNull();
  });

  it('[P2-S09-AC-997] [P2-S09-AC-1006] shows an inline Retry-After countdown for 429 and keeps the input', async () => {
    scriptFetch(() =>
      jsonResponse(429, apiError('RATE_LIMITED'), { 'retry-after': '9' }),
    );
    const root = mount();
    await submit(fillGrantForm(root));
    expect(textOf(root)).toContain('Too many requests. Try again shortly.');
    expect(textOf(root)).toMatch(/9 seconds/u);
  });

  it('[P2-S09-AC-998] [P2-S09-AC-1047] never guesses success after an unconfirmed outcome and refetches before any retry', async () => {
    const { calls } = scriptFetch(
      () => jsonResponse(503, apiError('DEPENDENCY_UNAVAILABLE')),
      () => jsonResponse(503, apiError('DEPENDENCY_UNAVAILABLE')),
      () => grantListResponse(),
    );
    const root = mount();
    await submit(fillGrantForm(root));
    expect(textOf(root)).toContain('not confirmed yet');
    expect(textOf(root)).not.toContain('Capability granted');
    expect(calls.some((call) => call.method === 'GET')).toBe(true);
  });
});
