// @vitest-environment jsdom

import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  FACTOR_A,
  FRESH_UNTIL,
  apiError,
  challenge,
  factor,
  factorsResource,
  flush,
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

let harness: FormHarness | null = null;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
  vi.setSystemTime(new Date('2026-10-02T12:00:00Z'));
});
afterEach(() => {
  harness?.mounted.unmount();
  harness = null;
  vi.useRealTimers();
});

const politeText = (container: HTMLElement): string =>
  Array.from(container.querySelectorAll('[role="status"][aria-live="polite"]'))
    .map((node) => node.textContent ?? '')
    .join('|');

const advance = (milliseconds: number): void => {
  act(() => {
    vi.advanceTimersByTime(milliseconds);
  });
};

const lock = async (retryAfter: number) => {
  const fetchImpl = stubFetch(
    json(201, challenge()),
    apiError(
      429,
      'RATE_LIMITED',
      { retryAfterSeconds: retryAfter },
      { 'retry-after': String(retryAfter) },
    ),
  );
  harness = mountForm(fetchImpl);
  await flush();
  const container = harness.mounted.container;
  setValue(codeInput(container), '123456');
  submitForm(container);
  await flush();
  return { container, fetchImpl };
};

/** FE01 lockout: countdown updates visually each second, announced politely at most once a minute. */
describe('StepUpChallengeForm lockout', () => {
  it('[P2-S09-AC-1096] [P2-S09-AC-1103] disables submit with a visible reason and announces the wait once at the start', async () => {
    const { container } = await lock(150);
    const submit = container.querySelector<HTMLButtonElement>(
      'button[type="submit"]',
    );
    expect(submit?.disabled).toBe(true);
    expect(container.textContent).toContain('Too many attempts');
    expect(politeText(container)).toContain('Try again in 3 minutes.');
  });

  it('[P2-S09-AC-1103] updates the visible countdown each second without re-announcing', async () => {
    const { container } = await lock(150);
    const visible = (): string =>
      container.querySelector('[data-lockout-countdown]')?.textContent ?? '';
    expect(visible()).toBe('2:30');
    const announced = politeText(container);
    advance(1000);
    expect(visible()).toBe('2:29');
    advance(10_000);
    expect(visible()).toBe('2:19');
    expect(politeText(container)).toBe(announced);
    expect(
      container
        .querySelector('[data-lockout-countdown]')
        ?.closest('[aria-live]'),
    ).toBeNull();
  });

  it('[P2-S09-AC-1103] announces again at each whole minute and at unlock, then re-enables submit', async () => {
    const { container } = await lock(150);
    advance(30_000);
    expect(politeText(container)).toContain('Try again in 2 minutes.');
    advance(60_000);
    expect(politeText(container)).toContain('Try again in 1 minute.');
    advance(60_000);
    expect(politeText(container)).toContain('You can try again.');
    const submit = container.querySelector<HTMLButtonElement>(
      'button[type="submit"]',
    );
    expect(submit?.disabled).toBe(false);
  });
});

describe('StepUpChallengeForm multi-tab and fresh proof', () => {
  it('[P2-S09-AC-1064] [P2-S09-AC-1068] refetches AUTH-API-16 on another tab success and offers Continue without auto-redirect', async () => {
    const resource = factorsResource([factor(FACTOR_A)], '4', true);
    const fetchImpl = stubFetch(
      json(201, challenge()),
      json(200, resource, { etag: '"4"' }),
    );
    harness = mountForm(fetchImpl);
    await flush();
    act(() => harness?.channel.emit());
    await flush();
    const container = harness.mounted.container;
    expect(fetchImpl.calls[1]?.url).toBe('/api/v1/account/mfa/factors');
    expect(container.textContent).toContain('already verified');
    expect(
      container.querySelector(`time[datetime="${FRESH_UNTIL}"]`),
    ).not.toBeNull();
    expect(
      container.querySelector(
        'a[href="/app/cms-content-modeling?tab=versions"]',
      ),
    ).not.toBeNull();
    expect(harness.navigate).not.toHaveBeenCalled();
  });

  it('[P2-S09-AC-1068] does not copy proof when the refetch shows no fresh step-up', async () => {
    const resource = factorsResource([factor(FACTOR_A)], '4', false);
    const fetchImpl = stubFetch(json(201, challenge()), json(200, resource));
    harness = mountForm(fetchImpl);
    await flush();
    act(() => harness?.channel.emit());
    await flush();
    expect(harness.mounted.container.textContent).not.toContain(
      'already verified',
    );
  });
});
