// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';

import {
  apiError,
  flush,
  json,
  stubFetch,
} from '../../identity-authority/step-up-mfa/step-up-mfa.test-support';
import { ADMIN_RESET_COPY } from './admin-mfa-reset-values';
import {
  PERSON,
  REASON,
  RESET_ID,
  alertText,
  mountReset,
  openConfirmation,
  personInput,
  press,
  reasonInput,
  resetBody,
  statusText,
  type ResetHarness,
} from './admin-mfa-reset.test-support';

let harness: ResetHarness | null = null;
afterEach(() => {
  harness?.mounted.unmount();
  harness = null;
});

const commit = async (...responses: Parameters<typeof stubFetch>) => {
  const fetchImpl = stubFetch(...responses);
  harness = mountReset(fetchImpl);
  const c = harness.mounted.container;
  await openConfirmation(c);
  press(c, 'Reset factors');
  await flush();
  return { fetchImpl, c, h: harness };
};

describe('AdminMfaFactorResetForm success', () => {
  it('posts the strict body once, announces completion and clears the form', async () => {
    const { fetchImpl, c, h } = await commit(json(200, resetBody('completed')));
    expect(fetchImpl.calls).toHaveLength(1);
    expect(fetchImpl.calls[0]?.body).toEqual({
      targetPersonId: PERSON,
      reason: REASON,
    });
    expect(fetchImpl.calls[0]?.headers.get('idempotency-key')).toBe(
      'reset-key-0001',
    );
    expect(statusText(c)).toContain(ADMIN_RESET_COPY.completed);
    const heading = c.querySelector('h3[data-result-heading]');
    expect(document.activeElement).toBe(heading);
    expect(personInput(c).value).toBe('');
    expect(reasonInput(c).value).toBe('');
    expect(h.refetch).toHaveBeenCalledWith('mutation');
  });

  it('announces reconciling for 202 and never says completed', async () => {
    const { c } = await commit(json(202, resetBody('reconciling')));
    expect(statusText(c)).toContain(ADMIN_RESET_COPY.reconciling);
    expect(c.textContent).not.toContain(ADMIN_RESET_COPY.completed);
  });

  it('never renders the person or reset identifiers from the response', async () => {
    const { c } = await commit(json(200, resetBody('completed')));
    expect(c.textContent).not.toContain(PERSON);
    expect(c.textContent).not.toContain(RESET_ID);
  });

  it('shows a stable pending label and ignores duplicate activation', async () => {
    const fetchImpl = stubFetch(json(200, resetBody('completed')));
    harness = mountReset(fetchImpl);
    const c = harness.mounted.container;
    await openConfirmation(c);
    press(c, 'Reset factors');
    expect(
      Array.from(c.querySelectorAll('button')).some(
        (b) => b.textContent === 'Resetting',
      ),
    ).toBe(true);
    const pending = Array.from(c.querySelectorAll('button')).find(
      (b) => b.textContent === 'Resetting',
    );
    pending?.click();
    await flush();
    expect(fetchImpl.calls).toHaveLength(1);
  });
});

describe('AdminMfaFactorResetForm step-up recovery', () => {
  it('navigates to /step-up with the current path and persists no entries', async () => {
    const { h } = await commit(
      apiError(401, 'STEP_UP_REQUIRED', { allowedMethods: ['totp'] }),
    );
    expect(h.navigate).toHaveBeenCalledWith(
      `/step-up?returnTo=${encodeURIComponent('/app/platform-configuration-admin/mfa-reset')}`,
    );
    expect(h.storage.dump()).not.toContain(PERSON);
    expect(h.storage.dump()).not.toContain(REASON);
  });

  it('opens empty with the not-saved note after returning from step-up, once', async () => {
    const first = await commit(apiError(401, 'STEP_UP_REQUIRED'));
    const { storage } = first.h;
    first.h.mounted.unmount();
    harness = mountReset(stubFetch(), { storage });
    const c = harness.mounted.container;
    expect(statusText(c)).toContain(ADMIN_RESET_COPY.notSaved);
    expect(personInput(c).value).toBe('');
    harness.mounted.unmount();
    harness = mountReset(stubFetch(), { storage });
    expect(statusText(harness.mounted.container)).not.toContain(
      ADMIN_RESET_COPY.notSaved,
    );
  });
});

describe('AdminMfaFactorResetForm errors', () => {
  it.each([
    [apiError(403, 'FORBIDDEN'), ADMIN_RESET_COPY.forbidden],
    [apiError(404, 'TARGET_NOT_FOUND'), ADMIN_RESET_COPY.notFound],
    [apiError(409, 'MFA_RESET_IN_PROGRESS'), ADMIN_RESET_COPY.inProgress],
    [apiError(409, 'IDEMPOTENCY_CONFLICT'), ADMIN_RESET_COPY.refresh],
    [apiError(422, 'MFA_RESET_INVALID'), ADMIN_RESET_COPY.selfTarget],
  ])('shows exact copy for %#', async (response, message) => {
    const { c } = await commit(response);
    expect(alertText(c)).toContain(message);
    expect(statusText(c)).not.toContain(ADMIN_RESET_COPY.completed);
  });

  it('keeps the entries after a refusal so the operator can correct them', async () => {
    const { c } = await commit(apiError(404, 'TARGET_NOT_FOUND'));
    expect(personInput(c).value).toBe(PERSON);
  });

  it('counts down a 429 Retry-After and disables submission', async () => {
    const { c } = await commit(
      apiError(429, 'RATE_LIMITED', {}, { 'retry-after': '90' }),
    );
    expect(c.textContent).toContain('1:30');
    const submitButton = Array.from(c.querySelectorAll('button')).find(
      (b) => b.type === 'submit',
    );
    expect(submitButton?.disabled).toBe(true);
  });

  it('shows degraded with the request ID for 503', async () => {
    const { c } = await commit(apiError(503, 'IDENTITY_UNAVAILABLE'));
    expect(alertText(c)).toContain(ADMIN_RESET_COPY.degraded);
    expect(c.textContent).toContain('0195b6f0-0000-7000-8000-000000000001');
  });

  it('never guesses an outcome after a network failure and retries with the same key', async () => {
    const { fetchImpl, c } = await commit(
      new Error('offline'),
      json(200, resetBody('completed')),
    );
    expect(alertText(c)).toContain(ADMIN_RESET_COPY.unknown);
    expect(statusText(c)).not.toContain(ADMIN_RESET_COPY.completed);
    press(c, 'Retry');
    await flush();
    expect(fetchImpl.calls).toHaveLength(2);
    expect(fetchImpl.calls[1]?.headers.get('idempotency-key')).toBe(
      fetchImpl.calls[0]?.headers.get('idempotency-key'),
    );
    expect(statusText(c)).toContain(ADMIN_RESET_COPY.completed);
  });
});
