import {
  AUTH_PROVIDER_REGISTRY,
  AuthCallbackQuerySchema,
  AuthEmptyBodySchema,
  AuthIdempotencyKeySchema,
  AuthIdentityPathSchema,
  AuthMergePathSchema,
  AuthProviderPathSchema,
  AuthReturnTargetSchema,
  AuthStrongVersionSchema,
  EmailStartRequestSchema,
  LogoutRequestSchema,
  MergeConfirmRequestSchema,
  MergeProofRequestSchema,
  OAuthStartRequestSchema,
  type ProviderCatalog,
  authRoutePolicies,
} from '@wejammin/contracts';
import { createLogger } from '@wejammin/observability/logging';
import { describe, expect, it, vi } from 'vitest';

import {
  createWorkerApp,
  type WorkerBindings,
  type WorkerDependencies,
} from '../index';
import type {
  AuthBootstrapResult,
  AuthenticationDependencies,
  AuthenticationResult,
} from './types';

const REQUEST_ID = '11111111-1111-4111-8111-111111111111';
const AUTH_USER_ID = '22222222-2222-4222-8222-222222222222';
const SESSION_ID = '33333333-3333-4333-8333-333333333333';
const PERSON_ID = '44444444-4444-4444-8444-444444444444';
const INTENT_ID = '55555555-5555-4555-8555-555555555555';

const bindings: WorkerBindings = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'phase-02-slice-01-test',
  SUPABASE_SECRET_KEY: 'sb_secret_test_only',
  SUPABASE_URL: 'https://staging.example.supabase.co',
};

const success = <T>(value: T): AuthenticationResult<T> => ({ ok: true, value });
const unavailable = (): AuthenticationResult<never> => ({
  ok: false,
  status: 503,
  code: 'DEPENDENCY_UNAVAILABLE',
  message: 'Authentication is temporarily unavailable.',
  retryAfterSeconds: 5,
});

const session = {
  authUserId: AUTH_USER_ID,
  sessionId: SESSION_ID,
  accountState: 'active',
  personId: PERSON_ID,
  actingPartyId: PERSON_ID,
  expiresAt: '2026-09-01T05:00:00Z',
  stepUpAt: new Date(Date.now() - 60_000).toISOString(),
} as const;

const resource = {
  authenticated: true,
  accountState: 'active',
  bootstrapState: 'complete',
  personId: PERSON_ID,
  actingPartyId: PERSON_ID,
  sessionExpiresAt: '2026-09-01T05:00:00Z',
} as const;

const createAuth = (
  overrides: Partial<AuthenticationDependencies> = {},
): AuthenticationDependencies => ({
  loadProviderCatalog: vi.fn(async () =>
    success<ProviderCatalog>({
      providers: [{ code: 'google', label: 'Google', state: 'enabled' }],
      emailRecoveryEnabled: true,
      version: '1',
    }),
  ),
  startEmail: vi.fn(async () =>
    success({ resource: { accepted: true as const }, cookies: [] }),
  ),
  startOAuth: vi.fn(async () =>
    success({
      resource: {
        authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        expiresAt: '2026-09-01T05:00:00Z',
        intentId: INTENT_ID,
      },
      cookies: [],
    }),
  ),
  startLoginMethodLink: vi.fn(async () =>
    success({
      resource: {
        authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        expiresAt: '2026-09-01T05:00:00Z',
        intentId: INTENT_ID,
      },
      cookies: [],
    }),
  ),
  completeCallback: vi.fn(async () =>
    success({
      location: '/app',
      cookies: ['wj_session=opaque; HttpOnly; Secure; SameSite=Lax; Path=/'],
    }),
  ),
  resolveSession: vi.fn(async () => success(session)),
  readSession: vi.fn(async () => success(resource)),
  refreshSession: vi.fn(async () =>
    success({
      resource,
      cookies: ['wj_session=rotated; HttpOnly; Secure; SameSite=Lax; Path=/'],
    }),
  ),
  bootstrap: vi.fn(async () =>
    success<AuthBootstrapResult>({
      created: true,
      resource: {
        personId: PERSON_ID,
        actingPartyId: PERSON_ID,
        contextKind: 'self',
        accountState: 'active',
        bindingVersion: '1',
      },
    }),
  ),
  logout: vi.fn(async () =>
    success({
      cookies: [
        'wj_session=; Max-Age=0; HttpOnly; Secure; SameSite=Lax; Path=/',
      ],
    }),
  ),
  rateLimit: vi.fn(async (input) =>
    success({
      allowed: true,
      limit: input.limit,
      remaining: input.limit - 1,
      resetAt: 1_788_236_460,
    }),
  ),
  ...overrides,
});

const createApp = (auth = createAuth()) => {
  const dependencies: WorkerDependencies & {
    auth: AuthenticationDependencies;
  } = {
    auth,
    captureException: vi.fn(),
    createLogger: () =>
      createLogger({
        environment: 'staging',
        release: 'phase-02-slice-01-test',
        service: 'wejammin-api',
      }),
    now: () => 1_788_236_400_000,
  };
  return { app: createWorkerApp(dependencies), auth };
};

const jsonHeaders = {
  'content-type': 'application/json',
  origin: 'https://api.example.test',
  cookie:
    'wj_session_ref=slice01-session-ref; wj_csrf=slice01-csrf-random.4c581cbb65100a702593c678609c3761a3a7f0f2577a3349325bcf06c0213ae4; wj_refresh=opaque',
  'x-csrf-token':
    'slice01-csrf-random.4c581cbb65100a702593c678609c3761a3a7f0f2577a3349325bcf06c0213ae4',
  'x-request-id': REQUEST_ID,
};

type OperationCase = Readonly<{
  id: string;
  path: string;
  method: 'GET' | 'POST';
  body?: string;
  successStatus: number;
}>;

const operations: readonly OperationCase[] = [
  {
    id: 'AUTH-API-01',
    path: '/api/v1/auth/providers',
    method: 'GET',
    successStatus: 200,
  },
  {
    id: 'AUTH-API-02',
    path: '/api/v1/auth/email/start',
    method: 'POST',
    body: JSON.stringify({
      email: 'artist@example.com',
      intent: 'recovery',
      returnTo: '/account/recover',
    }),
    successStatus: 202,
  },
  {
    id: 'AUTH-API-03',
    path: '/api/v1/auth/oauth/start',
    method: 'POST',
    body: JSON.stringify({
      provider: 'google',
      intent: 'sign_in',
      returnTo: '/app',
    }),
    successStatus: 201,
  },
  {
    id: 'AUTH-API-04',
    path: '/auth/callback?state=opaque&code=opaque',
    method: 'GET',
    successStatus: 303,
  },
  {
    id: 'AUTH-API-05',
    path: '/api/v1/auth/session',
    method: 'GET',
    successStatus: 200,
  },
  {
    id: 'AUTH-API-06',
    path: '/api/v1/auth/session/refresh',
    method: 'POST',
    body: '{}',
    successStatus: 200,
  },
  {
    id: 'AUTH-API-07',
    path: '/api/v1/auth/bootstrap',
    method: 'POST',
    body: '{}',
    successStatus: 201,
  },
  {
    id: 'AUTH-API-08',
    path: '/api/v1/auth/logout',
    method: 'POST',
    body: '{"scope":"current"}',
    successStatus: 204,
  },
];

const requestFor = (operation: OperationCase, invalid = false): Request => {
  const needsKey =
    operation.id === 'AUTH-API-07' || operation.id === 'AUTH-API-08';
  const path = invalid
    ? operation.method === 'GET'
      ? `${operation.path}${operation.path.includes('?') ? '&' : '?'}unknown=1`
      : operation.path
    : operation.path;
  return new Request(`https://api.example.test${path}`, {
    method: operation.method,
    headers: {
      ...jsonHeaders,
      ...(needsKey ? { 'idempotency-key': 'slice01-key' } : {}),
    },
    ...(operation.method === 'POST'
      ? { body: invalid ? '{"unknown":true}' : operation.body }
      : {}),
  });
};

describe('Phase 2 Slice 01 authentication acceptance', () => {
  it.each(AUTH_PROVIDER_REGISTRY)(
    '$code provider registry contract',
    (provider) => {
      expect(provider.adapter === 'none').toBe(
        provider.launchState === 'disabled' ||
          provider.launchState === 'unsupported',
      );
      expect(provider.setupGate).toMatch(/^[a-z0-9_]+$/u);
    },
  );

  const validationCases = [
    [
      'valid email',
      EmailStartRequestSchema,
      {
        email: 'artist@example.com',
        intent: 'recovery',
        returnTo: '/account/recover',
      },
      true,
    ],
    [
      'unknown email field',
      EmailStartRequestSchema,
      {
        email: 'artist@example.com',
        intent: 'recovery',
        returnTo: '/recover',
        extra: true,
      },
      false,
    ],
    [
      'invalid email',
      EmailStartRequestSchema,
      {
        email: 'not-an-email',
        intent: 'recovery',
        returnTo: '/account/recover',
      },
      false,
    ],
    [
      'invalid email intent',
      EmailStartRequestSchema,
      {
        email: 'artist@example.com',
        intent: 'reset',
        returnTo: '/account/recover',
      },
      false,
    ],
    ['relative return target', AuthReturnTargetSchema, '/app', true],
    [
      'scheme return target',
      AuthReturnTargetSchema,
      'https://evil.test',
      false,
    ],
    ['authority return target', AuthReturnTargetSchema, '//evil.test', false],
    ['backslash return target', AuthReturnTargetSchema, '/\\evil', false],
    ['control return target', AuthReturnTargetSchema, '/app\nnext', false],
    ['ambiguous return target', AuthReturnTargetSchema, '/%252fadmin', false],
    [
      'valid OAuth sign in',
      OAuthStartRequestSchema,
      { provider: 'google', intent: 'sign_in', returnTo: '/app' },
      true,
    ],
    [
      'merge proof requires id',
      OAuthStartRequestSchema,
      { provider: 'google', intent: 'prove_merge', returnTo: '/app' },
      false,
    ],
    [
      'sign in forbids merge id',
      OAuthStartRequestSchema,
      {
        provider: 'google',
        intent: 'sign_in',
        returnTo: '/app',
        mergeId: PERSON_ID,
      },
      false,
    ],
    [
      'callback code branch',
      AuthCallbackQuerySchema,
      { state: 'opaque', code: 'opaque' },
      true,
    ],
    [
      'callback error branch',
      AuthCallbackQuerySchema,
      { state: 'opaque', error: 'access_denied' },
      true,
    ],
    [
      'callback mixed branch',
      AuthCallbackQuerySchema,
      { state: 'opaque', code: 'opaque', error: 'denied' },
      false,
    ],
    [
      'callback empty branch',
      AuthCallbackQuerySchema,
      { state: 'opaque' },
      false,
    ],
    ['empty strict body', AuthEmptyBodySchema, {}, true],
    [
      'empty body unknown field',
      AuthEmptyBodySchema,
      { authUserId: AUTH_USER_ID },
      false,
    ],
    ['logout default scope', LogoutRequestSchema, {}, true],
    ['logout invalid scope', LogoutRequestSchema, { scope: 'tenant' }, false],
    ['provider path', AuthProviderPathSchema, { provider: 'google' }, true],
    ['identity path', AuthIdentityPathSchema, { identityId: PERSON_ID }, true],
    ['merge path malformed', AuthMergePathSchema, { mergeId: 'wrong' }, false],
    [
      'merge acknowledgements unique',
      MergeConfirmRequestSchema,
      { conflictPlanVersion: '1', acknowledgements: ['one', 'one'] },
      false,
    ],
  ] as const;

  it.each(validationCases)('%s', (_name, schema, value, accepted) => {
    expect(schema.safeParse(value).success).toBe(accepted);
  });

  it.each(authRoutePolicies)('$operationId route policy', (policy) => {
    expect(policy.path).toMatch(/^\/(?:api\/v1\/|auth\/callback)/u);
    expect(policy.rateLimit).toBeGreaterThan(0);
    expect(policy.timeoutMs).toBeLessThanOrEqual(15_000);
    expect(policy.cacheControl).toMatch(/^(?:no-store|public, max-age=60)$/u);
  });

  const routeFacets = [
    'happy',
    'invalid',
    'auth',
    'rate',
    'dependency',
    'headers',
  ] as const;
  it.each(
    operations.flatMap((operation) =>
      routeFacets.map(
        (facet) => [`${operation.id} ${facet}`, operation, facet] as const,
      ),
    ),
  )('%s boundary', async (_name, operation, facet) => {
    const auth = createAuth();
    if (facet === 'auth') {
      Object.assign(auth, {
        resolveSession: vi.fn(async () => ({
          ok: false,
          status: 401,
          code: 'UNAUTHENTICATED',
          message: 'Sign in is required.',
        })),
      });
    }
    if (facet === 'rate') {
      Object.assign(auth, {
        rateLimit: vi.fn(async (input: { limit: number }) =>
          success({
            allowed: false,
            limit: input.limit,
            remaining: 0,
            resetAt: 1_788_236_460,
          }),
        ),
      });
    }
    if (facet === 'dependency') {
      const method = {
        'AUTH-API-01': 'loadProviderCatalog',
        'AUTH-API-02': 'startEmail',
        'AUTH-API-03': 'startOAuth',
        'AUTH-API-04': 'completeCallback',
        'AUTH-API-05': 'readSession',
        'AUTH-API-06': 'refreshSession',
        'AUTH-API-07': 'bootstrap',
        'AUTH-API-08': 'logout',
      }[operation.id] as keyof AuthenticationDependencies;
      Object.assign(auth, { [method]: vi.fn(async () => unavailable()) });
    }
    const { app } = createApp(auth);
    const response = await app.fetch(
      requestFor(operation, facet === 'invalid'),
      bindings,
    );

    if (facet === 'happy')
      expect(response.status).toBe(operation.successStatus);
    if (facet === 'invalid') expect([400, 415, 422]).toContain(response.status);
    if (facet === 'auth') {
      const isPublic = [
        'AUTH-API-01',
        'AUTH-API-02',
        'AUTH-API-03',
        'AUTH-API-04',
      ].includes(operation.id);
      expect(response.status === 401).toBe(!isPublic);
    }
    if (facet === 'rate') {
      expect(response.status).toBe(429);
      expect(response.headers.get('ratelimit-limit')).not.toBeNull();
      expect(response.headers.get('retry-after')).not.toBeNull();
    }
    if (facet === 'dependency') expect(response.status).toBe(503);
    if (facet === 'headers') {
      expect(response.headers.get('x-request-id')).toBe(REQUEST_ID);
      expect(response.headers.get('cache-control')).not.toBeNull();
    }
  });

  it('preserves every callback cookie while applying global security headers', async () => {
    const cookies = [
      'wj_access=access; HttpOnly; Secure; SameSite=Lax; Path=/',
      'wj_refresh=refresh; HttpOnly; Secure; SameSite=Lax; Path=/',
      'wj_session_ref=reference; HttpOnly; Secure; SameSite=Lax; Path=/',
      'wj_csrf=csrf; Secure; SameSite=Lax; Path=/',
      'wj_auth_flow=; Max-Age=0; HttpOnly; Secure; SameSite=Lax; Path=/',
    ];
    const { app } = createApp(
      createAuth({
        completeCallback: vi.fn(async () =>
          success({ location: '/app', cookies }),
        ),
      }),
    );

    const response = await app.fetch(
      new Request(
        'https://api.example.test/auth/callback?state=opaque&code=opaque',
      ),
      bindings,
    );
    const headers = response.headers as Headers & {
      getSetCookie: () => string[];
    };

    expect(response.status).toBe(303);
    expect(headers.getSetCookie()).toEqual(cookies);
    expect(response.headers.get('content-security-policy')).not.toBeNull();
  });

  const customSecurityCases = [
    ['step-up blocks global logout', '/api/v1/auth/logout', '{"scope":"all"}'],
    [
      'callback rejects replay-safe missing state',
      '/auth/callback?code=opaque',
      undefined,
    ],
    [
      'refresh accepts no caller session claims',
      '/api/v1/auth/session/refresh',
      '{"sessionId":"forged"}',
    ],
    [
      'bootstrap accepts no caller Auth UUID',
      '/api/v1/auth/bootstrap',
      `{"authUserId":"${AUTH_USER_ID}"}`,
    ],
    [
      'provider catalog never includes unsupported provider',
      '/api/v1/auth/providers',
      undefined,
    ],
  ] as const;

  it.each(customSecurityCases)('%s', async (name, path, body) => {
    const auth = createAuth({
      resolveSession:
        name === 'step-up blocks global logout'
          ? vi.fn(async () => success({ ...session, stepUpAt: null }))
          : createAuth().resolveSession,
    });
    const { app } = createApp(auth);
    const response = await app.fetch(
      new Request(`https://api.example.test${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          ...jsonHeaders,
          'idempotency-key': 'slice01-key',
        },
        ...(body === undefined ? {} : { body }),
      }),
      bindings,
    );
    if (name === 'provider catalog never includes unsupported provider') {
      const payload = (await response.json()) as {
        providers?: { code: string }[];
      };
      expect(
        payload.providers?.some((provider) => provider.code === 'bandlab'),
      ).toBe(false);
    } else if (name === 'step-up blocks global logout') {
      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toMatchObject({
        code: 'STEP_UP_REQUIRED',
        details: { recoveryAction: 'step_up', allowedMethods: ['totp'] },
      });
    } else {
      expect([400, 403, 422]).toContain(response.status);
    }
  });

  it.each([
    [
      'idempotency key bounds',
      AuthIdempotencyKeySchema.safeParse('short').success,
      false,
    ],
    [
      'strong version rejects wildcard',
      AuthStrongVersionSchema.safeParse('*').success,
      false,
    ],
    [
      'merge proof rejects unsupported provider',
      MergeProofRequestSchema.safeParse({
        provider: 'bandlab',
        returnTo: '/app',
      }).success,
      false,
    ],
  ])('%s', (_name, actual, expected) => {
    expect(actual).toBe(expected);
  });
});

describe('Phase 2 Slice 01 authentication route branches', () => {
  it('returns typed dependency errors when authentication composition is absent', async () => {
    const app = createWorkerApp({
      captureException: vi.fn(),
      createLogger: () =>
        createLogger({
          environment: 'staging',
          release: 'test',
          service: 'wejammin-api',
        }),
      now: Date.now,
    });
    const response = await app.request('/api/v1/auth/providers', {}, bindings);
    expect(response.status).toBe(503);
  });

  it('rejects duplicate callback query fields', async () => {
    const { app } = createApp();
    const response = await app.request(
      '/auth/callback?state=one&state=two&code=opaque',
      {},
      bindings,
    );
    expect(response.status).toBe(400);
  });

  it('enforces session and fresh step-up for protected OAuth intents', async () => {
    const body = JSON.stringify({
      provider: 'google',
      intent: 'link',
      returnTo: '/settings/security',
    });
    const protectedHeaders = {
      ...jsonHeaders,
      'idempotency-key': 'protected-oauth-link',
      'if-match': '"1"',
    };
    const missing = createApp(
      createAuth({ resolveSession: vi.fn(async () => unavailable()) }),
    );
    expect(
      (
        await missing.app.request(
          'https://api.example.test/api/v1/auth/oauth/start',
          { method: 'POST', headers: protectedHeaders, body },
          bindings,
        )
      ).status,
    ).toBe(503);
    const stale = createApp(
      createAuth({
        resolveSession: vi.fn(async () =>
          success({ ...session, stepUpAt: null }),
        ),
      }),
    );
    expect(
      (
        await stale.app.request(
          'https://api.example.test/api/v1/auth/oauth/start',
          { method: 'POST', headers: protectedHeaders, body },
          bindings,
        )
      ).status,
    ).toBe(401);
    const fresh = createApp();
    expect(
      (
        await fresh.app.request(
          'https://api.example.test/api/v1/auth/oauth/start',
          { method: 'POST', headers: protectedHeaders, body },
          bindings,
        )
      ).status,
    ).toBe(201);
  });

  it('enforces CSRF and idempotency before refresh, bootstrap, and logout effects', async () => {
    const { app } = createApp();
    const withoutCsrf = {
      'content-type': 'application/json',
      origin: 'https://api.example.test',
    };
    expect(
      (
        await app.request(
          '/api/v1/auth/session/refresh',
          { method: 'POST', headers: withoutCsrf, body: '{}' },
          bindings,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await app.request(
          '/api/v1/auth/bootstrap',
          { method: 'POST', headers: jsonHeaders, body: '{}' },
          bindings,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await app.request(
          '/api/v1/auth/bootstrap',
          {
            method: 'POST',
            headers: { ...withoutCsrf, 'idempotency-key': 'bootstrap-key' },
            body: '{}',
          },
          bindings,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await app.request(
          '/api/v1/auth/logout',
          { method: 'POST', headers: jsonHeaders, body: '{}' },
          bindings,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await app.request(
          '/api/v1/auth/logout',
          {
            method: 'POST',
            headers: { ...withoutCsrf, 'idempotency-key': 'logout-key' },
            body: '{}',
          },
          bindings,
        )
      ).status,
    ).toBe(403);
  });

  it('returns 200 for a replayed bootstrap and defaults logout scope to current', async () => {
    const auth = createAuth({
      bootstrap: vi.fn(async () =>
        success({
          created: false,
          resource: {
            personId: PERSON_ID,
            actingPartyId: PERSON_ID,
            contextKind: 'self' as const,
            accountState: 'active' as const,
            bindingVersion: '1',
          },
        }),
      ),
    });
    const { app } = createApp(auth);
    const bootstrap = await app.fetch(
      new Request('https://api.example.test/api/v1/auth/bootstrap', {
        method: 'POST',
        headers: { ...jsonHeaders, 'idempotency-key': 'bootstrap-key' },
        body: '{}',
      }),
      bindings,
    );
    expect(bootstrap.status).toBe(200);
    const logout = await app.fetch(
      new Request('https://api.example.test/api/v1/auth/logout', {
        method: 'POST',
        headers: { ...jsonHeaders, 'idempotency-key': 'logout-key' },
        body: '{}',
      }),
      bindings,
    );
    expect(logout.status).toBe(204);
    expect(auth.logout).toHaveBeenCalledWith(
      expect.anything(),
      { scope: 'current' },
      'logout-key',
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
  });
});
