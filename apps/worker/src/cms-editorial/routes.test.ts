import { describe, expect, it, vi } from 'vitest';
import { type EntryRevisionResource } from '@wejammin/contracts';

import {
  createCmsEditorialApp,
  type CmsEditorialDependencies,
  type CmsEditorialPortInput,
  type CmsEditorialResult,
  type CmsEditorialSession,
} from './index';

const CMS_ORIGIN = 'https://cms-console.example.test';
const REQUEST_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_ID = '10000000-0000-4000-8000-000000000001';
const PARTY_ID = '20000000-0000-4000-8000-000000000002';
const ENTRY_ID = '30000000-0000-4000-8000-000000000003';
const OTHER_ENTRY_ID = '30000000-0000-4000-8000-000000000013';
const REVISION_ID = '40000000-0000-4000-8000-000000000004';
const SCHEMA_VERSION_ID = '50000000-0000-4000-8000-000000000005';
const FIELD_ID = '60000000-0000-4000-8000-000000000006';
const HASH = 'a'.repeat(64);
const IDEMPOTENCY_KEY = 'idempotency-key-0001';
const PATH = `/api/v1/cms/entries/${ENTRY_ID}/revisions`;

const revisionBody = {
  entryId: ENTRY_ID,
  baseRevision: '1',
  changedPaths: [`/fields/${FIELD_ID}/value`],
  values: { [FIELD_ID]: 'Hello' },
  locale: 'en-US',
  expectedVersion: '1',
};

const revisionResource: EntryRevisionResource = {
  id: REVISION_ID,
  version: '2',
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

/** Real timer captured before fake timers replace the global setTimeout. */
const wallSetTimeout = setTimeout.bind(globalThis);

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
  it('creates a revision with a strong ETag, Location and no-store', async () => {
    const { app, appendRevision } = createHarness();
    const response = await post(app);
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(revisionResource);
    expect(response.headers.get('etag')).toBe('"2"');
    expect(response.headers.get('location')).toBe(`${PATH}/${REVISION_ID}`);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-request-id')).toBe(REQUEST_ID);
    expect(appendRevision).toHaveBeenCalledTimes(1);
    const [input, signal] = appendRevision.mock.calls[0] as [
      CmsEditorialPortInput,
      AbortSignal,
    ];
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(input).toEqual({
      operationId: 'CMS-03B-01',
      requestId: REQUEST_ID,
      request: expect.any(Request),
      session,
      path: { entryId: ENTRY_ID },
      body: revisionBody,
      idempotencyKey: IDEMPOTENCY_KEY,
      ifMatch: '1',
    });
  });

  it('delegates an identical idempotency retry to the durable RPC', async () => {
    const { app, appendRevision } = createHarness();
    const first = await post(app);
    const replay = await post(app);
    expect(replay.status).toBe(201);
    expect(await replay.json()).toEqual(await first.json());
    expect(replay.headers.get('etag')).toBe('"2"');
    expect(appendRevision).toHaveBeenCalledTimes(2);
  });

  it('rejects the same key reused with a different body as 409', async () => {
    const { app, appendRevision } = createHarness({
      appendRevision: async (input) =>
        input.body.locale === 'en-US'
          ? ok(revisionResource)
          : {
              ok: false,
              status: 409,
              code: 'CONFLICT',
              message: 'The idempotency key was used for a different request.',
            },
    });
    expect((await post(app)).status).toBe(201);
    const conflict = await post(app, headersFor(), {
      ...revisionBody,
      locale: 'fr-FR',
    });
    expect(conflict.status).toBe(409);
    expect((await readJson(conflict)).code).toBe('CONFLICT');
    expect(appendRevision).toHaveBeenCalledTimes(2);
  });

  it('returns 401 with a reauthentication hint when no session resolves', async () => {
    const { app, appendRevision } = createHarness({
      resolveSession: async () => ({
        ok: false,
        status: 401,
        code: 'UNAUTHENTICATED',
        message: 'No session.',
        details: {},
      }),
    });
    const response = await post(app);
    expect(response.status).toBe(401);
    expect((await readJson(response)).details).toEqual({
      recoveryAction: 'reauthenticate',
    });
    expect(appendRevision).not.toHaveBeenCalled();
  });

  it('returns 401 when the resolved session shape is invalid', async () => {
    const { app } = createHarness({
      resolveSession: async () => ok({ ...session, mfaFresh: 'yes' } as never),
    });
    const response = await post(app);
    expect(response.status).toBe(401);
    expect((await readJson(response)).details).toEqual({
      recoveryAction: 'reauthenticate',
    });
  });

  it('admits author-only and editor-only capability sets and refuses others', async () => {
    for (const capabilities of [['cms.author'], ['cms.editor']]) {
      const { app } = createHarness({
        resolveSession: async () => ok({ ...session, capabilities } as never),
      });
      expect((await post(app)).status).toBe(201);
    }
    const { app } = createHarness({
      resolveSession: async () =>
        ok({ ...session, capabilities: ['cms.reviewer'] } as never),
    });
    const forbidden = await post(app);
    expect(forbidden.status).toBe(403);
    expect((await readJson(forbidden)).details).toEqual({
      reasonCode: 'CAPABILITY_REQUIRED',
    });
  });

  it('conceals an absent entry as 404 and reports an unassigned editor as 403', async () => {
    const { app } = createHarness({
      appendRevision: async () => ({
        ok: false,
        status: 404,
        code: 'NOT_FOUND',
        message: 'Missing.',
      }),
    });
    const concealed = await post(app);
    expect(concealed.status).toBe(404);
    expect((await readJson(concealed)).details).toEqual({});

    const { app: deniedApp } = createHarness({
      appendRevision: async () => ({
        ok: false,
        status: 403,
        code: 'FORBIDDEN',
        message: 'Denied.',
        details: { reasonCode: 'ASSIGNMENT_REQUIRED', leak: 'secret' },
      }),
    });
    const denied = await deniedApp.request(PATH, {
      method: 'POST',
      headers: headersFor(),
      body: JSON.stringify(revisionBody),
    });
    expect(denied.status).toBe(403);
    expect((await readJson(denied)).details).toEqual({
      reasonCode: 'ASSIGNMENT_REQUIRED',
    });
  });

  it('rejects an unsupported media type as 415', async () => {
    const { app } = createHarness();
    const response = await post(
      app,
      headersFor((headers) => {
        headers['content-type'] = 'text/plain';
      }),
    );
    expect(response.status).toBe(415);
  });

  it('rejects an unreadable JSON body as 400', async () => {
    const { app } = createHarness();
    const response = await app.request(PATH, {
      method: 'POST',
      headers: headersFor(),
      body: '{not json',
    });
    expect(response.status).toBe(400);
    expect((await readJson(response)).code).toBe('INVALID_REQUEST');
  });

  it('rejects an invalid body with bounded stable violations as 422', async () => {
    const { app } = createHarness();
    const response = await post(app, headersFor(), {
      ...revisionBody,
      baseRevision: '0',
    });
    expect(response.status).toBe(422);
    const body = await readJson(response);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(body.details.violations).toEqual([
      {
        path: '/baseRevision',
        code: expect.any(String),
        message: 'The value is invalid.',
      },
    ]);
  });

  it('rejects a path/body entryId mismatch as 422', async () => {
    const { app, appendRevision } = createHarness();
    const response = await post(app, headersFor(), {
      ...revisionBody,
      entryId: OTHER_ENTRY_ID,
    });
    expect(response.status).toBe(422);
    expect((await readJson(response)).details.violations[0]?.path).toBe(
      '/entryId',
    );
    expect(appendRevision).not.toHaveBeenCalled();
  });

  it('rejects a non-UUID path id as 400', async () => {
    const { app, appendRevision } = createHarness();
    const response = await post(
      app,
      headersFor(),
      revisionBody,
      '/api/v1/cms/entries/not-a-uuid/revisions',
    );
    expect(response.status).toBe(400);
    expect(appendRevision).not.toHaveBeenCalled();
  });

  it('requires Idempotency-Key and a strong If-Match', async () => {
    const { app, appendRevision } = createHarness();
    const missingKey = await post(
      app,
      headersFor((headers) => {
        delete headers['idempotency-key'];
      }),
    );
    expect(missingKey.status).toBe(400);
    expect((await readJson(missingKey)).details.violations).toEqual([
      {
        path: '/idempotencyKey',
        code: expect.any(String),
        message: 'The value is invalid.',
      },
    ]);

    const weakMatch = await post(
      app,
      headersFor((headers) => {
        headers['if-match'] = 'W/"1"';
      }),
    );
    expect(weakMatch.status).toBe(400);
    expect(appendRevision).not.toHaveBeenCalled();
  });
});

describe('cms-editorial CMS-03B-01 shared route budget', () => {
  it('refuses admission when the shared budget has already expired', async () => {
    const rateLimit = vi.fn(async () =>
      ok({ allowed: true, limit: 120, remaining: 119, resetAt: 60_000 }),
    );
    const { app, appendRevision } = createHarness({
      deadlineMs: 0,
      rateLimit,
    });
    const response = await post(app);
    expect(response.status).toBe(504);
    expect((await readJson(response)).code).toBe('GATEWAY_TIMEOUT');
    expect(rateLimit).not.toHaveBeenCalled();
    expect(appendRevision).not.toHaveBeenCalled();
  });

  it('aborts a stalled session dependency at the route deadline before rate admission', async () => {
    const observed: { signal: AbortSignal | null } = { signal: null };
    const rateLimit = vi.fn(async () =>
      ok({ allowed: true, limit: 120, remaining: 119, resetAt: 60_000 }),
    );
    const { app, appendRevision } = createHarness({
      deadlineMs: 200,
      rateLimit,
      resolveSession: (_request, signal) => {
        observed.signal = signal;
        return new Promise<never>(() => undefined);
      },
    });
    const response = await post(app);
    expect(response.status).toBe(504);
    expect((await readJson(response)).code).toBe('GATEWAY_TIMEOUT');
    expect(observed.signal?.aborted).toBe(true);
    expect(rateLimit).not.toHaveBeenCalled();
    expect(appendRevision).not.toHaveBeenCalled();
  });

  it('carries the remaining shared route budget into the port after admission stages', async () => {
    const observed: { signal: AbortSignal | null } = { signal: null };
    const { app, appendRevision } = createHarness({
      deadlineMs: 800,
      rateLimit: async () => {
        await new Promise((resolve) => wallSetTimeout(resolve, 150));
        return ok({
          allowed: true,
          limit: 120,
          remaining: 119,
          resetAt: 60_000,
        });
      },
      appendRevision: ((_input: unknown, signal: AbortSignal) => {
        observed.signal = signal;
        return new Promise<CmsEditorialResult<typeof revisionResource>>(
          () => undefined,
        );
      }) as unknown as Port,
    });
    const startedAt = Date.now();
    const response = await post(app);
    const elapsed = Date.now() - startedAt;
    expect(response.status).toBe(504);
    expect((await readJson(response)).code).toBe('GATEWAY_TIMEOUT');
    expect(appendRevision).toHaveBeenCalledTimes(1);
    expect(observed.signal?.aborted).toBe(true);
    // A fresh full-deadline window for the port resolves at stage latency
    // plus deadlineMs (~1000ms here); the shared budget expires it at stage
    // latency plus the remaining budget (~600ms here).
    expect(elapsed).toBeLessThan(1000);
  });

  it('aborts a stalled unreadable body at the route deadline', async () => {
    const { app, appendRevision } = createHarness({ deadlineMs: 200 });
    const stalled = new ReadableStream<Uint8Array>({
      start() {
        // The body never completes; the shared budget must expire it.
      },
    });
    const response = await app.request(PATH, {
      method: 'POST',
      headers: headersFor(),
      body: stalled as unknown as BodyInit,
      duplex: 'half',
    } as RequestInit);
    expect(response.status).toBe(504);
    expect((await readJson(response)).code).toBe('GATEWAY_TIMEOUT');
    expect(appendRevision).not.toHaveBeenCalled();
  });

  it('emits failure telemetry without blocking a rejected response', async () => {
    const events: unknown[] = [];
    const telemetry = vi.fn((event: unknown) => {
      events.push(event);
      return new Promise<void>(() => undefined);
    });
    const { app } = createHarness({ telemetry });
    const missingKey = await post(
      app,
      headersFor((headers) => {
        delete headers['idempotency-key'];
      }),
    );
    expect(missingKey.status).toBe(400);
    expect(telemetry).toHaveBeenCalledTimes(1);
    expect(events[0]).toMatchObject({
      outcome: 'rejected',
      status: 400,
      operationId: 'CMS-03B-01',
    });
  });

  it('returns the response even when telemetry never settles', async () => {
    const { app, appendRevision } = createHarness({
      telemetry: () => new Promise<void>(() => undefined),
    });
    const response = await post(app);
    expect(response.status).toBe(201);
    expect(appendRevision).toHaveBeenCalledTimes(1);
  });
});
