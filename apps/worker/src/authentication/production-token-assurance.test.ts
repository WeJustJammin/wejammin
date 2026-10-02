import { describe, expect, it, vi } from 'vitest';

import type { WorkerBindings } from '../index';
import { createProductionAuthenticationDependencies } from './production';
import {
  base64UrlEncode,
  normalizeAuthProductionOptions,
  sealFlowCookie,
  verifyTokenResponse,
} from './production-support';
import { AUTH_USER_ID, NOW, REQUEST_ID, SESSION_ID } from './mfa-test-support';

const environment: WorkerBindings = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'dec-111-test',
  SUPABASE_SECRET_KEY: 'sb_secret_test_only',
  SUPABASE_URL: 'https://staging.example.supabase.co',
};

const json = (value: unknown, status = 200): Response =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const encode = (value: unknown): string =>
  base64UrlEncode(new TextEncoder().encode(JSON.stringify(value)));

const jwt = (claims: Readonly<Record<string, unknown>> = {}): string =>
  `${encode({ alg: 'RS256' })}.${encode({
    sub: AUTH_USER_ID,
    session_id: SESSION_ID,
    iss: `${environment.SUPABASE_URL}/auth/v1`,
    aud: 'authenticated',
    exp: Math.floor(NOW / 1000) + 3600,
    ...claims,
  })}.signature`;

const options = (fetchImpl: typeof fetch) => ({
  environment,
  fetchImpl,
  now: () => NOW,
  randomBytes: (length: number) => new Uint8Array(length).fill(9),
});

const second = (offset: number): number => Math.floor(NOW / 1000) + offset;

const verify = async (claims: Readonly<Record<string, unknown>>) =>
  verifyTokenResponse(
    { access_token: jwt(claims), refresh_token: 'refresh' },
    normalizeAuthProductionOptions(
      options(vi.fn(async () => json({ id: AUTH_USER_ID })) as never),
    ),
    new AbortController().signal,
  );

describe('DEC-111 token assurance claims', () => {
  it('derives primaryAuthAt from the latest valid non-MFA amr entry only', async () => {
    await expect(verify({})).resolves.toMatchObject({
      ok: true,
      value: { primaryAuthAt: null },
    });
    await expect(
      verify({
        amr: [
          { method: 'totp', timestamp: second(-10) },
          { method: 'password', timestamp: second(-300) },
          { method: 'otp', timestamp: second(-120) },
          { method: 'oauth', timestamp: second(31) },
          { method: 'password', timestamp: 0 },
          { method: 'password', timestamp: 'later' },
          null,
        ],
      }),
    ).resolves.toMatchObject({
      ok: true,
      value: {
        primaryAuthAt: new Date(second(-120) * 1000).toISOString(),
        stepUpAt: new Date(second(-10) * 1000).toISOString(),
      },
    });
  });

  it('does not treat any MFA method as primary authentication', async () => {
    await expect(
      verify({
        amr: ['mfa', 'totp', 'webauthn', 'phone'].map((method) => ({
          method,
          timestamp: second(-5),
        })),
      }),
    ).resolves.toMatchObject({ ok: true, value: { primaryAuthAt: null } });
  });

  it('accepts a primary timestamp exactly 30 s ahead and ignores 31 s ahead', async () => {
    await expect(
      verify({ amr: [{ method: 'password', timestamp: second(30) }] }),
    ).resolves.toMatchObject({
      ok: true,
      value: { primaryAuthAt: new Date(second(30) * 1000).toISOString() },
    });
    await expect(
      verify({ amr: [{ method: 'password', timestamp: second(31) }] }),
    ).resolves.toMatchObject({ ok: true, value: { primaryAuthAt: null } });
  });

  it('records the token assurance level', async () => {
    await expect(verify({ aal: 'aal2' })).resolves.toMatchObject({
      ok: true,
      value: { aal: 'aal2' },
    });
    await expect(verify({ aal: 'aal1' })).resolves.toMatchObject({
      ok: true,
      value: { aal: 'aal1' },
    });
    await expect(verify({ aal: 'other' })).resolves.toMatchObject({
      ok: true,
      value: { aal: null },
    });
    await expect(verify({})).resolves.toMatchObject({
      ok: true,
      value: { aal: null },
    });
  });
});

describe('DEC-111 resolved session carries primaryAuthAt', () => {
  it('derives primaryAuthAt from the verified access token on each request', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const target = String(url);
      if (target.endsWith('/auth/v1/user')) return json({ id: AUTH_USER_ID });
      return json({
        accountState: 'active',
        bootstrapState: 'complete',
        personId: '44444444-4444-4444-8444-444444444444',
        actingPartyId: '44444444-4444-4444-8444-444444444444',
        actingContextId: null,
      });
    });
    const dependencies = createProductionAuthenticationDependencies(
      options(fetchImpl as never),
    );
    const config = normalizeAuthProductionOptions(options(fetchImpl as never));
    const sealed = await sealFlowCookie(
      {
        state: SESSION_ID,
        nonce: AUTH_USER_ID,
        verifier: new Date(NOW - 60_000).toISOString(),
        provider: 'session',
        intent: 'session',
        expiresAt: new Date(NOW + 3_600_000).toISOString(),
      },
      config,
    );
    const request = new Request(
      'https://api.example.test/api/v1/auth/session',
      {
        headers: {
          'x-request-id': REQUEST_ID,
          cookie: `wj_access=${jwt({
            amr: [{ method: 'password', timestamp: second(-90) }],
          })}; wj_session_ref=${sealed}`,
        },
      },
    );
    const result = await dependencies.resolveSession(
      request,
      environment,
      new AbortController().signal,
    );
    expect(result).toMatchObject({
      ok: true,
      value: {
        stepUpAt: new Date(NOW - 60_000).toISOString(),
        primaryAuthAt: new Date(second(-90) * 1000).toISOString(),
      },
    });
  });
});
