import { expect, it, vi } from 'vitest';

import { createProductionWorkerApp, type WorkerBindings } from '../index';
import { COMPLETION_BROWSER_HEADERS } from './upload-intent-completion.test-support';
import type { UploadCompletionRouteDependencies } from './upload-intent-completion';

const INTENT_ID = '44444444-4444-4444-8444-444444444444';
const REQUEST_ID = '11111111-1111-4111-8111-111111111111';
const CORRELATION_ID = '88888888-8888-4888-8888-888888888888';

const environment: WorkerBindings = {
  APP_ENVIRONMENT: 'production',
  APP_RELEASE: 'a2ec4803',
  SUPABASE_SECRET_KEY: 'sb_secret_test_only',
  SUPABASE_URL: 'https://production.example.supabase.co',
};

it('keeps the production upload-completion provider registry empty', async () => {
  const fetchImpl = vi.fn();
  const app = createProductionWorkerApp(environment, fetchImpl);
  const response = await app.request(
    new Request(
      `https://api.example.test/api/v1/upload-intents/${INTENT_ID}/complete`,
      {
        body: JSON.stringify({
          byteSize: 1,
          checksum: { algorithm: 'sha256', value: 'a'.repeat(64) },
          mediaType: 'audio/mpeg',
        }),
        headers: {
          ...COMPLETION_BROWSER_HEADERS,
          'content-type': 'application/json',
          'idempotency-key': 'complete-key-1',
          'if-match': '"7"',
          'x-correlation-id': CORRELATION_ID,
          'x-request-id': REQUEST_ID,
        },
        method: 'POST',
      },
    ),
    {},
    environment,
  );

  expect(response.status).toBe(503);
  expect(response.headers.get('retry-after')).toBe('5');
  await expect(response.json()).resolves.toMatchObject({
    code: 'DEPENDENCY_UNAVAILABLE',
    message: 'Upload completion is not available.',
    requestId: REQUEST_ID,
  });
  expect(fetchImpl).not.toHaveBeenCalled();
});

it('uses only an explicitly injected completion boundary', async () => {
  const fetchImpl = vi.fn();
  const resolveSession = vi.fn(async () => null);
  const uploadCompletion: UploadCompletionRouteDependencies = {
    ports: {} as never,
    rateLimit: vi.fn(async () => ({
      allowed: true,
      limit: 60,
      remaining: 59,
      resetAt: 60,
      scope: 'user' as const,
    })),
    resolveSession,
  };
  const app = createProductionWorkerApp(
    environment,
    fetchImpl,
    uploadCompletion,
  );
  const response = await app.request(
    new Request(
      `https://api.example.test/api/v1/upload-intents/${INTENT_ID}/complete`,
      {
        body: JSON.stringify({
          byteSize: 1,
          checksum: { algorithm: 'sha256', value: 'a'.repeat(64) },
          mediaType: 'audio/mpeg',
        }),
        headers: {
          ...COMPLETION_BROWSER_HEADERS,
          'content-type': 'application/json',
          'idempotency-key': 'complete-key-2',
          'if-match': '"7"',
          'x-correlation-id': CORRELATION_ID,
          'x-request-id': REQUEST_ID,
        },
        method: 'POST',
      },
    ),
    {},
    environment,
  );

  expect(response.status).toBe(401);
  expect(resolveSession).toHaveBeenCalledOnce();
  expect(fetchImpl).not.toHaveBeenCalled();
});
