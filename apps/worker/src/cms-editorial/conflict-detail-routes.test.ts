import { describe, expect, it, vi } from 'vitest';

import {
  ApiErrorSchema,
  ConflictDetailResourceSchema,
  type ConflictDetailResource,
} from '@wejammin/contracts';

import { createCmsEditorialApp, type CmsEditorialDependencies } from './index';

/**
 * QA-RED for CMS-03B-12 (BE03b `/api/v1/cms/entries/{entryId}/conflicts/{conflictId}`).
 * The protected three-way conflict-detail read is not registered and no
 * `getConflictDetail` port exists yet, so every case below must fail only
 * because the route/port is absent, never because of an assertion error.
 */

const origin = 'https://cms-console.example.test';
const requestId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const userId = '10000000-0000-4000-8000-000000000001';
const partyId = '20000000-0000-4000-8000-000000000002';
const entryId = '30000000-0000-4000-8000-000000000003';
const conflictId = '31000000-0000-4000-8000-000000000003';
const baseRevisionId = '40000000-0000-4000-8000-000000000004';
const theirsRevisionId = '41000000-0000-4000-8000-000000000004';
const schemaVersionId = '50000000-0000-4000-8000-000000000005';
const fieldId = '60000000-0000-4000-8000-000000000006';
const hash = 'a'.repeat(64);
const instant = '2026-09-26T12:00:00.000Z';
const path = `/api/v1/cms/entries/${entryId}/conflicts/${conflictId}`;

const side = (value: string) => ({
  value,
  provenance: 'authored' as const,
  valueHash: hash,
});

/** A strict, contract-valid open conflict: divergent paths are present. */
const openConflict: ConflictDetailResource = {
  conflict: {
    id: conflictId,
    version: '2',
    createdAt: instant,
    updatedAt: instant,
    state: 'open',
    changedPaths: [`/fields/${fieldId}`],
    conflictHash: hash,
  },
  entry: { id: entryId, version: '3', createdAt: instant, updatedAt: instant },
  base: {
    revisionId: baseRevisionId,
    revisionNumber: '1',
    schemaVersionId,
    contentHash: hash,
  },
  theirs: {
    revisionId: theirsRevisionId,
    revisionNumber: '2',
    schemaVersionId,
    contentHash: hash,
  },
  yours: { source: 'proposed', revisionId: null, contentHash: hash },
  paths: [
    {
      path: `/fields/${fieldId}`,
      base: side('Mine'),
      theirs: side('Theirs'),
      yours: side('Yours'),
    },
  ],
  resolvedRevisionId: null,
};

/** A resolved record has no divergent sides left, so `paths` is empty. */
const resolvedConflict: ConflictDetailResource = {
  ...openConflict,
  conflict: { ...openConflict.conflict, state: 'resolved' },
  paths: [],
  resolvedRevisionId: baseRevisionId,
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
  const getConflictDetail = vi.fn(
    options.port ?? (async () => ({ ok: true as const, value: openConflict })),
  );
  const telemetry = vi.fn(options.telemetry ?? ((): void => undefined));
  const ports =
    options.omitPort === true
      ? { appendRevision: unavailable }
      : { appendRevision: unavailable, getConflictDetail };
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
  return {
    app: createCmsEditorialApp(dependencies),
    getConflictDetail,
    telemetry,
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

describe('CMS-03B-12 protected conflict-detail route', () => {
  it('[P2-S10-AC-088] serves the strict three-way conflict detail with a strong no-store ETag', async () => {
    const { app, getConflictDetail } = harness();
    const response = await get(app);
    expect(response.status).toBe(200);
    expect(ConflictDetailResourceSchema.parse(await response.json())).toEqual(
      openConflict,
    );
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('etag')).toMatch(/^"[^"].*"$/u);
    expect(response.headers.get('etag')).not.toContain('W/');
    expect(getConflictDetail).toHaveBeenCalledTimes(1);
  });

  it('[P2-S10-AC-088] binds the port to the exact CMS-03B-12 operation and both path ids', async () => {
    const { app, getConflictDetail } = harness();
    expect((await get(app)).status).toBe(200);
    expect(getConflictDetail.mock.calls[0]?.[0]).toMatchObject({
      operationId: 'CMS-03B-12',
      path: { entryId, conflictId },
    });
  });

  it('[P2-S10-AC-088] changes the strong ETag whenever a bound conflict or entry version changes', async () => {
    let current = openConflict;
    const { app } = harness({
      port: async () => ({ ok: true, value: current }),
    });
    const before = await get(app);
    current = {
      ...openConflict,
      conflict: { ...openConflict.conflict, version: '4' },
      entry: { ...openConflict.entry, version: '5' },
    };
    const after = await get(app);
    expect(before.status).toBe(200);
    expect(after.status).toBe(200);
    expect(before.headers.get('etag')).not.toBe(after.headers.get('etag'));
    expect(after.headers.get('cache-control')).toBe('no-store');
  });

  it('[P2-S10-AC-088] treats a resolved or superseded payload as a dependency fault (DEC-139: only an open conflict is served)', async () => {
    const closedPayloads = [
      resolvedConflict,
      {
        ...resolvedConflict,
        conflict: { ...openConflict.conflict, state: 'superseded' },
        resolvedRevisionId: null,
      },
      // A closed state is refused whatever else the payload carries.
      {
        ...openConflict,
        conflict: { ...openConflict.conflict, state: 'resolved' },
      },
      { ...openConflict, resolvedRevisionId: baseRevisionId },
      // An internally inconsistent open payload is a dependency fault too.
      {
        ...openConflict,
        paths: [
          {
            ...openConflict.paths[0],
            base: { value: 'hidden', provenance: 'missing', valueHash: null },
          },
        ],
      },
      {
        ...openConflict,
        paths: [openConflict.paths[0], openConflict.paths[0]],
      },
      {
        ...openConflict,
        conflict: {
          ...openConflict.conflict,
          changedPaths: ['/fields/60000000-0000-4000-8000-000000000099'],
        },
      },
    ] as unknown as readonly ConflictDetailResource[];
    for (const value of closedPayloads) {
      const { app } = harness({ port: async () => ({ ok: true, value }) });
      const response = await get(app);
      expect(response.status).toBe(502);
      expect(response.headers.get('etag')).toBeNull();
      const text = await response.text();
      expect(ApiErrorSchema.parse(JSON.parse(text)).code).toBe('BAD_GATEWAY');
      expect(text).not.toContain('resolved');
      expect(text).not.toContain('superseded');
      expect(text).not.toContain('hidden');
    }
  });

  it('[P1-S10-API] rejects a dependency resource whose entry or conflict id is not bound to the request', async () => {
    const mismatchedEntry = {
      ...openConflict,
      entry: {
        ...openConflict.entry,
        id: '30000000-0000-4000-8000-000000000013',
      },
    };
    const mismatchedConflict = {
      ...openConflict,
      conflict: {
        ...openConflict.conflict,
        id: '31000000-0000-4000-8000-000000000013',
      },
    };
    for (const value of [mismatchedEntry, mismatchedConflict]) {
      const { app } = harness({ port: async () => ({ ok: true, value }) });
      const response = await get(app);
      expect(response.status).toBe(502);
      expect(ApiErrorSchema.parse(await response.json()).code).toBe(
        'BAD_GATEWAY',
      );
    }
  });

  it('[P2-S10-AC-092] refuses an open record with no paths and a closed record that still carries paths', async () => {
    for (const invalid of [
      { ...openConflict, paths: [] },
      { ...resolvedConflict, paths: openConflict.paths },
    ] as unknown as readonly ConflictDetailResource[]) {
      const { app } = harness({
        port: async () => ({ ok: true, value: invalid }),
      });
      const response = await get(app);
      expect(response.status).toBe(502);
      expect(ApiErrorSchema.parse(await response.json()).code).toBe(
        'BAD_GATEWAY',
      );
    }
  });

  it('[P2-S10-AC-092] refuses any payload that serializes an ownership or resolver identifier', async () => {
    const leaky = {
      ...openConflict,
      resolvedByPersonId: userId,
      ownerId: partyId,
      paths: [{ ...openConflict.paths[0], ownership: { ownerId: partyId } }],
    } as unknown as ConflictDetailResource;
    const { app } = harness({ port: async () => ({ ok: true, value: leaky }) });
    const response = await get(app);
    expect(response.status).toBe(502);
    const text = await response.text();
    expect(text).not.toContain(userId);
    expect(text).not.toContain(partyId);
    expect(text).not.toContain('resolvedByPersonId');
  });

  it('[P2-S10-AC-090] conceals a hidden or absent conflict as an indistinguishable 404 with empty details', async () => {
    const { app, getConflictDetail } = harness({
      port: async () => ({
        ok: false,
        status: 404,
        code: 'NOT_FOUND',
        message: 'The requested CMS editorial resource was not found.',
        details: { reasonCode: 'concealed' },
      }),
    });
    const response = await get(app);
    expect(response.status).toBe(404);
    // The literal conflict-detail route answers a typed BE00 envelope, not the
    // framework's plain 404 text; the JSON content type is part of the gate.
    expect(response.headers.get('content-type')).toContain('application/json');
    const payload = ApiErrorSchema.parse(JSON.parse(await response.text()));
    expect(payload.code).toBe('NOT_FOUND');
    expect(payload.details).toEqual({});
    const text = JSON.stringify(payload);
    expect(text).not.toContain(conflictId);
    expect(text).not.toContain(entryId);
    expect(getConflictDetail).toHaveBeenCalledTimes(1);
  });

  it('[P2-S10-AC-090] distinguishes a visible-but-unassigned conflict as 403 without disclosing values', async () => {
    const { app } = harness({
      port: async () => ({
        ok: false,
        status: 403,
        code: 'FORBIDDEN',
        message: 'The action is not allowed.',
        details: { reasonCode: 'entry_not_assigned' },
      }),
    });
    const response = await get(app);
    expect(response.status).toBe(403);
    expect(ApiErrorSchema.parse(await response.json()).code).toBe('FORBIDDEN');
  });

  it('[P2-S10-AC-089] rejects a malformed entry or conflict UUID as 400 before any dependency work', async () => {
    const resolveSession = vi.fn(async () => ({
      ok: true as const,
      value: {
        userId,
        actingPartyId: partyId,
        capabilities: ['cms.author'],
        mfaFresh: true,
      },
    }));
    const { app, getConflictDetail } = harness({ resolveSession });
    const badEntry = await app.request(
      `/api/v1/cms/entries/not-a-uuid/conflicts/${conflictId}`,
      { method: 'GET', headers: { origin, 'x-request-id': requestId } },
    );
    expect(badEntry.status).toBe(400);
    const badConflict = await app.request(
      `/api/v1/cms/entries/${entryId}/conflicts/not-a-uuid`,
      { method: 'GET', headers: { origin, 'x-request-id': requestId } },
    );
    expect(badConflict.status).toBe(400);
    expect(resolveSession).not.toHaveBeenCalled();
    expect(getConflictDetail).not.toHaveBeenCalled();
  });

  it('[P2-S10-AC-089] rejects undeclared queries, request bodies, and mutation headers on the read', async () => {
    const { app, getConflictDetail } = harness();
    expect((await get(app, '?state=open')).status).toBe(400);
    expect((await get(app, '?', { 'idempotency-key': 'key' })).status).toBe(
      400,
    );
    expect((await get(app, '?', { 'if-match': '"2"' })).status).toBe(400);
    expect((await get(app, '?', { 'content-length': '2' })).status).toBe(400);
    expect(
      (await get(app, '?', { 'content-type': 'application/json' })).status,
    ).toBe(415);
    expect(getConflictDetail).not.toHaveBeenCalled();
  });

  it('[P2-S10-AC-090] answers an anonymous caller 401 and a reviewer-only session 403 before persistence', async () => {
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
    expect(anonymous.getConflictDetail).not.toHaveBeenCalled();
    expect(reviewer.getConflictDetail).not.toHaveBeenCalled();
  });

  it('[P2-S10-AC-091] fails closed when the conflict-detail port is not wired', async () => {
    const { app } = harness({ omitPort: true });
    const response = await get(app);
    expect(response.status).toBe(503);
    expect(ApiErrorSchema.parse(await response.json()).code).toBe(
      'DEPENDENCY_UNAVAILABLE',
    );
  });

  it('[P2-S10-AC-091] enforces the declared read rate and publishes the read limit', async () => {
    const { app, getConflictDetail } = harness({
      rateLimit: async () => ({
        ok: true,
        value: { allowed: false, limit: 300, remaining: 0, resetAt: 60 },
      }),
    });
    const response = await get(app);
    expect(response.status).toBe(429);
    expect(response.headers.get('ratelimit-limit')).toBe('300');
    expect(response.headers.get('ratelimit-remaining')).toBe('0');
    expect(response.headers.get('retry-after')).not.toBeNull();
    expect(ApiErrorSchema.parse(await response.json()).code).toBe(
      'RATE_LIMITED',
    );
    expect(getConflictDetail).not.toHaveBeenCalled();
  });

  it('[P2-S10-AC-092] maps a dependency timeout to 504 and an invalid response to 502', async () => {
    const timed = harness({
      port: () => new Promise<never>(() => undefined),
      deadlineMs: 10,
    });
    expect((await get(timed.app)).status).toBe(504);
    const broken = harness({
      port: async () => ({ ok: true, value: { conflict: {} } }),
    });
    expect((await get(broken.app)).status).toBe(502);
  });

  it('[P1-S10-API] normalizes undeclared dependency errors (409 is not declared for CMS-03B-12) to a scrubbed 500 and drops private details', async () => {
    const { app } = harness({
      port: async () => ({
        ok: false,
        status: 409,
        code: 'CONFLICT',
        message: 'private SQL detail',
        retryAfterSeconds: Number.POSITIVE_INFINITY,
        details: {
          reasonCode: 'private reason',
          ownerId: partyId,
          retryAfterSeconds: 999_999,
        },
      }),
    });
    const response = await get(app);
    // BE03b matrix row CMS-03B-12: 409 is "not applicable to bounded read", so
    // an upstream 409 is an undeclared cell and fails closed, never as a
    // user-blamed 400.
    expect(response.status).toBe(500);
    expect(response.headers.get('retry-after')).toBeNull();
    const payload = ApiErrorSchema.parse(await response.json());
    expect(payload.code).toBe('INTERNAL_ERROR');
    expect(payload.message).not.toContain('private SQL detail');
    expect(payload.details).toEqual({});
  });

  it('[P1-S10-API] composes request cancellation with the bounded dependency signal', async () => {
    const controller = new AbortController();
    let dependencySignal: AbortSignal | undefined;
    const { app, getConflictDetail } = harness({
      port: async (_input, signal) => {
        dependencySignal = signal;
        return new Promise<never>(() => undefined);
      },
    });
    const pending = app.fetch(
      new Request(`https://worker.example.test${path}`, {
        method: 'GET',
        headers: { origin, 'x-request-id': requestId },
        signal: controller.signal,
      }),
    );
    await vi.waitFor(() => expect(getConflictDetail).toHaveBeenCalledTimes(1));
    controller.abort();
    const response = await pending;
    expect(response.status).toBe(504);
    expect(dependencySignal?.aborted).toBe(true);
  });

  it('[P2-S10-AC-093] emits redacted telemetry carrying only the CMS-03B-12 operation id', async () => {
    const { app, telemetry } = harness();
    expect((await get(app)).status).toBe(200);
    const event = telemetry.mock.calls[0]?.[0] as unknown as Record<
      string,
      unknown
    >;
    expect(event.operationId).toBe('CMS-03B-12');
    expect(event.actorClass).toBe('human');
    const serialized = JSON.stringify(event);
    for (const secret of [
      entryId,
      conflictId,
      userId,
      partyId,
      'Mine',
      'Theirs',
    ])
      expect(serialized).not.toContain(secret);
  });
});
