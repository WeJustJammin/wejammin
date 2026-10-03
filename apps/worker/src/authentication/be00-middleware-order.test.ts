import { describe, expect, it } from 'vitest';

import { registerOrderTests, type OrderStep } from '../be00-order.test-support';
import {
  CSRF,
  IDENTITY_ID,
  MERGE_ID,
  ORIGIN,
  REQUEST_ID,
  bindings,
  session,
} from './phase-02-slice-02.test-fixtures';
import { createApp, failure, success } from './phase-02-slice-02.test-support';

/*
 * BE00 "Hono Middleware Order" is executable contract. Each human cookie
 * mutation of the authentication family is probed with one request that fails
 * every step from N onward; the response must be the step N refusal.
 */

type State = Readonly<{
  headers: Readonly<Record<string, string>>;
  body: unknown;
  unauthenticated: boolean;
  staleStepUp: boolean;
  rateExhausted: boolean;
}>;

type Operation = Readonly<{
  id: string;
  path: string;
  method: 'DELETE' | 'POST';
  body: unknown;
  invalidBody: unknown;
  idempotency: boolean;
  ifMatch: boolean;
  stepUp: boolean;
}>;

const OPERATIONS: readonly Operation[] = [
  {
    id: 'AUTH-API-06 refresh',
    path: '/api/v1/auth/session/refresh',
    method: 'POST',
    body: {},
    invalidBody: { unknown: true },
    idempotency: false,
    ifMatch: false,
    stepUp: false,
  },
  {
    id: 'AUTH-API-07 bootstrap',
    path: '/api/v1/auth/bootstrap',
    method: 'POST',
    body: {},
    invalidBody: { unknown: true },
    idempotency: true,
    ifMatch: false,
    stepUp: false,
  },
  {
    id: 'AUTH-API-08 logout all',
    path: '/api/v1/auth/logout',
    method: 'POST',
    body: { scope: 'all' },
    invalidBody: { scope: 'bad' },
    idempotency: true,
    ifMatch: false,
    stepUp: true,
  },
  {
    id: 'AUTH-API-10 link intent',
    path: '/api/v1/account/login-methods/google/link-intents',
    method: 'POST',
    body: { returnTo: '/settings/security' },
    invalidBody: { unknown: true },
    idempotency: true,
    ifMatch: true,
    stepUp: false,
  },
  {
    id: 'AUTH-API-11 unlink',
    path: `/api/v1/account/login-methods/${IDENTITY_ID}`,
    method: 'DELETE',
    body: { reason: 'provider_compromise' },
    invalidBody: { unknown: true },
    idempotency: true,
    ifMatch: true,
    stepUp: false,
  },
  {
    id: 'AUTH-API-12 merge create',
    path: '/api/v1/account-merges',
    method: 'POST',
    body: { returnTo: '/settings/security' },
    invalidBody: { unknown: true },
    idempotency: true,
    ifMatch: true,
    stepUp: false,
  },
  {
    id: 'AUTH-API-14 merge proof',
    path: `/api/v1/account-merges/${MERGE_ID}/prove-duplicate`,
    method: 'POST',
    body: { provider: 'google', returnTo: '/settings/security' },
    invalidBody: { unknown: true },
    idempotency: true,
    ifMatch: true,
    stepUp: false,
  },
];

const withHeaders = (state: State, headers: Record<string, string>): State => ({
  ...state,
  headers: { ...state.headers, ...headers },
});

const stepsFor = (operation: Operation): readonly OrderStep<State>[] => [
  {
    name: 'CORS origin allowlist',
    status: 403,
    code: 'FORBIDDEN',
    break: (state) =>
      withHeaders(state, { origin: 'https://evil.example.test' }),
  },
  {
    name: 'body size ceiling',
    status: 413,
    code: 'PAYLOAD_TOO_LARGE',
    break: (state) =>
      withHeaders(state, { 'content-length': String(256 * 1024 + 1) }),
  },
  {
    name: 'content type',
    status: 415,
    code: 'UNSUPPORTED_MEDIA_TYPE',
    break: (state) => withHeaders(state, { 'content-type': 'text/plain' }),
    check: (_response, body) =>
      expect(body.details).toEqual({ allowedMediaTypes: ['application/json'] }),
  },
  {
    name: 'session-bound CSRF',
    status: 403,
    code: 'FORBIDDEN',
    break: (state) => withHeaders(state, { 'x-csrf-token': 'wrong-token' }),
    check: (_response, body) =>
      expect(body.message).toBe('The CSRF token is invalid.'),
  },
  {
    name: 'authentication',
    status: 401,
    code: 'UNAUTHENTICATED',
    break: (state) => ({ ...state, unauthenticated: true }),
  },
  {
    name: 'strict body validation',
    status: 422,
    code: 'VALIDATION_FAILED',
    break: (state) => ({ ...state, body: operation.invalidBody }),
  },
  ...(operation.stepUp
    ? [
        {
          name: 'step-up freshness',
          status: 401,
          code: 'STEP_UP_REQUIRED',
          break: (state: State): State => ({ ...state, staleStepUp: true }),
        },
      ]
    : []),
  {
    name: 'rate limit',
    status: 429,
    code: 'RATE_LIMITED',
    break: (state) => ({ ...state, rateExhausted: true }),
  },
  ...(operation.idempotency
    ? [
        {
          name: 'idempotency key',
          status: 400,
          code: 'INVALID_REQUEST',
          break: (state: State): State =>
            withHeaders(state, { 'idempotency-key': 'short' }),
        },
      ]
    : []),
];

describe('BE00 middleware order on the authentication human routes', () => {
  for (const operation of OPERATIONS)
    describe(operation.id, () => {
      registerOrderTests<State>({
        family: 'authentication',
        fresh: () => ({
          headers: {
            accept: 'application/json',
            origin: ORIGIN,
            cookie: `wj_session_ref=slice02-session-ref; wj_csrf=${CSRF}`,
            'x-csrf-token': CSRF,
            'x-request-id': REQUEST_ID,
            'content-type': 'application/json',
            ...(operation.idempotency
              ? { 'idempotency-key': 'be00-order-key-01' }
              : {}),
            ...(operation.ifMatch ? { 'if-match': '"7"' } : {}),
          },
          body: operation.body,
          unauthenticated: false,
          staleStepUp: false,
          rateExhausted: false,
        }),
        steps: stepsFor(operation),
        send: (state) => {
          const { app } = createApp({
            ...(state.unauthenticated
              ? {
                  resolveSession: async () =>
                    failure(401, 'UNAUTHENTICATED', 'Sign in again.'),
                }
              : state.staleStepUp
                ? {
                    resolveSession: async () =>
                      success({
                        ...session,
                        stepUpAt: new Date(
                          Date.now() - 3_600_000,
                        ).toISOString(),
                      }),
                  }
                : {}),
            ...(state.rateExhausted
              ? {
                  rateLimit: async (input: { limit: number }) =>
                    success({
                      allowed: false,
                      limit: input.limit,
                      remaining: 0,
                      resetAt: Math.floor(Date.now() / 1000) + 30,
                    }),
                }
              : {}),
          });
          return Promise.resolve(
            app.request(
              new Request(`${ORIGIN}${operation.path}`, {
                method: operation.method,
                headers: state.headers,
                body: JSON.stringify(state.body),
              }),
              undefined,
              {
                APP_ENVIRONMENT: 'staging',
                APP_RELEASE: 'phase-02-slice-02-test',
                SUPABASE_SECRET_KEY: 'sb_secret_test_only',
                SUPABASE_URL: 'https://staging.example.supabase.co',
              },
            ),
          );
        },
        accepted: (response) => expect(response.ok).toBe(true),
      });
    });
});

describe('BE00 middleware order on the authentication protected reads (AUTH-API-09)', () => {
  const read = (query: string, unauthenticated: boolean) => {
    const { app } = createApp(
      unauthenticated
        ? {
            resolveSession: async () =>
              failure(401, 'UNAUTHENTICATED', 'Sign in again.'),
          }
        : {},
    );
    return app.fetch(
      new Request(`${ORIGIN}/api/v1/account/login-methods${query}`, {
        headers: {
          accept: 'application/json',
          origin: ORIGIN,
          cookie: `wj_session_ref=slice02-session-ref; wj_csrf=${CSRF}`,
          'x-request-id': REQUEST_ID,
        },
      }),
      bindings,
    );
  };

  it('answers an unauthenticated caller 401 before it validates the query', async () => {
    expect((await read('?unexpected=1', true)).status).toBe(401);
  });

  it('answers an authenticated caller 400 for an unknown query member', async () => {
    expect((await read('?unexpected=1', false)).status).toBe(400);
  });

  it('serves a valid authenticated read', async () => {
    expect((await read('', false)).status).toBe(200);
  });
});

describe('BE00 middleware order on AUTH-API-03 (the public or cookie-authenticated OAuth start)', () => {
  const LINK = {
    provider: 'google',
    intent: 'link',
    returnTo: '/settings/security',
  };
  const send = (
    headers: Record<string, string>,
    overrides: Parameters<typeof createApp>[0] = {},
  ) => {
    const { app } = createApp(overrides);
    return app.fetch(
      new Request(`${ORIGIN}/api/v1/auth/oauth/start`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          origin: ORIGIN,
          cookie: `wj_session_ref=slice02-session-ref; wj_csrf=${CSRF}`,
          'x-csrf-token': CSRF,
          'x-request-id': REQUEST_ID,
          'content-type': 'application/json',
          'idempotency-key': 'be00-order-key-03',
          'if-match': '"7"',
          ...headers,
        },
        body: JSON.stringify(LINK),
      }),
      bindings,
    );
  };

  it('a link intent is refused for a foreign origin, a wrong CSRF token and an anonymous caller in that order', async () => {
    expect(
      (
        await send({
          origin: 'https://evil.example.test',
          'x-csrf-token': 'wrong-token',
        })
      ).status,
    ).toBe(403);
    const csrf = await send({ 'x-csrf-token': 'wrong-token' });
    expect(csrf.status).toBe(403);
    expect(((await csrf.json()) as { message: string }).message).toBe(
      'The CSRF token is invalid.',
    );
    expect(
      (
        await send(
          {},
          {
            resolveSession: async () =>
              failure(401, 'UNAUTHENTICATED', 'Sign in again.'),
          },
        )
      ).status,
    ).toBe(401);
    expect((await send({})).status).toBe(201);
  });

  it('refuses an oversize streamed body 413 and a malformed body 400 before it looks at the caller', async () => {
    const { app } = createApp({
      resolveSession: async () =>
        failure(401, 'UNAUTHENTICATED', 'Sign in again.'),
    });
    const post = (body: string) =>
      app.fetch(
        new Request(`${ORIGIN}/api/v1/auth/oauth/start`, {
          method: 'POST',
          headers: {
            accept: 'application/json',
            origin: ORIGIN,
            cookie: `wj_session_ref=slice02-session-ref; wj_csrf=${CSRF}`,
            'x-csrf-token': CSRF,
            'x-request-id': REQUEST_ID,
            'content-type': 'application/json',
          },
          body,
        }),
        bindings,
      );
    expect((await post('x'.repeat(256 * 1024 + 1))).status).toBe(413);
    const malformed = await post('{not json');
    expect(malformed.status).toBe(400);
    expect(((await malformed.json()) as { code: string }).code).toBe(
      'INVALID_REQUEST',
    );
  });

  it('refuses a body that cannot be read 400 before it looks at the caller', async () => {
    const { app } = createApp();
    const request = new Request(`${ORIGIN}/api/v1/auth/oauth/start`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        origin: ORIGIN,
        'x-request-id': REQUEST_ID,
        'content-type': 'application/json',
      },
      body: '{}',
    });
    Object.defineProperty(request, 'text', {
      value: () => Promise.reject(new Error('stream failed')),
    });
    const response = await app.fetch(request, bindings);
    expect(response.status).toBe(400);
    expect(((await response.json()) as { message: string }).message).toBe(
      'The request body could not be read.',
    );
  });
});
