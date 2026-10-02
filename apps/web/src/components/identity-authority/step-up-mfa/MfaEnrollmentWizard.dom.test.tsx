// @vitest-environment jsdom

import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  FACTOR_A,
  FACTOR_B,
  FRESH_UNTIL,
  OTPAUTH_URI,
  SECRET_KEY,
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
  pressButton,
  statusText,
  type WizardHarness,
} from './mfa-wizard-support.test-support';

let harness: WizardHarness | null = null;
afterEach(() => {
  harness?.mounted.unmount();
  harness = null;
  vi.restoreAllMocks();
});

const GROUPED_KEY = SECRET_KEY.match(/.{1,4}/gu)?.join(' ') ?? '';

const toScan = async (...tail: StubResponse[]) => {
  const fetchImpl = stubFetch(
    json(201, enrollment('5'), { etag: '"5"' }),
    ...tail,
  );
  harness = mountWizard(fetchImpl, { factors: [], expectedVersion: '4' });
  const container = harness.mounted.container;
  pressButton(container, 'Set up an authenticator');
  fillAndSubmitName(container, 'Laptop');
  await flush();
  return { fetchImpl, container, h: harness };
};

describe('MfaEnrollmentWizard empty state and name step', () => {
  it('[P2-S09-AC-1072] shows the empty state with the single action', () => {
    harness = mountWizard(stubFetch(), { factors: [] });
    const container = harness.mounted.container;
    expect(container.textContent).toContain('No authenticator is set up');
    expect(container.querySelectorAll('button').length).toBe(1);
    expect(button(container, 'Set up an authenticator')).toBeDefined();
  });

  it('[P2-S09-AC-1084] asks for a 1 to 80 character name with a persistent label and no autocomplete', () => {
    harness = mountWizard(stubFetch(), { factors: [] });
    const container = harness.mounted.container;
    pressButton(container, 'Set up an authenticator');
    const input = container.querySelector<HTMLInputElement>(
      'input[name="friendlyName"]',
    );
    expect(input?.getAttribute('maxlength')).toBe('80');
    expect(input?.getAttribute('autocomplete')).toBe('off');
    expect(container.querySelector(`label[for="${input?.id}"]`)).not.toBeNull();
  });

  it('rejects an empty name locally with an inline error and no request', async () => {
    const fetchImpl = stubFetch();
    harness = mountWizard(fetchImpl, { factors: [] });
    const container = harness.mounted.container;
    pressButton(container, 'Set up an authenticator');
    fillAndSubmitName(container, '   ');
    await flush();
    expect(fetchImpl.calls).toHaveLength(0);
    expect(alertText(container)).toContain(
      'Enter a name between 1 and 80 characters.',
    );
  });

  it('[P2-S09-AC-1074] starts enrollment with the expected version as If-Match', async () => {
    const { fetchImpl } = await toScan();
    expect(fetchImpl.calls[0]?.method).toBe('POST');
    expect(fetchImpl.calls[0]?.headers.get('if-match')).toBe('"4"');
    expect(fetchImpl.calls[0]?.body).toEqual({
      method: 'totp',
      friendlyName: 'Laptop',
    });
  });
});

describe('MfaEnrollmentWizard scan step', () => {
  it('[P2-S09-AC-1075] renders a local inline SVG QR with an accessible name and no otpauth link or text', async () => {
    const { container } = await toScan();
    const svg = container.querySelector('svg[role="img"]');
    expect(svg?.getAttribute('aria-label')).toBe(
      'QR code for adding WeJammin to an authenticator app',
    );
    expect(svg?.querySelector('path')?.getAttribute('d')).toMatch(
      /^M\d+ \d+h1v1h-1z/u,
    );
    expect(container.innerHTML).not.toContain('otpauth');
    expect(container.querySelector('a[href^="otpauth"]')).toBeNull();
    expect(container.querySelector('img, iframe, script')).toBeNull();
  });

  it('[P2-S09-AC-1077] shows the manual key in groups of four, not translated', async () => {
    const { container } = await toScan();
    const code = container.querySelector('code[translate="no"]');
    expect(code?.textContent).toBe(GROUPED_KEY);
  });

  it('[P2-S09-AC-1077] copies the key and announces it politely', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    const { container } = await toScan();
    pressButton(container, 'Copy key');
    await flush();
    expect(writeText).toHaveBeenCalledWith(SECRET_KEY);
    expect(statusText(container)).toContain('Key copied');
  });

  it('[P2-S09-AC-1074] [P2-S09-AC-1076] verifies with the version returned by enrollment and finishes with a fresh proof', async () => {
    const resource = factorsResource([factor(FACTOR_B)], '6', true);
    const { fetchImpl, container, h } = await toScan(
      json(200, resource, { etag: '"6"' }),
    );
    const input =
      container.querySelector<HTMLInputElement>('input[name="code"]');
    if (input === null) throw new Error('missing code field');
    setValue(input, '123 456');
    pressButton(container, 'Verify and finish');
    await flush();
    const call = fetchImpl.calls[1];
    expect(call?.url).toBe(`/api/v1/account/mfa/factors/${FACTOR_B}/verify`);
    expect(call?.headers.get('if-match')).toBe('"5"');
    expect(call?.body).toEqual({ code: '123456' });
    expect(container.textContent).toContain('Authenticator added');
    expect(
      container.querySelector(`time[datetime="${FRESH_UNTIL}"]`),
    ).not.toBeNull();
    expect(container.querySelector('a[href="/app/x"]')?.textContent).toMatch(
      /Continue/u,
    );
    expect(container.textContent).toContain('account recovery by email');
    expect(container.textContent).not.toContain(GROUPED_KEY);
    expect(container.querySelector('svg[role="img"]')).toBeNull();
    expect(h.channel.posts()).toBe(1);
  });

  it('keeps the secret after an incorrect code so the person can try again', async () => {
    const { container } = await toScan(violation('code_incorrect'));
    const input =
      container.querySelector<HTMLInputElement>('input[name="code"]');
    if (input === null) throw new Error('missing code field');
    setValue(input, '654321');
    pressButton(container, 'Verify and finish');
    await flush();
    expect(alertText(container)).toContain(
      "That code didn't work. Check the code and try again.",
    );
    expect(input.value).toBe('');
    expect(container.querySelector('code[translate="no"]')?.textContent).toBe(
      GROUPED_KEY,
    );
  });

  it('[P2-S09-AC-1078] [P2-S09-AC-1079] clears the secret on pagehide and writes it nowhere', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const pushState = vi.spyOn(window.history, 'pushState');
    const replaceState = vi.spyOn(window.history, 'replaceState');
    const before = window.location.href;
    const { container } = await toScan();
    expect(container.querySelector('code[translate="no"]')).not.toBeNull();
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(container.querySelector('code[translate="no"]')).toBeNull();
    expect(container.querySelector('svg[role="img"]')).toBeNull();
    expect(container.innerHTML).not.toContain(SECRET_KEY);
    expect(setItem).not.toHaveBeenCalled();
    expect(pushState).not.toHaveBeenCalled();
    expect(replaceState).not.toHaveBeenCalled();
    expect(window.location.href).toBe(before);
    expect(document.title + document.body.innerHTML).not.toContain(OTPAUTH_URI);
  });

  it('[P2-S09-AC-1076] keeps the continue link on the list when entered without a return target', async () => {
    const resource = factorsResource([factor(FACTOR_B)], '6', true);
    const fetchImpl = stubFetch(
      json(201, enrollment('5')),
      json(200, resource),
    );
    harness = mountWizard(fetchImpl, { factors: [], returnTo: null });
    const container = harness.mounted.container;
    pressButton(container, 'Set up an authenticator');
    fillAndSubmitName(container, 'Laptop');
    await flush();
    const input =
      container.querySelector<HTMLInputElement>('input[name="code"]');
    if (input !== null) setValue(input, '123456');
    pressButton(container, 'Verify and finish');
    await flush();
    expect(container.textContent).toContain('Authenticator added');
    expect(
      container.querySelector('a[href="#mfa-factor-list-heading"]'),
    ).not.toBeNull();
  });
});

describe('MfaEnrollmentWizard pending and reconciling rows', () => {
  it('[P2-S09-AC-1073] shows an unfinished setup with Start again and Cancel setup', async () => {
    const fetchImpl = stubFetch(json(201, enrollment('5')));
    harness = mountWizard(fetchImpl, {
      factors: [factor(FACTOR_B, 'pending', 'Laptop')],
    });
    const container = harness.mounted.container;
    expect(container.textContent).toContain('Setup not finished');
    pressButton(container, /Start again/u);
    fillAndSubmitName(container, 'Laptop');
    await flush();
    expect(fetchImpl.calls[0]?.url).toBe('/api/v1/account/mfa/factors');
    expect(container.querySelector('code[translate="no"]')).not.toBeNull();
  });

  it('[P2-S09-AC-1073] cancels a pending setup with reason user_request and no step-up confirmation', async () => {
    const fetchImpl = stubFetch(
      json(200, factorsResource([]), { etag: '"6"' }),
    );
    harness = mountWizard(fetchImpl, {
      factors: [factor(FACTOR_B, 'pending', 'Laptop')],
    });
    const container = harness.mounted.container;
    pressButton(container, /Cancel setup/u);
    await flush();
    expect(fetchImpl.calls[0]?.method).toBe('DELETE');
    expect(fetchImpl.calls[0]?.body).toEqual({ reason: 'user_request' });
    expect(container.textContent).toContain('No authenticator is set up');
  });

  it('[P2-S09-AC-1071] shows Checking status with a refresh control that refetches the list', async () => {
    const resource = factorsResource([factor(FACTOR_A)], '9');
    const fetchImpl = stubFetch(json(200, resource, { etag: '"9"' }));
    harness = mountWizard(fetchImpl, {
      factors: [factor(FACTOR_A, 'reconciling')],
    });
    const container = harness.mounted.container;
    expect(container.textContent).toContain('Checking status');
    pressButton(container, /Refresh status/u);
    await flush();
    expect(fetchImpl.calls[0]?.url).toBe('/api/v1/account/mfa/factors');
    expect(container.textContent).not.toContain('Checking status');
  });
});
