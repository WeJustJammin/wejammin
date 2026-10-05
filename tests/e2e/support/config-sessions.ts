import type { Browser, Page } from '@playwright/test';

/**
 * The e2e mock Worker answers CFG-05B-07 per session, exactly as the real
 * Worker does: capability is a property of the verified session, never of
 * the configuration key being opened. This cookie stands for a session whose
 * projection holds `settings.read` only.
 */
export const readOnlyCookie = {
  name: 'wj_access',
  value: 'slice-07-e2e-read-only-session',
  domain: '127.0.0.1',
  path: '/',
  httpOnly: true,
  secure: false,
  sameSite: 'Lax' as const,
};

/** A page in its own browser context, signed in as the read-only session. */
export const openReadOnlyPage = async (browser: Browser): Promise<Page> => {
  const context = await browser.newContext();
  await context.addCookies([readOnlyCookie]);
  return context.newPage();
};
