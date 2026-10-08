import { describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

import {
  cmsEditorialCapabilitiesSatisfied,
  cmsEditorialRoutePolicies,
  type EntryRevisionResource,
} from '@wejammin/contracts';

import {
  createCmsEditorialApp,
  registerCmsEditorialRoutes,
  type CmsEditorialDependencies,
  type CmsEditorialResult,
  type CmsEditorialSession,
} from './index';

const CMS_ORIGIN = 'https://cms-console.example.test';
const REQUEST_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_ID = '10000000-0000-4000-8000-000000000001';
const PARTY_ID = '20000000-0000-4000-8000-000000000002';
const ENTRY_ID = '30000000-0000-4000-8000-000000000003';
const REVISION_ID = '40000000-0000-4000-8000-000000000004';
const SCHEMA_VERSION_ID = '50000000-0000-4000-8000-000000000005';
const FIELD_ID = '60000000-0000-4000-8000-000000000006';
const HASH = 'a'.repeat(64);
const IDEMPOTENCY_KEY = 'idempotency-key-0001';
const PATH = `/api/v1/cms/entries/${ENTRY_ID}/revisions`;

const revisionBody = {
  entryId: ENTRY_ID,
  baseRevision: '1',
  changedPaths: [`/fields/${FIELD_ID}`],
  values: { [FIELD_ID]: 'Hello' },
  locale: 'en-US',
  expectedVersion: '1',
};

const revisionResource: EntryRevisionResource = {
  id: REVISION_ID,
  version: '1',
  entryVersion: '2',
  createdAt: '2026-09-26T12:00:00.000Z',
  updatedAt: '2026-09-26T12:00:00.000Z',
  state: 'draft',
  entryId: ENTRY_ID,
  revisionNumber: '2',
  schemaVersionId: SCHEMA_VERSION_ID,
  templateVersionId: null,
  taxonomyVersionIds: [],
  locale: 'en-US',
  contentHash: HASH,
  parentRevisionIds: [],
  validationState: 'valid',
  conflictId: null,
};

const session: CmsEditorialSession = {
  userId: USER_ID,
  actingPartyId: PARTY_ID,
  capabilities: ['cms.author'],
  mfaFresh: true,
};

const ok = <T>(value: T): CmsEditorialResult<T> => ({ ok: true, value });

type Port = CmsEditorialDependencies['ports']['appendRevision'];

type HarnessOptions = Readonly<{
  appendRevision?: Port;
  resolveSession?: (
    request: Request,
    signal: AbortSignal,
  ) => Promise<CmsEditorialResult<never>>;
  rateLimit?: CmsEditorialDependencies['rateLimit'];
  telemetry?: NonNullable<CmsEditorialDependencies['telemetry']>;
  now?: NonNullable<CmsEditorialDependencies['now']>;
  deadlineMs?: number;
  omitPort?: boolean;
  origins?: readonly string[];
}>;

const createHarness = (options: HarnessOptions = {}) => {
  const appendRevision = vi.fn(
    options.appendRevision ?? (async () => ok(revisionResource)),
  );
  const telemetry = vi.fn(options.telemetry ?? ((): void => undefined));
  const dependencies: CmsEditorialDependencies = {
    ports:
      options.omitPort === true
        ? ({} as CmsEditorialDependencies['ports'])
        : { appendRevision },
    resolveSession:
      options.resolveSession ?? (async () => ok(session as never)),
    rateLimit:
      options.rateLimit ??
      (async () =>
        ok({
          allowed: true,
          limit: 120,
          remaining: 119,
          resetAt: 1_800_000_060,
        })),
    humanOrigins: options.origins ?? [CMS_ORIGIN],
    ...(options.now === undefined ? {} : { now: options.now }),
    ...(options.deadlineMs === undefined
      ? {}
      : { deadlineMs: options.deadlineMs }),
    telemetry,
  };
  return {
    app: createCmsEditorialApp(dependencies),
    appendRevision,
    telemetry,
    dependencies,
  };
};

const headersFor = (
  mutate: (headers: Record<string, string>) => void = () => undefined,
): Record<string, string> => {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'idempotency-key': IDEMPOTENCY_KEY,
    'if-match': '"1"',
    'x-request-id': REQUEST_ID,
    origin: CMS_ORIGIN,
  };
  mutate(headers);
  return headers;
};

const post = (
  app: ReturnType<typeof createCmsEditorialApp>,
  headers: Record<string, string> = headersFor(),
  body: unknown = revisionBody,
  path: string = PATH,
): Promise<Response> =>
  Promise.resolve(
    app.request(path, { method: 'POST', headers, body: JSON.stringify(body) }),
  );

type TestErrorBody = Readonly<{
  code: string;
  message: string;
  details: Record<string, unknown> & {
    violations: readonly { path: string; code: string; message: string }[];
  };
}>;

const readJson = async (response: Response): Promise<TestErrorBody> =>
  (await response.json()) as TestErrorBody;

describe('cms-editorial CMS-03B-01 route', () => {
  it('refuses a foreign origin and allows a request with no Origin header', async () => {
    const { app } = createHarness();
    const foreign = await post(
      app,
      headersFor((headers) => {
        headers.origin = 'https://evil.example.test';
      }),
    );
    expect(foreign.status).toBe(403);
    expect(foreign.headers.get('access-control-allow-origin')).toBeNull();

    const noOrigin = await post(
      app,
      headersFor((headers) => {
        delete headers.origin;
      }),
    );
    expect(noOrigin.status).toBe(201);
  });

  it('enforces the cookie-gated CSRF rule', async () => {
    const { app } = createHarness();
    const missingToken = await post(
      app,
      headersFor((headers) => {
        headers.cookie = `wj_session_ref=${REQUEST_ID}`;
      }),
    );
    expect(missingToken.status).toBe(403);
    expect((await readJson(missingToken)).code).toBe('FORBIDDEN');

    const emptyToken = await post(
      app,
      headersFor((headers) => {
        headers.cookie = `wj_session_ref=${REQUEST_ID}; wj_csrf=`;
        headers['x-csrf-token'] = 'csrf-token-value';
      }),
    );
    expect(emptyToken.status).toBe(403);

    const matchedToken = await post(
      app,
      headersFor((headers) => {
        headers.cookie = `wj_session_ref=${REQUEST_ID}; wj_csrf=csrf-token-value`;
        headers['x-csrf-token'] = 'csrf-token-value';
      }),
    );
    expect(matchedToken.status).toBe(201);
  });

  it('rate limits with RateLimit and Retry-After headers', async () => {
    const { app, appendRevision } = createHarness({
      rateLimit: async () =>
        ok({ allowed: false, limit: 120, remaining: 0, resetAt: 1 } as never),
    });
    const response = await post(app);
    expect(response.status).toBe(429);
    expect(response.headers.get('ratelimit-limit')).toBe('120');
    expect(response.headers.get('ratelimit-remaining')).toBe('0');
    expect(response.headers.get('retry-after')).toBe('1');
    const body = await readJson(response);
    expect(body.code).toBe('RATE_LIMITED');
    expect(body.details.retryAfterSeconds).toBe(1);
    expect(appendRevision).not.toHaveBeenCalled();
  });

  it('carries the BE00-locked 429 details: retryAfterSeconds, limit, and a resetAt string matching RateLimit-Reset', async () => {
    const now = 1_800_000_000;
    const { app, appendRevision } = createHarness({
      rateLimit: async () =>
        ok({
          allowed: false,
          limit: 120,
          remaining: 0,
          resetAt: now + 30,
        }),
      now: () => now * 1_000,
    });
    const response = await post(app);
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('30');
    expect(response.headers.get('ratelimit-reset')).toBe(String(now + 30));
    const body = await readJson(response);
    expect(body.code).toBe('RATE_LIMITED');
    expect(body.details).toEqual({
      retryAfterSeconds: 30,
      limit: 120,
      resetAt: String(now + 30),
    });
    expect(appendRevision).not.toHaveBeenCalled();
  });

  it('clamps an expired limiter window to a one-second retry while reporting its exact reset', async () => {
    const now = 1_800_000_000;
    const { app, appendRevision } = createHarness({
      rateLimit: async () =>
        ok({
          allowed: false,
          limit: 120,
          remaining: 0,
          resetAt: now - 5,
        }),
      now: () => now * 1_000,
    });
    const response = await post(app);
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('1');
    const body = await readJson(response);
    expect(body.details).toEqual({
      retryAfterSeconds: 1,
      limit: 120,
      resetAt: String(now - 5),
    });
    expect(appendRevision).not.toHaveBeenCalled();
  });

  it('publishes the rejected party bucket limit in both header and body', async () => {
    const now = 1_800_000_000;
    const { app, appendRevision } = createHarness({
      rateLimit: async (input) =>
        ok({
          allowed: input.rateScope === 'user',
          limit: input.rateScope === 'user' ? 120 : 240,
          remaining: input.rateScope === 'user' ? 119 : 0,
          resetAt: now + 30,
        }),
      now: () => now * 1_000,
    });
    const response = await post(app);
    expect(response.status).toBe(429);
    expect(response.headers.get('ratelimit-limit')).toBe('240');
    expect(response.headers.get('ratelimit-remaining')).toBe('0');
    expect(response.headers.get('ratelimit-reset')).toBe(String(now + 30));
    expect((await readJson(response)).details).toEqual({
      retryAfterSeconds: 30,
      limit: 240,
      resetAt: String(now + 30),
    });
    expect(appendRevision).not.toHaveBeenCalled();
  });

  it('fails closed when no appendRevision port is wired', async () => {
    const { app } = createHarness({ omitPort: true });
    const response = await post(app);
    expect(response.status).toBe(503);
    expect((await readJson(response)).code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(response.headers.get('x-cms-editorial-retryable')).toBe('true');
  });

  it('maps a dependency timeout to 504 and a transport failure to 503', async () => {
    const timed = createHarness({
      appendRevision: () =>
        new Promise<CmsEditorialResult<EntryRevisionResource>>(() => undefined),
      deadlineMs: 10,
    });
    const timeout = await post(timed.app);
    expect(timeout.status).toBe(504);
    expect(timeout.headers.get('x-cms-editorial-retryable')).toBe('true');
    expect((await readJson(timeout)).code).toBe('GATEWAY_TIMEOUT');

    const failed = createHarness({
      appendRevision: async () => {
        throw new Error('transport down');
      },
    });
    const unavailable = await post(failed.app);
    expect(unavailable.status).toBe(503);
    expect((await readJson(unavailable)).details.dependencyClass).toBe(
      'cms_editorial',
    );
  });

  it('maps a schema-invalid dependency response to 502', async () => {
    const { app } = createHarness({
      appendRevision: async () =>
        ok({ ...revisionResource, unexpected: true } as never),
    });
    const response = await post(app);
    expect(response.status).toBe(502);
    expect(response.headers.get('x-cms-editorial-retryable')).toBe('false');
    expect((await readJson(response)).code).toBe('BAD_GATEWAY');
  });

  it('scrubs internal failures instead of echoing dependency internals', async () => {
    const { app } = createHarness({
      appendRevision: async () => ({
        ok: false,
        status: 500,
        code: 'bad code',
        message: "SQL: select * from cms.entries where owner = 'leak'",
        details: { reason: 'leak' },
      }),
    });
    const response = await post(app);
    expect(response.status).toBe(500);
    const body = await readJson(response);
    expect(body.code).toBe('INTERNAL_ERROR');
    expect(body.message).toBe('An unexpected error occurred.');
    expect(body.details).toEqual({});
    expect(JSON.stringify(body)).not.toContain('select');
  });

  it('emits redacted telemetry and survives a telemetry transport failure', async () => {
    const { app, telemetry } = createHarness();
    expect((await post(app)).status).toBe(201);
    const event = telemetry.mock.calls[0]?.[0] as unknown as Record<
      string,
      unknown
    >;
    expect(event.operationId).toBe('CMS-03B-01');
    expect(event.status).toBe(201);
    expect(event.actorClass).toBe('human');
    const serialized = JSON.stringify(event);
    for (const secret of [ENTRY_ID, USER_ID, PARTY_ID, FIELD_ID, 'Hello'])
      expect(serialized).not.toContain(secret);

    const throwing = createHarness({
      telemetry: () => {
        throw new Error('telemetry down');
      },
    });
    expect((await post(throwing.app)).status).toBe(201);
  });

  it('answers the cms-console preflight and refuses a foreign origin', async () => {
    const { app } = createHarness();
    const allowed = await app.request(PATH, {
      method: 'OPTIONS',
      headers: { origin: CMS_ORIGIN },
    });
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get('access-control-allow-origin')).toBe(CMS_ORIGIN);
    expect(allowed.headers.get('access-control-allow-credentials')).toBe(
      'true',
    );
    expect(allowed.headers.get('access-control-allow-methods')).toBe(
      'GET, POST, OPTIONS',
    );
    expect(allowed.headers.get('access-control-allow-headers')).toContain(
      'If-Match',
    );
    expect(allowed.headers.get('access-control-allow-headers')).toContain(
      'X-CSRF-Token',
    );
    expect(allowed.headers.get('cache-control')).toBe('no-store');

    const rejected = await app.request(PATH, {
      method: 'OPTIONS',
      headers: { origin: 'https://evil.example.test' },
    });
    expect(rejected.status).toBe(403);

    const anonymous = await app.request(PATH, { method: 'OPTIONS' });
    expect(anonymous.status).toBe(403);
  });

  it('keeps editorial headers off unrelated worker routes', async () => {
    const harness = createHarness();
    const app = new Hono();
    registerCmsEditorialRoutes(app, harness.dependencies);
    app.get('/api/v1/health', () => new Response('health', { status: 200 }));
    const health = await app.request('/api/v1/health', {
      headers: { origin: CMS_ORIGIN },
    });
    expect(await health.text()).toBe('health');
    expect(health.headers.get('access-control-allow-origin')).toBeNull();
    expect(health.headers.get('x-request-id')).toBeNull();
    expect(health.headers.get('cache-control')).toBeNull();
  });

  it('declares the CMS-03B-01 policy without a singular capability field', () => {
    const policy = cmsEditorialRoutePolicies.find(
      (candidate) => candidate.operationId === 'CMS-03B-01',
    );
    expect(policy).toBeDefined();
    expect('capability' in (policy as object)).toBe(false);
    expect(policy?.capabilities).toEqual(['cms.author', 'cms.editor']);
    expect(policy?.capabilityMode).toBe('any_of');
    expect(cmsEditorialCapabilitiesSatisfied([], 'any_of', [])).toBe(false);
    expect(cmsEditorialCapabilitiesSatisfied([], 'all_of', [])).toBe(false);
    expect(
      cmsEditorialCapabilitiesSatisfied(
        ['cms.author', 'cms.editor'],
        'all_of',
        ['cms.author'],
      ),
    ).toBe(false);
  });
});
