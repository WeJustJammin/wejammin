import { describe, expect } from 'vitest';

import { registerOrderTests, type OrderStep } from '../be00-order.test-support';
import {
  CSRF,
  MERGE_ID,
  ORIGIN,
  REQUEST_ID,
  session,
} from './phase-02-slice-02.test-fixtures';
import { createApp, failure, success } from './phase-02-slice-02.test-support';

/*
 * AUTH-API-03 is a public sign-in start or, for `link` and `prove_merge`, a
 * cookie-authenticated start; the body names which. BE00 "Hono Middleware
 * Order" step 2 (same-origin CORS, size ceiling, content type, session-bound
 * CSRF) precedes step 6 (strict body validation), so a request that carries
 * the cookie-session credentials is refused at the transport boundary before
 * its body is read. Then come verified session, step-up, quota and the exact
 * Idempotency-Key and If-Match. Each cookie mode is probed with one request
 * that fails every step from N onward. The public sign-in order is covered in
 * be00-oauth-start-body-order.test.ts.
 */

type State = Readonly<{
  headers: Readonly<Record<string, string>>;
  body: unknown;
  unauthenticated: boolean;
  staleStepUp: boolean;
  rateExhausted: boolean;
}>;

const withHeaders = (state: State, headers: Record<string, string>): State => ({
  ...state,
  headers: { ...state.headers, ...headers },
});

const stepsFor = (invalidBody: unknown): readonly OrderStep<State>[] => [
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
  },
  {
    name: 'strict body shape',
    status: 422,
    code: 'VALIDATION_FAILED',
    break: (state) => ({ ...state, body: invalidBody }),
  },
  {
    name: 'authentication',
    status: 401,
    code: 'UNAUTHENTICATED',
    break: (state) => ({ ...state, unauthenticated: true }),
  },
  {
    name: 'step-up freshness',
    status: 401,
    code: 'STEP_UP_REQUIRED',
    break: (state) => ({ ...state, staleStepUp: true }),
  },
  {
    name: 'rate limit',
    status: 429,
    code: 'RATE_LIMITED',
    break: (state) => ({ ...state, rateExhausted: true }),
  },
  {
    name: 'idempotency key',
    status: 400,
    code: 'INVALID_REQUEST',
    break: (state) => withHeaders(state, { 'idempotency-key': 'short' }),
  },
  {
    name: 'If-Match',
    status: 400,
    code: 'INVALID_REQUEST',
    break: (state) => withHeaders(state, { 'if-match': 'not-quoted' }),
  },
];

const MODES = [
  {
    id: 'AUTH-API-03 link',
    body: {
      provider: 'google',
      intent: 'link',
      returnTo: '/settings/security',
    },
  },
  {
    id: 'AUTH-API-03 prove_merge',
    body: {
      provider: 'google',
      intent: 'prove_merge',
      returnTo: '/settings/security',
      mergeId: MERGE_ID,
    },
  },
] as const;

describe('BE00 middleware order on the cookie-authenticated modes of AUTH-API-03', () => {
  for (const mode of MODES)
    describe(mode.id, () => {
      registerOrderTests<State>({
        family: 'authentication oauth start',
        fresh: () => ({
          headers: {
            accept: 'application/json',
            origin: ORIGIN,
            cookie: `wj_session_ref=slice02-session-ref; wj_csrf=${CSRF}`,
            'x-csrf-token': CSRF,
            'x-request-id': REQUEST_ID,
            'content-type': 'application/json',
            'idempotency-key': 'be00-order-key-01',
            'if-match': '"7"',
          },
          body: mode.body,
          unauthenticated: false,
          staleStepUp: false,
          rateExhausted: false,
        }),
        steps: stepsFor({ ...mode.body, unknown: true }),
        send: (state) => {
          const { app } = createApp({
            ...(state.unauthenticated
              ? {
                  resolveSession: async () =>
                    failure(401, 'UNAUTHENTICATED', 'Sign in again.'),
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
            ...(state.staleStepUp && !state.unauthenticated
              ? {
                  resolveSession: async () =>
                    success({
                      ...session,
                      stepUpAt: new Date(Date.now() - 3_600_000).toISOString(),
                    }),
                }
              : {}),
          });
          return Promise.resolve(
            app.request(`${ORIGIN}/api/v1/auth/oauth/start`, {
              method: 'POST',
              headers: state.headers,
              body: JSON.stringify(state.body),
            }),
          );
        },
        accepted: (response) => expect(response.status).toBe(201),
      });
    });
});
