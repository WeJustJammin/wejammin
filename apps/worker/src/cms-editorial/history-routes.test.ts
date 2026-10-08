import { describe, expect, it, vi } from 'vitest';

import { ApiErrorSchema, type RevisionHistoryPage } from '@wejammin/contracts';

import {
  createCmsEditorialApp,
  type CmsEditorialDependencies,
  type CmsEditorialHistoryPortInput,
} from './index';

const entryId = '30000000-0000-4000-8000-000000000003';
const revisionId = '40000000-0000-4000-8000-000000000004';
const origin = 'https://cms-console.example.test';
const path = `/api/v1/cms/entries/${entryId}/revisions`;
const requestId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const page: RevisionHistoryPage = {
  items: [
    {
      id: revisionId,
      revisionNumber: '2',
      locale: 'en-US',
      state: 'draft',
      contentHash: 'a'.repeat(64),
      createdAt: '2026-09-26T12:00:00.000Z',
      authorClass: 'author',
    },
  ],
  nextCursor: null,
  pageVersion: '2',
  compare: null,
};

const harness = (overrides: Partial<CmsEditorialDependencies> = {}) => {
  const listRevisions = vi.fn(
    async (_input: CmsEditorialHistoryPortInput, _signal: AbortSignal) => {
      void _input;
      void _signal;
      return { ok: true as const, value: page };
    },
  );
  const dependencies: CmsEditorialDependencies = {
    ports: {
      appendRevision: async () => ({
        ok: false,
        status: 503,
        code: 'DEPENDENCY_UNAVAILABLE',
        message: 'Unavailable.',
      }),
      listRevisions,
    },
    resolveSession: async () => ({
      ok: true,
      value: {
        userId: '10000000-0000-4000-8000-000000000001',
        actingPartyId: '20000000-0000-4000-8000-000000000002',
        capabilities: ['cms.reviewer'],
        mfaFresh: true,
      },
    }),
    rateLimit: async () => ({
      ok: true,
      value: { allowed: true, limit: 300, remaining: 299, resetAt: 60_000 },
    }),
    humanOrigins: [origin],
    now: () => 0,
    ...overrides,
  };
  return {
    app: createCmsEditorialApp(dependencies),
    listRevisions,
    dependencies,
  };
};

const get = (
  app: ReturnType<typeof createCmsEditorialApp>,
  suffix = '',
  extraHeaders: Record<string, string> = {},
): Promise<Response> =>
  Promise.resolve(
    app.request(`${path}${suffix}`, {
      method: 'GET',
      headers: { origin, 'x-request-id': requestId, ...extraHeaders },
    }),
  );

describe('CMS-03B-03 shared route deadline', () => {
  it('ends the entire request at the declared deadline when session resolution stalls', async () => {
    vi.useFakeTimers();
    try {
      let notifySession!: () => void;
      let sessionSignal: AbortSignal | undefined;
      const sessionStarted = new Promise<void>((resolve) => {
        notifySession = resolve;
      });
      const rateLimit = vi.fn(async (input: { limit: number }) => ({
        ok: true as const,
        value: {
          allowed: true,
          limit: input.limit,
          remaining: input.limit - 1,
          resetAt: 60_000,
        },
      }));
      const { app, listRevisions } = harness({
        rateLimit,
        resolveSession: async (_request, signal) => {
          sessionSignal = signal;
          notifySession();
          return new Promise(() => undefined);
        },
      });
      const response = get(app);
      await sessionStarted;
      await vi.advanceTimersByTimeAsync(8_000);
      const status = Promise.race([
        response.then((result) => result.status),
        new Promise<number>((resolve) => setTimeout(() => resolve(0), 1)),
      ]);
      await vi.advanceTimersByTimeAsync(1);
      expect(await status).toBe(504);
      expect(sessionSignal?.aborted).toBe(true);
      expect(rateLimit).not.toHaveBeenCalled();
      expect(listRevisions).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('uses one deadline across both rate buckets and never starts a late read', async () => {
    vi.useFakeTimers();
    try {
      let notifyRate!: () => void;
      const rateStarted = new Promise<void>((resolve) => {
        notifyRate = resolve;
      });
      const rateLimit = vi.fn(async (input: { limit: number }) => {
        notifyRate();
        await new Promise<void>((resolve) => setTimeout(resolve, 4_000));
        return {
          ok: true as const,
          value: {
            allowed: true,
            limit: input.limit,
            remaining: input.limit - 1,
            resetAt: 60_000,
          },
        };
      });
      const { app, listRevisions } = harness({ rateLimit });
      const response = get(app);
      await rateStarted;
      await vi.advanceTimersByTimeAsync(8_000);
      const status = Promise.race([
        response.then((result) => result.status),
        new Promise<number>((resolve) => setTimeout(() => resolve(0), 1)),
      ]);
      await vi.advanceTimersByTimeAsync(1);
      expect(await status).toBe(504);
      expect(rateLimit).toHaveBeenCalledTimes(2);
      expect(listRevisions).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not begin admission when the route budget is already exhausted', async () => {
    const rateLimit = vi.fn(async (input: { limit: number }) => ({
      ok: true as const,
      value: {
        allowed: true,
        limit: input.limit,
        remaining: input.limit - 1,
        resetAt: 60_000,
      },
    }));
    const { app, listRevisions } = harness({ deadlineMs: 0, rateLimit });
    const response = await get(app);
    expect(response.status).toBe(504);
    expect(rateLimit).not.toHaveBeenCalled();
    expect(listRevisions).not.toHaveBeenCalled();
  });

  it('does not let an asynchronous telemetry sink hold a completed response', async () => {
    const { app } = harness({
      telemetry: () => new Promise<void>(() => undefined),
    });
    expect((await get(app)).status).toBe(200);
  });
});

describe('CMS-03B-03 protected revision-history route', () => {
  it('returns a strict page with a strong version ETag and no-store', async () => {
    const { app, listRevisions } = harness();
    const response = await get(app, '?limit=1&state=draft&locale=en-US');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(page);
    expect(response.headers.get('etag')).toBe('"2"');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('location')).toBeNull();
    expect(listRevisions).toHaveBeenCalledTimes(1);
    expect(listRevisions.mock.calls[0]?.[0]).toMatchObject({
      operationId: 'CMS-03B-03',
      path: { entryId },
      query: { entryId, limit: 1, state: 'draft', locale: 'en-US' },
    });
  });

  it('rejects duplicated and unknown query keys before any dependency call', async () => {
    const { app, listRevisions } = harness();
    const duplicate = await get(app, '?limit=1&limit=2');
    expect(duplicate.status).toBe(400);
    expect(await duplicate.json()).toMatchObject({
      details: { violations: [{ path: '/limit', code: 'duplicate_field' }] },
    });
    const unknown = await get(app, '?ownerId=x');
    expect(unknown.status).toBe(400);
    expect(await unknown.json()).toMatchObject({
      details: { violations: [{ path: '/ownerId', code: 'unknown_field' }] },
    });
    expect(listRevisions).not.toHaveBeenCalled();
  });

  it('rejects a zero limit and malformed cursor', async () => {
    const { app, listRevisions } = harness();
    expect((await get(app, '?limit=0')).status).toBe(400);
    expect((await get(app, '?cursor=')).status).toBe(400);
    expect((await get(app, `?cursor=${'a'.repeat(513)}`)).status).toBe(400);
    expect(listRevisions).not.toHaveBeenCalled();
  });

  it.each([
    ['?limit=0', '/limit'],
    ['?limit=51', '/limit'],
    ['?limit=1.5', '/limit'],
    ['?limit=abc', '/limit'],
    ['?cursor=', '/cursor'],
    [`?cursor=${'a'.repeat(513)}`, '/cursor'],
    ['?compareRevisionId=not-a-uuid', '/compareRevisionId'],
    ['?locale=en_US', '/locale', 'locale_invalid'],
  ])(
    'returns the locked 400 violation for malformed history query %s',
    async (query, path, code = 'invalid_value') => {
      const { app, listRevisions } = harness();
      const response = await get(app, query);
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        code: 'INVALID_REQUEST',
        details: {
          violations: [
            {
              path,
              code,
              message: 'The value is invalid.',
            },
          ],
        },
      });
      expect(listRevisions).not.toHaveBeenCalled();
    },
  );

  it('allows a reviewer but rejects a caller without read capability', async () => {
    const { app } = harness();
    expect((await get(app)).status).toBe(200);
    const denied = harness({
      resolveSession: async () => ({
        ok: true,
        value: {
          userId: '10000000-0000-4000-8000-000000000001',
          actingPartyId: null,
          capabilities: [],
          mfaFresh: true,
        },
      }),
    });
    expect((await get(denied.app)).status).toBe(403);
  });

  it('keeps missing production wiring fail-closed', async () => {
    const { app } = harness({
      ports: {
        appendRevision: async () => ({
          ok: false,
          status: 503,
          code: 'DEPENDENCY_UNAVAILABLE',
          message: 'Unavailable.',
        }),
      },
    });
    const response = await get(app);
    expect(response.status).toBe(503);
    expect(response.headers.get('x-cms-editorial-retryable')).toBe('true');
  });

  it('rejects a malformed dependency page instead of relaying it', async () => {
    const { app } = harness({
      ports: {
        appendRevision: async () => ({
          ok: false,
          status: 503,
          code: 'DEPENDENCY_UNAVAILABLE',
          message: 'Unavailable.',
        }),
        listRevisions: async () => ({
          ok: true,
          value: { ...page, leak: true } as never,
        }),
      },
    });
    expect((await get(app)).status).toBe(502);
  });

  it('uses the independent 300/min read budget and propagates denial', async () => {
    const scopes: string[] = [];
    const { app, listRevisions } = harness({
      rateLimit: async (input) => {
        scopes.push(`${input.rateScope}:${input.limit}`);
        return input.rateScope === 'party'
          ? {
              ok: true,
              value: {
                allowed: false,
                limit: 600,
                remaining: 0,
                resetAt: 2,
              },
            }
          : {
              ok: true,
              value: {
                allowed: true,
                limit: 300,
                remaining: 299,
                resetAt: 2,
              },
            };
      },
    });
    const response = await get(app);
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('2');
    expect(scopes).toEqual(['user:300', 'party:600']);
    expect(listRevisions).not.toHaveBeenCalled();
  });

  it('rejects an invalid state filter and a foreign origin before a read', async () => {
    const { app, listRevisions } = harness();
    expect((await get(app, '?state=unknown')).status).toBe(422);
    const foreign = await get(app, '', {
      origin: 'https://foreign.example.test',
    });
    expect(foreign.status).toBe(403);
    expect(foreign.headers.get('access-control-allow-origin')).toBeNull();
    expect(listRevisions).not.toHaveBeenCalled();
  });

  it('rejects malformed path IDs and mutation-only headers', async () => {
    const { app, listRevisions } = harness();
    const invalidPath = await app.request(
      '/api/v1/cms/entries/not-a-uuid/revisions',
      { method: 'GET', headers: { origin } },
    );
    expect(invalidPath.status).toBe(400);
    expect((await get(app, '', { 'idempotency-key': 'key' })).status).toBe(400);
    expect((await get(app, '', { 'if-match': '"2"' })).status).toBe(400);
    expect(listRevisions).not.toHaveBeenCalled();
  });

  it('rejects read media and body claims before session or persistence', async () => {
    const resolveSession = vi.fn(async () => ({
      ok: true as const,
      value: {
        userId: '10000000-0000-4000-8000-000000000001',
        actingPartyId: null,
        capabilities: ['cms.reviewer'],
        mfaFresh: true,
      },
    }));
    const { app, listRevisions } = harness({ resolveSession });
    expect(
      (await get(app, '', { 'content-type': 'application/json' })).status,
    ).toBe(415);
    expect((await get(app, '', { 'content-length': '1' })).status).toBe(400);
    expect(
      (await get(app, '', { 'transfer-encoding': 'chunked' })).status,
    ).toBe(400);
    // The 415 is BE00 step 2 and never resolves a session; the two 400s are
    // step 6 and follow authentication.
    expect(resolveSession).toHaveBeenCalledTimes(2);
    expect(listRevisions).not.toHaveBeenCalled();
  });

  it('generates an ID and uses the clock fallback for a request without injected values', async () => {
    const { dependencies } = harness();
    const { now: _clock, ...withoutClock } = dependencies;
    void _clock;
    const app = createCmsEditorialApp(withoutClock);
    const response = await app.request(path, {
      method: 'GET',
      headers: { origin },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('maps session transport and shape failures before persistence', async () => {
    const thrown = harness({
      resolveSession: async () => {
        throw new Error('private session failure');
      },
    });
    const unavailable = await get(thrown.app);
    expect(unavailable.status).toBe(503);
    expect(await unavailable.text()).not.toContain('private session failure');
    const unauthenticated = harness({
      resolveSession: async () => ({
        ok: false,
        status: 401,
        code: 'UNAUTHENTICATED',
        message: 'No session.',
      }),
    });
    expect((await get(unauthenticated.app)).status).toBe(401);
    const invalid = harness({
      resolveSession: async () => ({
        ok: true,
        value: {
          userId: 'not-a-uuid',
          actingPartyId: null,
          capabilities: ['cms.reviewer'],
          mfaFresh: true,
        },
      }),
    });
    expect((await get(invalid.app)).status).toBe(401);
    expect(thrown.listRevisions).not.toHaveBeenCalled();
  });

  it('keeps limiter and persistence failures typed and redacted', async () => {
    const limited = harness({
      rateLimit: async () => ({
        ok: false,
        status: 429,
        code: 'RATE_LIMITED',
        message: 'Limited.',
      }),
    });
    const denied = await get(limited.app);
    expect(denied.status).toBe(429);
    expect(denied.headers.get('ratelimit-limit')).toBe('300');
    expect(denied.headers.get('retry-after')).toBe('1');

    const rateFailure = harness({
      rateLimit: async () => ({
        ok: false,
        status: 503,
        code: 'DEPENDENCY_UNAVAILABLE',
        message: 'Unavailable.',
      }),
    });
    expect((await get(rateFailure.app)).status).toBe(503);
    const missing = harness({
      ports: {
        appendRevision: async () => ({
          ok: false,
          status: 503,
          code: 'DEPENDENCY_UNAVAILABLE',
          message: 'Unavailable.',
        }),
        listRevisions: async () => ({
          ok: false,
          status: 404,
          code: 'NOT_FOUND',
          message: 'Hidden.',
        }),
      },
    });
    const concealed = await get(missing.app);
    expect(concealed.status).toBe(404);
    expect(await concealed.text()).not.toContain('Hidden.');
  });
});

describe('Codex s10-ts-2 M1: CMS-03B-03 publishes the read-specific error projection', () => {
  const failing = (failure: Record<string, unknown>) =>
    harness({
      ports: {
        appendRevision: async () => ({
          ok: false,
          status: 503,
          code: 'DEPENDENCY_UNAVAILABLE',
          message: 'Unavailable.',
        }),
        listRevisions: async () => ({ ok: false, ...failure }) as never,
      },
    });

  it('keeps only a registered read reasonCode on a visible 403 and drops every write-path member', async () => {
    const { app } = failing({
      status: 403,
      code: 'FORBIDDEN',
      message: 'Missing private assignment 123.',
      details: {
        reasonCode: 'CAPABILITY_REQUIRED',
        currentVersion: '9',
        expectedVersion: '8',
        dependencyClass: 'cms_rpc_private',
      },
    });
    const response = await get(app);
    expect(response.status).toBe(403);
    const payload = ApiErrorSchema.parse(await response.json());
    expect(payload.details).toEqual({ reasonCode: 'CAPABILITY_REQUIRED' });
  });

  it('publishes the declared cursor/context 409 with only conflict and recoveryAction', async () => {
    const { app } = failing({
      status: 409,
      code: 'CONFLICT',
      message: 'Cursor bound to another actor 123.',
      details: {
        conflict: 'INVALID_TRANSITION',
        recoveryAction: 'refresh',
        expectedVersion: '1',
        currentVersion: '2',
        reasonCode: 'cursor_context_mismatch',
      },
    });
    const response = await get(app);
    expect(response.status).toBe(409);
    const text = await response.text();
    expect(JSON.parse(text).details).toEqual({
      conflict: 'INVALID_TRANSITION',
      recoveryAction: 'refresh',
    });
    expect(text).not.toContain('actor 123');
  });

  it('conceals a 404 to empty details even when the dependency supplied some', async () => {
    const { app } = failing({
      status: 404,
      code: 'NOT_FOUND',
      message: 'Hidden.',
      details: { reasonCode: 'concealed', currentVersion: '4' },
    });
    const response = await get(app);
    expect(response.status).toBe(404);
    expect(ApiErrorSchema.parse(await response.json()).details).toEqual({});
  });
});
