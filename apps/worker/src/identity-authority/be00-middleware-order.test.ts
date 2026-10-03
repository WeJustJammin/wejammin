import { describe, expect } from 'vitest';

import {
  CSRF,
  ORIGIN,
  REQUEST_ID,
  bindings,
} from '../authentication/phase-02-slice-02.test-fixtures';
import {
  createApp,
  failure,
  success,
} from '../authentication/phase-02-slice-02.test-support';
import { registerOrderTests, type OrderStep } from '../be00-order.test-support';

/*
 * BE00 "Hono Middleware Order" is executable contract. Each human identity
 * and relationship mutation is probed with one request that fails every step
 * from N onward; the response must be the step N refusal.
 */

const ORGANIZATION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ASSIGNMENT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

type State = Readonly<{
  path: string;
  headers: Readonly<Record<string, string>>;
  body: unknown;
  unauthenticated: boolean;
  rateExhausted: boolean;
}>;

type Operation = Readonly<{
  id: string;
  method: 'POST' | 'DELETE';
  path: string;
  badPath: string | null;
  body: unknown;
  invalidBody: unknown;
  ifMatch: boolean;
  accepted: number;
}>;

const OPERATIONS: readonly Operation[] = [
  {
    id: 'BE01b-01 create person',
    method: 'POST',
    path: '/api/v1/me/identity',
    badPath: null,
    body: {},
    invalidBody: { ownerPersonId: ORGANIZATION_ID },
    ifMatch: false,
    accepted: 201,
  },
  {
    id: 'BE01b-03 add facet',
    method: 'POST',
    path: '/api/v1/me/facets',
    badPath: null,
    body: { facetCode: 'performer', source: 'self_asserted' },
    invalidBody: { facetCode: 'performer', actorPersonId: ORGANIZATION_ID },
    ifMatch: false,
    accepted: 201,
  },
  {
    id: 'BE01b-04 remove facet',
    method: 'DELETE',
    path: '/api/v1/me/facets/performer',
    badPath: '/api/v1/me/facets/NOT%20A%20FACET',
    body: {},
    invalidBody: { ownerPersonId: ORGANIZATION_ID },
    ifMatch: true,
    accepted: 200,
  },
  {
    id: 'ORG-01 create organization',
    method: 'POST',
    path: '/api/v1/organizations',
    badPath: null,
    body: { mode: 'self_member', typeCodes: ['band'] },
    invalidBody: { mode: 'self_member', ownerPartyId: ORGANIZATION_ID },
    ifMatch: false,
    accepted: 503,
  },
  {
    id: 'TYPE-02 retire organization type',
    method: 'DELETE',
    path: `/api/v1/organizations/${ORGANIZATION_ID}/type-assignments/${ASSIGNMENT_ID}`,
    badPath: `/api/v1/organizations/${ORGANIZATION_ID}/type-assignments/not-a-uuid`,
    body: {},
    invalidBody: { unexpected: true },
    ifMatch: true,
    accepted: 503,
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
    status: 400,
    code: 'INVALID_REQUEST',
    break: (state) => ({ ...state, body: operation.invalidBody }),
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

describe('BE00 middleware order on the identity and relationship routes', () => {
  for (const operation of OPERATIONS)
    describe(operation.id, () => {
      registerOrderTests<State>({
        family: 'identity-authority',
        fresh: () => ({
          path: operation.path,
          headers: {
            accept: 'application/json',
            origin: ORIGIN,
            cookie: `wj_session_ref=slice02-session-ref; wj_csrf=${CSRF}`,
            'x-csrf-token': CSRF,
            'x-request-id': REQUEST_ID,
            'content-type': 'application/json',
            'idempotency-key': 'be00-order-key-01',
            ...(operation.ifMatch ? { 'if-match': '"7"' } : {}),
          },
          body: operation.body,
          unauthenticated: false,
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
              new Request(`${ORIGIN}${state.path}`, {
                method: operation.method,
                headers: state.headers,
                body: JSON.stringify(state.body),
              }),
              bindings,
            ),
          );
        },
        // Admission passes and the request reaches the operation port; the
        // relationship ports are not composed in this harness, so they answer
        // the dependency outage a missing port always answers.
        accepted: (response) =>
          expect(response.status).toBe(operation.accepted),
      });
    });
});
