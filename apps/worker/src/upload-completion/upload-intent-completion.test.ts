import { createLogger } from '@wejammin/observability/logging';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { UploadCompletionPorts } from '@wejammin/application';
import { createWorkerApp, type WorkerDependencies } from '../index';
import type { UploadCompletionRouteDependencies } from './upload-intent-completion';

const ACTOR_ID = '11111111-1111-4111-8111-111111111111';
const PARTY_ID = '22222222-2222-4222-8222-222222222222';
const TARGET_ID = '33333333-3333-4333-8333-333333333333';
const INTENT_ID = '44444444-4444-4444-8444-444444444444';
const OBJECT_ID = '55555555-5555-4555-8555-555555555555';
const JOB_ID = '66666666-6666-4666-8666-666666666666';
const EVENT_ID = '77777777-7777-4777-8777-777777777777';
const CORRELATION_ID = '88888888-8888-4888-8888-888888888888';
const CHECKSUM = 'a'.repeat(64);
const NOW = Date.parse('2026-08-30T13:00:00.000Z');

const intent = {
  actingPartyId: PARTY_ID,
  actorId: ACTOR_ID,
  allowedMediaTypes: ['audio/mpeg'],
  expiresAt: '2026-08-30T13:15:00.000Z',
  id: INTENT_ID,
  maxBytes: 10_000,
  objectId: OBJECT_ID,
  objectKey: `objects/${OBJECT_ID}`,
  objectVersion: '7',
  purpose: 'recording',
  state: 'issued' as const,
  targetId: TARGET_ID,
  targetType: 'infrastructure.record',
};

const job = {
  createdAt: '2026-08-30T13:00:00.000Z',
  error: null,
  id: JOB_ID,
  progress: null,
  resultRef: null,
  state: 'queued' as const,
  type: 'platform.object.verify',
  updatedAt: '2026-08-30T13:00:00.000Z',
};

const event = {
  aggregateId: OBJECT_ID,
  aggregateType: 'object_record',
  aggregateVersion: '8',
  causationId: null,
  correlationId: CORRELATION_ID,
  eventId: EVENT_ID,
  eventType: 'object.uploaded' as const,
  schemaVersion: 1 as const,
};

const requestBody = {
  byteSize: 512,
  checksum: { algorithm: 'sha256' as const, value: CHECKSUM },
  mediaType: 'AUDIO/MPEG',
};

const makePorts = (): UploadCompletionPorts => ({
  authorization: {
    authorize: vi.fn(async () => ({
      actorId: ACTOR_ID,
      actingPartyId: PARTY_ID,
      capabilities: ['upload.complete'],
      kind: 'allow' as const,
    })),
  },
  digest: {
    digest: vi.fn(async (value: string) =>
      value === 'complete-key-1' ? 'b'.repeat(64) : 'c'.repeat(64),
    ),
  },
  persistence: {
    cancelCompletion: vi.fn(async () => undefined),
    claimVerification: vi.fn(async () => ({
      kind: 'claimed' as const,
      expectedVersion: '8',
      version: '9',
    })),
    commitCompletion: vi.fn(async () => ({
      event,
      kind: 'committed' as const,
      job,
      objectId: OBJECT_ID,
      objectVersion: '8',
    })),
    finishVerification: vi.fn(async () => ({
      kind: 'applied' as const,
      job,
      objectVersion: '10',
    })),
    readIntent: vi.fn(async () => intent),
    readObject: vi.fn(async () => null),
    readVerificationTarget: vi.fn(async () => null),
  },
  queue: { enqueue: vi.fn(async () => undefined) },
  storage: {
    observe: vi.fn(async () => ({
      byteSize: 512,
      checksum: { algorithm: 'sha256' as const, value: CHECKSUM },
      mediaType: 'audio/mpeg',
      objectKey: intent.objectKey,
    })),
  },
});

const createHarness = (
  uploadCompletion?: UploadCompletionRouteDependencies,
): ReturnType<typeof createWorkerApp> => {
  const dependencies: WorkerDependencies = {
    captureException: () => {},
    createLogger: () =>
      createLogger(
        {
          environment: 'staging',
          release: 'a2ec4803',
          service: 'wejammin-api',
        },
        { now: () => new Date(NOW), random: () => 0, sink: () => {} },
      ),
    now: () => NOW,
    ...(uploadCompletion === undefined ? {} : { uploadCompletion }),
  };
  return createWorkerApp(dependencies);
};

const makeRouteDependencies = (
  overrides: Partial<UploadCompletionRouteDependencies> = {},
): UploadCompletionRouteDependencies => ({
  now: () => NOW,
  ports: makePorts(),
  rateLimit: vi.fn(async () => ({
    allowed: true,
    limit: 60,
    remaining: 59,
    resetAt: Math.floor(NOW / 1_000) + 60,
    scope: 'user' as const,
  })),
  resolveSession: vi.fn(async () => ({ userId: ACTOR_ID })),
  ...overrides,
});

const requestFor = (
  body: unknown = requestBody,
  extraHeaders: Record<string, string> = {},
): Request =>
  new Request(
    `https://api.example.test/api/v1/upload-intents/${INTENT_ID}/complete`,
    {
      body: JSON.stringify(body),
      headers: {
        'content-type': 'application/json',
        'idempotency-key': 'complete-key-1',
        'if-match': '"7"',
        'x-correlation-id': CORRELATION_ID,
        'x-request-id': ACTOR_ID,
        ...extraHeaders,
      },
      method: 'POST',
    },
  );

afterEach(() => {
  vi.restoreAllMocks();
});

describe('upload completion Worker boundary', () => {
  it('fails closed when the production completion adapter is absent', async () => {
    const response = await createHarness().request(requestFor());

    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('retry-after')).toBe('5');
    expect(response.headers.get('x-request-id')).toBe(ACTOR_ID);
    expect(response.headers.get('x-correlation-id')).toBe(CORRELATION_ID);
    await expect(response.json()).resolves.toEqual({
      code: 'DEPENDENCY_UNAVAILABLE',
      details: {},
      message: 'Upload completion is not available.',
      requestId: ACTOR_ID,
    });
  });

  it('returns only the JobStatus with canonical Location and ETag', async () => {
    const route = makeRouteDependencies();
    const response = await createHarness(route).request(requestFor());

    expect(response.status).toBe(202);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('location')).toBe(`/api/v1/jobs/${JOB_ID}`);
    expect(response.headers.get('etag')).toBe('"8"');
    const responseText = await response.text();
    expect(JSON.parse(responseText)).toEqual(job);
    expect(responseText).not.toContain(intent.objectKey);
    expect(route.rateLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        concurrentLimit: 3,
        partyLimit: 120,
        userLimit: 60,
      }),
    );
    const ports = route.ports as UploadCompletionPorts;
    expect(ports.queue.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        envelope: expect.not.objectContaining({ payload: expect.anything() }),
        queue: 'platform-objects',
      }),
    );
  });

  it('validates path, query, content type, body keys, and body ceiling before authority', async () => {
    const route = makeRouteDependencies();
    const app = createHarness(route);

    const malformed = await app.request(
      requestFor({ ...requestBody, extra: true }),
    );
    expect(malformed.status).toBe(400);
    const wrongType = await app.request(
      requestFor(requestBody, { 'content-type': 'text/plain' }),
    );
    expect(wrongType.status).toBe(415);
    expect(((await wrongType.json()) as { details: unknown }).details).toEqual({
      allowedMediaTypes: ['application/json'],
    });
    const oversized = await app.request(
      requestFor(requestBody, { 'content-length': String(256 * 1024 + 1) }),
    );
    expect(oversized.status).toBe(413);
    const query = await app.request(
      new Request(`${requestFor().url}?page=1`, requestFor()),
    );
    expect(query.status).toBe(400);
    const invalidPath = await app.request(
      new Request(
        requestFor().url.replace(INTENT_ID, 'not-a-uuid'),
        requestFor(),
      ),
    );
    expect(invalidPath.status).toBe(400);
    expect(route.resolveSession).not.toHaveBeenCalled();
    expect(route.rateLimit).not.toHaveBeenCalled();
  });

  it('returns authentication and rate errors without invoking completion ports', async () => {
    const unauthenticated = makeRouteDependencies({
      resolveSession: vi.fn(async () => null),
    });
    const unauthenticatedResponse =
      await createHarness(unauthenticated).request(requestFor());
    expect(unauthenticatedResponse.status).toBe(401);
    expect(unauthenticated.rateLimit).not.toHaveBeenCalled();

    const limited = makeRouteDependencies({
      rateLimit: vi.fn(async () => ({
        allowed: false,
        limit: 60,
        remaining: 0,
        resetAt: Math.floor(NOW / 1_000) + 9,
        scope: 'user' as const,
        retryAfterSeconds: 9,
      })),
    });
    const limitedResponse = await createHarness(limited).request(requestFor());
    expect(limitedResponse.status).toBe(429);
    expect(limitedResponse.headers.get('retry-after')).toBe('9');
    expect(limitedResponse.headers.get('ratelimit-limit')).toBe('60');
    await expect(limitedResponse.json()).resolves.toMatchObject({
      code: 'RATE_LIMITED',
      details: { remaining: 0, resetAt: Math.floor(NOW / 1_000) + 9 },
    });
    expect(
      (limited.ports as UploadCompletionPorts).persistence.readIntent,
    ).not.toHaveBeenCalled();
  });

  it('ignores forged authority headers and does not leak dependency errors', async () => {
    const route = makeRouteDependencies({
      ports: vi.fn(async () => {
        throw new Error('secret dependency detail');
      }) as never,
    });
    const response = await createHarness(route).request(
      requestFor(requestBody, {
        'x-acting-party-id': '99999999-9999-4999-8999-999999999999',
        'x-capability': 'upload.complete',
        'x-role': 'operator',
      }),
    );

    expect(response.status).toBe(503);
    const text = await response.text();
    expect(text).not.toContain('secret dependency detail');
    expect(text).not.toContain('x-capability');
  });

  it('aborts the exact command deadline and propagates the abort signal', async () => {
    let aborted = false;
    const route = makeRouteDependencies({
      deadlineMs: 5,
      resolveSession: vi.fn(
        ({ signal }: { signal: AbortSignal }) =>
          new Promise<null>((resolve) => {
            signal.addEventListener(
              'abort',
              () => {
                aborted = true;
                resolve(null);
              },
              { once: true },
            );
          }),
      ),
    });
    const response = await createHarness(route).request(requestFor());

    expect(response.status).toBe(503);
    expect(aborted).toBe(true);
    await expect(response.json()).resolves.toMatchObject({
      code: 'DEPENDENCY_UNAVAILABLE',
    });
  });

  it('fences an in-flight canonical completion before a late commit can apply', async () => {
    let releaseCommit!: () => void;
    const commitGate = new Promise<void>((resolve) => {
      releaseCommit = resolve;
    });
    let fenced = false;
    let committed = false;
    const base = makePorts();
    const cancelCompletion = vi.fn(
      async (_input: unknown, signal: AbortSignal) => {
        expect(signal.aborted).toBe(false);
        fenced = true;
      },
    );
    const commitCompletion = vi.fn(async () => {
      await commitGate;
      if (fenced) throw new Error('canonical completion fenced');
      committed = true;
      return {
        event,
        kind: 'committed' as const,
        job,
        objectId: OBJECT_ID,
        objectVersion: '8',
      };
    });
    const route = makeRouteDependencies({
      deadlineMs: 5,
      ports: {
        ...base,
        persistence: {
          ...base.persistence,
          cancelCompletion,
          commitCompletion,
        },
      },
    });
    const responsePromise = createHarness(route).request(requestFor());

    await new Promise((resolve) => setTimeout(resolve, 15));
    await expect(responsePromise).resolves.toMatchObject({ status: 503 });
    expect(cancelCompletion).toHaveBeenCalledOnce();
    expect(committed).toBe(false);

    releaseCommit();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fenced).toBe(true);
    expect(committed).toBe(false);
  });

  it('returns within the bounded recovery window when canonical completion never settles', async () => {
    const base = makePorts();
    const cancelCompletion = vi.fn(async () => undefined);
    const commitCompletion = vi.fn(
      async () => new Promise<never>(() => undefined),
    );
    const route = makeRouteDependencies({
      deadlineMs: 5,
      ports: {
        ...base,
        persistence: {
          ...base.persistence,
          cancelCompletion,
          commitCompletion,
        },
      },
    });
    const outcome = await Promise.race([
      Promise.resolve(createHarness(route).request(requestFor())).then(
        (response) => response.status,
      ),
      new Promise<'timeout'>((resolve) =>
        setTimeout(() => resolve('timeout'), 250),
      ),
    ]);

    expect(outcome).toBe(503);
    expect(cancelCompletion).toHaveBeenCalledOnce();
  });

  it('fails closed before the canonical write when the completion fence is absent', async () => {
    const base = makePorts();
    const persistence = { ...base.persistence };
    delete persistence.cancelCompletion;
    const commitCompletion = vi.fn(base.persistence.commitCompletion);
    const route = makeRouteDependencies({
      ports: {
        ...base,
        persistence: { ...persistence, commitCompletion },
      },
    });
    const response = await createHarness(route).request(requestFor());

    expect(response.status).toBe(503);
    expect(commitCompletion).not.toHaveBeenCalled();
  });

  it('fails closed for invalid limits, resolver failures, and malformed rate decisions', async () => {
    const invalidLimit = makeRouteDependencies({ maxBodyBytes: 0 });
    expect(
      (await createHarness(invalidLimit).request(requestFor())).status,
    ).toBe(503);

    const resolverFailure = makeRouteDependencies({
      resolveSession: vi.fn(async () => {
        throw new Error('resolver failure');
      }),
    });
    expect(
      (await createHarness(resolverFailure).request(requestFor())).status,
    ).toBe(503);

    const invalidSession = makeRouteDependencies({
      resolveSession: vi.fn(async () => ({ userId: 'not-a-uuid' }) as never),
    });
    expect(
      (await createHarness(invalidSession).request(requestFor())).status,
    ).toBe(503);

    const rateFailure = makeRouteDependencies({
      rateLimit: vi.fn(async () => {
        throw new Error('rate failure');
      }),
    });
    expect(
      (await createHarness(rateFailure).request(requestFor())).status,
    ).toBe(503);

    const invalidRate = makeRouteDependencies({
      rateLimit: vi.fn(async () => ({
        allowed: true,
        limit: 61,
        remaining: 60,
        resetAt: Math.floor(NOW / 1_000) + 60,
        scope: 'user' as const,
      })),
    });
    expect(
      (await createHarness(invalidRate).request(requestFor())).status,
    ).toBe(503);
  });

  it('maps a completion-port construction failure to a scrubbed dependency error', async () => {
    const route = makeRouteDependencies({ ports: undefined as never });
    const response = await createHarness(route).request(requestFor());

    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('undefined');
  });

  it('maps an unexpected completion-port access failure to a scrubbed dependency error', async () => {
    const base = makePorts();
    const ports = new Proxy(base, {
      get(target, property, receiver) {
        if (property === 'authorization') {
          throw new Error('secret authorization failure');
        }
        return Reflect.get(target, property, receiver);
      },
    });
    const response = await createHarness(
      makeRouteDependencies({ ports }),
    ).request(requestFor());

    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('secret authorization failure');
  });
});
