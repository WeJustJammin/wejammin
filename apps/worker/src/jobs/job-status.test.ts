import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createJobDependencies,
  createTestApp,
  bindings,
  json,
  allowRate,
  record,
  request,
  status,
  REQUEST_ID,
} from './job-status-test-support';
import {
  PARTY_READ_LIMIT,
  USER_READ_LIMIT,
  JobStatusInternalError,
} from './job-status';
import { parseRateDecision, rateLimitedError } from './job-status-support';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Slice 03 Worker job-status endpoint', () => {
  it('P1-S03-AC-001', async () => {
    const app = createTestApp(createJobDependencies());
    const response = await app.fetch(request(), bindings);

    expect({
      body: await response.json(),
      etag: response.headers.get('etag'),
      status: response.status,
    }).toEqual({ body: status, etag: '"7"', status: 200 });
  });

  it('P1-S03-AC-002', async () => {
    const resolvePrincipal = vi.fn(async () => ({
      kind: 'user' as const,
      userId: '22222222-2222-4222-8222-222222222222',
    }));
    const loadJobStatus = vi.fn(async () => record);
    const rateLimit = vi.fn(async () => allowRate);
    const app = createTestApp(
      createJobDependencies({ loadJobStatus, rateLimit, resolvePrincipal }),
    );
    const response = await app.fetch(
      request('/api/v1/jobs/not-a-uuid'),
      bindings,
    );

    // BE00 step 4 (authentication) precedes step 6 (validation); validation
    // precedes authorization, quota and the data read.
    expect({
      status: response.status,
      authentications: resolvePrincipal.mock.calls.length,
      quotaAndReads:
        rateLimit.mock.calls.length + loadJobStatus.mock.calls.length,
    }).toEqual({
      status: 400,
      authentications: 1,
      quotaAndReads: 0,
    });
  });

  it('P1-S03-AC-003', async () => {
    const resolvePrincipal = vi.fn(async () => ({
      kind: 'user' as const,
      userId: '22222222-2222-4222-8222-222222222222',
    }));
    const app = createTestApp(createJobDependencies({ resolvePrincipal }));
    const responses = await Promise.all([
      app.fetch(
        request('/api/v1/jobs/66666666-6666-4666-8666-666666666666/extra'),
        bindings,
      ),
      app.fetch(
        request(
          '/api/v1/jobs/%36%36%36%36%36%36%36%36-6666-4666-8666-666666666666',
        ),
        bindings,
      ),
      app.fetch(
        request(
          '/api/v1/jobs/66666666-6666-4666-8666-666666666666?jobId=66666666-6666-4666-8666-666666666666',
        ),
        bindings,
      ),
    ]);

    expect({
      statuses: responses.map((item) => item.status),
      authCalls: resolvePrincipal.mock.calls.length,
    }).toEqual({ statuses: [400, 400, 400], authCalls: 3 });
  });

  it('P1-S03-AC-004', async () => {
    const app = createTestApp(createJobDependencies());
    const response = await app.fetch(
      request('/api/v1/jobs/not-a-uuid'),
      bindings,
    );
    const payload = await json(response);

    expect({
      path: (payload.details as { violations: Array<{ path: string }> })
        .violations[0]?.path,
      leakedId: JSON.stringify(payload).includes('not-a-uuid'),
    }).toEqual({ path: '/path/jobId', leakedId: false });
  });

  it('P1-S03-AC-005', async () => {
    const app = createTestApp(createJobDependencies());
    const response = await app.fetch(request('/api/v1/jobs/invalid'), bindings);
    const payload = await json(response);

    expect({
      keys: Object.keys(payload).sort(),
      code: payload.code,
      cache: response.headers.get('cache-control'),
      requestId: response.headers.get('x-request-id'),
    }).toEqual({
      keys: ['code', 'details', 'message', 'requestId'],
      code: 'INVALID_REQUEST',
      cache: 'no-store',
      requestId: REQUEST_ID,
    });
  });

  it('P1-S03-AC-006', async () => {
    const loadJobStatus = vi.fn(async () => record);
    const app = createTestApp(
      createJobDependencies({
        loadJobStatus,
        resolvePrincipal: vi.fn(async () => null),
      }),
    );
    const response = await app.fetch(request(), bindings);

    expect({
      status: response.status,
      code: (await json(response)).code,
      lookups: loadJobStatus.mock.calls.length,
    }).toEqual({ status: 401, code: 'UNAUTHENTICATED', lookups: 0 });
  });

  it('P1-S03-AC-007', async () => {
    const app = createTestApp(
      createJobDependencies({ loadJobStatus: vi.fn(async () => null) }),
    );
    const response = await app.fetch(request(), bindings);

    expect({
      status: response.status,
      code: (await json(response)).code,
    }).toEqual({
      status: 404,
      code: 'NOT_FOUND',
    });
  });

  it('P1-S03-AC-008', async () => {
    const app = createTestApp(
      createJobDependencies({
        rateLimit: vi.fn(async () => ({
          allowed: false,
          limit: PARTY_READ_LIMIT,
          remaining: 0,
          resetAt: 1_756_530_060,
          scope: 'party' as const,
        })),
      }),
    );
    const response = await app.fetch(request(), bindings);
    const payload = await json(response);

    expect({
      details: payload.details,
      status: response.status,
      code: payload.code,
      limit: response.headers.get('ratelimit-limit'),
      remaining: response.headers.get('ratelimit-remaining'),
      reset: response.headers.get('ratelimit-reset'),
      retryAfter: response.headers.get('retry-after'),
    }).toEqual({
      details: {
        limit: PARTY_READ_LIMIT,
        resetAt: new Date(1_756_530_060 * 1_000).toISOString(),
        retryAfterSeconds: 60,
      },
      status: 429,
      code: 'RATE_LIMITED',
      limit: String(PARTY_READ_LIMIT),
      remaining: '0',
      reset: '1756530060',
      retryAfter: '60',
    });
  });

  it('P1-S03-AC-009', async () => {
    const app = createTestApp(
      createJobDependencies({
        loadJobStatus: vi.fn(async () => {
          throw new Error('database unavailable');
        }),
      }),
    );
    const response = await app.fetch(request(), bindings);

    expect({
      status: response.status,
      code: (await json(response)).code,
    }).toEqual({
      status: 503,
      code: 'DEPENDENCY_UNAVAILABLE',
    });
  });

  it('P1-S03-AC-010', async () => {
    const app = createTestApp(
      createJobDependencies({
        loadJobStatus: vi.fn(async () => {
          throw new JobStatusInternalError('unexpected internal failure');
        }),
      }),
    );
    const response = await app.fetch(request(), bindings);
    const payload = await json(response);

    expect({
      status: response.status,
      code: payload.code,
      message: payload.message,
    }).toEqual({
      status: 500,
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
    });
  });

  it('uses the configured per-user ceiling for a standard user read', async () => {
    const rateLimit = vi.fn(async () => ({
      allowed: true,
      limit: USER_READ_LIMIT,
      remaining: USER_READ_LIMIT - 1,
      resetAt: 1_756_530_060,
      scope: 'user' as const,
    }));
    const app = createTestApp(createJobDependencies({ rateLimit }));
    await app.fetch(request(), bindings);

    expect(rateLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        partyLimit: PARTY_READ_LIMIT,
        userLimit: USER_READ_LIMIT,
      }),
    );
  });

  it('fails closed with the global four-field error when the shared limiter is absent', async () => {
    const dependencies = createJobDependencies();
    delete (dependencies as { rateLimit?: unknown }).rateLimit;
    const app = createTestApp(dependencies);
    const response = await app.fetch(request(), bindings);
    const payload = await json(response);

    expect({
      keys: Object.keys(payload).sort(),
      status: response.status,
      code: payload.code,
      details: payload.details,
    }).toEqual({
      keys: ['code', 'details', 'message', 'requestId'],
      status: 503,
      code: 'DEPENDENCY_UNAVAILABLE',
      details: {
        dependencyClass: 'job_status',
        retryAfterSeconds: 5,
        retryable: true,
      },
    });
  });

  it('rejects reset timestamps that cannot be represented as RFC3339', () => {
    const valid = {
      allowed: false,
      limit: PARTY_READ_LIMIT,
      remaining: 0,
      resetAt: 1_756_530_060,
      scope: 'party' as const,
    };

    expect(
      parseRateDecision({ ...valid, resetAt: Number.MAX_SAFE_INTEGER }),
    ).toBe(null);
    expect(parseRateDecision({ ...valid, resetAt: 8_700_000_000_000 })).toBe(
      null,
    );
    expect(
      rateLimitedError({ ...valid, resetAt: 8_700_000_000_000 }, 0),
    ).toMatchObject({ code: 'INTERNAL_ERROR', details: {} });
  });
});
