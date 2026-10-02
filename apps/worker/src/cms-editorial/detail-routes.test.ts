import { describe, expect, it, vi } from 'vitest';

import {
  ApiErrorSchema,
  EntryDraftDetailResourceSchema,
  type EntryDraftDetailResource,
} from '@wejammin/contracts';

import {
  createCmsEditorialApp,
  type CmsEditorialDependencies,
  type CmsEditorialDraftPortInput,
} from './index';

const entryId = '30000000-0000-4000-8000-000000000003';
const revisionId = '40000000-0000-4000-8000-000000000004';
const origin = 'https://cms-console.example.test';
const path = `/api/v1/cms/entries/${entryId}`;
const requestId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const contentHash = 'a'.repeat(64);
const timestamp = '2026-09-26T12:00:00.000Z';

const draft: EntryDraftDetailResource = {
  entry: {
    id: entryId,
    version: '3',
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  revision: {
    id: revisionId,
    version: '5',
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  lifecycle: 'active',
  state: 'draft',
  locale: 'en-US',
  contentHash,
  validationState: 'valid',
  fields: [],
  relations: [],
};

const unavailable = async () => ({
  ok: false as const,
  status: 503 as const,
  code: 'DEPENDENCY_UNAVAILABLE',
  message: 'Unavailable.',
});

const harness = (overrides: Partial<CmsEditorialDependencies> = {}) => {
  const getEntryDraft = vi.fn(
    async (_input: CmsEditorialDraftPortInput, _signal: AbortSignal) => {
      void _input;
      void _signal;
      return { ok: true as const, value: draft };
    },
  );
  const dependencies: CmsEditorialDependencies = {
    ports: { appendRevision: unavailable, getEntryDraft },
    resolveSession: async () => ({
      ok: true,
      value: {
        userId: '10000000-0000-4000-8000-000000000001',
        actingPartyId: '20000000-0000-4000-8000-000000000002',
        capabilities: ['cms.author'],
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
    getEntryDraft,
    dependencies,
  };
};

const get = (
  app: ReturnType<typeof createCmsEditorialApp>,
  suffix = '',
  headers: Record<string, string> = {},
): Promise<Response> =>
  Promise.resolve(
    app.request(`${path}${suffix}`, {
      method: 'GET',
      headers: { origin, 'x-request-id': requestId, ...headers },
    }),
  );

describe('CMS-03B-11 protected draft-detail route', () => {
  it('returns the exact draft with no-store and a strong entry/revision-bound ETag', async () => {
    const { app, getEntryDraft } = harness();
    const response = await get(app, '?locale=en-US');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(draft);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('etag')).toMatch(
      new RegExp(`^"${entryId}:3:${revisionId}:5:[a-f0-9]{64}"$`),
    );
    expect(getEntryDraft).toHaveBeenCalledTimes(1);
    expect(getEntryDraft.mock.calls[0]?.[0]).toMatchObject({
      operationId: 'CMS-03B-11',
      path: { entryId },
      query: { entryId, locale: 'en-US' },
    });
  });

  it('changes its strong ETag when relation visibility changes without a revision write', async () => {
    const visible: EntryDraftDetailResource = {
      ...draft,
      relations: [
        {
          fieldId: '50000000-0000-4000-8000-000000000005',
          fieldDefinitionId: '50000000-0000-4000-8000-000000000005',
          targetKind: 'content',
          targetId: '60000000-0000-4000-8000-000000000006',
          expectedTargetVersion: '1',
          position: 0,
          onUnavailable: 'omit',
          unavailable: null,
        },
      ],
    };
    let current = visible;
    const { app } = harness({
      ports: {
        appendRevision: unavailable,
        getEntryDraft: async () => ({ ok: true, value: current }),
      },
    });
    const before = await get(app);
    current = draft;
    const after = await get(app);
    expect(before.status).toBe(200);
    expect(after.status).toBe(200);
    expect(
      EntryDraftDetailResourceSchema.parse(await before.json()).relations,
    ).toHaveLength(1);
    expect(
      EntryDraftDetailResourceSchema.parse(await after.json()).relations,
    ).toHaveLength(0);
    expect(before.headers.get('etag')).not.toBe(after.headers.get('etag'));
    expect(after.headers.get('cache-control')).toBe('no-store');
  });

  it('does not reuse a draft-detail ETag across actor contexts', async () => {
    const first = await get(harness().app);
    const second = await get(
      harness({
        resolveSession: async () => ({
          ok: true,
          value: {
            userId: '70000000-0000-4000-8000-000000000007',
            actingPartyId: '20000000-0000-4000-8000-000000000002',
            capabilities: ['cms.author'],
            mfaFresh: true,
          },
        }),
      }).app,
    );
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await first.text()).toBe(await second.text());
    expect(first.headers.get('etag')).not.toBe(second.headers.get('etag'));
  });

  it('fails closed if a response-bound ETag cannot be computed', async () => {
    const digest = vi
      .spyOn(crypto.subtle, 'digest')
      .mockRejectedValueOnce(new Error('private digest failure'));
    try {
      const { app } = harness();
      const response = await get(app);
      expect(response.status).toBe(500);
      expect(response.headers.get('etag')).toBeNull();
      expect(await response.text()).not.toContain('private digest failure');
    } finally {
      digest.mockRestore();
    }
  });

  it('rejects unknown and duplicate query keys before session or persistence', async () => {
    const resolveSession = vi.fn(async () => ({
      ok: false as const,
      status: 401 as const,
      code: 'UNAUTHENTICATED',
      message: 'No session.',
    }));
    const { app, getEntryDraft } = harness({ resolveSession });
    expect((await get(app, '?ownerId=x')).status).toBe(400);
    expect((await get(app, '?locale=en-US&locale=fr')).status).toBe(400);
    expect((await get(app, '?entryId=x')).status).toBe(400);
    expect(resolveSession).not.toHaveBeenCalled();
    expect(getEntryDraft).not.toHaveBeenCalled();
  });

  it('rejects malformed paths and syntactically invalid locales as 400', async () => {
    const { app, getEntryDraft } = harness();
    const malformed = await app.request('/api/v1/cms/entries/not-a-uuid', {
      method: 'GET',
      headers: { origin },
    });
    expect(malformed.status).toBe(400);
    // BE03b's CMS-03B-11 row binds `malformed path/query` to 400, and its
    // policy text states that structural malformed input is always 400 before
    // an existence check; 422 stays reserved for the `response/field bounds`
    // class. The sibling CMS-03B-03 read already answers 400 for the same
    // malformed `locale` under one shared BCP 47 grammar.
    const empty = await get(app, '?locale=');
    expect(empty.status).toBe(400);
    expect(await empty.json()).toMatchObject({
      code: 'INVALID_REQUEST',
      details: {
        violations: [{ path: '/locale', code: 'locale_invalid' }],
      },
    });
    expect((await get(app, '?locale=en_123')).status).toBe(400);
    expect(getEntryDraft).not.toHaveBeenCalled();
  });

  it('relays a semantic dependency 422 without widening the structural 400 boundary', async () => {
    const { app } = harness({
      ports: {
        appendRevision: unavailable,
        getEntryDraft: async () => ({
          ok: false,
          status: 422,
          code: 'VALIDATION_FAILED',
          message: 'The stored draft failed active-schema field bounds.',
          details: {
            violations: [{ path: '/fields/0/value', code: 'invalid_value' }],
          },
        }),
      },
    });
    const response = await get(app);
    expect(response.status).toBe(422);
    const payload = ApiErrorSchema.parse(await response.json());
    expect(payload.code).toBe('VALIDATION_FAILED');
    expect(payload.details).toEqual({
      violations: [
        {
          path: '/fields/0/value',
          code: 'invalid_value',
          message: 'The value is invalid.',
        },
      ],
    });
  });

  it('rejects mutation headers, media, and a foreign origin', async () => {
    const { app, getEntryDraft } = harness();
    expect((await get(app, '', { 'idempotency-key': 'key' })).status).toBe(400);
    expect((await get(app, '', { 'if-match': '"3"' })).status).toBe(400);
    expect(
      (await get(app, '', { 'content-type': 'application/json' })).status,
    ).toBe(415);
    expect((await get(app, '', { 'content-length': '2' })).status).toBe(400);
    const foreign = await get(app, '', {
      origin: 'https://foreign.example.test',
    });
    expect(foreign.status).toBe(403);
    expect(foreign.headers.get('access-control-allow-origin')).toBeNull();
    expect(getEntryDraft).not.toHaveBeenCalled();
  });

  it('requires a valid human session and author/editor read capability', async () => {
    const unauthenticated = harness({
      resolveSession: async () => ({
        ok: false,
        status: 401,
        code: 'UNAUTHENTICATED',
        message: 'No session.',
      }),
    });
    expect((await get(unauthenticated.app)).status).toBe(401);
    const reviewer = harness({
      resolveSession: async () => ({
        ok: true,
        value: {
          userId: '10000000-0000-4000-8000-000000000001',
          actingPartyId: '20000000-0000-4000-8000-000000000002',
          capabilities: ['cms.reviewer'],
          mfaFresh: true,
        },
      }),
    });
    expect((await get(reviewer.app)).status).toBe(403);
    expect(unauthenticated.getEntryDraft).not.toHaveBeenCalled();
    expect(reviewer.getEntryDraft).not.toHaveBeenCalled();
  });

  it('maps thrown or malformed sessions without invoking the draft port', async () => {
    const thrown = harness({
      resolveSession: async () => {
        throw new Error('private session transport');
      },
    });
    const unavailable = await get(thrown.app);
    expect(unavailable.status).toBe(503);
    expect(await unavailable.text()).not.toContain('private session transport');
    const invalid = harness({
      resolveSession: async () => ({
        ok: true,
        value: {
          userId: 'not-a-uuid',
          actingPartyId: null,
          capabilities: ['cms.author'],
          mfaFresh: true,
        },
      }),
    });
    expect((await get(invalid.app)).status).toBe(401);
    expect(thrown.getEntryDraft).not.toHaveBeenCalled();
    expect(invalid.getEntryDraft).not.toHaveBeenCalled();
  });

  it('enforces independent user and party read buckets before persistence', async () => {
    const scopes: string[] = [];
    const { app, getEntryDraft } = harness({
      rateLimit: async (input) => {
        scopes.push(`${input.rateScope}:${input.limit}`);
        return {
          ok: true,
          value: {
            allowed: input.rateScope !== 'party',
            limit: input.limit,
            remaining: 0,
            resetAt: 2,
          },
        };
      },
    });
    const response = await get(app);
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('2');
    expect(scopes).toEqual(['user:300', 'party:600']);
    expect(getEntryDraft).not.toHaveBeenCalled();
  });

  it('maps a failed limiter without inventing a 429 decision', async () => {
    const failed = harness({
      rateLimit: async () => ({
        ok: false,
        status: 503,
        code: 'DEPENDENCY_UNAVAILABLE',
        message: 'Private limiter outage.',
      }),
    });
    const response = await get(failed.app);
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('Private limiter outage.');
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
    expect(limited.getEntryDraft).not.toHaveBeenCalled();
  });

  it('keeps missing production wiring fail-closed', async () => {
    const { app } = harness({ ports: { appendRevision: unavailable } });
    const response = await get(app);
    expect(response.status).toBe(503);
    expect(response.headers.get('x-cms-editorial-retryable')).toBe('true');
  });

  it('rejects an untyped or widened dependency resource without relaying values', async () => {
    const { app } = harness({
      ports: {
        appendRevision: unavailable,
        getEntryDraft: async () => ({
          ok: true,
          value: { ...draft, ownerId: 'private-party' } as never,
        }),
      },
    });
    const response = await get(app);
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain('private-party');
  });

  it('rejects a dependency draft for another entry or requested locale', async () => {
    const forAnotherEntry = harness({
      ports: {
        appendRevision: unavailable,
        getEntryDraft: async () => ({
          ok: true,
          value: {
            ...draft,
            entry: {
              ...draft.entry,
              id: '50000000-0000-4000-8000-000000000005',
            },
          },
        }),
      },
    });
    expect((await get(forAnotherEntry.app)).status).toBe(502);
    const wrongLocale = harness({
      ports: {
        appendRevision: unavailable,
        getEntryDraft: async () => ({ ok: true, value: draft }),
      },
    });
    expect((await get(wrongLocale.app, '?locale=fr')).status).toBe(502);
  });

  it('refuses archived entries and non-draft revision states', async () => {
    for (const value of [
      { ...draft, lifecycle: 'archived' as const },
      { ...draft, state: 'published' as const },
    ]) {
      const { app } = harness({
        ports: {
          appendRevision: unavailable,
          getEntryDraft: async () => ({ ok: true, value }),
        },
      });
      expect((await get(app)).status).toBe(502);
    }
  });

  it('conceals absent entries and scrubs dependency errors', async () => {
    const { app } = harness({
      ports: {
        appendRevision: unavailable,
        getEntryDraft: async () => ({
          ok: false,
          status: 404,
          code: 'NOT_FOUND',
          message: 'Hidden private entry.',
        }),
      },
    });
    const response = await get(app);
    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain('Hidden private entry.');
  });

  it('preserves visible 403 denial without exposing assignment evidence', async () => {
    const { app } = harness({
      ports: {
        appendRevision: unavailable,
        getEntryDraft: async () => ({
          ok: false,
          status: 403,
          code: 'FORBIDDEN',
          message: 'Missing private assignment 123.',
        }),
      },
    });
    const response = await get(app);
    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain('private assignment 123');
  });

  it('bounds a stalled draft dependency and scrubs unexpected failures', async () => {
    const stalled = harness({
      deadlineMs: 1,
      ports: {
        appendRevision: unavailable,
        getEntryDraft: async () => new Promise(() => undefined),
      },
    });
    const timeout = await get(stalled.app);
    expect(timeout.status).toBe(504);
    expect(timeout.headers.get('retry-after')).toBe('5');
    const failed = harness({
      ports: {
        appendRevision: unavailable,
        getEntryDraft: async () => ({
          ok: false,
          status: 500,
          code: 'INTERNAL_ERROR',
          message: 'Private SQL trace 123.',
        }),
      },
    });
    const internal = await get(failed.app);
    expect(internal.status).toBe(500);
    expect(await internal.text()).not.toContain('Private SQL trace 123.');
  });

  it('bounds a stalled session within the shared route deadline', async () => {
    const signals: AbortSignal[] = [];
    const stalled = harness({
      deadlineMs: 10,
      resolveSession: async (_request, signal) => {
        void _request;
        signals.push(signal);
        return new Promise<never>(() => undefined);
      },
    });
    const raced = await Promise.race([
      get(stalled.app).then((response) => response),
      new Promise<never>((_resolve, reject) =>
        setTimeout(() => reject(new Error('route blocked on session')), 500),
      ),
    ]);
    expect(raced.status).toBe(504);
    expect(raced.headers.get('retry-after')).toBe('5');
    expect(stalled.getEntryDraft).not.toHaveBeenCalled();
    expect(signals).toHaveLength(1);
    expect(signals[0]?.aborted).toBe(true);
  });

  it('refuses draft admission when the shared budget has expired', async () => {
    const { app, getEntryDraft } = harness({ deadlineMs: 0 });
    expect((await get(app)).status).toBe(504);
    expect(getEntryDraft).not.toHaveBeenCalled();
  });

  it('spends session, limiter, and port against one cumulative deadline', async () => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'],
    });
    try {
      let settledStatus: number | null = null;
      let settledAt: number | null = null;
      let portCalls = 0;
      const { app } = harness({
        deadlineMs: 40,
        resolveSession: async () => {
          await new Promise((resolve) => setTimeout(resolve, 20));
          return {
            ok: true as const,
            value: {
              userId: '10000000-0000-4000-8000-000000000001',
              actingPartyId: '20000000-0000-4000-8000-000000000002',
              capabilities: ['cms.author'],
              mfaFresh: true,
            },
          };
        },
        rateLimit: async (input) => {
          await new Promise((resolve) => setTimeout(resolve, 3));
          return {
            ok: true as const,
            value: {
              allowed: true,
              limit: input.limit,
              remaining: input.limit - 1,
              resetAt: 60_000,
            },
          };
        },
        ports: {
          appendRevision: unavailable,
          getEntryDraft: async () => {
            portCalls += 1;
            return new Promise<never>(() => undefined);
          },
        },
      });
      const start = Date.now();
      const pending = get(app);
      const settled = pending.then((response) => {
        settledStatus = response.status;
        settledAt = Date.now();
      });
      await vi.advanceTimersByTimeAsync(20);
      await vi.advanceTimersByTimeAsync(6);
      expect(portCalls).toBe(1);
      await vi.advanceTimersByTimeAsync(15);
      if (settledAt === null) await vi.runAllTimersAsync();
      await settled;
      expect(settledStatus).toBe(504);
      if (settledAt === null) throw new Error('the route never settled');
      expect(settledAt).toBeLessThanOrEqual(start + 41);
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns the response without waiting for unsettled telemetry', async () => {
    const seen: unknown[] = [];
    const { app } = harness({
      telemetry: (event) => {
        seen.push(event);
        return new Promise<void>(() => undefined);
      },
    });
    const raced = await Promise.race([
      get(app),
      new Promise<never>((_resolve, reject) =>
        setTimeout(() => reject(new Error('route blocked on telemetry')), 500),
      ),
    ]);
    expect(raced.status).toBe(200);
    expect(await raced.json()).toEqual(draft);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({
      operationId: 'CMS-03B-11',
      outcome: 'success',
      status: 200,
      actorClass: 'human',
    });
    expect(JSON.stringify(seen[0])).not.toContain(entryId);
  });

  it('emits only redacted operation telemetry after a successful read', async () => {
    const telemetry = vi.fn();
    const { app } = harness({ telemetry });
    expect((await get(app)).status).toBe(200);
    expect(telemetry).toHaveBeenCalledTimes(1);
    expect(telemetry.mock.calls[0]?.[0]).toMatchObject({
      operationId: 'CMS-03B-11',
      outcome: 'success',
      status: 200,
      actorClass: 'human',
    });
    expect(JSON.stringify(telemetry.mock.calls[0]?.[0])).not.toContain(entryId);
  });

  it('generates a request id and uses the system clock when none is injected', async () => {
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

  it('answers allowed preflight without invoking protected dependencies', async () => {
    const { app, getEntryDraft } = harness();
    const response = await app.request(path, {
      method: 'OPTIONS',
      headers: { origin },
    });
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-methods')).toBe(
      'GET, OPTIONS',
    );
    const foreign = await app.request(path, {
      method: 'OPTIONS',
      headers: { origin: 'https://foreign.example.test' },
    });
    expect(foreign.status).toBe(403);
    expect(foreign.headers.get('access-control-allow-origin')).toBeNull();
    const withoutOrigin = await app.request(path, { method: 'OPTIONS' });
    expect(withoutOrigin.status).toBe(403);
    expect(ApiErrorSchema.parse(await withoutOrigin.json()).code).toBe(
      'FORBIDDEN',
    );
    expect(getEntryDraft).not.toHaveBeenCalled();
  });
});
