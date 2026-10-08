import { describe, expect, it, vi } from 'vitest';
import {
  REVISION_RESTORE_SEAMS,
  type EntryRevisionResource,
  type RevisionRestoreVerification,
} from '@wejammin/contracts';

import { createCmsEditorialApp, type CmsEditorialDependencies } from './index';

const entryId = '30000000-0000-4000-8000-000000000003';
const sourceRevisionId = '40000000-0000-4000-8000-000000000004';
const restoredRevisionId = '41000000-0000-4000-8000-000000000004';
const migrationChainId = '50000000-0000-4000-8000-000000000005';
const sourceSchemaVersionId = '60000000-0000-4000-8000-000000000006';
const activeSchemaVersionId = '70000000-0000-4000-8000-000000000007';
const origin = 'https://cms-console.example.test';
const path = `/api/v1/cms/entries/${entryId}/revisions/${sourceRevisionId}/restore`;
const body = {
  entryId,
  revisionId: sourceRevisionId,
  migrationChainId,
  expectedVersion: '2',
};
const resource: EntryRevisionResource = {
  id: restoredRevisionId,
  version: '1',
  entryVersion: '3',
  createdAt: '2026-09-26T12:00:00.000Z',
  updatedAt: '2026-09-26T12:00:00.000Z',
  state: 'draft',
  entryId,
  revisionNumber: '3',
  schemaVersionId: migrationChainId,
  templateVersionId: null,
  taxonomyVersionIds: [],
  locale: 'en-US',
  contentHash: 'a'.repeat(64),
  parentRevisionIds: [sourceRevisionId],
  validationState: 'valid',
  conflictId: null,
};
const unavailable = async () => ({
  ok: false as const,
  status: 503 as const,
  code: 'DEPENDENCY_UNAVAILABLE',
  message: 'Unavailable.',
});
const verification = {
  request: {
    entryId,
    revisionId: sourceRevisionId,
    migrationChainId,
    expectedVersion: '2',
  },
  registry: {
    revisionId: sourceRevisionId,
    migrationChainId,
    sourceSchemaVersionId,
    activeSchemaVersionId,
    chainSchemaVersionIds: [sourceSchemaVersionId, activeSchemaVersionId],
    entryVersion: '2',
  },
  seams: [...REVISION_RESTORE_SEAMS],
} as const;
const harness = (
  options: {
    restoreRevision?: (input: unknown, signal: AbortSignal) => Promise<unknown>;
    omitPort?: boolean;
    capabilities?: readonly string[];
    resolveSession?: CmsEditorialDependencies['resolveSession'];
    rateLimit?: CmsEditorialDependencies['rateLimit'];
    telemetry?: CmsEditorialDependencies['telemetry'];
    omitClock?: boolean;
    deadlineMs?: number;
  } = {},
) => {
  const restoreRevision = vi.fn(
    options.restoreRevision ??
      (async () => ({
        ok: true as const,
        value: {
          resource,
          restoreVerification: verification,
        } satisfies {
          resource: EntryRevisionResource;
          restoreVerification: RevisionRestoreVerification;
        },
      })),
  );
  const rateLimit = vi.fn(
    options.rateLimit ??
      (async (input: unknown) => {
        expect(input).toBeDefined();
        return {
          ok: true as const,
          value: { allowed: true, limit: 30, remaining: 29, resetAt: 60_000 },
        };
      }),
  );
  const dependencies = {
    ports: options.omitPort
      ? { appendRevision: unavailable }
      : { appendRevision: unavailable, restoreRevision },
    resolveSession:
      options.resolveSession ??
      (async () => ({
        ok: true as const,
        value: {
          userId: '10000000-0000-4000-8000-000000000001',
          actingPartyId: '20000000-0000-4000-8000-000000000002',
          capabilities: options.capabilities ?? ['cms.author'],
          mfaFresh: true,
        },
      })),
    rateLimit,
    ...(options.telemetry === undefined
      ? {}
      : { telemetry: options.telemetry }),
    humanOrigins: [origin],
    ...(options.deadlineMs === undefined
      ? {}
      : { deadlineMs: options.deadlineMs }),
    ...(options.omitClock ? {} : { now: () => 0 }),
  } as unknown as CmsEditorialDependencies;
  return {
    app: createCmsEditorialApp(dependencies),
    restoreRevision,
    rateLimit,
  };
};
const post = (
  app: ReturnType<typeof createCmsEditorialApp>,
  value: unknown = body,
  headers: Record<string, string> = {},
  target = path,
): Promise<Response> =>
  Promise.resolve(
    app.request(target, {
      method: 'POST',
      headers: {
        origin,
        'content-type': 'application/json',
        'idempotency-key': 'revision-restore-0001',
        'if-match': '"2"',
        'x-request-id': 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        ...headers,
      },
      body: JSON.stringify(value),
    }),
  );

describe('CMS-03B-04 protected revision-restore route', () => {
  it('delegates a typed restore and returns a new draft revision with strong ETag', async () => {
    const { app, restoreRevision, rateLimit } = harness();
    const response = await post(app);
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(resource);
    expect(response.headers.get('etag')).toBe('"3"');
    expect(response.headers.get('location')).toBe(
      `/api/v1/cms/entries/${entryId}/revisions/${restoredRevisionId}`,
    );
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(restoreRevision.mock.calls[0]?.[0]).toMatchObject({
      operationId: 'CMS-03B-04',
      path: { entryId, revisionId: sourceRevisionId },
      body,
      idempotencyKey: 'revision-restore-0001',
      ifMatch: '2',
    });
    expect(rateLimit.mock.calls.map((call) => call[0])).toMatchObject([
      {
        operationId: 'CMS-03B-04',
        rateClass: 'cms-entry-write',
        rateScope: 'user',
        limit: 30,
      },
      {
        operationId: 'CMS-03B-04',
        rateClass: 'cms-entry-write',
        rateScope: 'party',
        limit: 60,
      },
    ]);
  });

  it('rejects mismatched path/body identities and validator before mutation', async () => {
    const { app, restoreRevision } = harness();
    expect(
      (await post(app, { ...body, entryId: migrationChainId })).status,
    ).toBe(422);
    expect(
      (await post(app, { ...body, revisionId: restoredRevisionId })).status,
    ).toBe(422);
    expect((await post(app, { ...body, expectedVersion: '3' })).status).toBe(
      422,
    );
    expect((await post(app, body, { 'if-match': 'W/"2"' })).status).toBe(400);
    expect(restoreRevision).not.toHaveBeenCalled();
  });

  it('fails closed without a restore port or edit capability', async () => {
    expect((await post(harness({ omitPort: true }).app)).status).toBe(503);
    expect(
      (await post(harness({ capabilities: ['cms.reviewer'] }).app)).status,
    ).toBe(403);
  });

  it('rejects a forged or wrong-entry restored revision', async () => {
    const { app } = harness({
      restoreRevision: async () => ({
        ok: true,
        value: {
          resource: { ...resource, entryId: migrationChainId },
          restoreVerification: verification,
        } as unknown as { resource: EntryRevisionResource },
      }),
    });
    expect((await post(app)).status).toBe(502);
  });

  it('admits only an allowed preflight origin', async () => {
    const { app } = harness();
    const allowed = await app.request(path, {
      method: 'OPTIONS',
      headers: { origin },
    });
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get('access-control-allow-methods')).toBe(
      'POST, OPTIONS',
    );
    expect(allowed.headers.get('access-control-allow-headers')).toContain(
      'If-Match',
    );
    expect((await app.request(path, { method: 'OPTIONS' })).status).toBe(403);
    expect(
      (
        await app.request(path, {
          method: 'OPTIONS',
          headers: {
            origin: 'https://evil.example.test',
            'x-request-id': 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          },
        })
      ).status,
    ).toBe(403);
  });

  it('rejects invalid origin, path IDs, media, headers, CSRF, and body', async () => {
    const { app, restoreRevision } = harness();
    expect(
      (await post(app, body, { origin: 'https://evil.example.test' })).status,
    ).toBe(403);
    expect(
      (await post(app, body, {}, path.replace(entryId, 'not-an-id'))).status,
    ).toBe(400);
    expect(
      (await post(app, body, {}, path.replace(sourceRevisionId, 'not-an-id')))
        .status,
    ).toBe(400);
    expect(
      (await post(app, body, { 'content-type': 'text/plain' })).status,
    ).toBe(415);
    expect((await post(app, body, { 'idempotency-key': '' })).status).toBe(400);
    expect(
      (
        await post(app, body, {
          cookie: 'wj_session_ref=abc; wj_csrf=expected',
        })
      ).status,
    ).toBe(403);
    expect((await post(app, { ...body, unknownKey: 'forbidden' })).status).toBe(
      422,
    );
    expect(restoreRevision).not.toHaveBeenCalled();
  });

  it('fails closed on thrown, rejected, or malformed sessions', async () => {
    const thrown = harness({
      resolveSession: async () => {
        throw new Error('private');
      },
    });
    expect((await post(thrown.app)).status).toBe(503);
    const rejected = harness({
      resolveSession: async () => ({
        ok: false,
        status: 401,
        code: 'UNAUTHENTICATED',
        message: 'private',
      }),
    });
    expect((await post(rejected.app)).status).toBe(401);
    const malformed = harness({
      resolveSession: async () => ({
        ok: true,
        value: {
          userId: '',
          actingPartyId: null,
          capabilities: [],
          mfaFresh: false,
        },
      }),
    });
    expect((await post(malformed.app)).status).toBe(401);
  });

  it('enforces rate decisions and scrubs private dependency errors', async () => {
    const denied = harness({
      rateLimit: async () => ({
        ok: true,
        value: { allowed: false, limit: 30, remaining: 0, resetAt: 60_000 },
      }),
    });
    const response = await post(denied.app);
    expect(response.status).toBe(429);
    expect(response.headers.get('ratelimit-remaining')).toBe('0');
    const unavailable = harness({
      rateLimit: async () => ({
        ok: false,
        status: 503,
        code: 'DEPENDENCY_UNAVAILABLE',
        message: 'private',
      }),
    });
    expect((await post(unavailable.app)).status).toBe(503);
    const mutation = harness({
      restoreRevision: async () => ({
        ok: false,
        status: 409,
        code: 'CONFLICT',
        message: 'Changed.',
        details: { privateValue: 'secret' },
      }),
    });
    const conflict = await post(mutation.app);
    expect(conflict.status).toBe(409);
    expect(await conflict.text()).not.toContain('secret');
  });

  it('refuses malformed, source-identical, conflicted, or published success', async () => {
    for (const value of [
      { ...resource, secret: 'leak' },
      { ...resource, id: sourceRevisionId },
      { ...resource, conflictId: migrationChainId },
      { ...resource, state: 'published' },
    ]) {
      const { app } = harness({
        restoreRevision: async () => ({
          ok: true,
          value: {
            resource: value,
            restoreVerification: verification,
          } as unknown as { resource: EntryRevisionResource },
        }),
      });
      expect((await post(app)).status).toBe(502);
    }
  });

  it('uses the default clock and generated request id when omitted', async () => {
    const { app } = harness({ omitClock: true });
    const response = await app.request(path, {
      method: 'POST',
      headers: {
        origin,
        'content-type': 'application/json',
        'idempotency-key': 'revision-restore-0001',
        'if-match': '"2"',
      },
      body: JSON.stringify(body),
    });
    expect(response.status).toBe(201);
    expect(response.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('ends the entire request at the declared deadline when session resolution stalls', async () => {
    vi.useFakeTimers();
    try {
      let notifySession!: () => void;
      let sessionSignal: AbortSignal | undefined;
      const sessionStarted = new Promise<void>((resolve) => {
        notifySession = resolve;
      });
      const { app, restoreRevision, rateLimit } = harness({
        resolveSession: async (_request, signal) => {
          sessionSignal = signal;
          notifySession();
          return new Promise(() => undefined);
        },
      });
      const response = post(app);
      await sessionStarted;
      await vi.advanceTimersByTimeAsync(15_000);
      const status = Promise.race([
        response.then((result) => result.status),
        new Promise<number>((resolve) => setTimeout(() => resolve(0), 1)),
      ]);
      await vi.advanceTimersByTimeAsync(1);
      expect(await status).toBe(504);
      expect(sessionSignal?.aborted).toBe(true);
      expect(rateLimit).not.toHaveBeenCalled();
      expect(restoreRevision).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('uses one deadline across both rate buckets and never starts a late restore', async () => {
    vi.useFakeTimers();
    try {
      let notifyRate!: () => void;
      const rateStarted = new Promise<void>((resolve) => {
        notifyRate = resolve;
      });
      const { app, restoreRevision, rateLimit } = harness({
        rateLimit: async (input) => {
          notifyRate();
          await new Promise<void>((resolve) => setTimeout(resolve, 8_000));
          return {
            ok: true,
            value: {
              allowed: true,
              limit: input.limit,
              remaining: input.limit - 1,
              resetAt: 60_000,
            },
          };
        },
      });
      const response = post(app);
      await rateStarted;
      await vi.advanceTimersByTimeAsync(15_000);
      const status = Promise.race([
        response.then((result) => result.status),
        new Promise<number>((resolve) => setTimeout(() => resolve(0), 1)),
      ]);
      await vi.advanceTimersByTimeAsync(1);
      expect(await status).toBe(504);
      expect(rateLimit).toHaveBeenCalledTimes(2);
      expect(restoreRevision).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not begin admission when the route budget is already exhausted', async () => {
    const { app, restoreRevision, rateLimit } = harness({ deadlineMs: 0 });
    const response = await post(app);
    expect(response.status).toBe(504);
    expect(rateLimit).not.toHaveBeenCalled();
    expect(restoreRevision).not.toHaveBeenCalled();
  });

  it('does not let an asynchronous telemetry sink hold a completed response', async () => {
    const { app } = harness({
      telemetry: () => new Promise<void>(() => undefined),
    });
    expect((await post(app)).status).toBe(201);
  });
});

describe('CMS-03B-04 restore-port internal evidence gate', () => {
  it('fails closed 503 without registry evidence', async () => {
    const missing = harness({
      restoreRevision: async () => ({ ok: true, value: resource }),
    });
    expect((await post(missing.app)).status).toBe(503);

    const malformed = harness({
      restoreRevision: async () => ({
        ok: true,
        value: {
          resource,
          restoreVerification: {
            no: 'seams',
          } as unknown as typeof verification,
        },
      }),
    });
    expect((await post(malformed.app)).status).toBe(503);

    const wrongSeams = harness({
      restoreRevision: async () => ({
        ok: true,
        value: {
          resource,
          restoreVerification: {
            ...verification,
            seams: ['entry_version_cas'],
          },
        },
      }),
    });
    expect((await post(wrongSeams.app)).status).toBe(503);
  });

  it('fails closed 503 when evidence disagrees with the validated request', async () => {
    const wrongRequest = harness({
      restoreRevision: async () => ({
        ok: true,
        value: {
          resource,
          restoreVerification: {
            ...verification,
            request: {
              ...verification.request,
              entryId: migrationChainId,
            },
          },
        },
      }),
    });
    expect((await post(wrongRequest.app)).status).toBe(503);

    const wrongRegistry = harness({
      restoreRevision: async () => ({
        ok: true,
        value: {
          resource,
          restoreVerification: {
            ...verification,
            registry: {
              ...verification.registry,
              migrationChainId: sourceSchemaVersionId,
            },
          },
        },
      }),
    });
    expect((await post(wrongRegistry.app)).status).toBe(503);
  });

  it('fails closed 503 when the recorded chain does not cover the request migrationChainId', async () => {
    const { app } = harness({
      restoreRevision: async () => ({
        ok: true,
        value: {
          resource,
          restoreVerification: {
            ...verification,
            registry: {
              ...verification.registry,
              migrationChainId: activeSchemaVersionId,
            },
          },
        },
      }),
    });
    expect((await post(app)).status).toBe(503);
  });

  it('fails closed 503 when the chain does not span source schema to active schema', async () => {
    const fabricated = harness({
      restoreRevision: async () => ({
        ok: true,
        value: {
          resource,
          restoreVerification: {
            ...verification,
            registry: {
              ...verification.registry,
              chainSchemaVersionIds: [sourceSchemaVersionId],
            },
          },
        },
      }),
    });
    expect((await post(fabricated.app)).status).toBe(503);
  });
});
