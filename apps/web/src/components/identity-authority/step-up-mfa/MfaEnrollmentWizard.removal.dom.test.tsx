// @vitest-environment jsdom

import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  FACTOR_A,
  FACTOR_B,
  apiError,
  conflict,
  factor,
  factorsResource,
  flush,
  json,
  stubFetch,
  click,
} from './step-up-mfa.test-support';
import {
  button,
  mountWizard,
  pressButton,
  statusText,
  type WizardHarness,
} from './mfa-wizard-support.test-support';

let harness: WizardHarness | null = null;
afterEach(() => {
  harness?.mounted.unmount();
  harness = null;
});

const two = [factor(FACTOR_A), factor(FACTOR_B, 'verified', 'Laptop')];

describe('MfaEnrollmentWizard factor list', () => {
  it('renders a semantic table with the five column headers and one row per factor', () => {
    harness = mountWizard(stubFetch(), { factors: two });
    const container = harness.mounted.container;
    const headers = Array.from(container.querySelectorAll('thead th')).map((th) => th.textContent?.trim());
    expect(headers).toEqual(['Name', 'Status', 'Added', 'Last used', 'Action']);
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(container.querySelector('table caption')).not.toBeNull();
    expect(container.querySelectorAll('time').length).toBeGreaterThan(0);
  });

  it('exposes a focusable list heading', () => {
    harness = mountWizard(stubFetch(), { factors: two });
    const heading = harness.mounted.container.querySelector('#mfa-factor-list-heading');
    expect(heading?.getAttribute('tabindex')).toBe('-1');
  });
});

describe('MfaEnrollmentWizard removal', () => {
  it('names the consequence, defaults the reason to user_request and cancels with Escape', () => {
    harness = mountWizard(stubFetch(), { factors: two });
    const container = harness.mounted.container;
    pressButton(container, 'Remove Phone a');
    expect(container.textContent).toContain('You will not be able to verify protected actions with it');
    expect(container.textContent).not.toContain('until you add another authenticator');
    const radios = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="radio"][name="reason"]'));
    expect(radios.map((radio) => radio.value)).toEqual(['user_request', 'factor_compromise']);
    expect(radios[0]?.checked).toBe(true);
    expect(container.textContent).toContain('Your other signed-in sessions will be signed out');
    act(() => {
      container.querySelector('[data-mfa-removal]')?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
    });
    expect(container.querySelector('[data-mfa-removal]')).toBeNull();
  });

  it('warns about the last verified factor', () => {
    harness = mountWizard(stubFetch(), { factors: [factor(FACTOR_A)] });
    const container = harness.mounted.container;
    pressButton(container, 'Remove Phone a');
    expect(container.textContent).toContain('until you add another authenticator');
  });

  it('removes with a per-instance idempotency key and If-Match, then focuses the list heading and announces', async () => {
    const after = factorsResource([factor(FACTOR_B, 'verified', 'Laptop')], '9');
    const fetchImpl = stubFetch(json(200, after, { etag: '"9"' }));
    harness = mountWizard(fetchImpl, { factors: two });
    const container = harness.mounted.container;
    pressButton(container, 'Remove Phone a');
    const radios = container.querySelectorAll<HTMLInputElement>('input[type="radio"][name="reason"]');
    const compromise = radios[1];
    if (compromise === undefined) throw new Error('missing radio');
    click(compromise);
    pressButton(container, 'Remove authenticator');
    await flush();
    const call = fetchImpl.calls[0];
    expect(call?.method).toBe('DELETE');
    expect(call?.url).toBe(`/api/v1/account/mfa/factors/${FACTOR_A}`);
    expect(call?.body).toEqual({ reason: 'factor_compromise' });
    expect(call?.headers.get('if-match')).toBe('"4"');
    expect(call?.headers.get('idempotency-key')).toMatch(/^mfa-/u);
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(statusText(container)).toContain('Authenticator removed');
    expect(document.activeElement).toBe(container.querySelector('#mfa-factor-list-heading'));
  });

  it('routes a missing step-up to /step-up with the current location and keeps nothing', async () => {
    const fetchImpl = stubFetch(
      apiError(401, 'STEP_UP_REQUIRED', { recoveryAction: 'step_up', allowedMethods: ['totp'] }),
    );
    harness = mountWizard(fetchImpl, { factors: two });
    const container = harness.mounted.container;
    pressButton(container, 'Remove Phone a');
    pressButton(container, 'Remove authenticator');
    await flush();
    expect(harness.navigate).toHaveBeenCalledExactlyOnceWith(
      `/step-up?returnTo=${encodeURIComponent('/settings/security/mfa')}`,
    );
  });

  it('refuses the last factor while access needs verification: closed, polite, no state change', async () => {
    const fetchImpl = stubFetch(conflict('last_factor_required', 'enroll_factor'));
    harness = mountWizard(fetchImpl, { factors: [factor(FACTOR_A)] });
    const container = harness.mounted.container;
    pressButton(container, 'Remove Phone a');
    pressButton(container, 'Remove authenticator');
    await flush();
    expect(container.querySelector('[data-mfa-removal]')).toBeNull();
    expect(statusText(container)).toContain(
      'You still have access that needs verification, so add another authenticator before removing this one.',
    );
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
    pressButton(container, 'Set up an authenticator');
    expect(container.querySelector('input[name="friendlyName"]')).not.toBeNull();
  });

  it('opens a sync conflict and refetches on factor_state_conflict', async () => {
    const fetchImpl = stubFetch(
      conflict('factor_state_conflict'),
      json(200, factorsResource([factor(FACTOR_A, 'reconciling')], '10'), { etag: '"10"' }),
    );
    harness = mountWizard(fetchImpl, { factors: two });
    const container = harness.mounted.container;
    pressButton(container, 'Remove Phone a');
    pressButton(container, 'Remove authenticator');
    await flush();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('This page was out of date');
    expect(container.textContent).toContain('Checking status');
    expect(button(container, /Refresh status/u)).toBeDefined();
  });
});
