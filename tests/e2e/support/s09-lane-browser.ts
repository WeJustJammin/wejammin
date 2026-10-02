import type { BrowserContext } from '@playwright/test';

import { laneCookieSet } from './s09-lane-cookies';
import type { Browser } from '@playwright/test';
import { laneSessionId, laneUserId, type LaneRole } from './s09-lane-ids';

export { newTestId, type LaneRole } from './s09-lane-ids';
export { totpCode } from './s09-lane-totp';

export type LaneAuthOptions = Readonly<{
  /** Random part of the CSRF double-submit token the forms read from `wj_csrf`. */
  csrfRandom?: string;
  /** Session generation: 0 before any step-up, +1 per completed proof. */
  generation?: number;
  /** Access-token expiry in epoch seconds (default: one hour from now). */
  expiresAt?: number;
}>;

/**
 * Sign a browser context in as one lane role of one test world. The cookies
 * are accepted only by the loopback harness; they are not credentials.
 */
export const authenticateLane = async (
  context: BrowserContext,
  role: LaneRole,
  testId: string,
  options: LaneAuthOptions = {},
): Promise<void> => {
  const sessionId = laneSessionId(role, testId, options.generation ?? 0);
  const userId = laneUserId(role);
  const base = { domain: '127.0.0.1', path: '/', secure: false, sameSite: 'Lax' as const };
  const cookies = await laneCookieSet({
    userId,
    sessionId,
    csrfRandom: options.csrfRandom ?? `lane${testId}${role}`,
    ...(options.expiresAt === undefined ? {} : { expiresAt: options.expiresAt }),
  });
  await context.addCookies([
    { ...base, name: 'wj_access', value: cookies.access, httpOnly: true },
    { ...base, name: 'wj_session_ref', value: cookies.sessionRef, httpOnly: true },
    { ...base, name: 'wj_csrf', value: cookies.csrf, httpOnly: false },
  ]);
};

const WEB_PORT = process.env.S09_WEB_PORT ?? '4324';
export const LANE_BASE_URL = `http://127.0.0.1:${WEB_PORT}`;

/** A fresh browser context for one lane role (its own cookie jar). */
export const newLaneContext = async (
  browser: Browser,
  role: LaneRole,
  testId: string,
  options: LaneAuthOptions = {},
): Promise<BrowserContext> => {
  const context = await browser.newContext({ baseURL: LANE_BASE_URL });
  await authenticateLane(context, role, testId, options);
  return context;
};
