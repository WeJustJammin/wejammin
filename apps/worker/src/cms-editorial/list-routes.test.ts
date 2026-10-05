import { describe, expect, it, vi } from 'vitest';

import {
  ApiErrorSchema,
  EntryListPageSchema,
  type EntryListPage,
} from '@wejammin/contracts';

import { createCmsEditorialApp, type CmsEditorialDependencies } from './index';

/**
 * QA-RED for CMS-03B-13 (BE03b `GET /api/v1/cms/entries`). The assigned-entry
 * keyset list is not registered and no `listEntries` port exists yet, so every
 * case must fail only because the route/port is absent.
 */

const origin = 'https://cms-console.example.test';
const requestId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const userId = '10000000-0000-4000-8000-000000000001';
const partyId = '20000000-0000-4000-8000-000000000002';
const contentTypeId = '60000000-0000-4000-8000-000000000006';
const revisionId = '40000000-0000-4000-8000-000000000004';
const hash = 'a'.repeat(64);
const instant = '2026-09-26T12:00:00.000Z';
const path = '/api/v1/cms/entries';

const page: EntryListPage = {
  items: [
    {
      id: revisionId,
      revisionNumber: '3',
      locale: 'en-US',
      state: 'draft',
      contentHash: hash,
      createdAt: instant,
      authorClass: 'human',
    },
  ],
  nextCursor: null,
  pageVersion: '7',
};

const unavailable = async () => ({
  ok: false as const,
  status: 503 as const,
  code: 'DEPENDENCY_UNAVAILABLE',
  message: 'Unavailable.',
});

type PortOutcome = (input: unknown, signal: AbortSignal) => Promise<unknown>;

type HarnessOptions = Readonly<{
  port?: PortOutcome;
  omitPort?: boolean;
  resolveSession?: CmsEditorialDependencies['resolveSession'];
  rateLimit?: CmsEditorialDependencies['rateLimit'];
  telemetry?: NonNullable<CmsEditorialDependencies['telemetry']>;
  deadlineMs?: number;
}>;

const harness = (options: HarnessOptions = {}) => {
  const listEntries = vi.fn(
    options.port ?? (async () => ({ ok: true as const, value: page })),
  );
  const telemetry = vi.fn(options.telemetry ?? ((): void => undefined));
  const ports =
    options.omitPort === true
      ? { appendRevision: unavailable }
      : { appendRevision: unavailable, listEntries };
  const dependencies = {
    ports,
    resolveSession:
      options.resolveSession ??
      (async () => ({
        ok: true as const,
        value: {
          userId,
          actingPartyId: partyId,
          capabilities: ['cms.author'],
          mfaFresh: true,
        },
      })),
    rateLimit:
      options.rateLimit ??
      (async () => ({
        ok: true as const,
        value: { allowed: true, limit: 300, remaining: 299, resetAt: 60_000 },
      })),
    humanOrigins: [origin],
    now: () => 0,
    ...(options.deadlineMs === undefined
      ? {}
      : { deadlineMs: options.deadlineMs }),
    telemetry,
  } as unknown as CmsEditorialDependencies;
  return { app: createCmsEditorialApp(dependencies), listEntries, telemetry };
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

describe('CMS-03B-13 protected assigned-entry list route', () => {
  it('[P2-S10-AC-094] serves the bounded keyset page with a no-store page ETag', async () => {
    const { app, listEntries } = harness();
    const response = await get(app);
    expect(response.status).toBe(200);
    expect(EntryListPageSchema.parse(await response.json())).toEqual(page);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('etag')).toMatch(/^"[^"].*"$/u);
    expect(response.headers.get('etag')).not.toContain('W/');
    expect(listEntries).toHaveBeenCalledTimes(1);
  });

  it('[P2-S10-AC-095] binds the port to CMS-03B-13 and applies the 25-row default window', async () => {
    const { app, listEntries } = harness();
    expect((await get(app)).status).toBe(200);
    expect(listEntries.mock.calls[0]?.[0]).toMatchObject({
      operationId: 'CMS-03B-13',
      query: { limit: 25 },
    });
  });

  it('[P2-S10-AC-095] accepts only the closed state/contentTypeId/limit/cursor filters', async () => {
    const { app, listEntries } = harness();
    const admitted = await get(
      app,
      `?limit=10&state=draft&contentTypeId=${contentTypeId}&cursor=${'c'.repeat(8)}`,
    );
    expect(admitted.status).toBe(200);
    expect(listEntries.mock.calls[0]?.[0]).toMatchObject({
      query: {
        limit: 10,
        state: 'draft',
        contentTypeId,
        cursor: 'c'.repeat(8),
      },
    });
  });

  it('[P2-S10-AC-095] rejects undeclared query keys, bodies, and mutation headers before reads', async () => {
    const { app, listEntries } = harness();
    expect((await get(app, '?ownerId=x')).status).toBe(400);
    expect((await get(app, '?limit=0')).status).toBe(400);
    expect((await get(app, '?limit=51')).status).toBe(400);
    expect((await get(app, '?limit=1.5')).status).toBe(400);
    expect((await get(app, '?state=nonsense')).status).toBe(400);
    expect((await get(app, `?contentTypeId=not-a-uuid`)).status).toBe(400);
    expect((await get(app, `?cursor=${'c'.repeat(513)}`)).status).toBe(400);
    expect((await get(app, '?', { 'idempotency-key': 'key' })).status).toBe(
      400,
    );
    expect((await get(app, '?', { 'if-match': '"7"' })).status).toBe(400);
    expect((await get(app, '?', { 'content-length': '2' })).status).toBe(400);
    expect(
      (await get(app, '?', { 'content-type': 'application/json' })).status,
    ).toBe(415);
    expect(listEntries).not.toHaveBeenCalled();
  });

  it('[P2-S10-AC-096] returns only authorized rows and never a hidden ownership identifier', async () => {
    const leaky = {
      ...page,
      items: [{ ...page.items[0], ownerId: partyId, assigneeId: userId }],
    } as unknown as EntryListPage;
    const { app } = harness({ port: async () => ({ ok: true, value: leaky }) });
    const response = await get(app);
    expect(response.status).toBe(502);
    const text = await response.text();
    expect(text).not.toContain(partyId);
    expect(text).not.toContain(userId);
    expect(text).not.toContain('ownerId');
  });

  it('[P2-S10-AC-097] signs and binds the next cursor into the page without echoing server scope', async () => {
    const nextCursor = 'signed-opaque-cursor-1';
    const { app } = harness({
      port: async () => ({ ok: true, value: { ...page, nextCursor } }),
    });
    const response = await get(app);
    expect(response.status).toBe(200);
    expect(EntryListPageSchema.parse(await response.json()).nextCursor).toBe(
      nextCursor,
    );
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('[P2-S10-AC-098] maps a malformed or expired cursor to a safe 400 or 409 without upstream text', async () => {
    const { app } = harness({
      port: async () => ({
        ok: false,
        status: 409,
        code: 'CONFLICT',
        message: 'cursor signature mismatch (private detail)',
        details: { reasonCode: 'cursor_context_mismatch' },
      }),
    });
    const response = await get(app, '?cursor=stale');
    expect(response.status).toBe(409);
    const text = await response.text();
    expect(text).not.toContain('signature mismatch');
    expect(text).not.toContain('private detail');
  });

  it('[P2-S10-AC-096] answers an anonymous caller 401 and a reviewer-only session 403 before reads', async () => {
    const anonymous = harness({
      resolveSession: async () => ({
        ok: false,
        status: 401,
        code: 'UNAUTHENTICATED',
        message: 'No session.',
      }),
    });
    expect((await get(anonymous.app)).status).toBe(401);
    const reviewer = harness({
      resolveSession: async () => ({
        ok: true,
        value: {
          userId,
          actingPartyId: partyId,
          capabilities: ['cms.reviewer'],
          mfaFresh: true,
        },
      }),
    });
    expect((await get(reviewer.app)).status).toBe(403);
    expect(anonymous.listEntries).not.toHaveBeenCalled();
    expect(reviewer.listEntries).not.toHaveBeenCalled();
  });

  it('[P2-S10-AC-097] fails closed when the entry-list port is not wired', async () => {
    const { app } = harness({ omitPort: true });
    const response = await get(app);
    expect(response.status).toBe(503);
    expect(ApiErrorSchema.parse(await response.json()).code).toBe(
      'DEPENDENCY_UNAVAILABLE',
    );
  });

  it('[P2-S10-AC-097] enforces the declared read rate with the read limit', async () => {
    const { app, listEntries } = harness({
      rateLimit: async () => ({
        ok: true,
        value: { allowed: false, limit: 300, remaining: 0, resetAt: 60 },
      }),
    });
    const response = await get(app);
    expect(response.status).toBe(429);
    expect(response.headers.get('ratelimit-limit')).toBe('300');
    expect(ApiErrorSchema.parse(await response.json()).code).toBe(
      'RATE_LIMITED',
    );
    expect(listEntries).not.toHaveBeenCalled();
  });

  it('[P2-S10-AC-098] maps a dependency timeout to 504 and an invalid page to 502', async () => {
    const timed = harness({
      port: () => new Promise<never>(() => undefined),
      deadlineMs: 10,
    });
    expect((await get(timed.app)).status).toBe(504);
    const broken = harness({
      port: async () => ({ ok: true, value: { items: 'nope' } }),
    });
    expect((await get(broken.app)).status).toBe(502);
  });

  it('[P2-S10-AC-099] emits redacted telemetry carrying only the CMS-03B-13 operation id', async () => {
    const { app, telemetry } = harness();
    expect((await get(app)).status).toBe(200);
    const event = telemetry.mock.calls[0]?.[0] as unknown as Record<
      string,
      unknown
    >;
    expect(event.operationId).toBe('CMS-03B-13');
    expect(event.actorClass).toBe('human');
    const serialized = JSON.stringify(event);
    for (const secret of [revisionId, contentTypeId, userId, partyId, hash])
      expect(serialized).not.toContain(secret);
  });
});
