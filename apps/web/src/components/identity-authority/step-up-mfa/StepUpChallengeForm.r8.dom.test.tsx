// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';

import {
  FACTOR_A,
  FACTOR_B,
  apiError,
  byText,
  challenge,
  flush,
  click,
  json,
  setValue,
  stubFetch,
} from './step-up-mfa.test-support';
import {
  codeInput,
  mountForm,
  submitForm,
  type FormHarness,
} from './step-up-form-support.test-support';

/**
 * R8 proofs for the step-up form clauses the fresh audit found only partly
 * asserted: the factor chooser is a labelled radio group (1059), the challenge
 * request is a POST (1060), and the code field is one input that allows paste
 * with no segmented boxes (1085).
 */

let harness: FormHarness | null = null;
afterEach(() => {
  harness?.mounted.unmount();
  harness = null;
});

describe('[P2-S09-AC-1059] choosing-factor radio group', () => {
  const choose = async () => {
    harness = mountForm(stubFetch(json(201, challenge(FACTOR_B))), {
      initialPhase: 'choosing-factor',
      factors: [
        { id: FACTOR_A, friendlyName: 'Phone a' },
        { id: FACTOR_B, friendlyName: 'Laptop' },
      ],
    });
    await flush();
    return harness.mounted.container;
  };

  it('[P2-S09-AC-1059] names the radio group through its legend', async () => {
    const container = await choose();
    const group = container.querySelector('[role="radiogroup"]');
    expect(group).not.toBeNull();
    const labelledBy = group?.getAttribute('aria-labelledby') ?? '';
    expect(container.querySelector(`#${labelledBy}`)?.textContent).toBe(
      'Choose an authenticator',
    );
  });

  it('[P2-S09-AC-1059] labels each radio with the authenticator friendly name', async () => {
    const container = await choose();
    const labels = [
      ...container.querySelectorAll<HTMLInputElement>('input[type="radio"]'),
    ].map(
      (radio) =>
        container.querySelector(`label[for="${radio.id}"]`)?.textContent ??
        radio.closest('label')?.textContent ??
        '',
    );
    expect(labels.map((text) => text.trim())).toEqual(['Phone a', 'Laptop']);
  });
});

describe('[P2-S09-AC-1060] creating-challenge request', () => {
  it('[P2-S09-AC-1060] sends the challenge creation as a POST', async () => {
    const fetchImpl = stubFetch(json(201, challenge()));
    harness = mountForm(fetchImpl);
    await flush();
    expect(fetchImpl.calls[0]?.method).toBe('POST');
  });
});

describe('[P2-S09-AC-1085] one-time code field', () => {
  const mount = async () => {
    harness = mountForm(stubFetch(json(201, challenge())));
    await flush();
    return harness.mounted.container;
  };

  it('[P2-S09-AC-1085] renders exactly one code input and no segmented boxes', async () => {
    const container = await mount();
    expect(container.querySelectorAll('input[name="code"]')).toHaveLength(1);
    expect(
      container.querySelectorAll(
        'input[type="text"], input[type="tel"], input[type="number"], input:not([type])',
      ),
    ).toHaveLength(1);
  });

  it('[P2-S09-AC-1085] lets a paste reach the field (no paste handler cancels it)', async () => {
    const container = await mount();
    const input = codeInput(container);
    const paste = new Event('paste', { bubbles: true, cancelable: true });
    input.dispatchEvent(paste);
    expect(paste.defaultPrevented).toBe(false);
    expect(input.hasAttribute('onpaste')).toBe(false);
  });
});

describe('[P2-S09-AC-1095] 403 CSRF or origin on the step-up form', () => {
  // The Worker emits `origin_csrf_required` for a refused origin or CSRF check
  // (mfa-error-boundary.ts); the form must not depend on any other token.
  it.each(['origin_csrf_required', 'csrf_invalid'])(
    '[P2-S09-AC-1095] shows the reload copy and a working Reload button for reasonCode %s',
    async (reasonCode) => {
      harness = mountForm(
        stubFetch(
          json(201, challenge()),
          apiError(403, 'FORBIDDEN', { reasonCode }),
        ),
      );
      await flush();
      const container = harness.mounted.container;
      setValue(codeInput(container), '123456');
      submitForm(container);
      await flush();
      expect(container.textContent).toContain(
        'Your session changed. Reload to continue.',
      );
      const reload = byText(container, 'button', 'Reload');
      expect(reload).toBeDefined();
      if (reload !== undefined) click(reload);
      expect(harness.reload).toHaveBeenCalledOnce();
    },
  );

  it('[P2-S09-AC-1095] does not offer Reload for an ineligible account', async () => {
    harness = mountForm(
      stubFetch(
        json(201, challenge()),
        apiError(403, 'FORBIDDEN', { reasonCode: 'account_not_eligible' }),
      ),
    );
    await flush();
    const container = harness.mounted.container;
    setValue(codeInput(container), '123456');
    submitForm(container);
    await flush();
    expect(byText(container, 'button', 'Reload')).toBeUndefined();
  });
});
