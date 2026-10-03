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
  it('[P2-S09-AC-1114] posts the strict body once, announces completion and clears the form', async () => {
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

  it('[P2-S09-AC-1115] announces reconciling for 202 and never says completed', async () => {
    const { c } = await commit(json(202, resetBody('reconciling')));
    expect(statusText(c)).toContain(ADMIN_RESET_COPY.reconciling);
    expect(c.textContent).not.toContain(ADMIN_RESET_COPY.completed);
  });

  it('never renders the person or reset identifiers from the response', async () => {
    const { c } = await commit(json(200, resetBody('completed')));
    expect(c.textContent).not.toContain(PERSON);
    expect(c.textContent).not.toContain(RESET_ID);
  });

  it('[P2-S09-AC-1113] shows a stable pending label and ignores duplicate activation', async () => {
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
  it('[P2-S09-AC-1116] navigates to /step-up with the current path and persists no entries', async () => {
    const { h } = await commit(
      apiError(401, 'STEP_UP_REQUIRED', { allowedMethods: ['totp'] }),
    );
    expect(h.navigate).toHaveBeenCalledWith(
      `/step-up?returnTo=${encodeURIComponent('/app/platform-configuration-admin/mfa-reset')}`,
    );
    expect(h.storage.dump()).not.toContain(PERSON);
    expect(h.storage.dump()).not.toContain(REASON);
  });

  it('[P2-S09-AC-1116] opens empty with the not-saved note after returning from step-up, once', async () => {
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

describe('AdminMfaFactorResetForm session recovery', () => {
  it('[P2-S09-AC-1117] offers the safe sign-in redirect on 401 UNAUTHENTICATED without a step-up detour', async () => {
    const { c, h } = await commit(apiError(401, 'UNAUTHENTICATED'));
    expect(alertText(c)).toContain(ADMIN_RESET_COPY.sessionEnded);
    const link = c.querySelector<HTMLAnchorElement>(
      'a[href^="/auth/sign-in?returnTo="]',
    );
    expect(link?.getAttribute('href')).toBe(
      `/auth/sign-in?returnTo=${encodeURIComponent('/app/platform-configuration-admin/mfa-reset')}`,
    );
    expect(h.navigate).not.toHaveBeenCalledWith(
      expect.stringContaining('/step-up'),
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

  // The Worker's own refusal of a schema-invalid CFG-05B-06 request, as the
  // real route emits it (BE00 FieldViolation: a JSON Pointer `path`, a `code`
  // and a `message`; never a `field` member). Captured from the production
  // Worker route in the real-route Chrome run of the same criterion.
  it('[P2-S09-AC-1122] a schema-invalid refusal in the Worker shape marks the offending field and links the summary, and never shows the self-target copy', async () => {
    const { c } = await commit(
      apiError(400, 'INVALID_REQUEST', {
        violations: [
          {
            path: '/targetPersonId',
            code: 'invalid_value',
            message: 'The value is invalid.',
          },
          { path: '/reason', code: 'too_small', message: 'Too short.' },
        ],
      }),
    );
    // With field errors the linked summary replaces the generic notice.
    expect(c.textContent).not.toContain(ADMIN_RESET_COPY.selfTarget);
    expect(personInput(c).getAttribute('aria-invalid')).toBe('true');
    expect(reasonInput(c).getAttribute('aria-invalid')).toBe('true');
    expect(c.textContent).toContain(ADMIN_RESET_COPY.personInvalid);
    expect(c.textContent).toContain(ADMIN_RESET_COPY.reasonInvalid);
  });

  it('[P2-S09-AC-1122] a self-target refusal carries no field errors and shows only the self-target copy', async () => {
    const { c } = await commit(apiError(422, 'MFA_RESET_INVALID', {}));
    expect(alertText(c)).toContain(ADMIN_RESET_COPY.selfTarget);
    expect(personInput(c).getAttribute('aria-invalid')).not.toBe('true');
    expect(c.textContent).not.toContain(ADMIN_RESET_COPY.personInvalid);
  });

  it('[P2-S09-AC-1118] [P2-S09-AC-1119] [P2-S09-AC-1120] [P2-S09-AC-1121] [P2-S09-AC-1122] keeps the entries after a refusal so the operator can correct them', async () => {
    const { c } = await commit(apiError(404, 'TARGET_NOT_FOUND'));
    expect(personInput(c).value).toBe(PERSON);
  });

  it('[P2-S09-AC-1123] counts down a 429 Retry-After and disables submission', async () => {
    const { c } = await commit(
      apiError(429, 'RATE_LIMITED', {}, { 'retry-after': '90' }),
    );
    expect(c.textContent).toContain('1:30');
    const submitButton = Array.from(c.querySelectorAll('button')).find(
      (b) => b.type === 'submit',
    );
    expect(submitButton?.disabled).toBe(true);
  });

  it('[P2-S09-AC-1124] shows degraded with the request ID for 503', async () => {
    const { c } = await commit(apiError(503, 'IDENTITY_UNAVAILABLE'));
    expect(alertText(c)).toContain(ADMIN_RESET_COPY.degraded);
    expect(c.textContent).toContain('0195b6f0-0000-7000-8000-000000000001');
  });

  it('[P2-S09-AC-1124] never guesses an outcome after a network failure and retries with the same key', async () => {
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
