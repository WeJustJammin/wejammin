// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import signInPage from '../../../pages/auth/sign-in.astro?raw';

afterEach(() => {
  window.sessionStorage.clear();
  vi.resetModules();
});

/**
 * Review r14 finding 2: logout (and an expired session) always funnels through
 * the sign-in page, so reaching it drops every pending step-up draft and
 * envelope this tab holds. The next person to sign in starts clean even if the
 * same account signs back in.
 */
describe('sign-in clears pending step-up state', () => {
  it('[P2-S09-AC-911] removes every step-up draft and envelope and keeps unrelated tab state', async () => {
    window.sessionStorage.setItem('wj-step-up-draft:/app/x', '{}');
    window.sessionStorage.setItem('wj:cms-grants:step-up-return', '{}');
    window.sessionStorage.setItem('wj-admin-mfa-reset-interrupted', '{}');
    window.sessionStorage.setItem('unrelated-tab-state', 'keep-me');

    await import('./clear-step-up-state-on-sign-in');

    expect(Object.entries(window.sessionStorage)).toEqual([
      ['unrelated-tab-state', 'keep-me'],
    ]);
  });

  it('[P2-S09-AC-911] the sign-in page loads the clearing script', () => {
    expect(signInPage).toContain('clear-step-up-state-on-sign-in');
  });
});
