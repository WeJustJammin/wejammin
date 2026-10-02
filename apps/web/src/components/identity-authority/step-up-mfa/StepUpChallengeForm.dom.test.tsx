// @vitest-environment jsdom

import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';

import { StepUpChallengeForm } from './StepUpChallengeForm';
import {
  FACTOR_A,
  FACTOR_B,
  apiError,
  challenge,
  conflict,
  flush,
  json,
  setValue,
  stepUpResult,
  stubFetch,
  type StubResponse,
  violation,
  byText,
  click,
} from './step-up-mfa.test-support';
import {
  RETURN_TO,
  channelStub,
  codeInput,
  mountForm,
  submitForm,
  type FormHarness,
} from './step-up-form-support.test-support';
import { stepUpSignInHref } from './step-up-return';

let harness: FormHarness | null = null;
afterEach(() => {
  harness?.mounted.unmount();
  harness = null;
});

const open = async (...responses: StubResponse[]) => {
  const fetchImpl = stubFetch(json(201, challenge()), ...responses);
  harness = mountForm(fetchImpl);
  await flush();
  return { fetchImpl, container: harness.mounted.container, h: harness };
};

describe('StepUpChallengeForm creating the challenge', () => {
  it('never creates a challenge during server rendering', () => {
    const fetchImpl = stubFetch();
    const html = renderToString(
      <StepUpChallengeForm
        variant="authPage"
        returnTo="/app"
        factors={[{ id: FACTOR_A, friendlyName: 'Phone a' }]}
        initialPhase="creating-challenge"
        api={{ fetch: fetchImpl }}
        channel={channelStub()}
      />,
    );
    expect(fetchImpl.calls).toHaveLength(0);
    expect(html).not.toContain('name="code"');
  });

  it('creates exactly one challenge on mount for a single verified factor', async () => {
    const { fetchImpl, container } = await open();
    expect(fetchImpl.calls).toHaveLength(1);
    expect(fetchImpl.calls[0]?.url).toBe('/api/v1/auth/step-up/challenges');
    expect(fetchImpl.calls[0]?.body).toEqual({ method: 'totp' });
    expect(container.textContent).toContain('Phone a');
  });

  it('lets a person choose among several verified factors first', async () => {
    const fetchImpl = stubFetch(json(201, challenge(FACTOR_B)));
    harness = mountForm(fetchImpl, {
      initialPhase: 'choosing-factor',
      factors: [
        { id: FACTOR_A, friendlyName: 'Phone a' },
        { id: FACTOR_B, friendlyName: 'Laptop' },
      ],
    });
    await flush();
    const container = harness.mounted.container;
    expect(fetchImpl.calls).toHaveLength(0);
    const group = container.querySelector('[role="radiogroup"], fieldset');
    expect(group).not.toBeNull();
    const radios = container.querySelectorAll<HTMLInputElement>(
      'input[type="radio"]',
    );
    expect(radios).toHaveLength(2);
    const second = radios[1];
    if (second === undefined) throw new Error('missing radio');
    click(second);
    const cont = byText(container, 'button', 'Continue');
    if (cont === undefined) throw new Error('missing Continue');
    click(cont);
    await flush();
    expect(fetchImpl.calls[0]?.body).toEqual({
      method: 'totp',
      factorId: FACTOR_B,
    });
  });

  it('explains the missing authenticator and links to enrollment and back', async () => {
    harness = mountForm(stubFetch(), { initialPhase: 'no-factor' });
    await flush();
    const container = harness.mounted.container;
    expect(container.textContent).toContain('verified authenticator');
    const primary = container.querySelector<HTMLAnchorElement>(
      'a[href^="/settings/security/mfa"]',
    );
    expect(primary?.getAttribute('href')).toBe(
      `/settings/security/mfa?returnTo=${encodeURIComponent(RETURN_TO)}`,
    );
    expect(container.querySelector(`a[href="${RETURN_TO}"]`)).not.toBeNull();
    expect(container.querySelector('input[name="code"]')).toBeNull();
  });
});

describe('StepUpChallengeForm one-time code field', () => {
  it('renders the exact one-time-code semantics with a persistent label', async () => {
    const { container } = await open();
    const input = codeInput(container);
    expect(input.getAttribute('type')).toBe('text');
    expect(input.getAttribute('inputmode')).toBe('numeric');
    expect(input.getAttribute('autocomplete')).toBe('one-time-code');
    expect(input.getAttribute('maxlength')).toBe('12');
    expect(input.getAttribute('spellcheck')).toBe('false');
    expect(input.getAttribute('autocapitalize')).toBe('none');
    expect(input.getAttribute('enterkeyhint')).toBe('done');
    expect(input.hasAttribute('pattern')).toBe(false);
    expect(input.hasAttribute('aria-invalid')).toBe(false);
    const label = container.querySelector(`label[for="${input.id}"]`);
    expect(label?.textContent).toMatch(/code/iu);
    const described = input.getAttribute('aria-describedby') ?? '';
    expect(
      described
        .split(' ')
        .every((id) => container.querySelector(`#${id}`) !== null),
    ).toBe(true);
    expect(container.querySelector('form')?.hasAttribute('novalidate')).toBe(
      true,
    );
  });

  it('strips spaces and hyphens before the six-digit check and sends the digits only', async () => {
    const { fetchImpl, container } = await open(json(200, stepUpResult));
    setValue(codeInput(container), '123 456');
    submitForm(container);
    await flush();
    expect(fetchImpl.calls[1]?.url).toContain('/verify');
    expect(fetchImpl.calls[1]?.body).toEqual({ code: '123456' });
  });

  it('refuses a malformed code without any request and announces the error in the field', async () => {
    const { fetchImpl, container } = await open();
    const input = codeInput(container);
    setValue(input, '12 ab');
    submitForm(container);
    await flush();
    expect(fetchImpl.calls).toHaveLength(1);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const errorId = input
      .getAttribute('aria-describedby')
      ?.split(' ')
      .find((id) => container.querySelector(`#${id}[role="alert"]`) !== null);
    expect(errorId).toBeDefined();
    expect(container.querySelector(`#${errorId}`)?.textContent).toBe(
      'Enter the 6-digit code from your authenticator app.',
    );
    expect(document.activeElement).toBe(input);
  });

  it('clears and re-selects the field when the code is incorrect', async () => {
    const { container } = await open(violation('code_incorrect'));
    const input = codeInput(container);
    setValue(input, '654321');
    submitForm(container);
    await flush();
    expect(input.value).toBe('');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(container.textContent).toContain(
      "That code didn't work. Check the code and try again.",
    );
    expect(document.activeElement).toBe(input);
  });

  it('makes the field read-only, not disabled, while verifying and ignores duplicate submits', async () => {
    let release: ((response: Response) => void) | undefined;
    const fetchImpl = stubFetch(json(201, challenge()), () => {
      throw new Error('replaced below');
    });
    const pending = new Promise<Response>((resolve) => {
      release = resolve;
    });
    let calls = 0;
    const wrapped = ((input: RequestInfo | URL, init?: RequestInit) => {
      calls += 1;
      return calls === 1 ? fetchImpl(input, init) : pending;
    }) as typeof fetch;
    harness = mountForm(wrapped);
    await flush();
    const container = harness.mounted.container;
    const input = codeInput(container);
    setValue(input, '123456');
    submitForm(container);
    submitForm(container);
    await flush();
    expect(calls).toBe(2);
    expect(input.readOnly).toBe(true);
    expect(input.disabled).toBe(false);
    expect(byText(container, 'button', 'Verifying')).toBeDefined();
    await act(async () => {
      release?.(json(200, stepUpResult));
      await Promise.resolve();
    });
    await flush();
  });
});

describe('StepUpChallengeForm outcomes', () => {
  it('announces success, posts an invalidation-only message and does a full navigation to returnTo', async () => {
    const { container, h } = await open(json(200, stepUpResult));
    setValue(codeInput(container), '123456');
    submitForm(container);
    await flush();
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      'Verified. Returning to your page.',
    );
    expect(h.navigate).toHaveBeenCalledExactlyOnceWith(RETURN_TO);
    expect(h.channel.posts()).toBe(1);
  });

  it('offers a fresh code request when the challenge expired and moves focus to it', async () => {
    const { fetchImpl, container } = await open(
      conflict('challenge_expired', 'new_challenge'),
      json(201, challenge()),
    );
    setValue(codeInput(container), '123456');
    submitForm(container);
    await flush();
    expect(container.textContent).toContain(
      'This code request is no longer valid.',
    );
    const button = byText(container, 'button', 'Get a new code request');
    expect(button).toBeDefined();
    expect(document.activeElement).toBe(button);
    if (button !== undefined) click(button);
    await flush();
    expect(fetchImpl.calls[2]?.url).toBe('/api/v1/auth/step-up/challenges');
  });

  it('signs out to the sign-in page carrying /step-up on 401 UNAUTHENTICATED', async () => {
    const { container, h } = await open(
      apiError(401, 'UNAUTHENTICATED', { recoveryAction: 'reauthenticate' }),
    );
    setValue(codeInput(container), '123456');
    submitForm(container);
    await flush();
    expect(h.navigate).toHaveBeenCalledExactlyOnceWith(
      stepUpSignInHref(RETURN_TO),
    );
  });

  it('shows degraded copy with the request id and retries by creating a new challenge, never resending the code', async () => {
    const { fetchImpl, container } = await open(
      apiError(503, 'DEPENDENCY_UNAVAILABLE', {
        dependencyClass: 'provider',
        retryable: true,
      }),
      json(201, challenge()),
    );
    setValue(codeInput(container), '123456');
    submitForm(container);
    await flush();
    expect(container.textContent).toContain(
      'Verification is temporarily unavailable.',
    );
    expect(container.textContent).toContain(
      '0195b6f0-0000-7000-8000-000000000001',
    );
    const retry = byText(container, 'button', 'Retry');
    if (retry === undefined) throw new Error('missing Retry');
    click(retry);
    await flush();
    expect(fetchImpl.calls[2]?.url).toBe('/api/v1/auth/step-up/challenges');
    expect(fetchImpl.calls[2]?.body).toEqual({ method: 'totp' });
  });

  it('keeps the code and the secret-free URL: nothing is written to storage or the location', async () => {
    const before = window.location.href;
    const { container } = await open(json(200, stepUpResult));
    setValue(codeInput(container), '123456');
    submitForm(container);
    await flush();
    expect(window.location.href).toBe(before);
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });
});
