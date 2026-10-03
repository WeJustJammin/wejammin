import { describe, expect, it, vi } from 'vitest';

import type { WorkerBindings } from '../index';
import { verifySameOriginCsrf } from './boundary';
import { createProductionAuthenticationDependencies } from './production';
import {
  base64UrlEncode,
  normalizeAuthProductionOptions,
  sealFlowCookie,
} from './production-support';

const USER = '22222222-2222-4222-8222-222222222222';
const SESSION = '33333333-3333-4333-8333-333333333333';
const NOW = Date.parse('2026-09-01T04:00:00Z');
const env: WorkerBindings = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'slice-02-security-branches',
  SUPABASE_SECRET_KEY: 'sb_secret_test_only',
  SUPABASE_URL: 'https://staging.example.supabase.co',
};
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status });
const encoded = (value: unknown) =>
  base64UrlEncode(new TextEncoder().encode(JSON.stringify(value)));
const jwt = (overrides: Readonly<Record<string, unknown>> = {}) =>
  `${encoded({ alg: 'RS256' })}.${encoded({
    sub: USER,
    session_id: SESSION,
    iss: `${env.SUPABASE_URL}/auth/v1`,
    aud: 'authenticated',
    exp: Math.floor(NOW / 1000) + 3600,
    ...overrides,
  })}.signature`;
const configuration = (fetchImpl: typeof fetch = vi.fn()) =>
  normalizeAuthProductionOptions({
    environment: env,
    fetchImpl,
    now: () => NOW,
    randomBytes: (length) => new Uint8Array(length).fill(4),
  });
const sessionReference = (nonce = USER, state = SESSION, verifier = '') =>
  sealFlowCookie(
    {
      state,
      nonce,
      verifier,
      provider: 'session',
      intent: 'session',
      expiresAt: new Date(NOW + 86_400_000).toISOString(),
    },
    configuration(),
  );

describe('Slice 02 production security defensive branches', () => {
  it('compares CSRF tokens across unequal lengths without accepting prefixes', async () => {
    const reference = 'session-reference';
    const random = 'random';
    const bytes = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(`${reference}\u0000${random}`),
    );
    const token = `${random}.${[...new Uint8Array(bytes)]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')}`;
    for (const header of [token.slice(0, -1), `${token}x`])
      await expect(
        verifySameOriginCsrf(
          new Request('https://api.example.test/mutation', {
            headers: {
              origin: 'https://api.example.test',
              cookie: `wj_session_ref=${reference}; wj_csrf=${token}`,
              'x-csrf-token': header,
            },
          }),
        ),
      ).resolves.toMatchObject({ status: 403 });
  });

  it('consumes a callback after provider exchange failure when persistence remains available', async () => {
    const flow = {
      state: 'exchange-state',
      nonce: 'exchange-nonce',
      verifier: 'exchange-verifier',
      provider: 'google',
      intent: 'sign_in',
      expiresAt: new Date(NOW + 600_000).toISOString(),
    } as const;
    const sealed = await sealFlowCookie(flow, configuration());
    const fetchImpl = vi.fn(async (input: string | URL | Request) =>
      String(input).includes('/auth/v1/token')
        ? json({}, 503)
        : json({ failed: true }),
    );
    const auth = createProductionAuthenticationDependencies({
      environment: env,
      fetchImpl: fetchImpl as typeof fetch,
      now: () => NOW,
    });
    await expect(
      auth.completeCallback(
        { state: flow.state, code: 'code' },
        new Request('https://api.example.test/auth/callback', {
          headers: { cookie: `wj_auth_flow=${sealed}` },
        }),
        env,
        new AbortController().signal,
      ),
    ).resolves.toMatchObject({
      ok: true,
      value: { location: '/auth/sign-in?result=failed' },
    });
  });

  it('fails closed when an account-control callback has no provider subject', async () => {
    const flow = {
      state: 'link-state',
      nonce: 'link-nonce',
      verifier: 'link-verifier',
      provider: 'email',
      intent: 'link',
      expiresAt: new Date(NOW + 600_000).toISOString(),
    } as const;
    const sealed = await sealFlowCookie(flow, configuration());
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/auth/v1/token'))
        return json({ access_token: jwt(), refresh_token: 'refresh' });
      return json({ id: USER });
    });
    const auth = createProductionAuthenticationDependencies({
      environment: env,
      fetchImpl: fetchImpl as typeof fetch,
      now: () => NOW,
    });
    await expect(
      auth.completeCallback(
        { state: flow.state, code: 'code' },
        new Request('https://api.example.test/auth/callback', {
          headers: { cookie: `wj_auth_flow=${sealed}` },
        }),
        env,
        new AbortController().signal,
      ),
    ).resolves.toMatchObject({ ok: false, status: 502 });
  });

  it('rejects access-session substitution and invalid indexed projections', async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) =>
      String(input).endsWith('/auth/v1/user')
        ? json({ id: USER })
        : json({ accountState: 'invalid' }),
    );
    const auth = createProductionAuthenticationDependencies({
      environment: env,
      fetchImpl: fetchImpl as typeof fetch,
      now: () => NOW,
    });
    for (const reference of [
      await sessionReference('44444444-4444-4444-8444-444444444444'),
      await sessionReference(USER, '55555555-5555-4555-8555-555555555555'),
    ])
      await expect(
        auth.resolveSession(
          new Request('https://api.example.test/api/v1/auth/session', {
            headers: {
              cookie: `wj_access=${jwt()}; wj_session_ref=${reference}`,
            },
          }),
          env,
          new AbortController().signal,
        ),
      ).resolves.toMatchObject({ ok: false, status: 401 });
    const validReference = await sessionReference();
    await expect(
      auth.resolveSession(
        new Request('https://api.example.test/api/v1/auth/session', {
          headers: {
            cookie: `wj_access=${jwt()}; wj_session_ref=${validReference}`,
          },
        }),
        env,
        new AbortController().signal,
      ),
    ).resolves.toMatchObject({ ok: false, status: 502 });
  });

  it.each([
    ['', null],
    ['not-a-time', null],
    [new Date(NOW + 60_000).toISOString(), null],
    [
      new Date(NOW - 60_000).toISOString(),
      new Date(NOW - 60_000).toISOString(),
    ],
  ] as const)(
    'bounds the sealed MFA timestamp %s',
    async (verifier, expected) => {
      const reference = await sessionReference(USER, SESSION, verifier);
      const fetchImpl = vi.fn(async (input: string | URL | Request) =>
        String(input).endsWith('/auth/v1/user')
          ? json({ id: USER })
          : json({
              accountState: 'active',
              bootstrapState: 'complete',
              personId: null,
              actingPartyId: null,
            }),
      );
      const auth = createProductionAuthenticationDependencies({
        environment: env,
        fetchImpl: fetchImpl as typeof fetch,
        now: () => NOW,
      });
      await expect(
        auth.resolveSession(
          new Request('https://api.example.test/api/v1/auth/session', {
            headers: {
              cookie: `wj_access=${jwt({
                aal: 'aal2',
                amr: [
                  { method: 'totp', timestamp: Math.floor(NOW / 1000) - 60 },
                ],
              })}; wj_session_ref=${reference}`,
            },
          }),
          env,
          new AbortController().signal,
        ),
      ).resolves.toMatchObject({ ok: true, value: { stepUpAt: expected } });
    },
  );

  it('rejects refreshed token and session-reference substitution', async () => {
    const reference = await sessionReference();
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('grant_type=refresh_token'))
        return json({
          access_token: jwt({
            session_id: '77777777-7777-4777-8777-777777777777',
          }),
          refresh_token: 'rotated',
        });
      return json({ id: USER });
    });
    const auth = createProductionAuthenticationDependencies({
      environment: env,
      fetchImpl: fetchImpl as typeof fetch,
      now: () => NOW,
    });
    await expect(
      auth.refreshSession(
        new Request('https://api.example.test/api/v1/auth/session/refresh', {
          headers: {
            cookie: `wj_refresh=refresh; wj_session_ref=${reference}`,
          },
        }),
        env,
        new AbortController().signal,
      ),
    ).resolves.toMatchObject({ ok: false, status: 401 });
  });
});
