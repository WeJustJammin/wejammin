import { describe, expect, it } from 'vitest';

import { CSRF, ORIGIN, REQUEST_ID } from './phase-02-slice-02.test-fixtures';
import { createApp } from './phase-02-slice-02.test-support';

/*
 * A request with no session cookie keeps the public order: its body is read
 * first because the body names the mode. Once the body names a cookie-bound
 * mode (link, prove_merge, re_auth) the same-origin and CSRF gates of BE00
 * step 2 still run, before the session is resolved, so a cookieless request
 * cannot reach a session lookup by claiming a credentialed intent.
 */
const LINK_BODY = {
  provider: 'google',
  intent: 'link',
  returnTo: '/settings/security',
};

const start = async (headers: Record<string, string>): Promise<Response> =>
  createApp().app.request(
    new Request(`${ORIGIN}/api/v1/auth/oauth/start`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-request-id': REQUEST_ID,
        ...headers,
      },
      body: JSON.stringify(LINK_BODY),
    }),
  );

const code = async (response: Response): Promise<unknown> =>
  ((await response.json()) as { code?: unknown }).code;

describe('AUTH-API-03 cookieless request that names a cookie-bound mode', () => {
  it('refuses a foreign origin with 403 FORBIDDEN after the body names the mode', async () => {
    const response = await start({ origin: 'https://evil.example.test' });

    expect(response.status).toBe(403);
    expect(await code(response)).toBe('FORBIDDEN');
  });

  it('refuses a missing CSRF token with 403 FORBIDDEN on the same-origin request', async () => {
    const response = await start({ origin: ORIGIN });

    expect(response.status).toBe(403);
    expect(await code(response)).toBe('FORBIDDEN');
  });

  it('refuses a CSRF pair that has no session reference to bind to, however well formed', async () => {
    const response = await start({
      origin: ORIGIN,
      cookie: `wj_csrf=${CSRF}`,
      'x-csrf-token': CSRF,
    });

    expect(response.status).toBe(403);
    expect(await code(response)).toBe('FORBIDDEN');
  });
});
