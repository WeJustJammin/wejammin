import { describe, expect, it, vi } from 'vitest';

import type { WorkerBindings } from '../index';
import {
  AUTH_USER_ID,
  NEW_SESSION_ID,
  NOW,
  PERSON_ID,
  SESSION_ID,
  requestFor,
  sessionFor,
} from './mfa-test-support';
import { createProductionAuthenticationDependencies } from './production';
import { openFlowCookie } from './production-cookie';
import { createSessionRotation } from './production-session-rotation';
import {
  base64UrlEncode,
  normalizeAuthProductionOptions,
  sealFlowCookie,
  verifyTokenResponse,
} from './production-support';

/**
 * DEC-111 step-up proof derivation and session rotation validation, proven
 * through the production token verifier, the production refresh path and the
 * production rotation port. Only the Supabase Auth and PostgREST HTTP
 * endpoints are faked.
 */
const environment: WorkerBindings = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'dec-111-proof',
  SUPABASE_SECRET_KEY: 'sb_secret_test_only',
  SUPABASE_URL: 'https://staging.example.supabase.co',
};
const signal = new AbortController().signal;
const second = (offset: number): number => Math.floor(NOW / 1000) + offset;
const iso = (offset: number): string =>
  new Date(second(offset) * 1000).toISOString();
const encode = (value: unknown): string =>
  base64UrlEncode(new TextEncoder().encode(JSON.stringify(value)));

const jwt = (claims: Readonly<Record<string, unknown>> = {}): string =>
  `${encode({ alg: 'RS256' })}.${encode({
    sub: AUTH_USER_ID,
    session_id: SESSION_ID,
    iss: `${environment.SUPABASE_URL}/auth/v1`,
    aud: 'authenticated',
    exp: second(3600),
    ...claims,
  })}.signature`;

const json = (value: unknown, status = 200): Response =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const projection = {
  accountState: 'active',
  bootstrapState: 'complete',
  personId: PERSON_ID,
  actingPartyId: PERSON_ID,
  actingContextId: null,
};

const config = (fetchImpl: typeof fetch) =>
  normalizeAuthProductionOptions({
    environment,
    fetchImpl,
    now: () => NOW,
    randomBytes: (length: number) => new Uint8Array(length).fill(7),
  });

const userOk = vi.fn(async () => json({ id: AUTH_USER_ID }));
const verify = (claims: Readonly<Record<string, unknown>>) =>
  verifyTokenResponse(
    { access_token: jwt(claims), refresh_token: 'refresh' },
    config(userOk as never),
    signal,
  );

describe('DEC-111 stepUpAt derivation (BE01a Step-Up Proof)', () => {
  it.each(['mfa', 'totp', 'webauthn', 'phone'])(
    '[P2-S09-AC-883] reads the %s method as an MFA proof timestamp',
    async (method) => {
      await expect(
        verify({ amr: [{ method, timestamp: second(-30) }] }),
      ).resolves.toMatchObject({ ok: true, value: { stepUpAt: iso(-30) } });
    },
  );

  it('[P2-S09-AC-883] uses the latest valid MFA timestamp and ignores non-MFA methods', async () => {
    await expect(
      verify({
        amr: [
          { method: 'totp', timestamp: second(-500) },
          { method: 'phone', timestamp: second(-40) },
          { method: 'password', timestamp: second(-1) },
          { method: 'webauthn', timestamp: second(-200) },
        ],
      }),
    ).resolves.toMatchObject({ ok: true, value: { stepUpAt: iso(-40) } });
    await expect(
      verify({ amr: [{ method: 'password', timestamp: second(-1) }] }),
    ).resolves.toMatchObject({ ok: true, value: { stepUpAt: null } });
  });

  it('[P2-S09-AC-883] accepts exactly 30 s ahead and ignores 31 s ahead, zero, negative, fractional, textual and unsafe timestamps', async () => {
    await expect(
      verify({ amr: [{ method: 'totp', timestamp: second(30) }] }),
    ).resolves.toMatchObject({ ok: true, value: { stepUpAt: iso(30) } });
    for (const timestamp of [
      second(31),
      0,
      -5,
      second(-10) + 0.5,
      String(second(-10)),
      2 ** 60,
      null,
    ])
      await expect(
        verify({ amr: [{ method: 'totp', timestamp }] }),
      ).resolves.toMatchObject({ ok: true, value: { stepUpAt: null } });
  });

  it('[P2-S09-AC-884] never uses the JWT iat: a freshly minted token carrying an old MFA timestamp keeps the old proof', async () => {
    await expect(
      verify({
        iat: second(0),
        amr: [{ method: 'totp', timestamp: second(-1200) }],
      }),
    ).resolves.toMatchObject({ ok: true, value: { stepUpAt: iso(-1200) } });
    await expect(verify({ iat: second(0) })).resolves.toMatchObject({
      ok: true,
      value: { stepUpAt: null },
    });
  });
});

const sealedReference = (stepUpAt: string) =>
  sealFlowCookie(
    {
      state: SESSION_ID,
      nonce: AUTH_USER_ID,
      verifier: stepUpAt,
      provider: 'session',
      intent: 'session',
      expiresAt: new Date(NOW + 3_600_000).toISOString(),
    },
    config(userOk as never),
  );

const refreshWith = async (
  stepUpAt: string,
  refreshedClaims: Readonly<Record<string, unknown>>,
) => {
  const fetchImpl = vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes('grant_type=refresh_token'))
      return json({
        access_token: jwt({ iat: second(0), ...refreshedClaims }),
        refresh_token: 'rotated-refresh',
      });
    if (url.endsWith('/auth/v1/user')) return json({ id: AUTH_USER_ID });
    if (url.endsWith('/auth_session_register')) return json({ ok: true });
    return json(projection);
  });
  const auth = createProductionAuthenticationDependencies({
    environment,
    fetchImpl: fetchImpl as unknown as typeof fetch,
    now: () => NOW,
    randomBytes: (length: number) => new Uint8Array(length).fill(7),
  });
  const reference = await sealedReference(stepUpAt);
  const refreshed = await auth.refreshSession(
    new Request('https://api.example.test/api/v1/auth/session/refresh', {
      headers: {
        cookie: `wj_refresh=old-refresh; wj_session_ref=${reference}`,
      },
    }),
    environment,
    signal,
  );
  if (!refreshed.ok) throw new Error('expected the refresh to succeed');
  const pairs = refreshed.value.cookies.map((line) => line.split(';')[0] ?? '');
  const value = (name: string) =>
    pairs.find((pair) => pair.startsWith(`${name}=`))?.slice(name.length + 1);
  return { auth, pairs, value };
};

describe('DEC-111 proof survives refresh without being extended', () => {
  it('[P2-S09-AC-884] a refresh preserves the original MFA timestamp even when the refreshed token carries a newer one', async () => {
    const original = iso(-400);
    for (const claims of [
      {},
      { amr: [{ method: 'totp', timestamp: second(-1) }] },
    ]) {
      const { value } = await refreshWith(original, claims);
      const reference = value('wj_session_ref');
      expect(reference).toBeDefined();
      const opened = await openFlowCookie(
        reference ?? '',
        config(userOk as never),
      );
      expect(opened?.verifier).toBe(original);
    }
  });

  it('[P2-S09-AC-884] a refresh never invents a proof for a session that had none', async () => {
    const { value } = await refreshWith('', {
      amr: [{ method: 'totp', timestamp: second(-1) }],
    });
    const opened = await openFlowCookie(
      value('wj_session_ref') ?? '',
      config(userOk as never),
    );
    expect(opened?.verifier).toBe('');
  });

  it('[P2-S09-AC-891] primaryAuthAt is the latest valid non-MFA amr time and survives a refresh through the verified access token', async () => {
    const claims = {
      amr: [
        { method: 'oauth', timestamp: second(-3000) },
        { method: 'password', timestamp: second(-2500) },
        { method: 'totp', timestamp: second(-20) },
        { method: 'password', timestamp: second(31) },
      ],
    };
    await expect(verify(claims)).resolves.toMatchObject({
      ok: true,
      value: { primaryAuthAt: iso(-2500) },
    });
    const { auth, value } = await refreshWith(iso(-400), claims);
    const resolved = await auth.resolveSession(
      new Request('https://api.example.test/api/v1/auth/session', {
        headers: {
          cookie: `wj_access=${value('wj_access')}; wj_session_ref=${value('wj_session_ref')}`,
        },
      }),
      environment,
      signal,
    );
    expect(resolved).toMatchObject({
      ok: true,
      value: { primaryAuthAt: iso(-2500), stepUpAt: iso(-400) },
    });
  });
});

const rotate = (
  payload: unknown,
  fetchImpl: typeof fetch = userOk as never,
) => {
  const rpc = vi.fn();
  const wrapped = vi.fn(
    async (input: string | URL | Request, init?: RequestInit) => {
      if (String(input).includes('/rest/v1/rpc/')) rpc();
      return fetchImpl(input, init);
    },
  );
  return {
    rpc,
    result: createSessionRotation(config(wrapped as never)).validate(
      {
        session: sessionFor({ personId: PERSON_ID }),
        request: requestFor(),
        payload,
      },
      signal,
    ),
  };
};

const aal2 = {
  aal: 'aal2',
  amr: [{ method: 'totp', timestamp: second(-5) }],
};

describe('DEC-111 session rotation token validation', () => {
  it.each([
    ['a wrong issuer', { iss: 'https://evil.example/auth/v1' }],
    ['a non-authenticated audience', { aud: 'anon' }],
    ['an expired token', { exp: second(-1) }],
    ['a subject that differs from the provider user', { sub: NEW_SESSION_ID }],
  ])(
    '[P2-S09-AC-879] returns 502 and changes nothing for %s',
    async (_label, claims) => {
      const { result, rpc } = rotate({
        access_token: jwt({ ...aal2, ...claims }),
        refresh_token: 'r',
      });
      expect(await result).toMatchObject({ ok: false, status: 502 });
      expect(rpc).not.toHaveBeenCalled();
    },
  );

  it('[P2-S09-AC-879] returns a non-success and changes nothing when the provider rejects the signature', async () => {
    const { result, rpc } = rotate(
      { access_token: jwt(aal2), refresh_token: 'r' },
      vi.fn(async () => json({ message: 'bad jwt' }, 401)) as never,
    );
    const outcome = await result;
    expect(outcome.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('[P2-S09-AC-879] accepts a verified aal2 token for the initiating user with a fresh MFA timestamp', async () => {
    const { result } = rotate({ access_token: jwt(aal2), refresh_token: 'r' });
    expect(await result).toMatchObject({
      ok: true,
      value: { stepUpAt: iso(-5) },
    });
  });

  it('[P2-S09-AC-881] replaces access, refresh, sealed session reference and session-bound CSRF cookies together, all Secure, token cookies HttpOnly and SameSite=Lax', async () => {
    const { result } = rotate({ access_token: jwt(aal2), refresh_token: 'r' });
    const validated = await result;
    if (!validated.ok) throw new Error('expected validation to pass');
    const byName = new Map(
      validated.value.cookies.map((line) => {
        const [pair = '', ...attrs] = line.split('; ');
        return [pair.split('=')[0] ?? '', attrs] as const;
      }),
    );
    expect(
      [...byName.keys()].filter((name) => name !== 'wj_auth_flow').sort(),
    ).toStrictEqual(['wj_access', 'wj_csrf', 'wj_refresh', 'wj_session_ref']);
    for (const attrs of byName.values()) expect(attrs).toContain('Secure');
    for (const name of ['wj_access', 'wj_refresh', 'wj_session_ref']) {
      expect(byName.get(name)).toContain('HttpOnly');
      expect(byName.get(name)).toContain('SameSite=Lax');
    }
    expect(byName.get('wj_csrf')).not.toContain('HttpOnly');
  });

  it('[P2-S09-AC-882] changes the CSRF token because it is bound to the new session reference', async () => {
    const csrfOf = async (stepUpAt: string) => {
      const validated = await rotate({
        access_token: jwt({
          ...aal2,
          amr: [
            {
              method: 'totp',
              timestamp: Math.floor(Date.parse(stepUpAt) / 1000),
            },
          ],
        }),
        refresh_token: 'r',
      }).result;
      if (!validated.ok) throw new Error('expected validation to pass');
      const line = validated.value.cookies.find((cookie) =>
        cookie.startsWith('wj_csrf='),
      );
      return (line ?? '').split(';')[0];
    };
    const before = await csrfOf(iso(-120));
    const after = await csrfOf(iso(-5));
    expect(before).not.toBe(after);
    expect(before).toMatch(/^wj_csrf=[\w-]+\.[0-9a-f]{64}$/u);
  });
});
