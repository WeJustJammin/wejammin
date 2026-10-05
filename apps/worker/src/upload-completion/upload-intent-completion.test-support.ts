import { createLogger } from '@wejammin/observability/logging';
import { vi } from 'vitest';

import { CSRF } from '../authentication/phase-02-slice-02.test-fixtures';
import type { UploadCompletionPorts } from '@wejammin/application';
import { createWorkerApp, type WorkerDependencies } from '../index';
import type { UploadCompletionRouteDependencies } from './upload-intent-completion';

export const ACTOR_ID = '11111111-1111-4111-8111-111111111111';
export const PARTY_ID = '22222222-2222-4222-8222-222222222222';
export const TARGET_ID = '33333333-3333-4333-8333-333333333333';
export const INTENT_ID = '44444444-4444-4444-8444-444444444444';
export const OBJECT_ID = '55555555-5555-4555-8555-555555555555';
export const JOB_ID = '66666666-6666-4666-8666-666666666666';
export const EVENT_ID = '77777777-7777-4777-8777-777777777777';
export const CORRELATION_ID = '88888888-8888-4888-8888-888888888888';
export const CHECKSUM = 'a'.repeat(64);
export const NOW = Date.parse('2026-08-30T13:00:00.000Z');

export const intent = {
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

export const job = {
  createdAt: '2026-08-30T13:00:00.000Z',
  error: null,
  id: JOB_ID,
  progress: null,
  resultRef: null,
  state: 'queued' as const,
  type: 'platform.object.verify',
  updatedAt: '2026-08-30T13:00:00.000Z',
};

export const event = {
  aggregateId: OBJECT_ID,
  aggregateType: 'object_record',
  aggregateVersion: '8',
  causationId: null,
  correlationId: CORRELATION_ID,
  eventId: EVENT_ID,
  eventType: 'object.uploaded' as const,
  schemaVersion: 1 as const,
};

export const requestBody = {
  byteSize: 512,
  checksum: { algorithm: 'sha256' as const, value: CHECKSUM },
  mediaType: 'AUDIO/MPEG',
};

export const makePorts = (): UploadCompletionPorts => ({
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

export const createHarness = (
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

export const makeRouteDependencies = (
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

/** Same-origin cookie-session headers every human completion carries (BE00 step 2). */
export const COMPLETION_BROWSER_HEADERS = {
  cookie: `wj_session_ref=slice02-session-ref; wj_csrf=${CSRF}`,
  origin: 'https://api.example.test',
  'x-csrf-token': CSRF,
} as const;

export const requestFor = (
  body: unknown = requestBody,
  extraHeaders: Record<string, string> = {},
): Request =>
  new Request(
    `https://api.example.test/api/v1/upload-intents/${INTENT_ID}/complete`,
    {
      body: JSON.stringify(body),
      headers: {
        ...COMPLETION_BROWSER_HEADERS,
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
