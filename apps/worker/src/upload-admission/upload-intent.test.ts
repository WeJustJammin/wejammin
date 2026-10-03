import { describe, expect, it, vi } from 'vitest';

import {
  createUploadIntentHandler,
  type UploadAdmissionRepository,
  type UploadIntentCreateInput,
  type UploadIntentHandlerOptions,
  type UploadPrincipal,
  type UploadTargetPolicy,
} from './upload-intent';
import { UPLOAD_INTENT_BROWSER_HEADERS } from './upload-intent.test-support';

const ACTOR = '11111111-1111-4111-8111-111111111111';
const PARTY = '22222222-2222-4222-8222-222222222222';
const TARGET = '33333333-3333-4333-8333-333333333333';
const INTENT = '44444444-4444-4444-8444-444444444444';
const OBJECT = '55555555-5555-4555-8555-555555555555';

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

const resource = {
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
    signedUrl: `https://storage.local/upload/${OBJECT}?token=${OBJECT}`,
  },
};

const jsonRequest = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('https://api.example.test/api/v1/upload-intents', {
    body: JSON.stringify(body),
    headers: {
      ...UPLOAD_INTENT_BROWSER_HEADERS,
      'content-type': 'application/json',
      'idempotency-key': 'upload-key-1',
      'if-match': '"7"',
      ...headers,
    },
    method: 'POST',
  });

const body = (overrides: Record<string, unknown> = {}) => ({
  byteSize: 12_345,
  checksum: { algorithm: 'sha256', value: 'a'.repeat(64) },
  mediaType: 'AUDIO/MPEG',
  purpose: 'demo',
  targetId: TARGET,
  targetType: 'recording',
  ...overrides,
});

const repository = (overrides: Partial<UploadAdmissionRepository> = {}) => ({
  createIntent: vi.fn(async () => ({ kind: 'created' as const, resource })),
  ...overrides,
});

const make = (overrides: Partial<UploadIntentHandlerOptions> = {}) =>
  createUploadIntentHandler({
    authorizeTarget: vi.fn(async () => 'allow' as const),
    environment: 'local',
    now: () => Date.parse('2026-08-30T12:00:00.000Z'),
    policies: { recording: policy },
    randomUUID: () => OBJECT,
    rateLimit: vi.fn(async () => ({
      allowed: true,
      limit: 20,
      remaining: 19,
      resetAt: 1_756_560_000 + 3_600,
    })),
    repository: repository(),
    resolvePrincipal: vi.fn(async () => principal),
    storage: {
      sign: vi.fn(async (input) => ({
        allowedMediaTypes: input.allowedMediaTypes,
        expiresAt: input.expiresAt,
        maxBytes: input.maxBytes,
        method: 'PUT' as const,
        signedUrl: `https://storage.local/upload/${input.objectId}?token=${OBJECT}`,
      })),
    },
    ...overrides,
  });

const read = async (response: Response) => response.json();

describe('upload-intent Worker boundary', () => {
  it('authenticates, authorizes, signs before commit, and returns the exact safe resource', async () => {
    const calls: string[] = [];
    const store = repository({
      createIntent: vi.fn(async (input) => {
        calls.push(`commit:${input.objectKey}`);
        return { kind: 'created' as const, resource };
      }),
    });
    const storage = {
      sign: vi.fn(async (input) => {
        calls.push(`sign:${input.objectKey}`);
        return {
          allowedMediaTypes: input.allowedMediaTypes,
          expiresAt: input.expiresAt,
          maxBytes: input.maxBytes,
          method: 'PUT' as const,
          signedUrl: `https://storage.local/upload/${input.objectId}?token=${OBJECT}`,
        };
      }),
    };
    const response = await createUploadIntentHandler({
      authorizeTarget: vi.fn(async () => 'allow' as const),
      environment: 'local',
      now: () => Date.parse('2026-08-30T12:00:00.000Z'),
      policies: { recording: policy },
      randomUUID: () => OBJECT,
      rateLimit: vi.fn(async () => ({
        allowed: true,
        limit: 20,
        remaining: 19,
        resetAt: 1_756_563_600,
      })),
      repository: store,
      resolvePrincipal: vi.fn(async () => principal),
      storage,
    })(jsonRequest(body()));

    expect(response.status).toBe(201);
    expect(await read(response)).toEqual(resource);
    expect(response.headers.get('location')).toBe(
      `/api/v1/upload-intents/${INTENT}`,
    );
    expect(response.headers.get('etag')).toBe('"1"');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(calls[0]).toMatch(/^sign:objects\//);
    expect(calls[1]).toMatch(/^commit:objects\//);
    expect(storage.sign).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: ACTOR, targetId: TARGET }),
      expect.any(AbortSignal),
    );
    expect(store.createIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: ACTOR,
        idempotencyKeyHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        requestHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
      expect.any(AbortSignal),
    );
  });

  it('rejects malformed JSON, unsupported content, unknown fields, and invalid headers before dependencies', async () => {
    const resolvePrincipal = vi.fn(async () => principal);
    const handler = make({ resolvePrincipal });
    const malformed = new Request(
      'https://api.example.test/api/v1/upload-intents',
      {
        body: '{',
        headers: {
          ...UPLOAD_INTENT_BROWSER_HEADERS,
          'content-type': 'application/json',
          'idempotency-key': 'upload-key-1',
          'if-match': '"7"',
        },
        method: 'POST',
      },
    );
    expect((await handler(malformed)).status).toBe(400);
    expect(
      (await handler(jsonRequest(body(), { 'content-type': 'text/plain' })))
        .status,
    ).toBe(415);
    expect(
      (await handler(jsonRequest({ ...body(), extra: true }))).status,
    ).toBe(400);
    expect(
      (await handler(jsonRequest(body(), { 'idempotency-key': ' short' })))
        .status,
    ).toBe(400);
    expect(
      (await handler(jsonRequest(body(), { 'if-match': '7' }))).status,
    ).toBe(400);
    expect(
      (await handler(jsonRequest(body(), { 'content-length': 'not-a-number' })))
        .status,
    ).toBe(400);
    expect(
      (await handler(jsonRequest(body(), { 'content-length': '999999' })))
        .status,
    ).toBe(413);
    const unreadable = new Request(
      'https://api.example.test/api/v1/upload-intents',
      {
        body: JSON.stringify(body()),
        headers: {
          ...UPLOAD_INTENT_BROWSER_HEADERS,
          'content-type': 'application/json',
          'idempotency-key': 'upload-key-1',
          'if-match': '"7"',
        },
        method: 'POST',
      },
    );
    Object.defineProperty(unreadable, 'body', {
      value: {
        getReader: () => ({
          read: () => {
            throw new Error('body unavailable');
          },
          releaseLock: () => undefined,
        }),
      },
    });
    expect((await handler(unreadable)).status).toBe(400);
    // BE00: transport refusals (type, declared size, unreadable body) precede
    // the session; JSON syntax, unknown keys and the concurrency headers follow
    // it, so the session was resolved for exactly those four requests.
    expect(resolvePrincipal).toHaveBeenCalledTimes(4);
  });

  it('returns semantic validation errors without target lookup', async () => {
    const authorizeTarget = vi.fn(async () => 'allow' as const);
    const handler = make({ authorizeTarget });
    for (const candidate of [
      body({ targetType: 'unknown' }),
      body({ targetType: 'BadType' }),
      body({ targetId: 'bad' }),
      body({ purpose: 'wrong' }),
      body({ mediaType: 'video/mp4' }),
      body({ byteSize: 0 }),
      body({ byteSize: 100_001 }),
      body({ checksum: { algorithm: 'md5', value: 'a'.repeat(64) } }),
      body({ checksum: { algorithm: 'sha256', value: 'A'.repeat(64) } }),
    ]) {
      expect(
        (await handler(jsonRequest(candidate))).status,
      ).toBeGreaterThanOrEqual(400);
    }
    expect(authorizeTarget).not.toHaveBeenCalled();
  });

  it('accepts an immutable new target without If-Match and enforces operator authority', async () => {
    const immutablePolicy = { ...policy, immutable: true };
    const immutable = make({ policies: { recording: immutablePolicy } });
    const response = await immutable(jsonRequest(body(), { 'if-match': '' }));
    expect(response.status).toBe(400);
    const withoutIfMatch = new Request(
      'https://api.example.test/api/v1/upload-intents',
      {
        body: JSON.stringify(body()),
        headers: {
          ...UPLOAD_INTENT_BROWSER_HEADERS,
          'content-type': 'application/json',
          'idempotency-key': 'upload-key-1',
        },
        method: 'POST',
      },
    );
    expect(
      await immutable(withoutIfMatch).then((result) => result.status),
    ).toBe(201);

    const operator = {
      ...principal,
      capabilities: ['other.capability'],
      kind: 'operator' as const,
      reason: 'review',
      stepUpVerified: true,
    };
    expect(
      (
        await make({ resolvePrincipal: vi.fn(async () => operator) })(
          jsonRequest(body()),
        )
      ).status,
    ).toBe(403);
  });

  it('fails closed for anonymous, concealed, forbidden, and rate-limited targets', async () => {
    expect(
      (
        await make({ resolvePrincipal: vi.fn(async () => null) })(
          jsonRequest(body()),
        )
      ).status,
    ).toBe(401);
    for (const decision of [
      'not_found',
      'forbidden',
      'step_up_required',
    ] as const) {
      expect(
        (
          await make({
            authorizeTarget: vi.fn(async () => decision),
          })(jsonRequest(body()))
        ).status,
      ).toBe(
        decision === 'not_found' ? 404 : decision === 'forbidden' ? 403 : 403,
      );
    }
    expect(
      (
        await make({
          rateLimit: vi.fn(async () => ({
            allowed: false,
            limit: 20,
            remaining: 0,
            resetAt: 1_800_000_000,
            retryAfterSeconds: 22,
          })),
        })(jsonRequest(body()))
      ).headers.get('retry-after'),
    ).toBe('22');
  });

  it('replays an idempotent result and reports a mismatched binding without a second commit', async () => {
    const replay = repository({
      createIntent: vi.fn(async () => ({ kind: 'replay' as const, resource })),
    });
    const replayResponse = await make({ repository: replay })(
      jsonRequest(body()),
    );
    expect(replayResponse.status).toBe(201);
    expect(await read(replayResponse)).toEqual(resource);
    const conflict = repository({
      createIntent: vi.fn(async () => ({ kind: 'conflict' as const })),
    });
    const conflictResponse = await make({ repository: conflict })(
      jsonRequest(body()),
    );
    expect(conflictResponse.status).toBe(409);
    expect(((await read(conflictResponse)) as { code: string }).code).toBe(
      'CONFLICT',
    );
  });

  it('keeps the normalized request hash stable when server-generated object IDs differ', async () => {
    const createIntent = vi.fn(async () => ({
      kind: 'created' as const,
      resource,
    }));
    let sequence = 0;
    const handler = make({
      randomUUID: () => {
        sequence += 1;
        return sequence === 1 ? OBJECT : '66666666-6666-4666-8666-666666666666';
      },
      repository: { createIntent },
    });
    await handler(jsonRequest(body()));
    await handler(jsonRequest(body()));
    expect(createIntent).toHaveBeenCalledTimes(2);
    const calls = createIntent.mock.calls as unknown as Array<
      [UploadIntentCreateInput, AbortSignal]
    >;
    expect(calls[0]?.[0].requestHash).toBe(calls[1]?.[0].requestHash);
  });
});
