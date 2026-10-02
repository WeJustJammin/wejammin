import { describe, expect, it, vi } from 'vitest';
import type { EntryCreateResource } from '@wejammin/contracts';

import { createCmsEditorialApp, type CmsEditorialDependencies } from './index';

const entryId = '30000000-0000-4000-8000-000000000003';
const revisionId = '40000000-0000-4000-8000-000000000004';
const versionId = '50000000-0000-4000-8000-000000000005';
const fieldId = '60000000-0000-4000-8000-000000000006';
const origin = 'https://cms-console.example.test';
const hash = 'a'.repeat(64);
const policy = {
  key: 'editorial.standard',
  version: '1',
  policyHash: hash,
  riskClass: 'ordinary',
  requiredDecisionCount: 1,
  requiredCapabilities: [],
  approvalEvidenceHash: hash,
} as const;
const body = {
  contentTypeId: entryId,
  contentTypeVersionId: versionId,
  locale: 'en-US',
  changedPaths: [`/fields/${fieldId}`],
  values: { [fieldId]: 'Hello' },
  schemaArtifact: {
    id: revisionId,
    contentTypeVersionId: versionId,
    artifactHash: hash,
    compilerVersion: '1.0.0',
    zodContractRef: '03a.content-type-version.v1',
  },
  validatorRefs: [],
  workflowPolicy: policy,
  activationEvidence: policy,
};
const resource: EntryCreateResource = {
  entry: {
    id: entryId,
    version: '1',
    createdAt: '2026-09-26T12:00:00.000Z',
    updatedAt: '2026-09-26T12:00:00.000Z',
  },
  revision: {
    id: revisionId,
    version: '1',
    createdAt: '2026-09-26T12:00:00.000Z',
    updatedAt: '2026-09-26T12:00:00.000Z',
  },
  revisionNumber: '1',
  lifecycle: 'active',
  state: 'draft',
  locale: 'en-US',
  contentHash: hash,
  validationState: 'valid',
};
const unavailable = async () => ({
  ok: false as const,
  status: 503 as const,
  code: 'DEPENDENCY_UNAVAILABLE',
  message: 'Unavailable.',
});
const harness = (
  options: {
    deadlineMs?: number;
    createEntry?: (input: unknown, signal: AbortSignal) => Promise<unknown>;
    omitPort?: boolean;
    capabilities?: readonly string[];
    rateLimit?: CmsEditorialDependencies['rateLimit'];
    resolveSession?: CmsEditorialDependencies['resolveSession'];
    telemetry?: CmsEditorialDependencies['telemetry'];
    omitClock?: boolean;
  } = {},
) => {
  const createEntry = vi.fn(
    options.createEntry ?? (async () => ({ ok: true, value: resource })),
  );
  const rateLimit = vi.fn(
    options.rateLimit ??
      (async (input: unknown) => {
        expect(input).toBeDefined();
        return {
          ok: true as const,
          value: { allowed: true, limit: 120, remaining: 119, resetAt: 60_000 },
        };
      }),
  );
  const dependencies = {
    ports: options.omitPort
      ? { appendRevision: unavailable }
      : { appendRevision: unavailable, createEntry },
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
  return { app: createCmsEditorialApp(dependencies), createEntry, rateLimit };
};
const post = (
  app: ReturnType<typeof createCmsEditorialApp>,
  value: unknown = body,
  headers: Record<string, string> = {},
): Promise<Response> =>
  Promise.resolve(
    app.request('/api/v1/cms/entries', {
      method: 'POST',
      headers: {
        origin,
        'content-type': 'application/json',
        'idempotency-key': 'entry-create-0001',
        'x-request-id': 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        ...headers,
      },
      body: JSON.stringify(value),
    }),
  );

describe('CMS-03B-10 protected initial-entry create route', () => {
  it('creates an active entry with first draft, scoped rate limits, ETag, and Location', async () => {
    const { app, createEntry, rateLimit } = harness();
    const response = await post(app);
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(resource);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('etag')).toBe('"1"');
    expect(response.headers.get('location')).toBe(
      `/api/v1/cms/entries/${entryId}`,
    );
    expect(createEntry).toHaveBeenCalledTimes(1);
    expect(createEntry.mock.calls[0]?.[0]).toMatchObject({
      operationId: 'CMS-03B-10',
      body,
      idempotencyKey: 'entry-create-0001',
    });
    expect(rateLimit.mock.calls.map((call) => call[0])).toMatchObject([
      { operationId: 'CMS-03B-10', rateScope: 'user', limit: 120 },
      { operationId: 'CMS-03B-10', rateScope: 'party', limit: 240 },
    ]);
  });

  it('rejects caller authority and If-Match before mutation', async () => {
    const { app, createEntry } = harness();
    expect((await post(app, { ...body, ownerId: entryId })).status).toBe(422);
    expect((await post(app, body, { 'if-match': '"1"' })).status).toBe(400);
    expect(createEntry).not.toHaveBeenCalled();
  });

  it('fails closed without a production port or author capability', async () => {
    expect((await post(harness({ omitPort: true }).app)).status).toBe(503);
    expect(
      (await post(harness({ capabilities: ['cms.reviewer'] }).app)).status,
    ).toBe(403);
  });

  it('refuses malformed initial-entry success', async () => {
    const { app } = harness({
      createEntry: async () => ({
        ok: true,
        value: { ...resource, revisionNumber: '2' },
      }),
    });
    expect((await post(app)).status).toBe(502);
  });

  it('admits only an allowed preflight origin', async () => {
    const { app } = harness();
    const allowed = await app.request('/api/v1/cms/entries', {
      method: 'OPTIONS',
      headers: { origin },
    });
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get('access-control-allow-methods')).toBe(
      'POST, OPTIONS',
    );
    expect(allowed.headers.get('access-control-allow-headers')).not.toContain(
      'If-Match',
    );
    expect(
      (await app.request('/api/v1/cms/entries', { method: 'OPTIONS' })).status,
    ).toBe(403);
    expect(
      (
        await app.request('/api/v1/cms/entries', {
          method: 'OPTIONS',
          headers: {
            origin: 'https://evil.example.test',
            'x-request-id': 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          },
        })
      ).status,
    ).toBe(403);
  });

  it('rejects disallowed origin, media, missing key, and failed cookie CSRF', async () => {
    const { app, createEntry } = harness();
    expect(
      (await post(app, body, { origin: 'https://evil.example.test' })).status,
    ).toBe(403);
    expect(
      (await post(app, body, { 'content-type': 'text/plain' })).status,
    ).toBe(415);
    expect((await post(app, body, { 'idempotency-key': '' })).status).toBe(400);
    expect(
      (
        await app.request('/api/v1/cms/entries', {
          method: 'POST',
          headers: { origin, 'content-type': 'application/json' },
          body: JSON.stringify(body),
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await post(app, body, {
          cookie: 'wj_session_ref=abc; wj_csrf=expected',
        })
      ).status,
    ).toBe(403);
    expect(createEntry).not.toHaveBeenCalled();
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

  it('enforces rate and dependency errors without exposing private details', async () => {
    const denied = harness({
      rateLimit: async () => ({
        ok: true,
        value: { allowed: false, limit: 120, remaining: 0, resetAt: 60_000 },
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
      createEntry: async () => ({
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

  it('rejects an invalid resource shape and wrong response locale', async () => {
    const malformed = harness({
      createEntry: async () => ({
        ok: true,
        value: { ...resource, secret: 'leak' },
      }),
    });
    expect((await post(malformed.app)).status).toBe(502);
    const wrongLocale = harness({
      createEntry: async () => ({
        ok: true,
        value: { ...resource, locale: 'fr' },
      }),
    });
    expect((await post(wrongLocale.app)).status).toBe(502);
  });

  it('uses the default clock and generated request id when omitted', async () => {
    const { app } = harness({ omitClock: true });
    const response = await app.request('/api/v1/cms/entries', {
      method: 'POST',
      headers: {
        origin,
        'content-type': 'application/json',
        'idempotency-key': 'entry-create-0001',
      },
      body: JSON.stringify(body),
    });
    expect(response.status).toBe(201);
    expect(response.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
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

  it('bounds a streamed create body that never finishes', async () => {
    const { app, createEntry } = harness({ deadlineMs: 50 });
    const request = new Request('https://api.example.test/api/v1/cms/entries', {
      method: 'POST',
      headers: {
        origin,
        'content-type': 'application/json',
        'idempotency-key': 'entry-create-0001',
      },
      body: new ReadableStream<Uint8Array>({ start() {} }),
      duplex: 'half',
    } as RequestInit);
    const status = await Promise.race([
      Promise.resolve(app.request(request)).then((response) => response.status),
      new Promise<number>((resolve) => setTimeout(() => resolve(0), 250)),
    ]);
    expect(status).toBe(504);
    expect(createEntry).not.toHaveBeenCalled();
  });

  it('refuses create admission when the shared budget has expired', async () => {
    const { app, rateLimit, createEntry } = harness({ deadlineMs: 0 });
    expect((await post(app)).status).toBe(504);
    expect(rateLimit).not.toHaveBeenCalled();
    expect(createEntry).not.toHaveBeenCalled();
  });

  it('aborts the create port when cumulative stage latency exhausts one shared route budget', async () => {
    const { app, createEntry } = harness({
      deadlineMs: 200,
      rateLimit: async () => {
        await new Promise((resolve) => setTimeout(resolve, 40));
        return {
          ok: true as const,
          value: { allowed: true, limit: 120, remaining: 119, resetAt: 60_000 },
        };
      },
      createEntry: (_input, signal) =>
        new Promise(() => {
          // The port stops progressing when aborted but never settles.
          signal.addEventListener('abort', () => undefined, { once: true });
        }),
    });
    const beganAt = performance.now();
    const response = await post(app, body, {
      'x-deadline-test-sleep': 'not-a-real-header',
    });
    expect(response.status).toBe(504);
    // A cumulative budget fires near the full deadline (~200ms); separate
    // per-stage budgets would spend 40ms per scope before the port's own
    // fresh budget, landing past 240ms.
    expect(performance.now() - beganAt).toBeLessThan(240);
    expect(createEntry).toHaveBeenCalledTimes(1);
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
