import { describe, expect, it } from 'vitest';

import {
  STEP_UP_SCOPE_COOKIE,
  decideStepUpScope,
  withStepUpScope,
} from './step-up-scope';

const b64url = (value: unknown): string =>
  btoa(JSON.stringify(value))
    .replace(/\+/gu, '-')
    .replace(/\//gu, '_')
    .replace(/=+$/u, '');

const jwt = (claims: Record<string, unknown>): string =>
  `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(claims)}.signature`;

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';

const requestWith = (
  cookie: string | null,
  init: { method?: string; url?: string } = {},
): Request =>
  new Request(init.url ?? 'https://web.example.test/app', {
    method: init.method ?? 'GET',
    headers: cookie === null ? {} : { cookie },
  });

const accessCookie = (sub: string, sessionId = 'session-1'): string =>
  `wj_access=${jwt({ sub, session_id: sessionId })}; wj_session_ref=ref`;

const valueOf = async (request: Request): Promise<string> => {
  const decision = await decideStepUpScope(request);
  if (decision.kind !== 'set')
    throw new Error(`expected set, got ${decision.kind}`);
  return decision.value;
};

/**
 * Review r14 finding 2: the web edge derives an opaque, non-reversible scope
 * from the signed-in subject so tab-held step-up drafts can be bound to it.
 */
describe('step-up scope derivation', () => {
  it('derives the same opaque scope for the same subject across a step-up session rotation', async () => {
    const before = await valueOf(requestWith(accessCookie(USER_A, 's-1')));
    const after = await valueOf(requestWith(accessCookie(USER_A, 's-2')));
    expect(after).toBe(before);
  });

  it('derives a different scope for a different subject', async () => {
    expect(await valueOf(requestWith(accessCookie(USER_A)))).not.toBe(
      await valueOf(requestWith(accessCookie(USER_B))),
    );
  });

  it('never carries the subject, the session id or any recoverable part of them', async () => {
    const value = await valueOf(requestWith(accessCookie(USER_A, 'session-1')));
    expect(value).toMatch(/^[A-Za-z0-9_-]{32}$/u);
    expect(value).not.toContain(USER_A.slice(0, 8));
    expect(value).not.toContain('session');
  });

  it('clears the scope when no session cookie is present', async () => {
    expect(await decideStepUpScope(requestWith(null))).toEqual({
      kind: 'clear',
    });
    expect(
      await decideStepUpScope(requestWith(`${STEP_UP_SCOPE_COOKIE}=abc`)),
    ).toEqual({ kind: 'clear' });
  });

  it.each([
    ['a refresh-only cookie', 'wj_refresh=token'],
    ['an unreadable access token', 'wj_access=not-a-jwt; wj_session_ref=ref'],
    [
      'an access token with no subject',
      `wj_access=${jwt({ session_id: 's' })}; wj_session_ref=ref`,
    ],
  ])('leaves the scope unchanged for %s', async (_name, cookie) => {
    expect(await decideStepUpScope(requestWith(cookie))).toEqual({
      kind: 'keep',
    });
  });
});

describe('step-up scope response header', () => {
  const html = (): Response =>
    new Response('<html></html>', {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });

  it('sets a script-readable, same-site, session-lifetime cookie on a signed-in HTML page', async () => {
    const response = await withStepUpScope(
      requestWith(accessCookie(USER_A)),
      html(),
    );
    const setCookie = response.headers.get('set-cookie') ?? '';
    expect(setCookie).toMatch(
      new RegExp(
        `^${STEP_UP_SCOPE_COOKIE}=[A-Za-z0-9_-]{32}; Path=/; SameSite=Lax; Secure$`,
        'u',
      ),
    );
    expect(setCookie).not.toMatch(/HttpOnly|Max-Age|Expires/iu);
  });

  it('omits Secure on a plain-http loopback request so Chrome keeps it in local runs', async () => {
    const response = await withStepUpScope(
      requestWith(accessCookie(USER_A), { url: 'http://127.0.0.1:4324/app' }),
      html(),
    );
    expect(response.headers.get('set-cookie')).not.toContain('Secure');
  });

  it('does not repeat the cookie when the browser already holds the current scope', async () => {
    const value = await valueOf(requestWith(accessCookie(USER_A)));
    const response = await withStepUpScope(
      requestWith(`${accessCookie(USER_A)}; ${STEP_UP_SCOPE_COOKIE}=${value}`),
      html(),
    );
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('replaces a stale scope left by the previous user', async () => {
    const stale = await valueOf(requestWith(accessCookie(USER_B)));
    const response = await withStepUpScope(
      requestWith(`${accessCookie(USER_A)}; ${STEP_UP_SCOPE_COOKIE}=${stale}`),
      html(),
    );
    expect(response.headers.get('set-cookie')).toContain(
      `${STEP_UP_SCOPE_COOKIE}=${await valueOf(requestWith(accessCookie(USER_A)))}`,
    );
  });

  it('expires the scope on a signed-out page that still receives it', async () => {
    const response = await withStepUpScope(
      requestWith(`${STEP_UP_SCOPE_COOKIE}=abcdefghijklmnopabcdefghijklmnop`),
      html(),
    );
    expect(response.headers.get('set-cookie')).toMatch(
      new RegExp(`^${STEP_UP_SCOPE_COOKIE}=; Path=/; Max-Age=0`, 'u'),
    );
  });

  it('leaves non-document responses, mutations and signed-out pages without a scope untouched', async () => {
    const json = new Response('{}', {
      headers: { 'content-type': 'application/json' },
    });
    expect(
      (
        await withStepUpScope(requestWith(accessCookie(USER_A)), json)
      ).headers.get('set-cookie'),
    ).toBeNull();
    expect(
      (
        await withStepUpScope(
          requestWith(accessCookie(USER_A), { method: 'POST' }),
          html(),
        )
      ).headers.get('set-cookie'),
    ).toBeNull();
    expect(
      (await withStepUpScope(requestWith(null), html())).headers.get(
        'set-cookie',
      ),
    ).toBeNull();
  });

  it('keeps the response status, body and other headers', async () => {
    const response = await withStepUpScope(
      requestWith(accessCookie(USER_A)),
      new Response('body', {
        status: 202,
        headers: {
          'content-type': 'text/html',
          'x-keep': '1',
          'set-cookie': 'a=1',
        },
      }),
    );
    expect(response.status).toBe(202);
    expect(await response.text()).toBe('body');
    expect(response.headers.get('x-keep')).toBe('1');
    expect(response.headers.getSetCookie()).toHaveLength(2);
  });
});
