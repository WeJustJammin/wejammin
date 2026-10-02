import { describe, expect, it, vi } from 'vitest';
import { type EntryRevisionResource } from '@wejammin/contracts';

import { createCmsEditorialApp, type CmsEditorialDependencies } from './index';

const entryId = '30000000-0000-4000-8000-000000000003';
const conflictId = '31000000-0000-4000-8000-000000000003';
const baseId = '40000000-0000-4000-8000-000000000004';
const theirsId = '41000000-0000-4000-8000-000000000004';
const resolvedId = '42000000-0000-4000-8000-000000000004';
const fieldId = '60000000-0000-4000-8000-000000000006';
const origin = 'https://cms-console.example.test';
const path = `/api/v1/cms/entries/${entryId}/conflicts/${conflictId}/resolve`;
const body = {
  entryId,
  conflictId,
  baseRevision: '1',
  choices: [{ path: `/fields/${fieldId}`, choice: 'theirs' }],
  expectedVersion: '2',
};
const resource: EntryRevisionResource = {
  id: resolvedId,
  version: '1',
  createdAt: '2026-09-26T12:00:00.000Z',
  updatedAt: '2026-09-26T12:00:00.000Z',
  state: 'draft',
  entryId,
  revisionNumber: '3',
  schemaVersionId: '50000000-0000-4000-8000-000000000005',
  templateVersionId: null,
  taxonomyVersionIds: [],
  locale: 'en-US',
  contentHash: 'a'.repeat(64),
  parentRevisionIds: [baseId, theirsId],
  validationState: 'valid',
  conflictId,
};
const unavailable = async () => ({
  ok: false as const,
  status: 503 as const,
  code: 'DEPENDENCY_UNAVAILABLE',
  message: 'Unavailable.',
});

const harness = (
  options: {
    resolveConflict?: (input: unknown, signal: AbortSignal) => Promise<unknown>;
    omitPort?: boolean;
    capabilities?: readonly string[];
    rateLimit?: CmsEditorialDependencies['rateLimit'];
    resolveSession?: CmsEditorialDependencies['resolveSession'];
    telemetry?: CmsEditorialDependencies['telemetry'];
    deadlineMs?: number;
    omitClock?: boolean;
  } = {},
) => {
  const resolveConflict = vi.fn(
    options.resolveConflict ?? (async () => ({ ok: true, value: resource })),
  );
  const rateLimit = vi.fn(
    options.rateLimit ??
      (async () => ({
        ok: true as const,
        value: { allowed: true, limit: 60, remaining: 59, resetAt: 60_000 },
      })),
  );
  const dependencies = {
    ports: options.omitPort
      ? { appendRevision: unavailable }
      : { appendRevision: unavailable, resolveConflict },
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
    humanOrigins: [origin],
    deadlineMs: options.deadlineMs,
    telemetry: options.telemetry,
    ...(options.omitClock ? {} : { now: () => 0 }),
  } as unknown as CmsEditorialDependencies;
  return {
    app: createCmsEditorialApp(dependencies),
    resolveConflict,
    rateLimit,
  };
};

const post = (
  app: ReturnType<typeof createCmsEditorialApp>,
  value: unknown = body,
  overrides: Record<string, string> = {},
  target = path,
): Promise<Response> =>
  Promise.resolve(
    app.request(target, {
      method: 'POST',
      headers: {
        origin,
        'content-type': 'application/json',
        'idempotency-key': 'conflict-resolve-0001',
        'if-match': '"2"',
        'x-request-id': 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        ...overrides,
      },
      body: JSON.stringify(value),
    }),
  );

describe('CMS-03B-02 protected conflict-resolution route', () => {
  it('delegates a validated explicit choice to the private port and returns a no-store two-parent revision', async () => {
    const { app, resolveConflict, rateLimit } = harness();
    const response = await post(app);
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(resource);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('etag')).toBe('"1"');
    expect(response.headers.get('location')).toBe(
      `/api/v1/cms/entries/${entryId}/revisions/${resolvedId}`,
    );
    expect(resolveConflict).toHaveBeenCalledTimes(1);
    expect(resolveConflict.mock.calls[0]?.[0]).toMatchObject({
      operationId: 'CMS-03B-02',
      path: { entryId, conflictId },
      body,
      idempotencyKey: 'conflict-resolve-0001',
      ifMatch: '2',
    });
    expect(rateLimit).toHaveBeenCalledTimes(2);
    expect(rateLimit.mock.calls[0]?.[0]).toMatchObject({
      operationId: 'CMS-03B-02',
      rateClass: 'cms-entry-conflict',
      rateScope: 'user',
      limit: 60,
    });
    expect(rateLimit.mock.calls[1]?.[0]).toMatchObject({
      rateScope: 'party',
      limit: 120,
    });
  });

  it('rejects duplicate paths, inferred choices, and path/body mismatch before mutation', async () => {
    const { app, resolveConflict } = harness();
    for (const invalid of [
      { ...body, choices: [...body.choices, ...body.choices] },
      { ...body, choices: [] },
      { ...body, entryId: baseId },
      { ...body, choices: [{ ...body.choices[0], value: 'smuggled' }] },
    ]) {
      const response = await post(app, invalid);
      expect(response.status).toBe(422);
    }
    expect(resolveConflict).not.toHaveBeenCalled();
  });

  it('rejects missing edit capability and a weak validator before mutation', async () => {
    const { app, resolveConflict } = harness({
      capabilities: ['cms.reviewer'],
    });
    expect((await post(app)).status).toBe(403);
    expect((await post(app, body, { 'if-match': 'W/"2"' })).status).toBe(400);
    expect(resolveConflict).not.toHaveBeenCalled();
  });

  it('does not expose a hidden conflict or call the port on invalid UUID path', async () => {
    const { app, resolveConflict } = harness();
    const response = await post(
      app,
      body,
      {},
      `/api/v1/cms/entries/${entryId}/conflicts/not-a-uuid/resolve`,
    );
    expect(response.status).toBe(400);
    expect(resolveConflict).not.toHaveBeenCalled();
  });

  it('maps a moved-base conflict without leaking private values', async () => {
    const { app } = harness({
      resolveConflict: async () => ({
        ok: false,
        status: 409,
        code: 'CONFLICT',
        message: 'The conflict base moved.',
        details: { conflict: 'VERSION_MISMATCH', privateValues: 'secret' },
      }),
    });
    const response = await post(app);
    expect(response.status).toBe(409);
    const payload = (await response.json()) as {
      details: Record<string, unknown>;
    };
    expect(payload.details).not.toHaveProperty('privateValues');
  });

  it('fails closed when the persistence port is not yet wired', async () => {
    const { app } = harness({ omitPort: true });
    const response = await post(app);
    expect(response.status).toBe(503);
    const payload = (await response.json()) as {
      code: string;
      details: Record<string, unknown>;
    };
    expect(payload.code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(payload.details).not.toHaveProperty('conflictId');
  });

  it('rejects a malformed or wrong-conflict RPC success as a bad gateway', async () => {
    const { app } = harness({
      resolveConflict: async () => ({
        ok: true,
        value: { ...resource, conflictId: baseId },
      }),
    });
    const response = await post(app);
    expect(response.status).toBe(502);
    expect(response.headers.get('x-cms-editorial-retryable')).toBe('false');
  });

  it('rejects body/header version disagreement before reaching the port', async () => {
    const { app, resolveConflict } = harness();
    const response = await post(app, { ...body, expectedVersion: '3' });
    expect(response.status).toBe(422);
    expect(resolveConflict).not.toHaveBeenCalled();
  });

  it('accepts only a configured CORS preflight origin', async () => {
    const { app } = harness();
    const allowed = await app.request(path, {
      method: 'OPTIONS',
      headers: {
        origin,
        'x-request-id': 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      },
    });
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get('access-control-allow-methods')).toBe(
      'POST, OPTIONS',
    );
    expect(allowed.headers.get('cache-control')).toBe('no-store');
    const missing = await app.request(path, { method: 'OPTIONS' });
    const foreign = await app.request(path, {
      method: 'OPTIONS',
      headers: { origin: 'https://other.example.test' },
    });
    expect(missing.status).toBe(403);
    expect(foreign.status).toBe(403);
  });

  it('rejects origin, entry path and media before resolving identity', async () => {
    const { app, resolveConflict } = harness();
    expect(
      (await post(app, body, { origin: 'https://other.example.test' })).status,
    ).toBe(403);
    expect(
      (
        await post(
          app,
          body,
          {},
          `/api/v1/cms/entries/not-a-uuid/conflicts/${conflictId}/resolve`,
        )
      ).status,
    ).toBe(400);
    expect(
      (await post(app, body, { 'content-type': 'text/plain' })).status,
    ).toBe(415);
    expect(resolveConflict).not.toHaveBeenCalled();
  });

  it('enforces CSRF for cookie sessions and rejects conflict/body disagreement', async () => {
    const { app, resolveConflict } = harness();
    expect(
      (
        await post(app, body, {
          cookie: 'wj_session_ref=session; wj_csrf=token',
        })
      ).status,
    ).toBe(403);
    expect((await post(app, { ...body, conflictId: baseId })).status).toBe(422);
    expect(resolveConflict).not.toHaveBeenCalled();
  });

  it('fails closed for thrown, denied, or malformed session resolution', async () => {
    const cases: CmsEditorialDependencies['resolveSession'][] = [
      async () => {
        throw new Error('private auth failure');
      },
      async () => ({
        ok: false,
        status: 401,
        code: 'UNAUTHENTICATED',
        message: 'No session.',
      }),
      async () => ({
        ok: true,
        value: {
          userId: 'not-a-uuid',
          actingPartyId: null,
          capabilities: ['cms.author'],
          mfaFresh: true,
        },
      }),
    ];
    for (const resolveSession of cases) {
      const { app, resolveConflict } = harness({ resolveSession });
      const response = await post(app);
      expect([401, 503]).toContain(response.status);
      expect(resolveConflict).not.toHaveBeenCalled();
    }
  });

  it('enforces the conflict-specific rate decision and fails closed on limiter outage', async () => {
    const limited = harness({
      rateLimit: async () => ({
        ok: false,
        status: 429,
        code: 'RATE_LIMITED',
        message: 'Too many requests.',
        retryAfterSeconds: 5,
      }),
    });
    const denied = await post(limited.app);
    expect(denied.status).toBe(429);
    expect(denied.headers.get('ratelimit-limit')).toBe('60');
    expect(denied.headers.get('ratelimit-remaining')).toBe('0');
    expect(limited.resolveConflict).not.toHaveBeenCalled();

    const outage = harness({
      rateLimit: async () => ({
        ok: false,
        status: 503,
        code: 'DEPENDENCY_UNAVAILABLE',
        message: 'Unavailable.',
      }),
    });
    expect((await post(outage.app)).status).toBe(503);
    expect(outage.resolveConflict).not.toHaveBeenCalled();
  });

  it('uses generated request and duration defaults when optional inputs are absent', async () => {
    const { app } = harness({ omitClock: true });
    const response = await app.request(path, {
      method: 'POST',
      headers: {
        origin,
        'content-type': 'application/json',
        'idempotency-key': 'conflict-resolve-0001',
        'if-match': '"2"',
      },
      body: JSON.stringify(body),
    });
    expect(response.status).toBe(201);
    expect(response.headers.get('x-request-id')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu,
    );
  });

  it('aborts a stalled session dependency at the route deadline', async () => {
    let observedSignal: AbortSignal | undefined;
    const { app, rateLimit } = harness({
      deadlineMs: 200,
      resolveSession: (_request, signal) => {
        observedSignal = signal as AbortSignal;
        return new Promise(() => {
          // The session dependency never settles on its own.
        });
      },
    });
    const response = await post(app);
    expect(response.status).toBe(504);
    expect(observedSignal?.aborted).toBe(true);
    expect(rateLimit).not.toHaveBeenCalled();
  });

  it('bounds a streamed request body that never finishes', async () => {
    const { app, resolveConflict } = harness({ deadlineMs: 50 });
    const request = new Request(`https://api.example.test${path}`, {
      method: 'POST',
      headers: {
        origin,
        'content-type': 'application/json',
        'idempotency-key': 'conflict-resolve-0001',
        'if-match': '"2"',
      },
      body: new ReadableStream<Uint8Array>({ start() {} }),
      duplex: 'half',
    } as RequestInit);
    const status = await Promise.race([
      Promise.resolve(app.request(request)).then((response) => response.status),
      new Promise<number>((resolve) => setTimeout(() => resolve(0), 250)),
    ]);
    expect(status).toBe(504);
    expect(resolveConflict).not.toHaveBeenCalled();
  });

  it('refuses admission when the shared budget has already expired', async () => {
    const { app, rateLimit, resolveConflict } = harness({ deadlineMs: 0 });
    expect((await post(app)).status).toBe(504);
    expect(rateLimit).not.toHaveBeenCalled();
    expect(resolveConflict).not.toHaveBeenCalled();
  });

  it('aborts the resolve port when cumulative stage latency exhausts one shared route budget', async () => {
    const { app, resolveConflict } = harness({
      deadlineMs: 200,
      rateLimit: async () => {
        await new Promise((resolve) => setTimeout(resolve, 40));
        return {
          ok: true as const,
          value: { allowed: true, limit: 60, remaining: 59, resetAt: 60_000 },
        };
      },
      resolveConflict: (_input, signal) =>
        new Promise(() => {
          // The port stops progressing when aborted but never settles.
          signal.addEventListener('abort', () => undefined, { once: true });
        }),
    });
    const beganAt = performance.now();
    const response = await post(app);
    expect(response.status).toBe(504);
    // A cumulative budget fires near the full deadline (~200ms); separate
    // per-stage budgets would spend 40ms per scope before the port's own
    // fresh budget, landing past 240ms.
    expect(performance.now() - beganAt).toBeLessThan(240);
    expect(resolveConflict).toHaveBeenCalledTimes(1);
  });

  it('returns the response even when telemetry never settles', async () => {
    const { app } = harness({
      telemetry: () =>
        new Promise(() => {
          // A stalled telemetry sink must not hold the response open.
        }),
    });
    const response = await post(app);
    expect(response.status).toBe(201);
  });
});
