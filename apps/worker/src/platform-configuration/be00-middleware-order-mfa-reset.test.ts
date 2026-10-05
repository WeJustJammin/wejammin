import { afterEach, beforeEach, describe, expect, vi } from 'vitest';

import {
  NOW,
  createWorld,
  iso,
  json,
  mintJar,
  send,
} from '../authentication/dec111-composition.test-support';
import { registerOrderTests, type OrderStep } from '../be00-order.test-support';
import {
  BODY,
  CAPABILITY,
  KEY,
  PATH,
  handlers,
} from './phase-02-slice-09-cfg05b06-wire.test-support';

/*
 * BE00 "Hono Middleware Order" for CFG-05B-06 through the production Worker
 * composition (real routes, session verifier, persistence adapter): one request
 * that fails every step from N onward is answered by the step N refusal.
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
  headers: Readonly<Record<string, string | null>>;
  rawBody: string | null;
  body: unknown;
  anonymous: boolean;
  wrongCsrf: boolean;
  noCapability: boolean;
  staleStepUp: boolean;
  rateExhausted: boolean;
}>;

const withHeaders = (
  state: State,
  headers: Record<string, string | null>,
): State => ({ ...state, headers: { ...state.headers, ...headers } });

const steps: readonly OrderStep<State>[] = [
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
    break: (state) => ({ ...state, wrongCsrf: true }),
  },
  {
    name: 'authentication',
    status: 401,
    code: 'UNAUTHENTICATED',
    break: (state) => ({ ...state, anonymous: true }),
  },
  {
    name: 'strict body validation',
    status: 400,
    code: 'INVALID_REQUEST',
    break: (state) => ({ ...state, body: {} }),
  },
  {
    name: 'capability',
    status: 403,
    code: 'FORBIDDEN',
    break: (state) => ({ ...state, noCapability: true }),
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
];

describe('BE00 middleware order on CFG-05B-06 (production composition)', () => {
  registerOrderTests<State>({
    family: 'cfg-05b-06',
    fresh: () => ({
      headers: { 'idempotency-key': KEY },
      rawBody: null,
      body: BODY,
      anonymous: false,
      wrongCsrf: false,
      noCapability: false,
      staleStepUp: false,
      rateExhausted: false,
    }),
    steps,
    send: async (state) => {
      const world = createWorld({
        handlers: handlers(
          state.rateExhausted
            ? {
                auth_rate_limit: (call) =>
                  json({
                    allowed: false,
                    limit: Number(call.body?.p_limit ?? 1),
                    remaining: 0,
                    resetAt: Math.floor(NOW / 1000) + 30,
                  }),
              }
            : {},
          state.noCapability ? [] : [CAPABILITY],
        ),
      });
      // An unauthenticated caller still carries the session cookies (and so a
      // CSRF token): the access token has expired.
      const jar = await mintJar(
        state.anonymous
          ? { accessClaims: { exp: Math.floor(NOW / 1000) - 60 } }
          : state.staleStepUp
            ? { stepUpAt: iso(-601) }
            : {},
      );
      return send(world.app, {
        method: 'POST',
        path: PATH,
        body: state.body,
        jar: { ...jar, csrf: state.wrongCsrf ? 'wrong-token' : jar.csrf },
        headers: state.headers,
      });
    },
    accepted: (response) => expect(response.ok).toBe(true),
  });
});
