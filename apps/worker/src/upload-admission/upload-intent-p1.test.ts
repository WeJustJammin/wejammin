import { describe, expect, it, vi } from 'vitest';

import {
  createUploadIntentHandler,
  type UploadAdmissionRepository,
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
const OTHER_OBJECT = '66666666-6666-4666-8666-666666666666';

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

const signedUrl = `https://storage.local/upload/${OBJECT}?token=token`;

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
    signedUrl,
  },
};

const request = () =>
  new Request('https://api.example.test/api/v1/upload-intents', {
    body: JSON.stringify({
      byteSize: 12_345,
      checksum: { algorithm: 'sha256', value: 'a'.repeat(64) },
      mediaType: 'audio/mpeg',
      purpose: 'demo',
      targetId: TARGET,
      targetType: 'recording',
    }),
    headers: {
      ...UPLOAD_INTENT_BROWSER_HEADERS,
      'content-type': 'application/json',
      'idempotency-key': 'upload-key-1',
      'if-match': '"7"',
    },
    method: 'POST',
  });

const repository = (
  overrides: Partial<UploadAdmissionRepository> = {},
): UploadAdmissionRepository => ({
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
        signedUrl,
      })),
    },
    ...overrides,
  });

const errorCode = async (response: Response): Promise<string> =>
  ((await response.json()) as { code: string }).code;

describe('upload-intent P1 contract boundary', () => {
  it('maps principal and target-authorizer dependency failures to 503', async () => {
    const principalFailure = await make({
      resolvePrincipal: vi.fn(async () => {
        throw new Error('session dependency unavailable');
      }),
    })(request());
    expect(principalFailure.status).toBe(503);
    await expect(errorCode(principalFailure)).resolves.toBe(
      'DEPENDENCY_UNAVAILABLE',
    );

    const targetFailure = await make({
      authorizeTarget: vi.fn(async () => {
        throw new Error('target dependency unavailable');
      }),
    })(request());
    expect(targetFailure.status).toBe(503);
    await expect(errorCode(targetFailure)).resolves.toBe(
      'DEPENDENCY_UNAVAILABLE',
    );
  });

  it('maps malformed resolver principals to 503 before signing or committing', async () => {
    const malformedPrincipals: unknown[] = [
      { ...principal, kind: 'unknown' },
      { ...principal, capabilities: 'upload.create' },
      { ...principal, capabilities: ['upload.create', 1] },
      { ...principal, stepUpVerified: 'true' },
      { ...principal, reason: false },
      { ...principal, actingPartyId: 1 },
      { ...principal, extra: true },
    ];

    for (const candidate of malformedPrincipals) {
      const sign = vi.fn(
        async (input: {
          allowedMediaTypes: readonly string[];
          expiresAt: string;
          maxBytes: number;
        }) => ({
          allowedMediaTypes: input.allowedMediaTypes,
          expiresAt: input.expiresAt,
          maxBytes: input.maxBytes,
          method: 'PUT' as const,
          signedUrl,
        }),
      );
      const createIntent = vi.fn(async () => ({
        kind: 'created' as const,
        resource,
      }));
      const response = await make({
        repository: { createIntent },
        resolvePrincipal: vi.fn(async () => candidate as UploadPrincipal),
        storage: { sign },
      })(request());

      expect(response.status).toBe(503);
      expect(sign).not.toHaveBeenCalled();
      expect(createIntent).not.toHaveBeenCalled();
    }
  });

  it('rejects non-canonical repository resources and generated-object mismatches', async () => {
    const mismatchedObject = await make({
      repository: repository({
        createIntent: vi.fn(async () => ({
          kind: 'created' as const,
          resource: {
            ...resource,
            object: {
              ...resource.object,
              id: OTHER_OBJECT,
              objectKey: `objects/${OTHER_OBJECT}`,
            },
          },
        })),
      }),
    })(request());
    expect(mismatchedObject.status).toBe(500);

    const mismatchedCredential = await make({
      repository: repository({
        createIntent: vi.fn(async () => ({
          kind: 'created' as const,
          resource: {
            ...resource,
            upload: {
              ...resource.upload,
              expiresAt: '2026-08-30T12:14:59.000Z',
              signedUrl: 'https://storage.local/upload/other?token=token',
            },
          },
        })),
      }),
    })(request());
    expect(mismatchedCredential.status).toBe(500);

    const nonCanonical = await make({
      repository: repository({
        createIntent: vi.fn(async () => ({
          kind: 'created' as const,
          resource: {
            ...resource,
            extra: 'must not cross the wire',
          },
        })),
      }),
    })(request());
    expect(nonCanonical.status).toBe(500);

    const unboundSigner = await make({
      storage: {
        sign: vi.fn(async (input) => ({
          allowedMediaTypes: input.allowedMediaTypes,
          expiresAt: input.expiresAt,
          maxBytes: input.maxBytes,
          method: 'PUT' as const,
          signedUrl: 'https://storage.local/upload/another-object?token=token',
        })),
      },
    })(request());
    expect(unboundSigner.status).toBe(503);
  });

  it('revokes a validated credential when its URL does not bind the generated object', async () => {
    const revoke = vi.fn(async () => undefined);
    const unboundSigner = await make({
      storage: {
        revoke,
        sign: vi.fn(async (input) => ({
          allowedMediaTypes: input.allowedMediaTypes,
          expiresAt: input.expiresAt,
          maxBytes: input.maxBytes,
          method: 'PUT' as const,
          signedUrl: `https://storage.local/upload/${OBJECT}-other?token=token`,
        })),
      },
    })(request());
    expect(unboundSigner.status).toBe(503);
    expect(revoke).toHaveBeenCalledOnce();
  });

  it('revokes an issued URL when signer metadata validation fails', async () => {
    const revoke = vi.fn(async () => undefined);
    const sign = vi.fn(
      async (input: {
        allowedMediaTypes: readonly string[];
        expiresAt: string;
        maxBytes: number;
      }) => ({
        allowedMediaTypes: input.allowedMediaTypes,
        expiresAt: input.expiresAt,
        maxBytes: input.maxBytes + 1,
        method: 'PUT' as const,
        signedUrl,
      }),
    );
    const response = await make({ storage: { revoke, sign } })(request());

    expect(response.status).toBe(503);
    expect(revoke).toHaveBeenCalledOnce();
    expect(revoke).toHaveBeenCalledWith(
      expect.objectContaining({
        allowedMediaTypes: ['audio/mpeg'],
        expiresAt: '2026-08-30T12:15:00.000Z',
        maxBytes: 100_000,
        method: 'PUT',
        signedUrl,
      }),
      expect.any(AbortSignal),
    );
  });

  it('does not commit or leave a live credential when signing resolves after the deadline', async () => {
    let resolveSign!: (value: object) => void;
    const signResult = new Promise<object>((resolve) => {
      resolveSign = resolve;
    });
    const createIntent = vi.fn(async () => ({
      kind: 'created' as const,
      resource,
    }));
    const revoke = vi.fn(async () => undefined);
    const storage = {
      revoke,
      sign: vi.fn(
        async (input: {
          allowedMediaTypes: readonly string[];
          expiresAt: string;
          maxBytes: number;
        }) => {
          await signResult;
          return {
            allowedMediaTypes: input.allowedMediaTypes,
            expiresAt: input.expiresAt,
            maxBytes: input.maxBytes,
            method: 'PUT' as const,
            signedUrl,
          };
        },
      ),
    };
    const responsePromise = make({
      deadlineMs: 5,
      repository: { createIntent },
      storage,
    })(request());
    await new Promise((resolve) => setTimeout(resolve, 15));
    await expect(responsePromise).resolves.toMatchObject({ status: 503 });

    resolveSign({});
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(createIntent).not.toHaveBeenCalled();
    expect(revoke).toHaveBeenCalledOnce();
  });

  it('bounds an in-flight repository commit with a cancellation fence', async () => {
    vi.useFakeTimers();
    let resolveCommit!: () => void;
    let markCommitStarted!: () => void;
    const commitResult = new Promise<void>((resolve) => {
      resolveCommit = resolve;
    });
    const commitStarted = new Promise<void>((resolve) => {
      markCommitStarted = resolve;
    });
    let committed = false;
    let cancelled = false;
    const createIntent = vi.fn(async () => {
      markCommitStarted();
      await commitResult;
      if (cancelled) throw new Error('canonical attempt fenced');
      committed = true;
      return { kind: 'created' as const, resource };
    });
    const cancelIntent = vi.fn(async () => {
      cancelled = true;
    });
    try {
      const responsePromise = make({
        deadlineMs: 5,
        repository: { cancelIntent, createIntent },
      })(request());
      await commitStarted;
      await vi.advanceTimersByTimeAsync(5);
      expect(committed).toBe(false);
      await expect(responsePromise).resolves.toMatchObject({ status: 503 });
      expect(cancelled).toBe(true);

      resolveCommit();
      await vi.advanceTimersByTimeAsync(0);
      expect(committed).toBe(false);
      expect(cancelIntent).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it('reconciles a canonical attempt when the commit rejects after the deadline', async () => {
    vi.useFakeTimers();
    let rejectCommit!: (error: Error) => void;
    const commitResult = new Promise<never>((_, reject) => {
      rejectCommit = reject;
    });
    let markCommitStarted!: () => void;
    const commitStarted = new Promise<void>((resolve) => {
      markCommitStarted = resolve;
    });
    const cancelIntent = vi.fn(async () => {
      throw new Error('cancellation unavailable');
    });
    const revoke = vi.fn(async () => undefined);
    const responsePromise = make({
      deadlineMs: 5,
      repository: {
        cancelIntent,
        createIntent: vi.fn(async () => {
          markCommitStarted();
          await commitResult;
          throw new Error('commit failed after timeout');
        }),
      },
      storage: {
        revoke,
        sign: vi.fn(async (input) => ({
          allowedMediaTypes: input.allowedMediaTypes,
          expiresAt: input.expiresAt,
          maxBytes: input.maxBytes,
          method: 'PUT' as const,
          signedUrl,
        })),
      },
    })(request());
    try {
      await commitStarted;
      await vi.advanceTimersByTimeAsync(5);
      await expect(responsePromise).resolves.toMatchObject({ status: 503 });
      expect(cancelIntent).toHaveBeenCalledOnce();
      expect(revoke).toHaveBeenCalledOnce();

      rejectCommit(new Error('commit failed after timeout'));
      await vi.advanceTimersByTimeAsync(0);
      expect(cancelIntent).toHaveBeenCalledOnce();
      expect(revoke).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it('bounds a never-settling commit while invoking the cancellation fence', async () => {
    vi.useFakeTimers();
    let markCommitStarted!: () => void;
    const commitStarted = new Promise<void>((resolve) => {
      markCommitStarted = resolve;
    });
    const cancelIntent = vi.fn(async () => undefined);
    const createIntent = vi.fn(async () => {
      markCommitStarted();
      return new Promise<never>(() => undefined);
    });

    try {
      const response = make({
        deadlineMs: 5,
        repository: { cancelIntent, createIntent },
      })(request());
      await commitStarted;
      await vi.advanceTimersByTimeAsync(5);
      const outcome = await response.then((result) => result.status);

      expect(outcome).toBe(503);
      expect(cancelIntent).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it('fences a delayed repository attempt before it can commit', async () => {
    vi.useFakeTimers();
    let markCommitStarted!: () => void;
    const commitStarted = new Promise<void>((resolve) => {
      markCommitStarted = resolve;
    });
    let fenced = false;
    let committed = false;
    const cancelIntent = vi.fn(async () => {
      fenced = true;
    });
    const createIntent = vi.fn(async () => {
      markCommitStarted();
      await new Promise((resolve) => setTimeout(resolve, 25));
      if (fenced) throw new Error('canonical attempt fenced');
      committed = true;
      return { kind: 'created' as const, resource };
    });
    try {
      const responsePromise = make({
        deadlineMs: 5,
        repository: { cancelIntent, createIntent },
      })(request());
      await commitStarted;
      await vi.advanceTimersByTimeAsync(5);
      const response = await responsePromise;

      expect(response.status).toBe(503);
      expect(cancelIntent).toHaveBeenCalledOnce();
      expect(fenced).toBe(true);
      expect(committed).toBe(false);

      await vi.advanceTimersByTimeAsync(20);
      expect(committed).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('reconciles a late successful repository result after the fence completes', async () => {
    vi.useFakeTimers();
    let resolveCommit!: () => void;
    let markCommitStarted!: () => void;
    const commitResult = new Promise<void>((resolve) => {
      resolveCommit = resolve;
    });
    const commitStarted = new Promise<void>((resolve) => {
      markCommitStarted = resolve;
    });
    let lateResultObserved = false;
    const cancelIntent = vi.fn(async () => undefined);
    const revoke = vi.fn(async () => undefined);
    const response = make({
      deadlineMs: 5,
      repository: {
        cancelIntent,
        createIntent: vi.fn(async () => {
          markCommitStarted();
          await commitResult;
          lateResultObserved = true;
          return { kind: 'created' as const, resource };
        }),
      },
      storage: {
        revoke,
        sign: vi.fn(async (input) => ({
          allowedMediaTypes: input.allowedMediaTypes,
          expiresAt: input.expiresAt,
          maxBytes: input.maxBytes,
          method: 'PUT' as const,
          signedUrl,
        })),
      },
    })(request());
    try {
      await commitStarted;
      await vi.advanceTimersByTimeAsync(5);
      await expect(response).resolves.toMatchObject({ status: 503 });
      expect(cancelIntent).toHaveBeenCalledOnce();
      expect(revoke).toHaveBeenCalledOnce();

      resolveCommit();
      await vi.advanceTimersByTimeAsync(0);
      expect(lateResultObserved).toBe(true);
      expect(cancelIntent).toHaveBeenCalledOnce();
      expect(revoke).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it('guards malformed repository results and revokes their credentials', async () => {
    for (const malformed of [null, undefined, {}, { kind: 'unknown' }]) {
      const cancelIntent = vi.fn(async () => undefined);
      const revoke = vi.fn(async () => undefined);
      const response = await make({
        repository: {
          cancelIntent,
          createIntent: vi.fn(async () => malformed as never),
        },
        storage: {
          revoke,
          sign: vi.fn(async (input) => ({
            allowedMediaTypes: input.allowedMediaTypes,
            expiresAt: input.expiresAt,
            maxBytes: input.maxBytes,
            method: 'PUT' as const,
            signedUrl,
          })),
        },
      })(request());

      expect(response.status).toBe(500);
      expect(cancelIntent).toHaveBeenCalledOnce();
      expect(revoke).toHaveBeenCalledOnce();
    }
  });

  it('cleans up an invalid replay without attempting canonical cancellation', async () => {
    const cancelIntent = vi.fn(async () => undefined);
    const response = await make({
      repository: {
        cancelIntent,
        createIntent: vi.fn(async () => ({
          kind: 'replay' as const,
          resource: { ...resource, id: 'not-an-intent-id' },
        })),
      },
    })(request());

    expect(response.status).toBe(500);
    expect(cancelIntent).not.toHaveBeenCalled();
  });

  it('refuses production signing when canonical cancellation is not configured', async () => {
    const sign = vi.fn(
      async (input: {
        allowedMediaTypes: readonly string[];
        expiresAt: string;
        maxBytes: number;
      }) => ({
        allowedMediaTypes: input.allowedMediaTypes,
        expiresAt: input.expiresAt,
        maxBytes: input.maxBytes,
        method: 'PUT' as const,
        signedUrl,
      }),
    );
    const createIntent = vi.fn(async () => ({
      kind: 'created' as const,
      resource,
    }));
    const response = await make({
      environment: 'production',
      repository: { createIntent },
      storage: { sign },
    })(request());
    expect(response.status).toBe(503);
    expect(sign).not.toHaveBeenCalled();
    expect(createIntent).not.toHaveBeenCalled();
  });

  it('refuses production signing when credential revocation is not configured', async () => {
    const sign = vi.fn(
      async (input: {
        allowedMediaTypes: readonly string[];
        expiresAt: string;
        maxBytes: number;
      }) => ({
        allowedMediaTypes: input.allowedMediaTypes,
        expiresAt: input.expiresAt,
        maxBytes: input.maxBytes,
        method: 'PUT' as const,
        signedUrl,
      }),
    );
    const createIntent = vi.fn(async () => ({
      kind: 'created' as const,
      resource,
    }));
    const cancelIntent = vi.fn(async () => undefined);
    const response = await make({
      environment: 'production',
      repository: { cancelIntent, createIntent },
      storage: { sign },
    })(request());
    expect(response.status).toBe(503);
    expect(sign).not.toHaveBeenCalled();
    expect(createIntent).not.toHaveBeenCalled();
  });
});
