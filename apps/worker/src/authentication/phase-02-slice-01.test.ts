import { describe, expect, it, vi } from 'vitest';

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
  authRoutePolicies,
} from '@wejammin/contracts';
import { type AuthenticationDependencies } from './types';
import {
  REQUEST_ID,
  AUTH_USER_ID,
  PERSON_ID,
  bindings,
  success,
  unavailable,
  session,
  createAuth,
  createApp,
  jsonHeaders,
  operations,
  requestFor,
} from './phase-02-slice-01.test-support';

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
