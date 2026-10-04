import { describe, expect, it } from 'vitest';

import {
  STEP_UP_SCOPE_COOKIE,
  STEP_UP_SUBJECT_COOKIE,
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
const SECRET = 'test-only-step-up-scope-secret-0001';
const OTHER_SECRET = 'test-only-step-up-scope-secret-0002';
const NONCE = /^[A-Za-z0-9_-]{32}$/u;

/** The derivation the previous scheme exposed to page scripts: unsalted SHA-256, base64url. */
const unsaltedHash = async (text: string): Promise<string> => {
  const digest = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)),
  );
  return btoa(String.fromCharCode(...digest))
    .replace(/\+/gu, '-')
    .replace(/\//gu, '_')
    .replace(/=+$/u, '');
};

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

const html = (): Response =>
  new Response('<html></html>', {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });

type Issued = Readonly<{ nonce: string; subjectMac: string | null }>;

const issue = async (
  cookie: string | null,
  secret: string | null = SECRET,
): Promise<Issued> => {
  const decision = await decideStepUpScope(requestWith(cookie), secret);
  if (decision.kind !== 'issue')
    throw new Error(`expected issue, got ${decision.kind}`);
  return { nonce: decision.nonce, subjectMac: decision.subjectMac };
};

/** The two cookies a browser holds after one signed-in page load. */
const signIn = async (
  sub: string,
  sessionId = 'session-1',
): Promise<Issued & { jar: string }> => {
  const issued = await issue(accessCookie(sub, sessionId));
  return {
    ...issued,
    jar: `${accessCookie(sub, sessionId)}; ${STEP_UP_SCOPE_COOKIE}=${issued.nonce}; ${STEP_UP_SUBJECT_COOKIE}=${issued.subjectMac ?? ''}`,
  };
};

const setCookies = async (
  request: Request,
  secret: string | null = SECRET,
): Promise<readonly string[]> =>
  (await withStepUpScope(request, html(), secret)).headers.getSetCookie();

/**
 * Review r14 finding 2 and the F5 hardening: the cookie a page script can read
 * holds a RANDOM nonce with no derivation of the subject. The subject binding
 * lives in a separate HttpOnly cookie (an HMAC under a server secret) that only
 * the edge reads, to notice a subject change and rotate the nonce.
 */
describe('step-up scope nonce', () => {
  it('is random: two sign-ins of the same user get different nonces', async () => {
    const first = (await issue(accessCookie(USER_A))).nonce;
    const second = (await issue(accessCookie(USER_A))).nonce;
    expect(first).toMatch(NONCE);
    expect(second).toMatch(NONCE);
    expect(second).not.toBe(first);
  });

  it('is not derived from the subject: no unsalted hash, no HMAC, no substring of it appears in the script-readable value', async () => {
    const nonces = await Promise.all(
      Array.from(
        { length: 24 },
        async () => (await issue(accessCookie(USER_A))).nonce,
      ),
    );
    expect(new Set(nonces).size).toBe(nonces.length);
    const derivations = [
      (await unsaltedHash(`wj-step-up-scope-v1\u0000${USER_A}`)).slice(0, 32),
      (await unsaltedHash(USER_A)).slice(0, 32),
      (await issue(accessCookie(USER_A))).subjectMac ?? '',
    ];
    for (const nonce of nonces) {
      for (const derived of derivations) {
        expect(nonce).not.toBe(derived);
        expect(derived.length).toBeGreaterThan(0);
        expect(nonce.includes(derived.slice(0, 12))).toBe(false);
      }
      expect(nonce).not.toContain(USER_A.slice(0, 8));
    }
  });

  it('keeps the same nonce for the same subject across a step-up session rotation', async () => {
    const before = await signIn(USER_A, 's-1');
    const after = await decideStepUpScope(
      requestWith(
        `${accessCookie(USER_A, 's-2')}; ${STEP_UP_SCOPE_COOKIE}=${before.nonce}; ${STEP_UP_SUBJECT_COOKIE}=${before.subjectMac}`,
      ),
      SECRET,
    );
    expect(after).toEqual({ kind: 'keep' });
  });

  it('rotates the nonce when a different user signs in on the same browser', async () => {
    const previous = await signIn(USER_A);
    const decision = await decideStepUpScope(
      requestWith(
        `${accessCookie(USER_B)}; ${STEP_UP_SCOPE_COOKIE}=${previous.nonce}; ${STEP_UP_SUBJECT_COOKIE}=${previous.subjectMac}`,
      ),
      SECRET,
    );
    if (decision.kind !== 'issue') throw new Error('expected a rotation');
    expect(decision.nonce).toMatch(NONCE);
    expect(decision.nonce).not.toBe(previous.nonce);
    expect(decision.subjectMac).not.toBe(previous.subjectMac);
  });

  it('rotates when the browser holds a nonce but no subject binding (a binding it cannot vouch for)', async () => {
    const decision = await decideStepUpScope(
      requestWith(
        `${accessCookie(USER_A)}; ${STEP_UP_SCOPE_COOKIE}=${'a'.repeat(32)}`,
      ),
      SECRET,
    );
    if (decision.kind !== 'issue') throw new Error('expected a rotation');
    expect(decision.nonce).not.toBe('a'.repeat(32));
  });

  it('rotates when the binding was made under another secret', async () => {
    const held = await signIn(USER_A);
    const decision = await decideStepUpScope(
      requestWith(held.jar),
      OTHER_SECRET,
    );
    if (decision.kind !== 'issue') throw new Error('expected a rotation');
    expect(decision.nonce).not.toBe(held.nonce);
  });

  it('re-issues only the nonce, keeping the binding, when the script-readable cookie is gone', async () => {
    const held = await signIn(USER_A);
    const decision = await decideStepUpScope(
      requestWith(
        `${accessCookie(USER_A)}; ${STEP_UP_SUBJECT_COOKIE}=${held.subjectMac}`,
      ),
      SECRET,
    );
    if (decision.kind !== 'issue') throw new Error('expected an issue');
    expect(decision.subjectMac).toBe(held.subjectMac);
    expect(decision.nonce).toMatch(NONCE);
  });

  it('binds by HMAC under the secret: the binding is neither the old unsalted hash nor the same for another secret', async () => {
    const mine = (await issue(accessCookie(USER_A), SECRET)).subjectMac;
    const theirs = (await issue(accessCookie(USER_A), OTHER_SECRET)).subjectMac;
    expect(mine).not.toBeNull();
    expect(mine).not.toBe(theirs);
    const unsalted = await unsaltedHash(`wj-step-up-scope-v1\u0000${USER_A}`);
    expect(mine).not.toBe(unsalted);
    expect(mine).not.toBe(unsalted.slice(0, 32));
  });

  it('fails closed without a server secret: a fresh nonce on every load and no subject binding, so no draft survives a load', async () => {
    for (const secret of [null, '']) {
      const first = await issue(accessCookie(USER_A), secret);
      const second = await issue(accessCookie(USER_A), secret);
      expect(first.subjectMac).toBeNull();
      expect(first.nonce).not.toBe(second.nonce);
    }
  });

  it('clears the scope when no session cookie is present', async () => {
    expect(await decideStepUpScope(requestWith(null), SECRET)).toEqual({
      kind: 'clear',
    });
    expect(
      await decideStepUpScope(
        requestWith(`${STEP_UP_SCOPE_COOKIE}=abc`),
        SECRET,
      ),
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
    expect(await decideStepUpScope(requestWith(cookie), SECRET)).toEqual({
      kind: 'keep',
    });
  });
});

describe('step-up scope response headers', () => {
  it('sets a script-readable nonce cookie and a separate HttpOnly binding cookie on a signed-in HTML page', async () => {
    const cookies = await setCookies(requestWith(accessCookie(USER_A)));
    expect(cookies).toHaveLength(2);
    const readable = cookies.find((c) =>
      c.startsWith(`${STEP_UP_SCOPE_COOKIE}=`),
    );
    const binding = cookies.find((c) =>
      c.startsWith(`${STEP_UP_SUBJECT_COOKIE}=`),
    );
    expect(readable).toMatch(
      new RegExp(
        `^${STEP_UP_SCOPE_COOKIE}=[A-Za-z0-9_-]{32}; Path=/; SameSite=Lax; Secure$`,
        'u',
      ),
    );
    expect(readable).not.toMatch(/HttpOnly|Max-Age|Expires/iu);
    expect(binding).toMatch(
      new RegExp(
        `^${STEP_UP_SUBJECT_COOKIE}=[A-Za-z0-9_-]+; Path=/; HttpOnly; SameSite=Lax; Secure$`,
        'u',
      ),
    );
  });

  it('omits Secure on a plain-http loopback request so Chrome keeps both cookies in local runs', async () => {
    const cookies = await setCookies(
      requestWith(accessCookie(USER_A), { url: 'http://127.0.0.1:4324/app' }),
    );
    expect(cookies).toHaveLength(2);
    for (const cookie of cookies) expect(cookie).not.toContain('Secure');
  });

  it('never puts the subject, its hash or the binding in the script-readable cookie', async () => {
    const cookies = await setCookies(requestWith(accessCookie(USER_A)));
    const readable =
      cookies.find((c) => c.startsWith(`${STEP_UP_SCOPE_COOKIE}=`)) ?? '';
    const binding =
      (cookies.find((c) => c.startsWith(`${STEP_UP_SUBJECT_COOKIE}=`)) ?? '')
        .split(';')[0]
        ?.split('=')[1] ?? '';
    expect(binding.length).toBeGreaterThan(0);
    expect(readable).not.toContain(binding.slice(0, 12));
    expect(readable).not.toContain(USER_A.slice(0, 8));
  });

  it('does not repeat either cookie when the browser already holds the current pair', async () => {
    const held = await signIn(USER_A);
    expect(await setCookies(requestWith(held.jar))).toEqual([]);
  });

  it('replaces both cookies when a different user signs in over the previous user', async () => {
    const previous = await signIn(USER_B);
    const cookies = await setCookies(
      requestWith(
        `${accessCookie(USER_A)}; ${STEP_UP_SCOPE_COOKIE}=${previous.nonce}; ${STEP_UP_SUBJECT_COOKIE}=${previous.subjectMac}`,
      ),
    );
    expect(cookies).toHaveLength(2);
    expect(cookies.join('\n')).not.toContain(
      `${STEP_UP_SCOPE_COOKIE}=${previous.nonce}`,
    );
  });

  it('expires BOTH cookies on a signed-out page that still receives either', async () => {
    for (const jar of [
      `${STEP_UP_SCOPE_COOKIE}=abcdefghijklmnopabcdefghijklmnop`,
      `${STEP_UP_SUBJECT_COOKIE}=abcdefghijklmnopabcdefghijklmnop`,
      `${STEP_UP_SCOPE_COOKIE}=abcdefghijklmnopabcdefghijklmnop; ${STEP_UP_SUBJECT_COOKIE}=xyz`,
    ]) {
      const cookies = await setCookies(requestWith(jar));
      expect(cookies).toHaveLength(2);
      expect(
        cookies.some((c) =>
          new RegExp(`^${STEP_UP_SCOPE_COOKIE}=; Path=/; Max-Age=0`, 'u').test(
            c,
          ),
        ),
      ).toBe(true);
      expect(
        cookies.some((c) =>
          new RegExp(
            `^${STEP_UP_SUBJECT_COOKIE}=; Path=/; Max-Age=0; HttpOnly`,
            'u',
          ).test(c),
        ),
      ).toBe(true);
    }
  });

  it('leaves non-document responses, mutations and signed-out pages without a scope untouched', async () => {
    const json = new Response('{}', {
      headers: { 'content-type': 'application/json' },
    });
    expect(
      (
        await withStepUpScope(requestWith(accessCookie(USER_A)), json, SECRET)
      ).headers.get('set-cookie'),
    ).toBeNull();
    expect(
      (
        await withStepUpScope(
          requestWith(accessCookie(USER_A), { method: 'POST' }),
          html(),
          SECRET,
        )
      ).headers.get('set-cookie'),
    ).toBeNull();
    expect(
      (await withStepUpScope(requestWith(null), html(), SECRET)).headers.get(
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
      SECRET,
    );
    expect(response.status).toBe(202);
    expect(await response.text()).toBe('body');
    expect(response.headers.get('x-keep')).toBe('1');
    expect(response.headers.getSetCookie()).toHaveLength(3);
  });
});
