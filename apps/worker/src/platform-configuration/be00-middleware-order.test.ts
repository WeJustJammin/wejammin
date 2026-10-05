import { describe, expect } from 'vitest';

import { registerOrderTests, type OrderStep } from '../be00-order.test-support';
import {
  auditReadRequest,
  bindings,
  capabilityActionRequest,
} from './phase-02-slice-08-worker.fixtures';
import {
  inboxRequest,
  jsonRequest,
} from './phase-02-slice-08-worker.request-support';
import {
  contextFor,
  makeHarness,
  sessionFor,
} from './phase-02-slice-08-worker.test-support';

/*
 * BE00 "Hono Middleware Order" is executable contract. Each platform
 * configuration admin mutation is probed with one request that fails every step
 * from N onward; the response must be the step N refusal.
 */

type State = Readonly<{
  path: string;
  headers: Readonly<Record<string, string | undefined>>;
  body: unknown;
  unauthenticated: boolean;
  noCapability: boolean;
  staleStepUp: boolean;
  rateExhausted: boolean;
}>;

type Operation = Readonly<{
  id: string;
  path: string;
  body: unknown;
  invalidBody: unknown;
  headers: Readonly<Record<string, string>>;
  stepUp: boolean;
  capability: string;
}>;

const OPERATIONS: readonly Operation[] = [
  {
    id: 'CFG-05B-04 capability action',
    path: '/api/v1/admin/capability-grants/actions',
    body: capabilityActionRequest,
    invalidBody: {},
    headers: { 'idempotency-key': 'be00-order-key-04' },
    stepUp: true,
    capability: 'admin.capability.grant',
  },
  {
    id: 'CFG-05B-05 audit diagnostic',
    path: '/api/v1/admin/audit-diagnostics/actions',
    body: auditReadRequest,
    invalidBody: {},
    headers: { 'idempotency-key': 'be00-order-key-05', 'if-match': '"4"' },
    stepUp: false,
    capability: 'admin.audit.read',
  },
];

const withHeaders = (
  state: State,
  headers: Record<string, string | undefined>,
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
    break: (state) =>
      withHeaders(state, {
        cookie: 'wj_session_ref=ref-1; wj_csrf=a',
        'x-csrf-token': 'b',
      }),
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
    status: 400,
    code: 'INVALID_REQUEST',
    break: (state) => ({ ...state, body: operation.invalidBody }),
  },
  {
    name: 'capability',
    status: 403,
    code: 'FORBIDDEN',
    break: (state) => ({ ...state, noCapability: true }),
    check: (_response, body) =>
      expect(body.message).toBe('The named admin capability is required.'),
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
  {
    name: 'idempotency key',
    status: 400,
    code: 'INVALID_REQUEST',
    break: (state) => withHeaders(state, { 'idempotency-key': 'short' }),
  },
];

describe('BE00 middleware order on the platform configuration admin routes', () => {
  for (const operation of OPERATIONS)
    describe(operation.id, () => {
      registerOrderTests<State>({
        family: 'platform-configuration',
        fresh: () => ({
          path: operation.path,
          headers: operation.headers,
          body: operation.body,
          unauthenticated: false,
          noCapability: false,
          staleStepUp: false,
          rateExhausted: false,
        }),
        steps: stepsFor(operation),
        send: (state) => {
          const harness = makeHarness({
            ...(state.unauthenticated
              ? {
                  resolveSession: {
                    ok: false as const,
                    status: 401 as const,
                    code: 'UNAUTHENTICATED',
                    message: 'No session.',
                  },
                }
              : {}),
            session: state.staleStepUp
              ? {
                  ...sessionFor(),
                  stepUpAt: new Date(Date.now() - 3_600_000).toISOString(),
                }
              : sessionFor(),
            requestContext: contextFor(
              state.noCapability ? [] : [operation.capability],
            ),
            ...(state.rateExhausted
              ? {
                  rateLimit: {
                    ok: true as const,
                    value: {
                      allowed: false,
                      limit: 1_000,
                      remaining: 0,
                      resetAt: Math.floor(Date.now() / 1000) + 30,
                    },
                  },
                }
              : {}),
          });
          return Promise.resolve(
            harness.app.fetch(
              jsonRequest(state.path, state.body, state.headers),
              bindings,
            ),
          );
        },
        accepted: (response) => expect(response.ok).toBe(true),
      });
    });
});

type ReadState = Readonly<{
  query: string;
  headers: Readonly<Record<string, string | undefined>>;
  unauthenticated: boolean;
  noCapability: boolean;
  rateExhausted: boolean;
}>;

const readSteps: readonly OrderStep<ReadState>[] = [
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
  {
    name: 'strict query validation',
    status: 400,
    code: 'INVALID_REQUEST',
    break: (state) => ({ ...state, query: '?unexpected=1' }),
  },
  {
    name: 'capability',
    status: 403,
    code: 'FORBIDDEN',
    break: (state) => ({ ...state, noCapability: true }),
  },
  {
    name: 'rate limit',
    status: 429,
    code: 'RATE_LIMITED',
    break: (state) => ({ ...state, rateExhausted: true }),
  },
];

describe('BE00 middleware order on the platform configuration admin read (CFG-05B-01)', () => {
  registerOrderTests<ReadState>({
    family: 'platform-configuration read',
    fresh: () => ({
      query: '',
      headers: {},
      unauthenticated: false,
      noCapability: false,
      rateExhausted: false,
    }),
    steps: readSteps,
    send: (state) => {
      const harness = makeHarness({
        ...(state.unauthenticated
          ? {
              resolveSession: {
                ok: false as const,
                status: 401 as const,
                code: 'UNAUTHENTICATED',
                message: 'No session.',
              },
            }
          : {}),
        requestContext: contextFor(
          state.noCapability ? [] : ['admin.inbox.read'],
        ),
        ...(state.rateExhausted
          ? {
              rateLimit: {
                ok: true as const,
                value: {
                  allowed: false,
                  limit: 1_000,
                  remaining: 0,
                  resetAt: Math.floor(Date.now() / 1000) + 30,
                },
              },
            }
          : {}),
      });
      return Promise.resolve(
        harness.app.fetch(inboxRequest(state.query, state.headers), bindings),
      );
    },
    accepted: (response) => expect(response.status).toBe(200),
  });
});
