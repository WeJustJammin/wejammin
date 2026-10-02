import type { CompositionInstanceResource } from '@wejammin/contracts';
import { createLogger } from '@wejammin/observability/logging';
import { describe, expect, it, vi } from 'vitest';

import { createWorkerApp } from '../index';

import {
  createCmsPatternInstanceApp,
  type CmsPatternInstanceDependencies,
} from './pattern-instance-routes';

const origin = 'https://cms.example.test';
const revisionId = 'd1200000-0000-4000-8000-000000000011';
const patternId = 'd1200000-0000-4000-8000-000000000012';
const instanceId = 'd1200000-0000-4000-8000-000000000013';
const path = '/api/v1/cms/compositions/pattern-instances';
const body = {
  revisionId,
  patternId,
  patternVersion: 1,
  linkMode: 'linked',
  slotPath: '/primary',
  overrides: {},
  expectedVersion: '1',
} as const;
const resource: CompositionInstanceResource = {
  id: instanceId,
  version: '1',
  contentHash: 'a'.repeat(64),
  createdAt: '2026-09-28T14:00:00.000Z',
  updatedAt: '2026-09-28T14:00:00.000Z',
  state: 'draft',
  revisionId,
  path: '/primary',
  blockKey: 'profile.header',
  blockVersion: 1,
  patternId,
  patternVersion: 1,
  blockRegistryDigest: 'b'.repeat(64),
  linkMode: 'linked',
  conflictState: 'none',
};

const request = (
  overrides: {
    body?: unknown;
    headers?: Record<string, string>;
    path?: string;
  } = {},
): Request =>
  new Request(`https://api.example.test${overrides.path ?? path}`, {
    method: 'POST',
    headers: {
      origin,
      'content-type': 'application/json',
      'idempotency-key': 'pattern-instance-0001',
      'if-match': '"1"',
      ...overrides.headers,
    },
    body: JSON.stringify(overrides.body ?? body),
  });

const deps = (
  overrides: Partial<CmsPatternInstanceDependencies> = {},
): CmsPatternInstanceDependencies => ({
  humanOrigins: [origin],
  now: () => 1_000,
  resolveSession: async () => ({
    ok: true,
    value: {
      userId: 'd1200000-0000-4000-8000-000000000014',
      actingPartyId: 'd1200000-0000-4000-8000-000000000015',
      capabilities: ['cms.author'],
      mfaFresh: true,
    },
  }),
  rateLimit: async (input) => ({
    ok: true,
    value: {
      allowed: true,
      limit: input.limit,
      remaining: input.limit - 1,
      resetAt: 2_000,
    },
  }),
  insertPattern: async () => ({ ok: true, value: resource }),
  telemetry: () => undefined,
  ...overrides,
});

describe('CMS-03C-02 protected pattern instance route', () => {
  it('mounts the protected route in the composed Worker when injected', async () => {
    const worker = createWorkerApp({
      captureException: () => undefined,
      createLogger: () =>
        createLogger(
          {
            environment: 'staging',
            release: 'slice-12',
            service: 'wejammin-api',
          },
          {
            now: () => new Date('2026-09-28T14:00:00.000Z'),
            random: () => 0,
            sink: () => undefined,
          },
        ),
      now: () => 1_000,
      cmsPatternInstance: deps(),
    });
    const response = await worker.request(request(), undefined, {
      APP_ENVIRONMENT: 'staging',
      APP_RELEASE: 'slice-12',
      SUPABASE_SECRET_KEY: 'sb_secret_test_only',
      SUPABASE_URL: 'https://supabase.example.test',
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(resource);
  });

  it('returns the authoritative instance and forwards the exact precondition to the port', async () => {
    const insertPattern = vi.fn(deps().insertPattern);
    const rateLimit = vi.fn(deps().rateLimit);
    const response = await createCmsPatternInstanceApp(
      deps({ insertPattern, rateLimit }),
    ).request(request());

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(resource);
    expect(response.headers.get('etag')).toBe('"1"');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(insertPattern).toHaveBeenCalledWith(
      expect.objectContaining({
        operationId: 'CMS-03C-02',
        body,
        ifMatch: '1',
        idempotencyKey: 'pattern-instance-0001',
      }),
      expect.any(AbortSignal),
    );
    expect(
      rateLimit.mock.calls.map(([input]) => [input.rateScope, input.limit]),
    ).toEqual([
      ['user', 120],
      ['party', 240],
    ]);
  });

  it('rejects malformed, cross-origin, and missing-authority requests before mutation', async () => {
    const insertPattern = vi.fn(deps().insertPattern);
    const app = createCmsPatternInstanceApp(deps({ insertPattern }));
    for (const [input, status] of [
      [request({ headers: { origin: 'https://evil.test' } }), 403],
      [request({ path: `${path}?debug=1` }), 400],
      [request({ body: { ...body, actorId: instanceId } }), 422],
      [request({ body: { ...body, expectedVersion: '2' } }), 400],
      [request({ headers: { 'if-match': 'W/"1"' } }), 400],
      [request({ headers: { 'content-type': 'text/plain' } }), 415],
      [request({ headers: { 'idempotency-key': '' } }), 400],
    ] as const) {
      const response = await app.request(input);
      expect(response.status).toBe(status);
      expect(response.headers.get('cache-control')).toBe('no-store');
    }
    expect(insertPattern).not.toHaveBeenCalled();
  });

  it('returns a redacted conflict without leaking provider details', async () => {
    const response = await createCmsPatternInstanceApp(
      deps({
        insertPattern: async () => ({
          ok: false,
          status: 409,
          code: 'PRIVATE',
          message: 'provider SQL text',
          details: {
            expectedVersion: '1',
            currentVersion: '2',
            secret: 'do-not-expose',
          },
        }),
      }),
    ).request(request());
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      code: 'COMPOSITION_VERSION_CONFLICT',
      message:
        'COMPOSITION_VERSION_CONFLICT: composition operation rejected or unavailable.',
      requestId: expect.any(String),
      details: { expectedVersion: '1', currentVersion: '2' },
    });
  });

  it('rejects an invalid success resource from the dependency', async () => {
    const response = await createCmsPatternInstanceApp(
      deps({
        insertPattern: async () => ({
          ok: true,
          value: { ...resource, revisionId: instanceId },
        }),
      }),
    ).request(request());
    expect(response.status).toBe(502);
    expect((await response.json()) as { code: string }).toHaveProperty(
      'code',
      'DEPENDENCY_INVALID_RESPONSE',
    );
  });
});
