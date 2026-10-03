import { describe, expect, vi } from 'vitest';

import { registerOrderTests, type OrderStep } from '../be00-order.test-support';
import type { ConfigurationPort } from './types';
import {
  action,
  actionRequest,
  actionResponse,
  defaultRate,
  definitionId,
  makeHarness,
  nextSession,
  proposal,
  proposalRequest,
  proposalResponse,
} from './phase-02-slice-07.test-support';

/*
 * BE00 "Hono Middleware Order" is executable contract. Each human settings
 * mutation (CFG-05A-03 propose, CFG-05A-04 review action) is probed with one
 * request that fails every step from N onward; the response must be the step N
 * refusal.
 */

type State = Readonly<{
  path: string;
  headers: Readonly<Record<string, string | undefined>>;
  body: unknown;
  unauthenticated: boolean;
  staleStepUp: boolean;
  rateExhausted: boolean;
}>;

type Operation = Readonly<{
  id: string;
  body: unknown;
  value: unknown;
  accepted: number;
  build: (
    body: unknown,
    headers: Record<string, string | undefined>,
  ) => Request;
  badPath: string;
}>;

const OPERATIONS: readonly Operation[] = [
  {
    id: 'CFG-05A-03 propose',
    body: proposal,
    value: proposalResponse,
    accepted: 201,
    build: proposalRequest,
    badPath: '/api/v1/admin/settings/not-a-uuid/changes',
  },
  {
    id: 'CFG-05A-04 action',
    body: action,
    value: actionResponse,
    accepted: 200,
    build: actionRequest,
    badPath: '/api/v1/admin/settings/changes/not-a-uuid/actions',
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
    name: 'strict path validation',
    status: 400,
    code: 'INVALID_REQUEST',
    break: (state) => ({ ...state, path: operation.badPath }),
  },
  {
    name: 'strict body validation',
    status: 422,
    code: 'VALIDATION_FAILED',
    break: (state) => ({ ...state, body: {} }),
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

describe('BE00 middleware order on the platform configuration settings mutations', () => {
  for (const operation of OPERATIONS)
    describe(operation.id, () => {
      const template = operation.build(operation.body, {});
      const templatePath = new URL(template.url).pathname;
      registerOrderTests<State>({
        family: 'platform-configuration settings',
        fresh: () => ({
          path: templatePath,
          headers: {
            authorization: 'Bearer verified-session',
            'content-type': 'application/json',
            'idempotency-key': 'be00-order-key-0001',
          },
          body: operation.body,
          unauthenticated: false,
          staleStepUp: false,
          rateExhausted: false,
        }),
        steps: stepsFor(operation),
        send: (state) => {
          const session = nextSession();
          const port = vi.fn<ConfigurationPort>(async () => ({
            ok: true as const,
            value: operation.value,
          })) as ConfigurationPort;
          const harness = makeHarness({
            port,
            session: state.staleStepUp
              ? {
                  ...session,
                  stepUpAt: new Date(Date.now() - 3_600_000).toISOString(),
                }
              : session,
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
            ...(state.rateExhausted
              ? {
                  rateLimit: {
                    ok: true as const,
                    value: {
                      ...(defaultRate() as { value: object }).value,
                      allowed: false,
                      remaining: 0,
                    },
                  } as never,
                }
              : {}),
          });
          const built = operation.build(state.body, state.headers);
          // The request builder always sets a JSON content type, so the
          // state's own content type is applied last.
          const headers = new Headers(built.headers);
          const contentType = state.headers['content-type'];
          if (contentType !== undefined)
            headers.set('content-type', contentType);
          return Promise.resolve(
            harness.app.fetch(
              new Request(new URL(state.path, built.url).toString(), {
                method: 'POST',
                headers,
                body: JSON.stringify(state.body),
              }),
            ),
          );
        },
        accepted: (response) =>
          expect(response.status).toBe(operation.accepted),
      });
    });
});

void definitionId;
