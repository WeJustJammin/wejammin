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
  CHALLENGE_ID,
  CLAIM_ID,
  PARTY_ID,
  PERSON_ID,
  createProfileApp,
  failure,
} from './phase-02-slice-05.test-support';

/*
 * BE00 "Hono Middleware Order" is executable contract. Each human profile
 * ownership command is probed with one request that fails every step from N
 * onward; the response must be the step N refusal.
 */

type State = Readonly<{
  path: string;
  query: string;
  headers: Readonly<Record<string, string>>;
  body: unknown;
  unauthenticated: boolean;
  staleStepUp: boolean;
  rateExhausted: boolean;
}>;

type Operation = Readonly<{
  id: string;
  path: string;
  badPath: string | null;
  body: unknown;
  invalidBody: unknown;
  stepUp: boolean;
}>;

const OPERATIONS: readonly Operation[] = [
  {
    id: 'PRF-API-04 start claim',
    path: '/api/v1/party-claims',
    badPath: null,
    body: { targetPartyId: PARTY_ID, claimKind: 'self' },
    invalidBody: { targetPartyId: PARTY_ID, claimKind: 'self', extra: true },
    stepUp: false,
  },
  {
    id: 'PRF-API-06 issue challenge',
    path: `/api/v1/party-claims/${CLAIM_ID}/challenges`,
    badPath: '/api/v1/party-claims/not-a-uuid/challenges',
    body: { method: 'attester_route', attesterPersonId: PERSON_ID },
    invalidBody: { method: 'attester_route', extra: true },
    stepUp: false,
  },
  {
    id: 'PRF-API-07 complete proof',
    path: `/api/v1/party-claims/${CLAIM_ID}/proofs`,
    badPath: '/api/v1/party-claims/not-a-uuid/proofs',
    body: {
      kind: 'challenge_code',
      challengeId: CHALLENGE_ID,
      code: '482901',
      reasonCode: 'claim_proof',
    },
    invalidBody: { kind: 'challenge_code', extra: true },
    stepUp: true,
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
          status: 422,
          code: 'VALIDATION_FAILED',
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
  {
    name: 'idempotency key',
    status: 400,
    code: 'INVALID_REQUEST',
    break: (state) => withHeaders(state, { 'idempotency-key': 'short' }),
  },
];

describe('BE00 middleware order on the profile ownership commands', () => {
  for (const operation of OPERATIONS)
    describe(operation.id, () => {
      registerOrderTests<State>({
        family: 'profile-ownership',
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
            'if-match': '"2"',
          },
          body: operation.body,
          unauthenticated: false,
          staleStepUp: false,
          rateExhausted: false,
        }),
        steps: stepsFor(operation),
        send: (state) => {
          const harness = createProfileApp();
          if (state.unauthenticated)
            vi.mocked(harness.auth.resolveSession).mockImplementation(
              async () => failure(401, 'UNAUTHENTICATED', 'Sign in again.'),
            );
          else if (state.staleStepUp)
            vi.mocked(harness.auth.resolveSession).mockImplementation(
              async () => ({
                ok: true as const,
                value: {
                  ...session,
                  personId: PERSON_ID,
                  actingPartyId: PERSON_ID,
                  stepUpAt: new Date(Date.now() - 3_600_000).toISOString(),
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
                method: 'POST',
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

describe('BE00 step 2 body read on the profile ownership commands', () => {
  const claim = { targetPartyId: PARTY_ID, claimKind: 'self' };
  const post = (body: BodyInit, text?: () => Promise<string>) => {
    const request = new Request(`${ORIGIN}/api/v1/party-claims`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        origin: ORIGIN,
        cookie: `wj_session_ref=slice02-session-ref; wj_csrf=${CSRF}`,
        'x-csrf-token': CSRF,
        'x-request-id': REQUEST_ID,
        'content-type': 'application/json',
        'idempotency-key': 'be00-order-key-01',
        'if-match': '"2"',
      },
      body,
    });
    if (text !== undefined)
      Object.defineProperty(request, 'text', { value: text });
    return createProfileApp().app.fetch(request, bindings);
  };

  it('refuses a streamed body over the ceiling with the maximum in its details', async () => {
    const response = await post(
      JSON.stringify({ ...claim, pad: 'x'.repeat(300_000) }),
    );
    expect(response.status).toBe(413);
    expect(((await response.json()) as { details: unknown }).details).toEqual({
      maxBytes: 256 * 1024,
    });
  });

  it('refuses a body that cannot be read as an invalid request', async () => {
    const response = await post(JSON.stringify(claim), () =>
      Promise.reject(new Error('stream failed')),
    );
    expect(response.status).toBe(400);
    expect(((await response.json()) as { code: string }).code).toBe(
      'INVALID_REQUEST',
    );
  });
});
