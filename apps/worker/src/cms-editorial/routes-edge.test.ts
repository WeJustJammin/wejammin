import { describe, expect, it, vi } from 'vitest';

import { createCmsEditorialApp, type CmsEditorialDependencies } from './index';
import type { CmsEditorialError } from './types';

const entryId = '30000000-0000-4000-8000-000000000003';
const fieldId = '60000000-0000-4000-8000-000000000006';
const origin = 'https://cms-console.example.test';
const path = `/api/v1/cms/entries/${entryId}/revisions`;
const body = {
  entryId,
  baseRevision: '1',
  changedPaths: [`/fields/${fieldId}`],
  values: { [fieldId]: 'Hello' },
  locale: 'en-US',
  expectedVersion: '1',
};
const defaultError: CmsEditorialError = {
  ok: false,
  status: 403,
  code: 'FORBIDDEN',
  message: 'Denied.',
};

const harness = (overrides: Partial<CmsEditorialDependencies> = {}) => {
  const appendRevision = vi.fn(async () => defaultError);
  const dependencies: CmsEditorialDependencies = {
    ports: { appendRevision },
    resolveSession: async () => ({
      ok: true,
      value: {
        userId: '10000000-0000-4000-8000-000000000001',
        actingPartyId: null,
        capabilities: ['cms.author'],
        mfaFresh: true,
      },
    }),
    rateLimit: async () => ({
      ok: true,
      value: { allowed: true, limit: 120, remaining: 119, resetAt: 60_000 },
    }),
    humanOrigins: [origin],
    now: () => 0,
    ...overrides,
  };
  return { app: createCmsEditorialApp(dependencies), appendRevision };
};

const post = (
  app: ReturnType<typeof createCmsEditorialApp>,
  includeRequestId = true,
): Promise<Response> =>
  Promise.resolve(
    app.request(path, {
      method: 'POST',
      headers: {
        origin,
        'content-type': 'application/json',
        'idempotency-key': 'idempotency-key-0001',
        'if-match': '"1"',
        ...(includeRequestId
          ? { 'x-request-id': 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }
          : {}),
      },
      body: JSON.stringify(body),
    }),
  );

describe('CMS editorial error and transport edge cases', () => {
  it('preserves only the authorized BE00 version-conflict details', async () => {
    const error: CmsEditorialError = {
      ok: false,
      status: 409,
      code: 'CONFLICT',
      message: 'The CMS editorial resource changed; reload and try again.',
      details: {
        conflict: 'VERSION_MISMATCH',
        expectedVersion: '1',
        currentVersion: '2',
        recoveryAction: 'reload',
        conflictHash: 'a'.repeat(64),
        proposedValues: { secret: 'private draft' },
      },
    };
    const { app } = harness({ ports: { appendRevision: async () => error } });
    const response = await post(app);
    expect(response.status).toBe(409);
    const payload = (await response.json()) as {
      details: Record<string, unknown>;
    };
    expect(payload.details).toEqual({
      conflict: 'VERSION_MISMATCH',
      expectedVersion: '1',
      currentVersion: '2',
      recoveryAction: 'reload',
    });
    expect(JSON.stringify(payload)).not.toContain('private draft');
    expect(JSON.stringify(payload)).not.toContain('conflictHash');
  });

  it.each([
    ['IDEMPOTENCY_MISMATCH', 'IDEMPOTENCY_MISMATCH'],
    ['INVALID_TRANSITION', 'INVALID_TRANSITION'],
    ['private-injected-reason', undefined],
  ])('allowlists the 409 conflict reason %s', async (reason, expected) => {
    const error: CmsEditorialError = {
      ok: false,
      status: 409,
      code: 'CONFLICT',
      message: 'The request conflicts with current state.',
      details: { conflict: reason, recoveryAction: 'reload' },
    };
    const { app } = harness({ ports: { appendRevision: async () => error } });
    const response = await post(app);
    expect(response.status).toBe(409);
    const payload = (await response.json()) as {
      details: Record<string, unknown>;
    };
    expect(payload.details.conflict).toBe(expected);
  });

  it('bounds malformed validation violations without echoing arbitrary data', async () => {
    const error: CmsEditorialError = {
      ok: false,
      status: 422,
      code: 'VALIDATION_FAILED',
      message: 'Invalid.',
      details: {
        violations: [
          null,
          'leak',
          [],
          { path: 42, code: null, secret: 'leak' },
        ],
      },
    };
    const { app } = harness({ ports: { appendRevision: async () => error } });
    const response = await post(app);
    expect(response.status).toBe(422);
    const payload = (await response.json()) as {
      details: Record<string, unknown>;
    };
    expect(payload.details).toEqual({
      violations: [
        { path: '/', code: 'invalid', message: 'The value is invalid.' },
      ],
    });
    expect(JSON.stringify(payload)).not.toContain('leak');
  });

  it('drops oversized error details before schema serialization', async () => {
    const error: CmsEditorialError = {
      ...defaultError,
      details: { reasonCode: 'x'.repeat(8_193) },
    };
    const { app } = harness({ ports: { appendRevision: async () => error } });
    const response = await post(app);
    expect(response.status).toBe(403);
    const payload = (await response.json()) as {
      details: Record<string, unknown>;
    };
    expect(payload.details).toEqual({});
  });

  it('normalizes a port rate error with a bounded default Retry-After', async () => {
    const error: CmsEditorialError = {
      ok: false,
      status: 429,
      code: 'RATE_LIMITED',
      message: 'Limited.',
    };
    const { app } = harness({ ports: { appendRevision: async () => error } });
    const response = await post(app);
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('1');
  });

  it('generates a request ID when the client omits it', async () => {
    const { app } = harness();
    const response = await post(app, false);
    expect(response.status).toBe(403);
    expect(response.headers.get('x-request-id')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('fails closed when the session resolver throws', async () => {
    const { app, appendRevision } = harness({
      resolveSession: async () => {
        throw new Error('private identity failure');
      },
    });
    const response = await post(app);
    expect(response.status).toBe(503);
    expect(appendRevision).not.toHaveBeenCalled();
    expect(await response.text()).not.toContain('private identity failure');
  });

  it('propagates a limiter dependency failure before persistence', async () => {
    const { app, appendRevision } = harness({
      rateLimit: async () => ({
        ok: false,
        status: 503,
        code: 'DEPENDENCY_UNAVAILABLE',
        message: 'Unavailable.',
      }),
    });
    const response = await post(app);
    expect(response.status).toBe(503);
    expect(appendRevision).not.toHaveBeenCalled();
    expect(response.headers.get('ratelimit-limit')).toBeNull();
  });
});
