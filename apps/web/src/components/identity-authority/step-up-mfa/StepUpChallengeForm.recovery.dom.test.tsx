// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';

import {
  challenge,
  flush,
  json,
  stubFetch,
} from './step-up-mfa.test-support';
import {
  RETURN_TO,
  mountForm,
  type FormHarness,
} from './step-up-form-support.test-support';
import { stepUpSignInHref } from './step-up-return';

let harness: FormHarness | null = null;
afterEach(() => {
  harness?.mounted.unmount();
  harness = null;
});

const LOST_ACCESS = 'Lost your authenticator? Recover your account';

const lostAccessLink = (container: HTMLElement): HTMLAnchorElement | null =>
  [...container.querySelectorAll<HTMLAnchorElement>('a')].find(
    (anchor) => anchor.textContent === LOST_ACCESS,
  ) ?? null;

describe('[P2-S09-AC-1098] FE01 lost-access link', () => {
  it('[P2-S09-AC-1098] offers the lost-access link once a code is awaited and sends it to the sign-in recovery entry, never a bypass', async () => {
    harness = mountForm(stubFetch(json(201, challenge())));
    await flush();
    const link = lostAccessLink(harness.mounted.container);
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toBe(stepUpSignInHref(RETURN_TO));
    expect(link?.getAttribute('href')).toMatch(/^\/auth\/sign-in\?returnTo=/u);
    // A recovery path is never a way around the proof: no return target,
    // enrollment shortcut or step-up route is reachable from this link.
    expect(link?.getAttribute('href')).not.toContain('settings');
  });

  it('[P2-S09-AC-1098] also offers it when no verified authenticator exists', async () => {
    harness = mountForm(stubFetch(), { initialPhase: 'no-factor' });
    await flush();
    expect(lostAccessLink(harness.mounted.container)).not.toBeNull();
  });

  it('renders the lost-access link exactly once', async () => {
    harness = mountForm(stubFetch(), { initialPhase: 'no-factor' });
    await flush();
    const links = [...harness.mounted.container.querySelectorAll('a')].filter(
      (anchor) => anchor.textContent === LOST_ACCESS,
    );
    expect(links).toHaveLength(1);
  });
});
