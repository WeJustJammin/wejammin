import { describe, expect, it, vi } from 'vitest';

import { registerOrderTests, type OrderStep } from '../be00-order.test-support';
import {
  createUploadIntentHandler,
  type UploadPrincipal,
  type UploadTargetPolicy,
} from './upload-intent';
import { UPLOAD_INTENT_BROWSER_HEADERS } from './upload-intent.test-support';

/*
 * BE00 "Hono Middleware Order" is executable contract. INF-API-02 (upload
 * intent creation) is probed with one request that fails every step from N
 * onward; the response must be the step N refusal.
 */

const ACTOR = '11111111-1111-4111-8111-111111111111';
const PARTY = '22222222-2222-4222-8222-222222222222';
const TARGET = '33333333-3333-4333-8333-333333333333';
const INTENT = '44444444-4444-4444-8444-444444444444';
const OBJECT = '55555555-5555-4555-8555-555555555555';
const signedUrl = `https://storage.local/upload/${OBJECT}?token=token`;

const policy: UploadTargetPolicy = {
  allowedMediaTypes: ['audio/mpeg'],
  immutable: false,
  maxBytes: 100_000,
  purposes: ['demo'],
};

const principal: UploadPrincipal = {
  actingPartyId: PARTY,
  actorId: ACTOR,
  capabilities: ['upload.create'],
  kind: 'acting_party',
  reason: null,
  stepUpVerified: false,
};

const validBody = {
  byteSize: 12_345,
  checksum: { algorithm: 'sha256', value: 'a'.repeat(64) },
  mediaType: 'audio/mpeg',
  purpose: 'demo',
  targetId: TARGET,
  targetType: 'recording',
};

type State = Readonly<{
  headers: Readonly<Record<string, string>>;
  body: unknown;
  unauthenticated: boolean;
  forbiddenTarget: boolean;
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
    name: 'target authorization',
    status: 403,
    code: 'FORBIDDEN',
    break: (state) => ({ ...state, forbiddenTarget: true }),
  },
  {
    name: 'idempotency key',
    status: 400,
    code: 'INVALID_REQUEST',
    break: (state) => withHeaders(state, { 'idempotency-key': 'short' }),
  },
];

const send = (state: State): Promise<Response> => {
  const handler = createUploadIntentHandler({
    authorizeTarget: vi.fn(async () =>
      state.forbiddenTarget ? ('forbidden' as const) : ('allow' as const),
    ),
    environment: 'local',
    now: () => Date.parse('2026-08-30T12:00:00.000Z'),
    policies: { recording: policy },
    randomUUID: () => OBJECT,
    rateLimit: vi.fn(async () => ({
      allowed: !state.rateExhausted,
      limit: 20,
      remaining: state.rateExhausted ? 0 : 19,
      resetAt: 1_756_563_600,
    })),
    repository: {
      createIntent: vi.fn(async () => ({
        kind: 'created' as const,
        resource: {
          id: INTENT,
          object: {
            id: OBJECT,
            objectKey: `objects/${OBJECT}`,
            state: 'pending_upload' as const,
            version: '1',
          },
          upload: {
            allowedMediaTypes: ['audio/mpeg'],
            expiresAt: '2026-08-30T12:15:00.000Z',
            maxBytes: 100_000,
            method: 'PUT' as const,
            signedUrl,
          },
        },
      })),
    },
    resolvePrincipal: vi.fn(async () =>
      state.unauthenticated ? null : principal,
    ),
    storage: {
      sign: vi.fn(async (input) => ({
        allowedMediaTypes: input.allowedMediaTypes,
        expiresAt: input.expiresAt,
        maxBytes: input.maxBytes,
        method: 'PUT' as const,
        signedUrl,
      })),
    },
  });
  return Promise.resolve(
    handler(
      new Request('https://api.example.test/api/v1/upload-intents', {
        method: 'POST',
        headers: state.headers,
        body: JSON.stringify(state.body),
      }),
    ),
  );
};

describe('BE00 middleware order on the upload intent command (INF-API-02)', () => {
  registerOrderTests<State>({
    family: 'upload-admission',
    fresh: () => ({
      headers: {
        ...UPLOAD_INTENT_BROWSER_HEADERS,
        'content-type': 'application/json',
        'idempotency-key': 'upload-key-1',
        'if-match': '"7"',
      },
      body: validBody,
      unauthenticated: false,
      forbiddenTarget: false,
      rateExhausted: false,
    }),
    steps,
    send,
    accepted: (response) => expect(response.ok).toBe(true),
  });

  it('does not resolve the principal for a refused origin', async () => {
    const resolvePrincipal = vi.fn(async () => principal);
    const handler = createUploadIntentHandler({
      authorizeTarget: vi.fn(async () => 'allow' as const),
      environment: 'local',
      policies: { recording: policy },
      rateLimit: vi.fn(),
      repository: { createIntent: vi.fn() },
      resolvePrincipal,
    });
    const response = await handler(
      new Request('https://api.example.test/api/v1/upload-intents', {
        method: 'POST',
        headers: {
          ...UPLOAD_INTENT_BROWSER_HEADERS,
          origin: 'https://evil.example.test',
          'content-type': 'application/json',
        },
        body: JSON.stringify(validBody),
      }),
    );
    expect(response.status).toBe(403);
    expect(resolvePrincipal).not.toHaveBeenCalled();
  });
});
