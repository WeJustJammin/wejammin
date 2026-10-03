// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';

import {
  FACTOR_B,
  REQUEST_ID,
  apiError,
  conflict,
  enrollment,
  factor,
  factorsResource,
  flush,
  json,
  setValue,
  stubFetch,
  type StubResponse,
  violation,
} from './step-up-mfa.test-support';
import {
  alertText,
  button,
  fillAndSubmitName,
  mountWizard,
  nameInput,
  pressButton,
  statusText,
  type WizardHarness,
} from './mfa-wizard-support.test-support';

let harness: WizardHarness | null = null;
afterEach(() => {
  harness?.mounted.unmount();
  harness = null;
  vi.useRealTimers();
});

const startWith = async (response: Response, ...tail: StubResponse[]) => {
  const fetchImpl = stubFetch(response, ...tail);
  harness = mountWizard(fetchImpl, { factors: [] });
  const container = harness.mounted.container;
  pressButton(container, 'Set up an authenticator');
  fillAndSubmitName(container, 'Laptop');
  await flush();
  return { fetchImpl, container, h: harness };
};

/** FE01 "Error copy and routing" for AUTH-API-17 and AUTH-API-18. */
describe('MfaEnrollmentWizard enrollment start errors', () => {
  it('[P2-S09-AC-1088] asks for sign-in again when no recent primary authentication exists', async () => {
    const { container } = await startWith(
      apiError(401, 'UNAUTHENTICATED', { recoveryAction: 'reauthenticate' }),
    );
    expect(statusText(container)).toContain(
      'For your security, sign in again to set up your first authenticator.',
    );
    const link = container.querySelector<HTMLAnchorElement>(
      'a[href^="/auth/sign-in"]',
    );
    expect(link?.getAttribute('href')).toBe(
      `/auth/sign-in?returnTo=${encodeURIComponent('/settings/security/mfa')}`,
    );
    expect(container.querySelector('a[href^="/step-up"]')).toBeNull();
  });

  it('routes a STEP_UP_REQUIRED from a second-factor enrollment to /step-up', async () => {
    const { h } = await startWith(
      apiError(401, 'STEP_UP_REQUIRED', {
        recoveryAction: 'step_up',
        allowedMethods: ['totp'],
      }),
    );
    expect(h.navigate).toHaveBeenCalledExactlyOnceWith(
      `/step-up?returnTo=${encodeURIComponent('/settings/security/mfa')}`,
    );
  });

  it('[P2-S09-AC-1090] reports the 10 authenticator limit with a link to the list', async () => {
    const { container } = await startWith(conflict('mfa_factor_limit'));
    expect(alertText(container)).toContain(
      'You have reached the limit of 10 authenticators. Remove one first.',
    );
    expect(
      container.querySelector('a[href="#mfa-factor-list-heading"]'),
    ).not.toBeNull();
  });

  it('[P2-S09-AC-1091] shows a taken name as a field error on the name', async () => {
    const { container } = await startWith(conflict('factor_name_taken'));
    const input = nameInput(container);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(
      container.querySelector(
        `#${input
          .getAttribute('aria-describedby')
          ?.split(' ')
          .find(
            (id) => container.querySelector(`#${id}[role="alert"]`) !== null,
          )}`,
      )?.textContent,
    ).toContain('already have an authenticator with that name');
    expect(document.activeElement).toBe(input);
  });

  it('shows a rejected name as a field error', async () => {
    const { container } = await startWith(violation('friendly_name_invalid'));
    expect(nameInput(container).getAttribute('aria-invalid')).toBe('true');
  });

  it('[P2-S09-AC-1093] opens a sync conflict and refetches the list on a stale version', async () => {
    const resource = factorsResource([], '8', false);
    const { fetchImpl, container } = await startWith(
      apiError(409, 'CONFLICT', {
        conflict: 'VERSION_MISMATCH',
        recoveryAction: 'refetch',
      }),
      json(200, resource, { etag: '"8"' }),
    );
    expect(alertText(container)).toContain('This page was out of date');
    expect(fetchImpl.calls[1]?.url).toBe('/api/v1/account/mfa/factors');
  });

  it('[P2-S09-AC-1094] gates an ineligible account with a reason', async () => {
    const { container } = await startWith(
      apiError(403, 'FORBIDDEN', { reasonCode: 'account_not_eligible' }),
    );
    expect(container.textContent).toContain(
      'Two-step verification is not available for this account.',
    );
    const gated = container.querySelector(
      '[aria-disabled="true"], button[disabled]',
    );
    expect(gated).not.toBeNull();
  });

  it('[P2-S09-AC-1095] asks for a reload on a CSRF refusal', async () => {
    const { container, h } = await startWith(
      apiError(403, 'FORBIDDEN', { reasonCode: 'origin_csrf_required' }),
    );
    expect(alertText(container)).toContain(
      'Your session changed. Reload to continue.',
    );
    pressButton(container, 'Reload');
    expect(h.reload).toHaveBeenCalledOnce();
  });

  it('[P2-S09-AC-1096] counts down a rate limit and keeps submit disabled with a visible reason', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    vi.setSystemTime(new Date('2026-10-02T12:00:00Z'));
    const { container } = await startWith(
      apiError(
        429,
        'RATE_LIMITED',
        { retryAfterSeconds: 90 },
        { 'retry-after': '90' },
      ),
    );
    const submit = container.querySelector<HTMLButtonElement>(
      'form button[type="submit"]',
    );
    expect(submit?.disabled).toBe(true);
    expect(container.textContent).toContain('Too many attempts');
    expect(
      container.querySelector('[data-lockout-countdown]')?.textContent,
    ).toBe('1:30');
    act(() => {
      vi.advanceTimersByTime(90_000);
    });
    expect(
      container.querySelector<HTMLButtonElement>('form button[type="submit"]')
        ?.disabled,
    ).toBe(false);
  });

  it('[P2-S09-AC-1097] is degraded with the request id and Retry starts a new enrollment, never a resend', async () => {
    const { fetchImpl, container } = await startWith(
      apiError(503, 'DEPENDENCY_UNAVAILABLE', {
        dependencyClass: 'provider',
        retryable: true,
      }),
      json(201, enrollment('5')),
    );
    expect(alertText(container)).toContain(
      'Verification is temporarily unavailable.',
    );
    expect(container.textContent).toContain(REQUEST_ID);
    pressButton(container, 'Retry');
    await flush();
    expect(fetchImpl.calls[1]?.url).toBe('/api/v1/account/mfa/factors');
    expect(fetchImpl.calls[1]?.method).toBe('POST');
    expect(container.querySelector('code[translate="no"]')).not.toBeNull();
  });
});

describe('MfaEnrollmentWizard verify errors', () => {
  const toVerify = async (failure: Response) => {
    const state = await startWith(json(201, enrollment('5')), failure);
    const input =
      state.container.querySelector<HTMLInputElement>('input[name="code"]');
    if (input === null) throw new Error('missing code field');
    setValue(input, '123456');
    pressButton(state.container, 'Verify and finish');
    await flush();
    return state;
  };

  it.each(['enrollment_expired', 'factor_not_pending'])(
    '[P2-S09-AC-1079] [P2-S09-AC-1092] offers Start again after %s and drops the secret',
    async (reason) => {
      const { container } = await toVerify(
        conflict(reason, 'restart_enrollment'),
      );
      expect(alertText(container)).toContain('Setup expired. Start again.');
      expect(container.querySelector('code[translate="no"]')).toBeNull();
      pressButton(container, 'Start again');
      expect(
        container.querySelector('input[name="friendlyName"]'),
      ).not.toBeNull();
    },
  );

  it('[P2-S09-AC-1087] reports a malformed code from the server in the field', async () => {
    const { container } = await toVerify(violation('code_invalid'));
    expect(alertText(container)).toContain(
      'Enter the 6-digit code from your authenticator app.',
    );
  });

  it('[P2-S09-AC-1087] refuses a malformed code locally with no request', async () => {
    const { fetchImpl, container } = await startWith(
      json(201, enrollment('5')),
    );
    const input =
      container.querySelector<HTMLInputElement>('input[name="code"]');
    if (input === null) throw new Error('missing code field');
    setValue(input, '12');
    pressButton(container, 'Verify and finish');
    await flush();
    expect(fetchImpl.calls).toHaveLength(1);
    expect(alertText(container)).toContain(
      'Enter the 6-digit code from your authenticator app.',
    );
  });

  it('[P2-S09-AC-1093] opens a sync conflict on factor_state_conflict and refetches', async () => {
    const { fetchImpl, container } = await toVerify(
      conflict('factor_state_conflict'),
    );
    expect(alertText(container)).toContain('This page was out of date');
    expect(fetchImpl.calls.at(-1)?.url).toBe('/api/v1/account/mfa/factors');
    expect(button(container, 'Set up an authenticator')).toBeDefined();
    expect(FACTOR_B).toBeDefined();
    expect(factor(FACTOR_B)).toBeDefined();
  });
});
