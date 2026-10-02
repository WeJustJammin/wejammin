import { describe, expect, it, vi } from 'vitest';

import type { WorkerBindings } from '../index';
import { createProductionAuthenticationDependencies } from './production';
import { callRpc } from './production-http';
import {
  base64UrlEncode,
  normalizeAuthProductionOptions,
  openFlowCookie,
  sealFlowCookie,
  verifyTokenResponse,
} from './production-support';

const AUTH_USER_ID = '22222222-2222-4222-8222-222222222222';
const SESSION_ID = '33333333-3333-4333-8333-333333333333';
const PERSON_ID = '44444444-4444-4444-8444-444444444444';
const INTENT_ID = '55555555-5555-4555-8555-555555555555';
const REQUEST_ID = '11111111-1111-4111-8111-111111111111';
const ACTING_CONTEXT_ID = '66666666-6666-4666-8666-666666666666';
const NOW = Date.parse('2026-09-01T04:00:00Z');

const environment: WorkerBindings = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'phase-02-slice-01-test',
  SUPABASE_SECRET_KEY: 'sb_secret_test_only',
  SUPABASE_URL: 'https://staging.example.supabase.co',
};

const json = (value: unknown, status = 200): Response =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const encodeJson = (value: unknown): string =>
  base64UrlEncode(new TextEncoder().encode(JSON.stringify(value)));

const jwt = (overrides: Readonly<Record<string, unknown>> = {}): string =>
  `${encodeJson({ alg: 'RS256', typ: 'JWT' })}.${encodeJson({
    sub: AUTH_USER_ID,
    session_id: SESSION_ID,
    iss: `${environment.SUPABASE_URL}/auth/v1`,
    aud: 'authenticated',
    exp: Math.floor(NOW / 1000) + 3600,
    iat: Math.floor(NOW / 1000),
    aal: 'aal2',
    ...overrides,
  })}.signature`;

const request = (path: string, init: RequestInit = {}): Request =>
  new Request(`https://api.example.test${path}`, {
    ...init,
    headers: {
      'x-request-id': REQUEST_ID,
      'x-correlation-id': REQUEST_ID,
      ...(init.headers ?? {}),
    },
  });

const config = (
  fetchImpl: typeof fetch = vi.fn(),
  secret = environment.SUPABASE_SECRET_KEY,
) =>
  normalizeAuthProductionOptions({
    environment: { ...environment, SUPABASE_SECRET_KEY: secret },
    fetchImpl,
    now: () => NOW,
    randomBytes: (length) => new Uint8Array(length).fill(7),
  });

describe('production authentication adapter', () => {
  it('rejects non-TLS remote Supabase origins and weak secrets', () => {
    expect(() =>
      normalizeAuthProductionOptions({
        environment: {
          ...environment,
          SUPABASE_URL: 'http://remote.example.test',
        },
      }),
    ).toThrow();
    expect(() =>
      normalizeAuthProductionOptions({
        environment: { ...environment, SUPABASE_SECRET_KEY: 'short' },
      }),
    ).toThrow();
  });

  it('round-trips encrypted flow state and rejects cookie tampering', async () => {
    const production = config();
    const flow = {
      state: 'state',
      nonce: 'nonce',
      verifier: 'verifier',
      provider: 'google',
      intent: 'sign_in',
      expiresAt: '2026-09-01T04:10:00Z',
    } as const;
    const sealed = await sealFlowCookie(flow, production);
    expect(await openFlowCookie(sealed, production)).toEqual(flow);
    const tamperAt = Math.floor(sealed.length / 2);
    const tampered = `${sealed.slice(0, tamperAt)}${sealed[tamperAt] === 'x' ? 'y' : 'x'}${sealed.slice(tamperAt + 1)}`;
    expect(await openFlowCookie(tampered, production)).toBeNull();
    expect(sealed).not.toContain('verifier');
  });

  it('accepts arbitrary provider 2xx while validating user and JWT claims', async () => {
    const fetchImpl = vi.fn(async () => json({ id: AUTH_USER_ID }, 201));
    const result = await verifyTokenResponse(
      { access_token: jwt(), refresh_token: 'refresh-secret' },
      config(fetchImpl),
      new AbortController().signal,
    );
    expect(result).toMatchObject({
      ok: true,
      value: { authUserId: AUTH_USER_ID, sessionId: SESSION_ID },
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      `${environment.SUPABASE_URL}/auth/v1/user`,
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('rejects a provider token with the wrong issuer', async () => {
    const fetchImpl = vi.fn(async () =>
      json({
        id: AUTH_USER_ID,
        identities: [{ provider: 'google', identity_id: 'provider-subject' }],
      }),
    );
    const result = await verifyTokenResponse(
      {
        access_token: jwt({ iss: 'https://attacker.example/auth/v1' }),
        refresh_token: 'refresh-secret',
      },
      config(fetchImpl),
      new AbortController().signal,
    );
    expect(result).toMatchObject({ ok: false, status: 502 });
  });

  it('rejects a provider identity token with a mismatched OAuth nonce', async () => {
    const fetchImpl = vi.fn(async () => json({ id: AUTH_USER_ID }));
    const result = await verifyTokenResponse(
      {
        access_token: jwt(),
        refresh_token: 'refresh-secret',
        id_token: jwt({ nonce: 'attacker-nonce' }),
      },
      config(fetchImpl),
      new AbortController().signal,
      'expected-nonce',
      'google',
    );
    expect(result).toMatchObject({ ok: false, status: 502 });
  });

  it('accepts a Supabase social PKCE response without an optional provider ID token', async () => {
    const fetchImpl = vi.fn(async () =>
      json({
        id: AUTH_USER_ID,
        identities: [{ provider: 'google', identity_id: 'provider-subject' }],
      }),
    );
    const result = await verifyTokenResponse(
      { access_token: jwt(), refresh_token: 'refresh-secret' },
      config(fetchImpl),
      new AbortController().signal,
      'expected-nonce',
      'google',
    );
    expect(result).toMatchObject({
      ok: true,
      value: {
        authUserId: AUTH_USER_ID,
        sessionId: SESSION_ID,
        providerSubjectDigest: expect.stringMatching(/^\\x[0-9a-f]{64}$/),
      },
    });
  });

  it('rejects malformed provider ID tokens when the token response includes one', async () => {
    const fetchImpl = vi.fn(async () =>
      json({
        id: AUTH_USER_ID,
        identities: [{ provider: 'google', identity_id: 'provider-subject' }],
      }),
    );
    for (const idToken of [{ nonce: 'expected-nonce' }, 'broken']) {
      const result = await verifyTokenResponse(
        {
          access_token: jwt(),
          refresh_token: 'refresh-secret',
          id_token: idToken,
        },
        config(fetchImpl),
        new AbortController().signal,
        'expected-nonce',
        'google',
      );
      expect(result).toMatchObject({ ok: false, status: 502 });
    }
  });

  it('loads the protected provider catalog through the named RPC', async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      void input;
      return json({
        providers: [{ code: 'google', label: 'Google', state: 'enabled' }],
        emailRecoveryEnabled: true,
        version: '1',
      });
    });
    const auth = createProductionAuthenticationDependencies({
      environment,
      fetchImpl,
      now: () => NOW,
    });
    const result = await auth.loadProviderCatalog(
      environment,
      new AbortController().signal,
    );
    expect(result.ok).toBe(true);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      `${environment.SUPABASE_URL}/rest/v1/rpc/auth_provider_catalog`,
    );
  });

  it('omits Authorization when an opaque Supabase secret key authenticates an RPC', async () => {
    let capturedHeaders: HeadersInit | undefined;
    const fetchImpl = vi.fn(
      async (_input: string | URL | Request, init?: RequestInit) => {
        capturedHeaders = init?.headers;
        return json({ ok: true });
      },
    );

    await callRpc(
      config(fetchImpl),
      'auth_provider_catalog',
      {},
      new AbortController().signal,
    );

    const headers = new Headers(capturedHeaders);
    expect(headers.get('apikey')).toBe(environment.SUPABASE_SECRET_KEY);
    expect(headers.has('authorization')).toBe(false);
  });

  it('retains Bearer Authorization for a legacy JWT service-role key', async () => {
    let capturedHeaders: HeadersInit | undefined;
    const legacySecret =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.legacy-service-role';
    const fetchImpl = vi.fn(
      async (_input: string | URL | Request, init?: RequestInit) => {
        capturedHeaders = init?.headers;
        return json({ ok: true });
      },
    );

    await callRpc(
      config(fetchImpl, legacySecret),
      'auth_provider_catalog',
      {},
      new AbortController().signal,
    );

    const headers = new Headers(capturedHeaders);
    expect(headers.get('apikey')).toBe(legacySecret);
    expect(headers.get('authorization')).toBe(`Bearer ${legacySecret}`);
  });

  it('starts enumeration-safe email auth with digest-only persistence', async () => {
    const bodies: string[] = [];
    const fetchImpl = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        bodies.push(String(init?.body ?? ''));
        return String(input).includes('/rest/v1/rpc/auth_intent_create')
          ? json({ intentId: INTENT_ID })
          : new Response(null, { status: 204 });
      },
    );
    const auth = createProductionAuthenticationDependencies({
      environment,
      fetchImpl: fetchImpl as typeof fetch,
      now: () => NOW,
      randomBytes: (length) => new Uint8Array(length).fill(7),
    });
    const result = await auth.startEmail(
      {
        email: 'artist@example.com',
        intent: 'recovery',
        returnTo: '/account/recover',
      },
      request('/api/v1/auth/email/start'),
      environment,
      new AbortController().signal,
    );
    expect(result).toMatchObject({
      ok: true,
      value: { resource: { accepted: true } },
    });
    expect(bodies[0]).not.toContain('artist@example.com');
    expect(bodies[1]).toContain('artist@example.com');
    expect(result.ok && result.value.cookies[0]).toMatch(
      /HttpOnly; Secure; SameSite=Lax/u,
    );
  });

  it('keeps setup-required OAuth providers unavailable', async () => {
    const fetchImpl = vi.fn(async () =>
      json({
        providers: [
          { code: 'google', label: 'Google', state: 'temporarily_unavailable' },
        ],
        emailRecoveryEnabled: true,
        version: '1',
      }),
    );
    const auth = createProductionAuthenticationDependencies({
      environment,
      fetchImpl,
    });
    const result = await auth.startOAuth(
      { provider: 'google', intent: 'sign_in', returnTo: '/app' },
      null,
      request('/api/v1/auth/oauth/start'),
      environment,
      new AbortController().signal,
    );
    expect(result).toMatchObject({
      ok: false,
      status: 422,
      code: 'PROVIDER_NOT_AVAILABLE',
    });
  });

  it('hashes the rate bucket before persistence', async () => {
    let rpcBody = '';
    const fetchImpl = vi.fn(
      async (_input: string | URL | Request, init?: RequestInit) => {
        rpcBody = String(init?.body ?? '');
        return json({
          allowed: true,
          limit: 5,
          remaining: 4,
          resetAt: 1_788_236_460,
        });
      },
    );
    const auth = createProductionAuthenticationDependencies({
      environment,
      fetchImpl: fetchImpl as typeof fetch,
    });
    const result = await auth.rateLimit(
      {
        operationId: 'AUTH-API-02',
        request: request('/api/v1/auth/email/start', {
          headers: { 'cf-connecting-ip': '203.0.113.42' },
        }),
        authUserId: null,
        identifierDigest: 'identifier-digest',
        limit: 5,
        windowSeconds: 900,
      },
      environment,
      new AbortController().signal,
    );
    expect(result.ok).toBe(true);
    expect(rpcBody).not.toContain('203.0.113.42');
    expect(rpcBody).not.toContain('identifier-digest');
    expect(rpcBody).toMatch(/[0-9a-f]{64}/u);
  });

  it('maps non-authentication operation ids onto the bounded auth rate RPC without losing operation isolation', async () => {
    let rpcBody = '';
    const fetchImpl = vi.fn(
      async (_input: string | URL | Request, init?: RequestInit) => {
        rpcBody = String(init?.body ?? '');
        return json({
          allowed: true,
          limit: 30,
          remaining: 29,
          resetAt: 1_788_236_460,
        });
      },
    );
    const auth = createProductionAuthenticationDependencies({
      environment,
      fetchImpl: fetchImpl as typeof fetch,
    });
    const result = await auth.rateLimit(
      {
        operationId: 'CMS-03A-01',
        request: request('/api/v1/cms/content-types', {
          headers: { 'cf-connecting-ip': '203.0.113.42' },
        }),
        authUserId: AUTH_USER_ID,
        actingPartyId: PERSON_ID,
        identifierDigest: 'identifier-digest',
        limit: 30,
        windowSeconds: 60,
      },
      environment,
      new AbortController().signal,
    );
    expect(result).toMatchObject({ ok: true, value: { limit: 30 } });
    expect(rpcBody).toContain('AUTH-API-15');
    expect(rpcBody).not.toContain('CMS-03A-01');
  });

  it('parses bootstrap output without leaking the internal created flag', async () => {
    const fetchImpl = vi.fn(async () =>
      json({
        created: true,
        personId: PERSON_ID,
        actingPartyId: PERSON_ID,
        contextKind: 'self',
        accountState: 'active',
        bindingVersion: '1',
      }),
    );
    const auth = createProductionAuthenticationDependencies({
      environment,
      fetchImpl,
    });
    const result = await auth.bootstrap(
      {
        authUserId: AUTH_USER_ID,
        sessionId: SESSION_ID,
        accountState: 'active',
        personId: null,
        actingPartyId: null,
        expiresAt: '2026-09-01T05:00:00Z',
        stepUpAt: null,
      },
      'bootstrap-key',
      request('/api/v1/auth/bootstrap'),
      environment,
      new AbortController().signal,
    );
    expect(result).toMatchObject({
      ok: true,
      value: {
        created: true,
        resource: { personId: PERSON_ID, contextKind: 'self' },
      },
    });
  });

  it('commits local logout before attempting the provider effect', async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      calls.push(String(input));
      return String(input).includes('/rest/v1/rpc/auth_logout')
        ? json({ revoked: 1, replayed: false })
        : new Response(null, { status: 503 });
    });
    const auth = createProductionAuthenticationDependencies({
      environment,
      fetchImpl: fetchImpl as typeof fetch,
    });
    const result = await auth.logout(
      {
        authUserId: AUTH_USER_ID,
        sessionId: SESSION_ID,
        accountState: 'active',
        personId: PERSON_ID,
        actingPartyId: PERSON_ID,
        expiresAt: '2026-09-01T05:00:00Z',
        stepUpAt: '2026-09-01T04:00:00Z',
      },
      { scope: 'current' },
      'logout-key',
      request('/api/v1/auth/logout', {
        headers: { cookie: `wj_access=${jwt()}` },
      }),
      environment,
      new AbortController().signal,
    );
    expect(result.ok).toBe(true);
    expect(calls[0]).toContain('/rest/v1/rpc/auth_logout');
    expect(calls[1]).toContain('/auth/v1/logout?scope=local');
  });
});

describe('production authentication operation coverage', () => {
  const signal = new AbortController().signal;
  const authSession = {
    authUserId: AUTH_USER_ID,
    sessionId: SESSION_ID,
    accountState: 'active' as const,
    personId: PERSON_ID,
    actingPartyId: PERSON_ID,
    expiresAt: '2026-09-01T05:00:00Z',
    stepUpAt: '2026-09-01T04:00:00Z',
  };
  const projection = {
    accountState: 'active',
    bootstrapState: 'complete',
    personId: PERSON_ID,
    actingPartyId: PERSON_ID,
  };

  it('covers provider catalog invalid-response and outage branches', async () => {
    for (const fetchImpl of [
      vi.fn(async () => json({})),
      vi.fn(async () => Promise.reject(new Error('offline'))),
    ]) {
      const auth = createProductionAuthenticationDependencies({
        environment,
        fetchImpl: fetchImpl as typeof fetch,
      });
      await expect(
        auth.loadProviderCatalog(environment, signal),
      ).resolves.toMatchObject({
        ok: false,
      });
    }
  });

  it('starts enabled sign-in OAuth and rejects account-control bypasses, email, or invalid persistence', async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith('/auth_provider_catalog')) {
        return json({
          providers: [{ code: 'google', label: 'Google', state: 'enabled' }],
          emailRecoveryEnabled: true,
          version: '1',
        });
      }
      if (url.endsWith('/auth_intent_create'))
        return json({ intentId: INTENT_ID });
      return json({});
    });
    const auth = createProductionAuthenticationDependencies({
      environment,
      fetchImpl: fetchImpl as typeof fetch,
      now: () => NOW,
      randomBytes: (length) => new Uint8Array(length).fill(9),
    });
    const started = await auth.startOAuth(
      { provider: 'google', intent: 'sign_in', returnTo: '/settings/security' },
      null,
      new Request('https://api.example.test/api/v1/auth/oauth/start'),
      environment,
      signal,
    );
    expect(started).toMatchObject({ ok: true });
    if (!started.ok) throw new Error('Expected OAuth start success');
    const authorization = new URL(started.value.resource.authorizationUrl);
    expect(authorization.pathname).toBe('/auth/v1/authorize');
    expect(authorization.searchParams.get('provider')).toBe('google');
    expect(authorization.searchParams.get('state')).toBeNull();
    expect(authorization.searchParams.get('code_challenge')).toMatch(
      /^[A-Za-z0-9_-]{43}$/,
    );
    expect(authorization.searchParams.get('code_challenge_method')).toBe(
      's256',
    );
    expect(authorization.searchParams.get('nonce')).toBe(
      base64UrlEncode(new Uint8Array(32).fill(9)),
    );
    const redirectTo = authorization.searchParams.get('redirect_to');
    expect(redirectTo).not.toBeNull();
    if (redirectTo === null) throw new Error('Expected OAuth redirect');
    expect(new URL(redirectTo).searchParams.get('state')).toBe(
      base64UrlEncode(new Uint8Array(32).fill(9)),
    );
    await expect(
      auth.startOAuth(
        { provider: 'google', intent: 'link', returnTo: '/settings/security' },
        authSession,
        request('/api/v1/auth/oauth/start'),
        environment,
        signal,
      ),
    ).resolves.toMatchObject({ ok: false, status: 400 });
    await expect(
      auth.startOAuth(
        { provider: 'email', intent: 'sign_in', returnTo: '/app' },
        null,
        request('/api/v1/auth/oauth/start'),
        environment,
        signal,
      ),
    ).resolves.toMatchObject({ ok: false, status: 422 });

    const invalid = createProductionAuthenticationDependencies({
      environment,
      fetchImpl: vi.fn(async (input: string | URL | Request) =>
        String(input).endsWith('/auth_provider_catalog')
          ? json({
              providers: [
                { code: 'google', label: 'Google', state: 'enabled' },
              ],
              emailRecoveryEnabled: true,
              version: '1',
            })
          : json(null),
      ) as typeof fetch,
      now: () => NOW,
    });
    await expect(
      invalid.startOAuth(
        { provider: 'google', intent: 'sign_in', returnTo: '/app' },
        null,
        request('/api/v1/auth/oauth/start'),
        environment,
        signal,
      ),
    ).resolves.toMatchObject({ ok: false, status: 502 });
  });

  it('maps email-flow persistence and provider failures safely', async () => {
    const invalidPersistence = createProductionAuthenticationDependencies({
      environment,
      fetchImpl: vi.fn(async () => json(null)) as typeof fetch,
      now: () => NOW,
    });
    await expect(
      invalidPersistence.startEmail(
        { email: 'artist@example.com', intent: 'sign_in', returnTo: '/app' },
        new Request('https://api.example.test/api/v1/auth/email/start'),
        environment,
        signal,
      ),
    ).resolves.toMatchObject({ ok: false, status: 502 });

    const providerFailure = createProductionAuthenticationDependencies({
      environment,
      fetchImpl: vi.fn(async (input: string | URL | Request) =>
        String(input).endsWith('/auth_intent_create')
          ? json({ intentId: INTENT_ID })
          : new Response(null, { status: 503 }),
      ) as typeof fetch,
      now: () => NOW,
    });
    await expect(
      providerFailure.startEmail(
        { email: 'artist@example.com', intent: 'sign_in', returnTo: '/app' },
        new Request('https://api.example.test/api/v1/auth/email/start'),
        environment,
        signal,
      ),
    ).resolves.toMatchObject({ ok: false, status: 503 });
  });

  it('completes a valid Supabase callback without an ID token and rotates secure session cookies', async () => {
    const options = {
      environment,
      now: () => NOW,
      randomBytes: (length: number) => new Uint8Array(length).fill(5),
    };
    const flow = {
      state: 'callback-state',
      nonce: 'callback-nonce',
      verifier: 'pkce-verifier',
      provider: 'google',
      intent: 'sign_in',
      expiresAt: '2026-09-01T04:10:00Z',
    } as const;
    const sealed = await sealFlowCookie(
      flow,
      normalizeAuthProductionOptions(options),
    );
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/auth/v1/token')) {
        return json({
          access_token: jwt(),
          refresh_token: 'refresh-secret',
        });
      }
      if (url.endsWith('/auth/v1/user'))
        return json({
          id: AUTH_USER_ID,
          identities: [{ provider: 'google', identity_id: 'provider-subject' }],
        });
      if (url.endsWith('/auth_callback_complete'))
        return json({ returnPath: '/app' });
      return json({});
    });
    const auth = createProductionAuthenticationDependencies({
      ...options,
      fetchImpl: fetchImpl as typeof fetch,
    });
    const result = await auth.completeCallback(
      { state: flow.state, code: 'authorization-code' },
      new Request('https://api.example.test/auth/callback', {
        headers: { cookie: `wj_auth_flow=${sealed}` },
      }),
      environment,
      signal,
    );
    expect(result).toMatchObject({ ok: true, value: { location: '/app' } });
    expect(result.ok && result.value.cookies).toHaveLength(5);
  });

  it('rejects missing, mismatched, provider-error, invalid-token, and unsafe callbacks', async () => {
    const options = { environment, now: () => NOW };
    const flow = {
      state: 'callback-state',
      nonce: 'callback-nonce',
      verifier: 'pkce-verifier',
      provider: 'google',
      intent: 'sign_in',
      expiresAt: '2026-09-01T04:10:00Z',
    } as const;
    const sealed = await sealFlowCookie(
      flow,
      normalizeAuthProductionOptions(options),
    );
    const baseRequest = (cookie?: string) =>
      new Request('https://api.example.test/auth/callback', {
        ...(cookie === undefined ? {} : { headers: { cookie } }),
      });
    const auth = createProductionAuthenticationDependencies({
      ...options,
      fetchImpl: vi.fn(async () => json({})) as typeof fetch,
    });
    for (const [input, callbackRequest] of [
      [{ state: flow.state, code: 'code' }, baseRequest()],
      [{ state: 'wrong', code: 'code' }, baseRequest(`wj_auth_flow=${sealed}`)],
    ] as const) {
      await expect(
        auth.completeCallback(input, callbackRequest, environment, signal),
      ).resolves.toMatchObject({ ok: false, status: 400 });
    }
    await expect(
      auth.completeCallback(
        { state: flow.state, error: 'denied' },
        baseRequest(`wj_auth_flow=${sealed}`),
        environment,
        signal,
      ),
    ).resolves.toMatchObject({
      ok: true,
      value: { location: '/auth/sign-in?result=failed' },
    });
    await expect(
      auth.completeCallback(
        { state: flow.state, code: 'code' },
        baseRequest(`wj_auth_flow=${sealed}`),
        environment,
        signal,
      ),
    ).resolves.toMatchObject({
      ok: true,
      value: { location: '/auth/sign-in?result=failed' },
    });

    const unsafe = createProductionAuthenticationDependencies({
      ...options,
      fetchImpl: vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes('/auth/v1/token')) {
          return json({
            access_token: jwt(),
            refresh_token: 'refresh',
            id_token: jwt({ nonce: flow.nonce }),
          });
        }
        if (url.endsWith('/auth/v1/user'))
          return json({
            id: AUTH_USER_ID,
            identities: [
              { provider: 'google', identity_id: 'provider-subject' },
            ],
          });
        return json({ returnPath: 'https://attacker.example' });
      }) as typeof fetch,
    });
    await expect(
      unsafe.completeCallback(
        { state: flow.state, code: 'code' },
        baseRequest(`wj_auth_flow=${sealed}`),
        environment,
        signal,
      ),
    ).resolves.toMatchObject({ ok: false, status: 502 });
  });

  it('resolves both indexed access and refresh session references', async () => {
    const options = { environment, now: () => NOW };
    const reference = await sealFlowCookie(
      {
        state: SESSION_ID,
        nonce: AUTH_USER_ID,
        verifier: '',
        provider: 'session',
        intent: 'session',
        expiresAt: '2026-10-01T04:00:00Z',
      },
      normalizeAuthProductionOptions(options),
    );
    const fetchImpl = vi.fn(async (input: string | URL | Request) =>
      String(input).endsWith('/auth/v1/user')
        ? json({ id: AUTH_USER_ID })
        : json(projection),
    );
    const auth = createProductionAuthenticationDependencies({
      ...options,
      fetchImpl: fetchImpl as typeof fetch,
    });
    const refreshed = await auth.resolveSession(
      new Request('https://api.example.test/api/v1/auth/session/refresh', {
        headers: { cookie: `wj_session_ref=${reference}` },
      }),
      environment,
      signal,
    );
    expect(refreshed).toMatchObject({
      ok: true,
      value: { authUserId: AUTH_USER_ID },
    });
    const accessed = await auth.resolveSession(
      new Request('https://api.example.test/api/v1/auth/session', {
        headers: { cookie: `wj_access=${jwt()}; wj_session_ref=${reference}` },
      }),
      environment,
      signal,
    );
    expect(accessed).toMatchObject({
      ok: true,
      value: { sessionId: SESSION_ID },
    });
  });

  it('rejects missing, wrong-kind, invalid-token, and invalid-index session inputs', async () => {
    const options = { environment, now: () => NOW };
    const wrongReference = await sealFlowCookie(
      {
        state: SESSION_ID,
        nonce: AUTH_USER_ID,
        verifier: '',
        provider: 'google',
        intent: 'sign_in',
        expiresAt: '2026-10-01T04:00:00Z',
      },
      normalizeAuthProductionOptions(options),
    );
    const auth = createProductionAuthenticationDependencies({
      ...options,
      fetchImpl: vi.fn(async (input: string | URL | Request) =>
        String(input).endsWith('/auth/v1/user')
          ? json({ id: AUTH_USER_ID })
          : json({ accountState: 'invalid' }),
      ) as typeof fetch,
    });
    for (const sessionRequest of [
      new Request('https://api.example.test/api/v1/auth/session/refresh'),
      new Request('https://api.example.test/api/v1/auth/session/refresh', {
        headers: { cookie: `wj_session_ref=${wrongReference}` },
      }),
      new Request('https://api.example.test/api/v1/auth/session'),
      new Request('https://api.example.test/api/v1/auth/session', {
        headers: { cookie: 'wj_access=broken' },
      }),
      new Request('https://api.example.test/api/v1/auth/session', {
        headers: { cookie: `wj_access=${jwt()}` },
      }),
    ]) {
      await expect(
        auth.resolveSession(sessionRequest, environment, signal),
      ).resolves.toMatchObject({
        ok: false,
      });
    }
  });

  it('renders required and complete session projections', async () => {
    const auth = createProductionAuthenticationDependencies({ environment });
    await expect(
      auth.readSession(
        { ...authSession, personId: null, actingPartyId: null },
        environment,
        signal,
      ),
    ).resolves.toMatchObject({
      ok: true,
      value: { bootstrapState: 'required' },
    });
    await expect(
      auth.readSession(authSession, environment, signal),
    ).resolves.toMatchObject({
      ok: true,
      value: { bootstrapState: 'complete' },
    });
  });

  it('refreshes a session end to end and rejects missing or invalid refresh state', async () => {
    const reference = await sealFlowCookie(
      {
        state: SESSION_ID,
        nonce: AUTH_USER_ID,
        verifier: '',
        provider: 'session',
        intent: 'session',
        expiresAt: '2026-10-01T04:00:00Z',
      },
      normalizeAuthProductionOptions({ environment, now: () => NOW }),
    );
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('grant_type=refresh_token')) {
        return json({ access_token: jwt(), refresh_token: 'rotated-refresh' });
      }
      if (url.endsWith('/auth/v1/user')) return json({ id: AUTH_USER_ID });
      if (url.endsWith('/auth_session_register'))
        return json({ registered: true });
      return json(projection);
    });
    const auth = createProductionAuthenticationDependencies({
      environment,
      fetchImpl: fetchImpl as typeof fetch,
      now: () => NOW,
    });
    await expect(
      auth.refreshSession(
        new Request('https://api.example.test/api/v1/auth/session/refresh'),
        environment,
        signal,
      ),
    ).resolves.toMatchObject({ ok: false, status: 401 });
    const refreshed = await auth.refreshSession(
      new Request('https://api.example.test/api/v1/auth/session/refresh', {
        headers: {
          cookie: `wj_refresh=refresh-secret; wj_session_ref=${reference}`,
        },
      }),
      environment,
      signal,
    );
    expect(refreshed).toMatchObject({ ok: true });

    const invalid = createProductionAuthenticationDependencies({
      environment,
      fetchImpl: vi.fn(async () => json({})) as typeof fetch,
      now: () => NOW,
    });
    await expect(
      invalid.refreshSession(
        new Request('https://api.example.test/api/v1/auth/session/refresh', {
          headers: {
            cookie: `wj_refresh=refresh-secret; wj_session_ref=${reference}`,
          },
        }),
        environment,
        signal,
      ),
    ).resolves.toMatchObject({ ok: false, status: 502 });
  });

  it('maps invalid bootstrap output and bootstrap outages', async () => {
    for (const fetchImpl of [
      vi.fn(async () => json({ created: 'yes' })),
      vi.fn(async () => Promise.reject(new Error('offline'))),
    ]) {
      const auth = createProductionAuthenticationDependencies({
        environment,
        fetchImpl: fetchImpl as typeof fetch,
      });
      await expect(
        auth.bootstrap(
          authSession,
          'bootstrap-key',
          new Request('https://api.example.test/api/v1/auth/bootstrap'),
          environment,
          signal,
        ),
      ).resolves.toMatchObject({ ok: false });
    }
  });

  it('handles global logout without an access cookie and maps local persistence failure', async () => {
    const calls: string[] = [];
    const auth = createProductionAuthenticationDependencies({
      environment,
      fetchImpl: vi.fn(async (input: string | URL | Request) => {
        calls.push(String(input));
        return String(input).endsWith('/auth_logout')
          ? json({ revoked: 2 })
          : new Response(null, { status: 204 });
      }) as typeof fetch,
    });
    await expect(
      auth.logout(
        authSession,
        { scope: 'all' },
        'logout-key',
        new Request('https://api.example.test/api/v1/auth/logout'),
        environment,
        signal,
      ),
    ).resolves.toMatchObject({ ok: true });
    expect(calls[1]).toContain('scope=global');

    const failed = createProductionAuthenticationDependencies({
      environment,
      fetchImpl: vi.fn(async () =>
        Promise.reject(new Error('offline')),
      ) as typeof fetch,
    });
    await expect(
      failed.logout(
        authSession,
        { scope: 'current' },
        'logout-key',
        request('/api/v1/auth/logout'),
        environment,
        signal,
      ),
    ).resolves.toMatchObject({ ok: false, status: 503 });
  });

  it('rejects malformed rate decisions and maps rate persistence outages', async () => {
    for (const fetchImpl of [
      vi.fn(async () => json({ allowed: true })),
      vi.fn(async () => Promise.reject(new Error('offline'))),
    ]) {
      const auth = createProductionAuthenticationDependencies({
        environment,
        fetchImpl: fetchImpl as typeof fetch,
      });
      await expect(
        auth.rateLimit(
          {
            operationId: 'AUTH-API-01',
            request: new Request(
              'https://api.example.test/api/v1/auth/providers',
            ),
            authUserId: null,
            identifierDigest: null,
            limit: 120,
            windowSeconds: 60,
          },
          environment,
          signal,
        ),
      ).resolves.toMatchObject({ ok: false });
    }
  });

  it('covers callback, session-index, and refresh dependency recovery branches', async () => {
    const options = { environment, now: () => NOW };
    const flow = {
      state: 'callback-state',
      nonce: 'callback-nonce',
      verifier: 'pkce-verifier',
      provider: 'google',
      intent: 'sign_in',
      expiresAt: '2026-09-01T04:10:00Z',
    } as const;
    const sealedFlow = await sealFlowCookie(
      flow,
      normalizeAuthProductionOptions(options),
    );
    const accessReference = await sealFlowCookie(
      {
        state: SESSION_ID,
        nonce: AUTH_USER_ID,
        verifier: '',
        provider: 'session',
        intent: 'session',
        expiresAt: '2026-10-01T04:00:00Z',
      },
      normalizeAuthProductionOptions(options),
    );
    const outage = createProductionAuthenticationDependencies({
      ...options,
      fetchImpl: vi.fn(async () =>
        Promise.reject(new Error('offline')),
      ) as typeof fetch,
    });
    await expect(
      outage.completeCallback(
        { state: flow.state, code: 'code' },
        new Request('https://api.example.test/auth/callback', {
          headers: { cookie: `wj_auth_flow=${sealedFlow}` },
        }),
        environment,
        signal,
      ),
    ).resolves.toMatchObject({ ok: false, status: 503 });
    await expect(
      outage.resolveSession(
        new Request('https://api.example.test/api/v1/auth/session', {
          headers: {
            cookie: `wj_access=${jwt()}; wj_session_ref=${accessReference}`,
          },
        }),
        environment,
        signal,
      ),
    ).resolves.toMatchObject({ ok: false, status: 503 });

    const sessionReference = await sealFlowCookie(
      {
        state: SESSION_ID,
        nonce: AUTH_USER_ID,
        verifier: '',
        provider: 'session',
        intent: 'session',
        expiresAt: '2026-10-01T04:00:00Z',
      },
      normalizeAuthProductionOptions(options),
    );
    await expect(
      outage.resolveSession(
        new Request('https://api.example.test/api/v1/auth/session/refresh', {
          headers: { cookie: `wj_session_ref=${sessionReference}` },
        }),
        environment,
        signal,
      ),
    ).resolves.toMatchObject({ ok: false, status: 503 });
    for (const projectionValue of [null, { accountState: 'invalid' }]) {
      const auth = createProductionAuthenticationDependencies({
        ...options,
        fetchImpl: vi.fn(async () => json(projectionValue)) as typeof fetch,
      });
      const resolved = await auth.resolveSession(
        new Request('https://api.example.test/api/v1/auth/session/refresh', {
          headers: { cookie: `wj_session_ref=${sessionReference}` },
        }),
        environment,
        signal,
      );
      expect(resolved.ok).toBe(projectionValue === null);
    }

    const refreshWith = (fetchImpl: typeof fetch) =>
      createProductionAuthenticationDependencies({ ...options, fetchImpl });
    const refreshRequest = () =>
      new Request('https://api.example.test/api/v1/auth/session/refresh', {
        headers: {
          cookie: `wj_refresh=refresh-secret; wj_session_ref=${sessionReference}`,
        },
      });
    const invalidIndex = refreshWith(
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes('grant_type=refresh_token')) {
          return json({ access_token: jwt(), refresh_token: 'rotated' });
        }
        if (url.endsWith('/auth/v1/user')) return json({ id: AUTH_USER_ID });
        if (url.endsWith('/auth_session_register'))
          return json({ registered: true });
        return json({ accountState: 'invalid' });
      }) as typeof fetch,
    );
    await expect(
      invalidIndex.refreshSession(refreshRequest(), environment, signal),
    ).resolves.toMatchObject({ ok: false, status: 502 });

    const registerOutage = refreshWith(
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes('grant_type=refresh_token')) {
          return json({ access_token: jwt(), refresh_token: 'rotated' });
        }
        if (url.endsWith('/auth/v1/user')) return json({ id: AUTH_USER_ID });
        return Promise.reject(new Error('offline'));
      }) as typeof fetch,
    );
    await expect(
      registerOutage.refreshSession(refreshRequest(), environment, signal),
    ).resolves.toMatchObject({ ok: false, status: 503 });
  });

  it('threads the private acting-context binding id from the service-role projection into the internal session', async () => {
    const reference = await sealFlowCookie(
      {
        state: SESSION_ID,
        nonce: AUTH_USER_ID,
        verifier: '',
        provider: 'session',
        intent: 'session',
        expiresAt: '2026-10-01T04:00:00Z',
      },
      normalizeAuthProductionOptions({ environment, now: () => NOW }),
    );
    const bindingProjection = (actingContextId: unknown) => ({
      accountState: 'active',
      personId: PERSON_ID,
      actingPartyId: PERSON_ID,
      actingContextId,
    });
    const authFor = (projectionValue: unknown) =>
      createProductionAuthenticationDependencies({
        environment,
        fetchImpl: vi.fn(async (input: string | URL | Request) =>
          String(input).endsWith('/auth/v1/user')
            ? json({ id: AUTH_USER_ID })
            : json(projectionValue),
        ) as typeof fetch,
        now: () => NOW,
      });
    const accessRequest = () =>
      new Request('https://api.example.test/api/v1/auth/session', {
        headers: {
          cookie: `wj_access=${jwt()}; wj_session_ref=${reference}`,
        },
      });
    const referenceRequest = () =>
      new Request('https://api.example.test/api/v1/auth/session/refresh', {
        headers: { cookie: `wj_session_ref=${reference}` },
      });

    await expect(
      authFor(bindingProjection(ACTING_CONTEXT_ID)).resolveSession(
        accessRequest(),
        environment,
        signal,
      ),
    ).resolves.toMatchObject({
      ok: true,
      value: { actingContextId: ACTING_CONTEXT_ID },
    });
    await expect(
      authFor(bindingProjection(ACTING_CONTEXT_ID)).resolveSession(
        referenceRequest(),
        environment,
        signal,
      ),
    ).resolves.toMatchObject({
      ok: true,
      value: { actingContextId: ACTING_CONTEXT_ID },
    });
    await expect(
      authFor(bindingProjection(null)).resolveSession(
        accessRequest(),
        environment,
        signal,
      ),
    ).resolves.toMatchObject({ ok: true, value: { actingContextId: null } });
    await expect(
      authFor({
        accountState: 'active',
        personId: PERSON_ID,
        actingPartyId: PERSON_ID,
      }).resolveSession(accessRequest(), environment, signal),
    ).resolves.toMatchObject({ ok: true, value: { actingContextId: null } });

    for (const malformed of ['not-a-uuid', 7, {}, true] as const) {
      await expect(
        authFor(bindingProjection(malformed)).resolveSession(
          accessRequest(),
          environment,
          signal,
        ),
      ).resolves.toMatchObject({
        ok: false,
        status: 502,
        code: 'DEPENDENCY_INVALID_RESPONSE',
      });
      await expect(
        authFor(bindingProjection(malformed)).resolveSession(
          referenceRequest(),
          environment,
          signal,
        ),
      ).resolves.toMatchObject({
        ok: false,
        status: 502,
        code: 'DEPENDENCY_INVALID_RESPONSE',
      });
    }
  });

  it('keeps the private acting-context binding id out of the public session resource', async () => {
    const auth = createProductionAuthenticationDependencies({ environment });
    const result = await auth.readSession(
      { ...authSession, actingContextId: ACTING_CONTEXT_ID },
      environment,
      signal,
    );
    expect(result).toMatchObject({
      ok: true,
      value: {
        authenticated: true,
        accountState: 'active',
        bootstrapState: 'complete',
        personId: PERSON_ID,
        actingPartyId: PERSON_ID,
        sessionExpiresAt: '2026-09-01T05:00:00Z',
      },
    });
    expect(result.ok ? Object.keys(result.value).sort() : []).toEqual([
      'accountState',
      'actingPartyId',
      'authenticated',
      'bootstrapState',
      'personId',
      'sessionExpiresAt',
    ]);
  });
});
