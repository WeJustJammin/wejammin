import { createLogger } from '@wejammin/observability/logging';
import { describe, expect, it, vi } from 'vitest';

import { createWorkerApp, type WorkerDependencies } from '../index';
import { COMPLETION_BROWSER_HEADERS } from './upload-intent-completion.test-support';
import type { UploadCompletionRouteDependencies } from './upload-intent-completion';

const INTENT_ID = '44444444-4444-4444-8444-444444444444';
const USER_ID = '11111111-1111-4111-8111-111111111111';
const body = JSON.stringify({
  byteSize: 1,
  checksum: { algorithm: 'sha256', value: 'a'.repeat(64) },
  mediaType: 'audio/mpeg',
});

const base = (route: Partial<UploadCompletionRouteDependencies> = {}) => {
  const dependencies: WorkerDependencies = {
    captureException: () => {},
    createLogger: () =>
      createLogger({
        environment: 'staging',
        release: 'a2ec4803',
        service: 'wejammin-api',
      }),
    now: () => 0,
    uploadCompletion: {
      ports: undefined as never,
      rateLimit: vi.fn(async () => ({
        allowed: true,
        limit: 60,
        remaining: 59,
        resetAt: 60,
        scope: 'user' as const,
      })),
      resolveSession: vi.fn(async () => ({ userId: USER_ID })),
      ...route,
    } as UploadCompletionRouteDependencies,
  };
  return createWorkerApp(dependencies);
};

const request = () =>
  new Request(
    `https://api.example.test/api/v1/upload-intents/${INTENT_ID}/complete`,
    {
      body,
      headers: {
        ...COMPLETION_BROWSER_HEADERS,
        'content-type': 'application/json',
        'idempotency-key': 'complete-key-1',
        'if-match': '"7"',
      },
      method: 'POST',
    },
  );

describe('upload completion Worker configuration guards', () => {
  it('rejects a deadline outside the exact 15-second command bound', async () => {
    const response = await base({ deadlineMs: 15_001 }).request(request());
    expect(response.status).toBe(503);
  });

  it('fails closed when the clock returns an invalid value', async () => {
    const response = await base({ now: () => Number.NaN }).request(request());
    expect(response.status).toBe(503);
  });

  it('uses the platform clock fallback while still failing closed without ports', async () => {
    const response = await base({ now: undefined as never }).request(request());
    expect(response.status).toBe(503);
  });
});
