import { afterEach, beforeEach, describe, expect, vi } from 'vitest';

import { registerOrderTests, type OrderStep } from '../be00-order.test-support';
import {
  FACTOR_ID,
  NOW,
  OTHER_FACTOR_ID,
  CHALLENGE_ID,
  createWorld,
  iso,
  json,
  mintJar,
  send,
  type Handler,
} from './dec111-composition.test-support';
import {
  BASE,
  type OperationNumber,
} from './dec111-wire-scenarios.test-support';
import { verifiedFactors } from './phase-02-slice-09-r8.test-support';

/*
 * BE00 "Hono Middleware Order" is executable contract. Every MFA command of
 * the authentication family (AUTH-API-17..21) is probed through the production
 * composition (real routes, session verifier, MFA service, persistence adapter
 * and Supabase MFA provider; only PostgREST and Supabase Auth are faked) with
 * one request that fails every step from N onward; the response must be the
 * step N refusal.
 */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const LIST = '/api/v1/account/mfa/factors';
const EXPIRED_EXP = Math.floor(NOW / 1000) - 60;

type State = Readonly<{
  path: string;
  headers: Readonly<Record<string, string | null>>;
  body: unknown;
  expiredSession: boolean;
  staleStepUp: boolean;
  rateExhausted: boolean;
  csrf: string | null;
}>;

type Operation = Readonly<{
  op: OperationNumber;
  id: string;
  badPath: string | null;
  invalidBody: unknown;
  stepUp: boolean;
  idempotency: boolean;
  ifMatch: boolean;
  handlers: Readonly<Record<string, Handler>>;
}>;

const OPERATIONS: readonly Operation[] = [
  {
    op: 17,
    id: 'AUTH-API-17 start enrollment',
    badPath: null,
    invalidBody: { method: 'totp', unknown: true },
    stepUp: false,
    idempotency: false,
    ifMatch: true,
    handlers: {},
  },
  {
    op: 18,
    id: 'AUTH-API-18 verify enrollment',
    badPath: `${LIST}/not-a-uuid/verify`,
    invalidBody: { code: '123456', unknown: true },
    stepUp: false,
    idempotency: false,
    ifMatch: true,
    handlers: verifiedFactors(),
  },
  {
    op: 19,
    id: 'AUTH-API-19 remove factor',
    badPath: `${LIST}/not-a-uuid`,
    invalidBody: { reason: 'user_request', unknown: true },
    // The removal's step-up depends on the persisted target state (only a
    // verified factor needs a fresh proof), so the service decides it after
    // quota; BE00 step 7 does not say whether that precedes the quota, see
    // needs ruling in the lane report. It is asserted in the r14 step-up file.
    stepUp: false,
    idempotency: true,
    ifMatch: true,
    handlers: verifiedFactors(),
  },
  {
    op: 20,
    id: 'AUTH-API-20 step-up challenge',
    badPath: null,
    invalidBody: { method: 'totp', unknown: true },
    stepUp: false,
    idempotency: false,
    ifMatch: false,
    handlers: verifiedFactors(),
  },
  {
    op: 21,
    id: 'AUTH-API-21 step-up verify',
    badPath: '/api/v1/auth/step-up/challenges/not-a-uuid/verify',
    invalidBody: { code: '123456', unknown: true },
    stepUp: false,
    idempotency: false,
    ifMatch: false,
    handlers: verifiedFactors(),
  },
];

const withHeaders = (
  state: State,
  headers: Record<string, string | null>,
): State => ({ ...state, headers: { ...state.headers, ...headers } });

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
  },
  {
    name: 'authentication',
    status: 401,
    code: 'UNAUTHENTICATED',
    break: (state) => ({ ...state, expiredSession: true }),
  },
  ...(operation.badPath === null
    ? []
    : [
        {
          name: 'strict path validation',
          status: 400,
          code: 'INVALID_REQUEST',
          break: (state: State): State => ({
            ...state,
            path: operation.badPath as string,
          }),
        },
      ]),
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
  ...(operation.ifMatch
    ? [
        {
          name: 'If-Match',
          status: 400,
          code: 'INVALID_REQUEST',
          break: (state: State): State =>
            withHeaders(state, { 'if-match': 'not-quoted' }),
        },
      ]
    : []),
];

describe('BE00 middleware order on the MFA commands (AUTH-API-17..21)', () => {
  for (const operation of OPERATIONS)
    describe(operation.id, () => {
      const base = BASE[operation.op];
      registerOrderTests<State>({
        family: 'authentication mfa',
        fresh: () => ({
          path: base.path,
          headers: {},
          body: base.body,
          expiredSession: false,
          staleStepUp: false,
          rateExhausted: false,
          csrf: null,
        }),
        steps: stepsFor(operation),
        send: async (state) => {
          const world = createWorld({
            handlers: {
              ...operation.handlers,
              ...(state.rateExhausted
                ? {
                    auth_rate_limit: () =>
                      json({
                        allowed: false,
                        limit: 5,
                        remaining: 0,
                        resetAt: Math.floor(NOW / 1000) + 60,
                      }),
                  }
                : {}),
            },
          });
          const jar = await mintJar({
            ...(state.staleStepUp ? { stepUpAt: iso(-601) } : {}),
            ...(state.expiredSession
              ? { accessClaims: { exp: EXPIRED_EXP } }
              : {}),
          });
          return send(world.app, {
            method: base.method,
            path: state.path,
            body: state.body,
            jar,
            headers: { ...base.headers, ...state.headers },
          });
        },
        accepted: (response) => expect(response.ok).toBe(true),
      });
    });
});

void FACTOR_ID;
void OTHER_FACTOR_ID;
void CHALLENGE_ID;
