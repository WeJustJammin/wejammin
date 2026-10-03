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
const ALIAS_ID = '66666666-6666-4666-8666-666666666666';
const OFFER_ID = '77777777-7777-4777-8777-777777777777';
const PARTY_ID = '88888888-8888-4888-8888-888888888888';
const CONTEXT_ID = '99999999-9999-4999-8999-999999999999';
const TENURE_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const PERSON_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const TERMS_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const EVIDENCE_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

type State = Readonly<{
  path: string;
  headers: Readonly<Record<string, string>>;
  body: unknown;
  unauthenticated: boolean;
  rateExhausted: boolean;
}>;

type Operation = Readonly<{
  id: string;
  method: 'POST' | 'PATCH' | 'DELETE';
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
  {
    id: 'BE01b-05 create alias',
    method: 'POST',
    path: '/api/v1/aliases',
    badPath: null,
    body: {
      displayName: 'Neon Harbor',
      handle: 'neon.harbor',
      publicLinkState: 'public',
    },
    invalidBody: { displayName: 'Neon Harbor', ownerPersonId: PARTY_ID },
    ifMatch: false,
    accepted: 201,
  },
  {
    id: 'BE01b-06 patch alias',
    method: 'PATCH',
    path: `/api/v1/aliases/${ALIAS_ID}`,
    badPath: '/api/v1/aliases/not-a-uuid',
    body: { displayName: 'Neon Harbor Live' },
    invalidBody: { displayName: 'Neon Harbor Live', ownerPersonId: PARTY_ID },
    ifMatch: true,
    accepted: 200,
  },
  {
    id: 'BE01b-07 change alias handle',
    method: 'POST',
    path: `/api/v1/aliases/${ALIAS_ID}/handle-changes`,
    badPath: '/api/v1/aliases/not-a-uuid/handle-changes',
    body: { handle: 'neon-harbor' },
    invalidBody: { handle: 'neon-harbor', ownerPersonId: PARTY_ID },
    ifMatch: true,
    accepted: 200,
  },
  {
    id: 'BE01b-08 retire alias',
    method: 'POST',
    path: `/api/v1/aliases/${ALIAS_ID}/retire`,
    badPath: '/api/v1/aliases/not-a-uuid/retire',
    body: {},
    invalidBody: { ownerPersonId: PARTY_ID },
    ifMatch: true,
    accepted: 200,
  },
  {
    id: 'BE01b-09 create transfer offer',
    method: 'POST',
    path: `/api/v1/aliases/${ALIAS_ID}/transfer-offers`,
    badPath: '/api/v1/aliases/not-a-uuid/transfer-offers',
    body: { recipientPersonId: PARTY_ID },
    invalidBody: { recipientPersonId: PARTY_ID, ownerPersonId: PARTY_ID },
    ifMatch: true,
    accepted: 201,
  },
  {
    id: 'BE01b-10 accept transfer offer',
    method: 'POST',
    path: `/api/v1/alias-transfer-offers/${OFFER_ID}/accept`,
    badPath: '/api/v1/alias-transfer-offers/not-a-uuid/accept',
    body: {},
    invalidBody: { ownerPersonId: PARTY_ID },
    ifMatch: true,
    accepted: 200,
  },
  {
    id: 'BE01b-11 decline transfer offer',
    method: 'POST',
    path: `/api/v1/alias-transfer-offers/${OFFER_ID}/decline`,
    badPath: '/api/v1/alias-transfer-offers/not-a-uuid/decline',
    body: {},
    invalidBody: { ownerPersonId: PARTY_ID },
    ifMatch: true,
    accepted: 200,
  },
  {
    id: 'BE01b-13 bind acting context',
    method: 'POST',
    path: '/api/v1/me/acting-context-bindings',
    badPath: null,
    body: {
      contextId: CONTEXT_ID,
      deliberateConfirmation: true,
      clientBindingId: 'tab-a',
    },
    invalidBody: { contextId: CONTEXT_ID, actorPersonId: PARTY_ID },
    ifMatch: false,
    accepted: 201,
  },
  {
    id: 'TYPE-01 add organization type',
    method: 'POST',
    path: `/api/v1/organizations/${ORGANIZATION_ID}/type-assignments`,
    badPath: '/api/v1/organizations/not-a-uuid/type-assignments',
    body: { typeCode: 'label' },
    invalidBody: { typeCode: 'label', ownerPartyId: PARTY_ID },
    ifMatch: true,
    accepted: 503,
  },
  {
    id: 'MEM-01 invite membership',
    method: 'POST',
    path: `/api/v1/organizations/${ORGANIZATION_ID}/membership-invitations`,
    badPath: '/api/v1/organizations/not-a-uuid/membership-invitations',
    body: {
      personId: PERSON_ID,
      startsOn: '2026-09-01',
      termsVersionId: TERMS_ID,
      governanceMode: 'governed',
      capacity: 'permanent',
      inviteExpiresAt: new Date(Date.now() + 14 * 86_400_000).toISOString(),
    },
    invalidBody: { personId: PERSON_ID, ownerPartyId: PARTY_ID },
    ifMatch: true,
    accepted: 503,
  },
  {
    id: 'MEM-02 assert membership',
    method: 'POST',
    path: `/api/v1/organizations/${ORGANIZATION_ID}/membership-assertions`,
    badPath: '/api/v1/organizations/not-a-uuid/membership-assertions',
    body: {
      personId: PERSON_ID,
      startsOn: '2024-01-01',
      provenance: 'historical_assertion',
      evidenceRef: EVIDENCE_ID,
    },
    invalidBody: { personId: PERSON_ID, ownerPartyId: PARTY_ID },
    ifMatch: true,
    accepted: 503,
  },
  {
    id: 'MEM-03 accept membership',
    method: 'POST',
    path: `/api/v1/membership-tenures/${TENURE_ID}/accept`,
    badPath: '/api/v1/membership-tenures/not-a-uuid/accept',
    body: {
      termsVersionId: TERMS_ID,
      termsHash: 'a'.repeat(64),
      decision: 'accept',
    },
    invalidBody: { termsVersionId: TERMS_ID, ownerPartyId: PARTY_ID },
    ifMatch: true,
    accepted: 503,
  },
  {
    id: 'MEM-04 end membership',
    method: 'POST',
    path: `/api/v1/membership-tenures/${TENURE_ID}/end`,
    badPath: '/api/v1/membership-tenures/not-a-uuid/end',
    body: { mode: 'now', reasonCode: 'AUTHORITY_WITHDRAWN' },
    invalidBody: { mode: 'now', ownerPartyId: PARTY_ID },
    ifMatch: true,
    accepted: 503,
  },
  {
    id: 'MEM-05 add capacity period',
    method: 'POST',
    path: `/api/v1/membership-tenures/${TENURE_ID}/capacity-periods`,
    badPath: '/api/v1/membership-tenures/not-a-uuid/capacity-periods',
    body: { capacity: 'touring', startsOn: '2026-09-01', endsOn: '2026-10-01' },
    invalidBody: { capacity: 'touring', ownerPartyId: PARTY_ID },
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

type ReadOperation = Readonly<{
  id: string;
  path: string;
  badPath: string | null;
  protectedRead: boolean;
  accepted: number;
}>;

const READS: readonly ReadOperation[] = [
  {
    id: 'BE01b-02 read own identity',
    path: '/api/v1/me/identity',
    badPath: null,
    protectedRead: true,
    accepted: 200,
  },
  {
    id: 'BE01b-12 list acting contexts',
    path: '/api/v1/me/acting-contexts',
    badPath: null,
    protectedRead: true,
    accepted: 200,
  },
  {
    id: 'BE01b-18 public projection',
    path: `/api/v1/identity/parties/${PARTY_ID}/projection`,
    badPath: '/api/v1/identity/parties/not-a-uuid/projection',
    protectedRead: false,
    accepted: 200,
  },
  {
    id: 'ORG-02 public organization',
    path: `/api/v1/organizations/${ORGANIZATION_ID}`,
    badPath: '/api/v1/organizations/not-a-uuid',
    protectedRead: false,
    accepted: 503,
  },
  {
    id: 'MEM-06 memberships',
    path: `/api/v1/organizations/${ORGANIZATION_ID}/memberships`,
    badPath: '/api/v1/organizations/not-a-uuid/memberships',
    protectedRead: true,
    accepted: 503,
  },
];

type ReadState = Readonly<{
  path: string;
  query: string;
  headers: Readonly<Record<string, string>>;
  unauthenticated: boolean;
  rateExhausted: boolean;
}>;

const readSteps = (
  operation: ReadOperation,
): readonly OrderStep<ReadState>[] => [
  {
    name: 'CORS origin allowlist',
    status: 403,
    code: 'FORBIDDEN',
    break: (state) => ({
      ...state,
      headers: { ...state.headers, origin: 'https://evil.example.test' },
    }),
  },
  ...(operation.protectedRead
    ? [
        {
          name: 'authentication',
          status: 401,
          code: 'UNAUTHENTICATED',
          break: (state: ReadState): ReadState => ({
            ...state,
            unauthenticated: true,
          }),
        },
      ]
    : []),
  {
    name: 'strict query validation',
    status: 400,
    code: 'INVALID_REQUEST',
    break: (state) => ({ ...state, query: '?unexpected=1' }),
  },
  ...(operation.badPath === null
    ? []
    : [
        {
          name: 'strict path validation',
          status: 400,
          code: 'INVALID_REQUEST',
          break: (state: ReadState): ReadState => ({
            ...state,
            path: operation.badPath as string,
          }),
        },
      ]),
  {
    name: 'rate limit',
    status: 429,
    code: 'RATE_LIMITED',
    break: (state) => ({ ...state, rateExhausted: true }),
  },
];

describe('BE00 middleware order on the identity and relationship reads', () => {
  for (const operation of READS)
    describe(operation.id, () => {
      registerOrderTests<ReadState>({
        family: 'identity-authority',
        fresh: () => ({
          path: operation.path,
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
        steps: readSteps(operation),
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
        accepted: (response) =>
          expect(response.status).toBe(operation.accepted),
      });
    });
});
