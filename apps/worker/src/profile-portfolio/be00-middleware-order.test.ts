import { describe, expect, it, vi } from 'vitest';

import {
  CSRF,
  ORIGIN,
  REQUEST_ID,
  bindings,
  session,
} from '../authentication/phase-02-slice-02.test-fixtures';
import { registerOrderTests, type OrderStep } from '../be00-order.test-support';
import {
  CREDIT_ID,
  MEDIA_ID,
  PARTY_ID,
  REEL_ITEM_ID,
  RIGHTS_ID,
  createProfilePortfolioApp,
} from './phase-02-slice-06.test-support';

/*
 * BE00 "Hono Middleware Order" is executable contract. Each human profile
 * portfolio command is probed with one request that fails every step from N
 * onward; the response must be the step N refusal.
 */

const factRef = {
  sourceType: 'credit',
  sourceId: CREDIT_ID,
  sourceVersion: '3',
} as const;
const mediaRef = {
  sourceType: 'media',
  sourceId: MEDIA_ID,
  sourceVersion: '3',
} as const;
const rightsRef = {
  sourceType: 'media',
  sourceId: RIGHTS_ID,
  sourceVersion: '3',
} as const;
const reelBody = {
  creditRef: factRef,
  mediaRef,
  roleCode: 'performer',
  rightsBasis: 'ownership',
  rightsRef,
  order: 0,
} as const;

type State = Readonly<{
  path: string;
  query: string;
  headers: Readonly<Record<string, string>>;
  body: unknown;
  unauthenticated: boolean;
  rateExhausted: boolean;
}>;

type Operation = Readonly<{
  id: string;
  method: 'POST' | 'PUT';
  path: string;
  badPath: string;
  body: unknown;
  ifMatch: string;
}>;

const OPERATIONS: readonly Operation[] = [
  {
    id: 'PRF-PROF-07 create reel item',
    method: 'POST',
    path: `/api/v1/profiles/${PARTY_ID}/reel-items`,
    badPath: '/api/v1/profiles/not-a-uuid/reel-items',
    body: reelBody,
    ifMatch: '"3"',
  },
  {
    id: 'PRF-PROF-08 update reel item',
    method: 'PUT',
    path: `/api/v1/reel-items/${REEL_ITEM_ID}`,
    badPath: '/api/v1/reel-items/not-a-uuid',
    body: {
      roleCode: 'performer',
      rightsBasis: 'ownership',
      rightsRef,
      order: 0,
      desiredState: 'draft',
    },
    ifMatch: '"3"',
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
  },
  {
    name: 'authentication',
    status: 401,
    code: 'UNAUTHENTICATED',
    break: (state) => ({ ...state, unauthenticated: true }),
  },
  {
    name: 'strict path validation',
    status: 422,
    code: 'VALIDATION_FAILED',
    break: (state) => ({ ...state, path: operation.badPath }),
  },
  {
    name: 'strict body validation',
    status: 422,
    code: 'VALIDATION_FAILED',
    break: (state) => ({
      ...state,
      body: { ...(operation.body as object), extra: true },
    }),
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

describe('BE00 middleware order on the profile portfolio commands', () => {
  for (const operation of OPERATIONS)
    describe(operation.id, () => {
      registerOrderTests<State>({
        family: 'profile-portfolio',
        fresh: () => ({
          path: operation.path,
          query: '',
          headers: {
            accept: 'application/json',
            origin: ORIGIN,
            cookie: `wj_session_ref=slice02-session-ref; wj_csrf=${CSRF}`,
            'x-csrf-token': CSRF,
            'x-request-id': REQUEST_ID,
            'content-type': 'application/json',
            'idempotency-key': 'be00-order-key-01',
            'if-match': operation.ifMatch,
          },
          body: operation.body,
          unauthenticated: false,
          rateExhausted: false,
        }),
        steps: stepsFor(operation),
        send: (state) => {
          const harness = createProfilePortfolioApp();
          if (state.unauthenticated)
            vi.mocked(harness.auth.resolveSession).mockImplementation(
              async () => ({
                ok: false as const,
                status: 401 as const,
                code: 'UNAUTHENTICATED',
                message: 'Sign in again.',
              }),
            );
          else
            vi.mocked(harness.auth.resolveSession).mockImplementation(
              async () => ({
                ok: true as const,
                value: {
                  ...session,
                  personId: PARTY_ID,
                  actingPartyId: PARTY_ID,
                },
              }),
            );
          if (state.rateExhausted)
            vi.mocked(harness.auth.rateLimit).mockImplementation(
              async (input) => ({
                ok: true as const,
                value: {
                  allowed: false,
                  limit: input.limit,
                  remaining: 0,
                  resetAt: Math.floor(Date.now() / 1000) + 30,
                },
              }),
            );
          return Promise.resolve(
            harness.app.fetch(
              new Request(`${ORIGIN}${state.path}${state.query}`, {
                method: operation.method,
                headers: state.headers,
                body: JSON.stringify(state.body),
              }),
              bindings,
            ),
          );
        },
        accepted: (response) => expect(response.ok).toBe(true),
      });
    });
});

describe('BE00 step 2 body read on the profile portfolio commands', () => {
  const post = (body: BodyInit, text?: () => Promise<string>) => {
    const request = new Request(
      `${ORIGIN}/api/v1/profiles/${PARTY_ID}/reel-items`,
      {
        method: 'POST',
        headers: {
          accept: 'application/json',
          origin: ORIGIN,
          cookie: `wj_session_ref=slice02-session-ref; wj_csrf=${CSRF}`,
          'x-csrf-token': CSRF,
          'x-request-id': REQUEST_ID,
          'content-type': 'application/json',
          'idempotency-key': 'be00-order-key-01',
          'if-match': '"3"',
        },
        body,
      },
    );
    if (text !== undefined)
      Object.defineProperty(request, 'text', { value: text });
    return createProfilePortfolioApp().app.fetch(request, bindings);
  };

  it('refuses a streamed body over the ceiling with the maximum in its details', async () => {
    const response = await post(
      JSON.stringify({ ...reelBody, pad: 'x'.repeat(300_000) }),
    );
    expect(response.status).toBe(413);
    expect(((await response.json()) as { details: unknown }).details).toEqual({
      maxBytes: 256 * 1024,
    });
  });

  it('refuses a body that cannot be read as an invalid request', async () => {
    const response = await post(JSON.stringify(reelBody), () =>
      Promise.reject(new Error('stream failed')),
    );
    expect(response.status).toBe(400);
    expect(((await response.json()) as { code: string }).code).toBe(
      'INVALID_REQUEST',
    );
  });
});
