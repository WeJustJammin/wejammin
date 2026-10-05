import { describe, expect, it, vi } from 'vitest';

import {
  createUploadIntentHandler,
  type UploadAdmissionRepository,
  type UploadIntentHandlerOptions,
  type UploadPrincipal,
  type UploadTargetPolicy,
} from './upload-intent';
import { UPLOAD_INTENT_BROWSER_HEADERS } from './upload-intent.test-support';
import { UploadBodyReadAbortedError } from './upload-intent-body';

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

const repository = (
  overrides: Partial<UploadAdmissionRepository> = {},
): UploadAdmissionRepository => ({
  createIntent: vi.fn(async () => ({ kind: 'created' as const, resource })),
  ...overrides,
});

const request = (overrides: Record<string, unknown> = {}) =>
  new Request('https://api.example.test/api/v1/upload-intents', {
    body: JSON.stringify({
      byteSize: 12_345,
      checksum: { algorithm: 'sha256', value: 'a'.repeat(64) },
      mediaType: 'audio/mpeg',
      purpose: 'demo',
      targetId: TARGET,
      targetType: 'recording',
      ...overrides,
    }),
    headers: {
      ...UPLOAD_INTENT_BROWSER_HEADERS,
      'content-type': 'application/json',
      'idempotency-key': 'upload-key-1',
      'if-match': '"7"',
    },
    method: 'POST',
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
      resetAt: 1_756_563_600,
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

describe('upload-intent branch boundary', () => {
  it('fails closed for missing rate limit, dependency errors, malformed authority, and output', async () => {
    const noRate = await make({ rateLimit: undefined } as never)(request());
    expect(noRate.status).toBe(503);
    const unavailable = await make({
      storage: {
        sign: vi.fn(async () => {
          throw new Error('secret');
        }),
      },
    })(request());
    expect(unavailable.status).toBe(503);
    expect(JSON.stringify(await unavailable.json())).not.toContain('secret');
    const invalidAuthority = await make({
      resolvePrincipal: vi.fn(async () => ({ ...principal, actorId: 'bad' })),
    })(request());
    expect(invalidAuthority.status).toBe(503);
    const invalidOutput = await make({
      repository: {
        createIntent: vi.fn(async () => ({
          kind: 'created' as const,
          resource: {
            ...resource,
            object: { ...resource.object, version: '0' },
          },
        })),
      },
    })(request());
    expect(invalidOutput.status).toBe(500);
    const invalidRate = await make({
      rateLimit: vi.fn(async () => ({ invalid: true }) as never),
    })(request());
    expect(invalidRate.status).toBe(503);
    const rateFailure = await make({
      rateLimit: vi.fn(async () => {
        throw new Error('rate database');
      }),
    })(request());
    expect(rateFailure.status).toBe(503);
    const unknownAuthorization = await make({
      authorizeTarget: vi.fn(async () => 'unexpected' as never),
    })(request());
    expect(unknownAuthorization.status).toBe(503);
    const operator = await make({
      resolvePrincipal: vi.fn(async () => ({
        ...principal,
        capabilities: [],
        kind: 'operator' as const,
        reason: null,
        stepUpVerified: false,
      })),
    })(request());
    expect(operator.status).toBe(403);
    const authorizedOperator = await make({
      resolvePrincipal: vi.fn(async () => ({
        ...principal,
        capabilities: ['upload.create'],
        kind: 'operator' as const,
        reason: 'verified support action',
        stepUpVerified: true,
      })),
    })(request());
    expect(authorizedOperator.status).toBe(201);
    const fallbackClock = await make({
      now: undefined,
      randomUUID: undefined,
      repository: {
        createIntent: vi.fn(async (input) => ({
          kind: 'created' as const,
          resource: {
            ...resource,
            object: {
              ...resource.object,
              id: input.objectId,
              objectKey: input.objectKey,
            },
            upload: {
              ...resource.upload,
              allowedMediaTypes: input.signedUpload.allowedMediaTypes,
              expiresAt: input.signedUpload.expiresAt,
              maxBytes: input.signedUpload.maxBytes,
              signedUrl: input.signedUpload.signedUrl,
            },
          },
        })),
      },
    } as never)(request());
    expect(fallbackClock.status).toBe(201);
    const noStorage = createUploadIntentHandler({
      authorizeTarget: vi.fn(async () => 'allow' as const),
      environment: 'local',
      policies: { recording: policy },
      rateLimit: vi.fn(async () => ({
        allowed: true,
        limit: 20,
        remaining: 19,
        resetAt: 1,
      })),
      repository: repository(),
      resolvePrincipal: vi.fn(async () => principal),
    });
    expect((await noStorage(request())).status).toBe(503);
  });

  it('cleans up issued credentials after persistence failure, replay, and conflict', async () => {
    const revoke = vi.fn(async () => undefined);
    const failed = await make({
      repository: {
        createIntent: vi.fn(async () => {
          throw new Error('database');
        }),
      },
      storage: {
        revoke,
        sign: vi.fn(async (input) => ({
          allowedMediaTypes: input.allowedMediaTypes,
          expiresAt: input.expiresAt,
          maxBytes: input.maxBytes,
          method: 'PUT' as const,
          signedUrl: `https://storage.local/upload/${input.objectId}?token=${OBJECT}`,
        })),
      },
    })(request());
    expect(failed.status).toBe(500);
    expect(revoke).toHaveBeenCalledTimes(1);
    const replayRevoke = vi.fn(async () => undefined);
    const replay = await make({
      repository: {
        createIntent: vi.fn(async () => ({
          kind: 'replay' as const,
          resource,
        })),
      },
      storage: {
        revoke: replayRevoke,
        sign: vi.fn(async (input) => ({
          allowedMediaTypes: input.allowedMediaTypes,
          expiresAt: input.expiresAt,
          maxBytes: input.maxBytes,
          method: 'PUT' as const,
          signedUrl: `https://storage.local/upload/${input.objectId}?token=${OBJECT}`,
        })),
      },
    })(request());
    expect(replay.status).toBe(201);
    expect(replayRevoke).toHaveBeenCalledTimes(1);
    const conflictRevoke = vi.fn(async () => undefined);
    const conflict = await make({
      repository: {
        createIntent: vi.fn(async () => ({ kind: 'conflict' as const })),
      },
      storage: {
        revoke: conflictRevoke,
        sign: vi.fn(async (input) => ({
          allowedMediaTypes: input.allowedMediaTypes,
          expiresAt: input.expiresAt,
          maxBytes: input.maxBytes,
          method: 'PUT' as const,
          signedUrl: `https://storage.local/upload/${input.objectId}?token=${OBJECT}`,
        })),
      },
    })(request());
    expect(conflict.status).toBe(409);
    expect(conflictRevoke).toHaveBeenCalledTimes(1);
  });

  it('keeps production storage fail-closed and maps request ceiling/deadline failures', async () => {
    expect(() => make({ maxBodyBytes: 0 })).toThrow(
      'Upload intent configuration is invalid.',
    );
    const production = createUploadIntentHandler({
      authorizeTarget: vi.fn(async () => 'allow' as const),
      environment: 'production',
      policies: { recording: policy },
      rateLimit: vi.fn(async () => ({
        allowed: true,
        limit: 20,
        remaining: 19,
        resetAt: 1,
      })),
      repository: repository(),
      resolvePrincipal: vi.fn(async () => principal),
    });
    expect((await production(request())).status).toBe(503);
    expect((await make({ maxBodyBytes: 64 })(request())).status).toBe(413);
    expect(
      (
        await make()(
          new Request('https://api.example.test', {
            headers: {
              ...UPLOAD_INTENT_BROWSER_HEADERS,
              'content-type': 'application/json',
            },
            method: 'GET',
          }),
        )
      ).status,
    ).toBe(400);
    const declaredBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1]));
        controller.close();
      },
    });
    expect(
      (
        await make()({
          body: declaredBody,
          url: 'https://api.example.test/api/v1/upload-intents',
          headers: new Headers({
            ...UPLOAD_INTENT_BROWSER_HEADERS,
            'content-length': '1',
            'content-type': 'application/json',
          }),
          method: 'POST',
        } as unknown as Request)
      ).status,
    ).toBe(400);
    expect(
      (
        await make()(
          new Request('https://api.example.test', {
            body: JSON.stringify({}),
            headers: {
              ...UPLOAD_INTENT_BROWSER_HEADERS,
              'content-length': 'bad',
              'content-type': 'application/json',
            },
            method: 'POST',
          }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await make()(
          new Request('https://api.example.test', {
            body: new Uint8Array([0xc3, 0x28]),
            headers: {
              ...UPLOAD_INTENT_BROWSER_HEADERS,
              'content-type': 'application/json',
            },
            method: 'POST',
          }),
        )
      ).status,
    ).toBe(400);
    const pendingBody = {
      body: {
        getReader: () => ({
          cancel: () => Promise.resolve(),
          read: () => new Promise<never>(() => undefined),
          releaseLock: () => undefined,
        }),
      },
      url: 'https://api.example.test/api/v1/upload-intents',
      headers: new Headers({
        ...UPLOAD_INTENT_BROWSER_HEADERS,
        'content-type': 'application/json',
      }),
      method: 'POST',
    } as unknown as Request;
    expect((await make({ deadlineMs: 1 })(pendingBody)).status).toBe(503);
    const abortedBody = {
      body: {
        getReader: () => ({
          cancel: () => Promise.resolve(),
          read: async () => {
            throw new UploadBodyReadAbortedError();
          },
          releaseLock: () => undefined,
        }),
      },
      url: 'https://api.example.test/api/v1/upload-intents',
      headers: new Headers({
        ...UPLOAD_INTENT_BROWSER_HEADERS,
        'content-type': 'application/json',
      }),
      method: 'POST',
    } as unknown as Request;
    expect((await make()(abortedBody)).status).toBe(503);
    const hanging = make({
      deadlineMs: 1,
      storage: {
        sign: vi.fn(() => new Promise<never>(() => undefined)),
      },
    });
    expect((await hanging(request())).status).toBe(503);
  });
});
