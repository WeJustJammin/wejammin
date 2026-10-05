// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';

import {
  FACTOR_A,
  FACTOR_B,
  apiError,
  click,
  factor,
  factorsResource,
  flush,
  json,
  stubFetch,
} from './step-up-mfa.test-support';
import {
  mountWizard,
  pressButton,
  type WizardHarness,
} from './mfa-wizard-support.test-support';

let harness: WizardHarness | null = null;
afterEach(() => {
  harness?.mounted.unmount();
  harness = null;
});

const two = [factor(FACTOR_A), factor(FACTOR_B, 'verified', 'Laptop')];
const KEY = /^mfa-[0-9a-f-]{36}$/u;

const removalFieldset = (container: HTMLElement): HTMLFieldSetElement => {
  const fieldset = container.querySelector<HTMLFieldSetElement>(
    '[data-mfa-removal] fieldset',
  );
  if (fieldset === null) throw new Error('missing removal reason group');
  return fieldset;
};

describe('MfaEnrollmentWizard removal reason group', () => {
  it('[P2-S09-AC-1081] is a required, labelled radio group with user_request checked and factor_compromise described by the sessions note', () => {
    harness = mountWizard(stubFetch(), { factors: two });
    const container = harness.mounted.container;
    pressButton(container, 'Remove Phone a');
    const fieldset = removalFieldset(container);
    expect(fieldset.querySelector('legend')?.textContent).toBe(
      'Why are you removing it?',
    );
    const radios = [
      ...fieldset.querySelectorAll<HTMLInputElement>('input[type="radio"]'),
    ];
    expect(radios.map((radio) => radio.name)).toStrictEqual([
      'reason',
      'reason',
    ]);
    expect(radios.map((radio) => radio.required)).toStrictEqual([true, true]);
    expect(radios.map((radio) => radio.checked)).toStrictEqual([true, false]);
    const compromise = radios[1];
    const note = container.querySelector(
      `#${compromise?.getAttribute('aria-describedby') ?? 'missing'}`,
    );
    expect(note?.textContent).toBe(
      'Your other signed-in sessions will be signed out.',
    );
  });
});

describe('MfaEnrollmentWizard removal request', () => {
  it('[P2-S09-AC-1081] sends If-Match from the list version, the chosen reason, and a generated Idempotency-Key', async () => {
    const fetchImpl = stubFetch(
      json(
        200,
        factorsResource([factor(FACTOR_B, 'verified', 'Laptop')], '9'),
        {
          etag: '"9"',
        },
      ),
    );
    harness = mountWizard(fetchImpl, { factors: two });
    const container = harness.mounted.container;
    pressButton(container, 'Remove Phone a');
    pressButton(container, 'Remove authenticator');
    await flush();
    const [call] = fetchImpl.calls;
    expect(call?.method).toBe('DELETE');
    expect(call?.body).toStrictEqual({ reason: 'user_request' });
    expect(call?.headers.get('if-match')).toBe('"4"');
    expect(call?.headers.get('idempotency-key')).toMatch(KEY);
  });

  it('[P2-S09-AC-1081] keeps one Idempotency-Key for one confirmation instance across a failed attempt and its retry', async () => {
    const fetchImpl = stubFetch(
      apiError(503, 'DEPENDENCY_UNAVAILABLE'),
      json(
        200,
        factorsResource([factor(FACTOR_B, 'verified', 'Laptop')], '9'),
        {
          etag: '"9"',
        },
      ),
    );
    harness = mountWizard(fetchImpl, { factors: two });
    const container = harness.mounted.container;
    pressButton(container, 'Remove Phone a');
    pressButton(container, 'Remove authenticator');
    await flush();
    // The confirmation stays open after the failure; the same instance retries.
    expect(container.querySelector('[data-mfa-removal]')).not.toBeNull();
    pressButton(container, 'Remove authenticator');
    await flush();
    const keys = fetchImpl.calls.map((call) =>
      call.headers.get('idempotency-key'),
    );
    expect(keys).toHaveLength(2);
    expect(keys[0]).toMatch(KEY);
    expect(keys[1]).toBe(keys[0]);
  });

  it('[P2-S09-AC-1081] uses a new Idempotency-Key for each new confirmation instance (reopened, or another factor)', async () => {
    const failing = (): ReturnType<typeof apiError> =>
      apiError(503, 'DEPENDENCY_UNAVAILABLE');
    const fetchImpl = stubFetch(failing(), failing(), failing());
    harness = mountWizard(fetchImpl, { factors: two });
    const container = harness.mounted.container;
    pressButton(container, 'Remove Phone a');
    pressButton(container, 'Remove authenticator');
    await flush();
    // Cancel and reopen the same factor: a new instance.
    pressButton(container, 'Keep it');
    pressButton(container, 'Remove Phone a');
    pressButton(container, 'Remove authenticator');
    await flush();
    // Cancel and open a different factor: another new instance.
    pressButton(container, 'Keep it');
    pressButton(container, 'Remove Laptop');
    pressButton(container, 'Remove authenticator');
    await flush();
    const keys = fetchImpl.calls.map((call) =>
      call.headers.get('idempotency-key'),
    );
    expect(keys).toHaveLength(3);
    for (const key of keys) expect(key).toMatch(KEY);
    expect(new Set(keys).size).toBe(3);
    expect(fetchImpl.calls[2]?.url).toContain(FACTOR_B);
  });

  it('[P2-S09-AC-1081] a chosen compromise reason travels in the DELETE body', async () => {
    const fetchImpl = stubFetch(
      json(
        200,
        factorsResource([factor(FACTOR_B, 'verified', 'Laptop')], '9'),
        {
          etag: '"9"',
        },
      ),
    );
    harness = mountWizard(fetchImpl, { factors: two });
    const container = harness.mounted.container;
    pressButton(container, 'Remove Phone a');
    const radios = container.querySelectorAll<HTMLInputElement>(
      'input[type="radio"][name="reason"]',
    );
    const compromise = radios[1];
    if (compromise === undefined) throw new Error('missing radio');
    click(compromise);
    pressButton(container, 'Remove authenticator');
    await flush();
    expect(fetchImpl.calls[0]?.body).toStrictEqual({
      reason: 'factor_compromise',
    });
  });
});
