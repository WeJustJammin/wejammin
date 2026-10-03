import { describe, expect, it, vi } from 'vitest';

import type { UploadCompletionPorts } from '@wejammin/application';
import { registerOrderTests, type OrderStep } from '../be00-order.test-support';
import {
  ACTOR_ID,
  INTENT_ID,
  NOW,
  createHarness,
  makeRouteDependencies,
  requestBody,
  requestFor,
} from './upload-intent-completion.test-support';

/*
 * BE00 "Hono Middleware Order" is executable contract. INF-API-03 (upload
 * completion) is probed with one request that fails every step from N onward;
 * the response must be the step N refusal.
 */

type State = Readonly<{
  intentId: string;
  query: string;
  headers: Readonly<Record<string, string>>;
  body: unknown;
  unauthenticated: boolean;
  rateExhausted: boolean;
}>;

const withHeaders = (state: State, headers: Record<string, string>): State => ({
  ...state,
  headers: { ...state.headers, ...headers },
});

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
    break: (state) => ({ ...state, query: '?page=1' }),
  },
  {
    name: 'strict path validation',
    status: 400,
    code: 'INVALID_REQUEST',
    break: (state) => ({ ...state, intentId: 'not-a-uuid' }),
  },
  {
    name: 'strict body validation',
    status: 400,
    code: 'INVALID_REQUEST',
    break: (state) => ({
      ...state,
      body: { ...(state.body as object), extra: true },
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

const send = (state: State): Promise<Response> => {
  const route = makeRouteDependencies({
    resolveSession: vi.fn(async () =>
      state.unauthenticated ? null : { userId: ACTOR_ID },
    ),
    rateLimit: vi.fn(async () => ({
      allowed: !state.rateExhausted,
      limit: 60,
      remaining: state.rateExhausted ? 0 : 59,
      resetAt: Math.floor(NOW / 1_000) + 60,
      scope: 'user' as const,
    })),
  });
  const template = requestFor(state.body);
  const url = template.url.replace(INTENT_ID, state.intentId) + state.query;
  const headers = new Headers(template.headers);
  for (const [name, value] of Object.entries(state.headers))
    headers.set(name, value);
  return Promise.resolve(
    createHarness(route).request(
      new Request(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(state.body),
      }),
    ),
  );
};

describe('BE00 middleware order on the upload completion command (INF-API-03)', () => {
  registerOrderTests<State>({
    family: 'upload-completion',
    fresh: () => ({
      intentId: INTENT_ID,
      query: '',
      headers: {},
      body: requestBody,
      unauthenticated: false,
      rateExhausted: false,
    }),
    steps,
    send,
    accepted: (response) => expect(response.status).toBe(202),
  });

  it('answers a refused request before the session, quota and ports are touched', async () => {
    const route = makeRouteDependencies();
    const response = await createHarness(route).request(
      requestFor(requestBody, { origin: 'https://evil.example.test' }),
    );
    expect(response.status).toBe(403);
    expect(route.resolveSession).not.toHaveBeenCalled();
    expect(route.rateLimit).not.toHaveBeenCalled();
    expect(
      (route.ports as UploadCompletionPorts).persistence.readIntent,
    ).not.toHaveBeenCalled();
  });
});
