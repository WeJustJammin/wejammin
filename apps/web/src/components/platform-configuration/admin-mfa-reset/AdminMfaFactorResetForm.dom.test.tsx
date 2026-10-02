// @vitest-environment jsdom

import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  flush,
  stubFetch,
} from '../../identity-authority/step-up-mfa/step-up-mfa.test-support';
import { ADMIN_RESET_COPY } from './admin-mfa-reset-values';
import {
  PERSON,
  REASON,
  alertText,
  fill,
  mountReset,
  openConfirmation,
  personInput,
  press,
  reasonInput,
  submit,
  type ResetHarness,
} from './admin-mfa-reset.test-support';

let harness: ResetHarness | null = null;
afterEach(() => {
  harness?.mounted.unmount();
  harness = null;
});

const mountWith = (...args: Parameters<typeof mountReset>) => {
  harness = mountReset(...args);
  return harness.mounted.container;
};

describe('AdminMfaFactorResetForm access variants', () => {
  it('renders nothing for forbiddenHidden', () => {
    const c = mountWith(stubFetch(), { variant: 'forbiddenHidden' });
    expect(c.innerHTML).toBe('');
  });

  it('renders the prerequisite message and a step-up link for disabledPrerequisite', () => {
    const c = mountWith(stubFetch(), {
      variant: 'disabledPrerequisite',
      stepUp: { fresh: false, freshUntil: null },
    });
    expect(c.textContent).toContain(ADMIN_RESET_COPY.prerequisite);
    expect(c.querySelector('form')).toBeNull();
    const link = c.querySelector('a');
    expect(link?.getAttribute('href')).toBe(
      `/step-up?returnTo=${encodeURIComponent('/app/platform-configuration-admin/mfa-reset')}`,
    );
  });
});

describe('AdminMfaFactorResetForm fields', () => {
  it('labels both fields natively, with helper copy and no autocomplete', () => {
    const c = mountWith(stubFetch());
    const person = personInput(c);
    expect(person.autocomplete).toBe('off');
    expect(person.getAttribute('spellcheck')).toBe('false');
    expect(c.querySelector(`label[for="${person.id}"]`)?.textContent).toBe(
      'Person ID',
    );
    const describedBy = person.getAttribute('aria-describedby') ?? '';
    expect(c.querySelector(`#${describedBy.split(' ')[0]}`)?.textContent).toBe(
      ADMIN_RESET_COPY.personHelp,
    );
    const reason = reasonInput(c);
    expect(c.querySelector(`label[for="${reason.id}"]`)?.textContent).toBe(
      'Reason',
    );
    expect(
      c.querySelector(
        `#${reason.getAttribute('aria-describedby')?.split(' ').pop()}`,
      )?.textContent,
    ).toBe('0 / 512');
  });

  it('updates the live character count as the operator types', () => {
    const c = mountWith(stubFetch());
    fill(c, PERSON, 'abc');
    expect(c.textContent).toContain('3 / 512');
  });

  it('validates the person ID on blur', () => {
    const c = mountWith(stubFetch());
    fill(c, 'nope', 'reason');
    act(() => {
      personInput(c).dispatchEvent(
        new FocusEvent('focusout', { bubbles: true }),
      );
    });
    expect(c.textContent).toContain(ADMIN_RESET_COPY.personInvalid);
    expect(personInput(c).getAttribute('aria-invalid')).toBe('true');
  });

  it('refuses an invalid submit with a focused summary and no request', async () => {
    const fetchImpl = stubFetch();
    const c = mountWith(fetchImpl);
    fill(c, 'nope', '');
    submit(c);
    await flush();
    expect(fetchImpl.calls).toHaveLength(0);
    expect(alertText(c)).toContain(ADMIN_RESET_COPY.personInvalid);
    expect(alertText(c)).toContain(ADMIN_RESET_COPY.reasonInvalid);
    expect(document.activeElement).toBe(personInput(c));
    expect(c.querySelector('a[href="#admin-mfa-reset-person"]')).not.toBeNull();
  });

  it('points to the sole-administrator runbook by name as plain text', () => {
    const c = mountWith(stubFetch());
    expect(c.textContent).toContain('sole-admin-mfa-lockout');
    expect(c.querySelector('a[href*="sole-admin"]')).toBeNull();
  });
});

describe('AdminMfaFactorResetForm confirmation', () => {
  it('opens a named confirmation with the exact consequence and focuses its heading', async () => {
    const c = mountWith(stubFetch());
    await openConfirmation(c);
    expect(c.textContent).toContain(ADMIN_RESET_COPY.confirmation);
    const heading = c.querySelector('h3[tabindex="-1"]');
    expect(heading?.textContent).toBe('Confirm reset');
    expect(document.activeElement).toBe(heading);
    expect(
      Array.from(c.querySelectorAll('button')).map((b) => b.textContent),
    ).toEqual(expect.arrayContaining(['Reset factors', 'Cancel']));
  });

  it('cancels with Escape and keeps the entered values', async () => {
    const fetchImpl = stubFetch();
    const c = mountWith(fetchImpl);
    await openConfirmation(c);
    act(() => {
      c.querySelector('[data-confirmation]')?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
    });
    expect(c.textContent).not.toContain(ADMIN_RESET_COPY.confirmation);
    expect(personInput(c).value).toBe(PERSON);
    expect(reasonInput(c).value).toBe(REASON);
    expect(fetchImpl.calls).toHaveLength(0);
  });

  it('cancels with the Cancel button', async () => {
    const c = mountWith(stubFetch());
    await openConfirmation(c);
    press(c, 'Cancel');
    expect(c.textContent).not.toContain(ADMIN_RESET_COPY.confirmation);
    expect(personInput(c).value).toBe(PERSON);
  });
});
