import { afterEach, beforeEach, describe, expect, vi } from 'vitest';

import { registerOrderTests, type OrderStep } from '../be00-order.test-support';
import {
  CSRF,
  MERGE_ID,
  ORIGIN,
  REQUEST_ID,
  bindings,
} from './phase-02-slice-02.test-fixtures';
import { createApp, failure, success } from './phase-02-slice-02.test-support';
import {
  NOW,
  createWorld,
  json,
  mintJar,
  send,
} from './dec111-composition.test-support';

/*
 * BE00 "Hono Middleware Order" is executable contract. Every cookie-session
 * read of the authentication family (AUTH-API-05, 09, 13, 16) is probed with
 * one request that fails every step from N onward; the response must be the
 * step N refusal. A read has no body, content type or CSRF token, so step 2 is
 * the origin check alone.
 */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

type State = Readonly<{
  path: string;
  query: string;
  headers: Readonly<Record<string, string>>;
  unauthenticated: boolean;
  rateExhausted: boolean;
}>;

type Read = Readonly<{
  id: string;
  path: string;
  badPath: string | null;
}>;

const READS: readonly Read[] = [
  { id: 'AUTH-API-05 session', path: '/api/v1/auth/session', badPath: null },
  {
    id: 'AUTH-API-09 login methods',
    path: '/api/v1/account/login-methods',
    badPath: null,
  },
  {
    id: 'AUTH-API-13 merge case',
    path: `/api/v1/account-merges/${MERGE_ID}`,
    badPath: '/api/v1/account-merges/not-a-uuid',
  },
];

const stepsFor = (read: Read): readonly OrderStep<State>[] => [
  {
    name: 'CORS origin allowlist',
    status: 403,
    code: 'FORBIDDEN',
    break: (state) => ({
      ...state,
      headers: { ...state.headers, origin: 'https://evil.example.test' },
    }),
  },
  {
    name: 'authentication',
    status: 401,
    code: 'UNAUTHENTICATED',
    break: (state) => ({ ...state, unauthenticated: true }),
  },
  ...(read.badPath === null
    ? []
    : [
        {
          name: 'strict path validation',
          status: 400,
          code: 'INVALID_REQUEST',
          break: (state: State): State => ({
            ...state,
            path: read.badPath as string,
          }),
        },
      ]),
  {
    name: 'strict query validation',
    status: 400,
    code: 'INVALID_REQUEST',
    break: (state) => ({ ...state, query: '?unexpected=1' }),
  },
  {
    name: 'rate limit',
    status: 429,
    code: 'RATE_LIMITED',
    break: (state) => ({ ...state, rateExhausted: true }),
  },
];

describe('BE00 middleware order on the authentication session reads', () => {
  for (const read of READS)
    describe(read.id, () => {
      registerOrderTests<State>({
        family: 'authentication read',
        fresh: () => ({
          path: read.path,
          query: '',
          headers: {
            accept: 'application/json',
            origin: ORIGIN,
            cookie: `wj_session_ref=slice02-session-ref; wj_csrf=${CSRF}`,
            'x-request-id': REQUEST_ID,
          },
          unauthenticated: false,
          rateExhausted: false,
        }),
        steps: stepsFor(read),
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
          });
          return Promise.resolve(
            app.fetch(
              new Request(`${ORIGIN}${state.path}${state.query}`, {
                method: 'GET',
                headers: state.headers,
              }),
              bindings,
            ),
          );
        },
        accepted: (response) => expect(response.status).toBe(200),
      });
    });
});

const LIST = '/api/v1/account/mfa/factors';

type MfaState = Readonly<{
  query: string;
  origin: string | null;
  expiredSession: boolean;
  rateExhausted: boolean;
}>;

describe('BE00 middleware order on the MFA factor list (AUTH-API-16, production composition)', () => {
  const steps: readonly OrderStep<MfaState>[] = [
    {
      name: 'CORS origin allowlist',
      status: 403,
      code: 'FORBIDDEN',
      break: (state) => ({ ...state, origin: 'https://evil.example.test' }),
    },
    {
      name: 'authentication',
      status: 401,
      code: 'UNAUTHENTICATED',
      break: (state) => ({ ...state, expiredSession: true }),
    },
    {
      name: 'strict query validation',
      status: 400,
      code: 'INVALID_REQUEST',
      break: (state) => ({ ...state, query: '?unexpected=1' }),
    },
    {
      name: 'rate limit',
      status: 429,
      code: 'RATE_LIMITED',
      break: (state) => ({ ...state, rateExhausted: true }),
    },
  ];
  registerOrderTests<MfaState>({
    family: 'authentication mfa read',
    fresh: () => ({
      query: '',
      origin: null,
      expiredSession: false,
      rateExhausted: false,
    }),
    steps,
    send: async (state) => {
      const world = createWorld({
        handlers: state.rateExhausted
          ? {
              auth_rate_limit: () =>
                json({
                  allowed: false,
                  limit: 300,
                  remaining: 0,
                  resetAt: Math.floor(NOW / 1000) + 60,
                }),
            }
          : {},
      });
      const jar = await mintJar(
        state.expiredSession
          ? { accessClaims: { exp: Math.floor(NOW / 1000) - 60 } }
          : {},
      );
      return send(world.app, {
        method: 'GET',
        path: `${LIST}${state.query}`,
        jar,
        headers: state.origin === null ? {} : { origin: state.origin },
      });
    },
    accepted: (response) => expect(response.status).toBe(200),
  });
});
