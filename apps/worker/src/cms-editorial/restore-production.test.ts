// WP-S10-2b QA-RED: production restore port wiring for CMS-03B-04.
//
// The protected restore route already exists and is fully covered by
// restore-routes.test.ts against an injected stub port. What is absent is the
// production port that binds the route to the named cms_restore_revision RPC,
// so every restore request served by the composed production adapter still
// fails closed with the 503 dependency seam
// (cms-editorial-production-types.ts:150 carries the seam comment and
// cms-editorial-production.ts composes no restoreRevision member).
//
// These tests pin the locked contract (BE03b CMS-03B-04, AC022-AC027/AC037)
// and currently fail because the implementation is missing, not because an
// assertion is wrong.
import { describe, expect, it, vi } from 'vitest';
import {
  REVISION_RESTORE_SEAMS,
  type RevisionRestoreVerification,
} from '@wejammin/contracts';

import { createProductionCmsEditorialDependencies } from '../cms-editorial-production';
import { createCmsEditorialApp, type CmsEditorialDependencies } from './index';
import {
  CORRELATION_ID,
  ENTRY_ID,
  PARTY_ID,
  REQUEST_ID,
  USER_ID,
  captureInit,
  compose,
  json,
  portInput,
} from '../cms-editorial-production.test-support';

const SOURCE_REVISION_ID = '40000000-0000-4000-8000-000000000004';
const RESTORED_REVISION_ID = '41000000-0000-4000-8000-000000000004';
const MIGRATION_CHAIN_ID = '50000000-0000-4000-8000-000000000005';
const SOURCE_SCHEMA_VERSION_ID = '60000000-0000-4000-8000-000000000006';
const ACTIVE_SCHEMA_VERSION_ID = '70000000-0000-4000-8000-000000000007';
const ORIGIN = 'https://cms.example.test';
const RESTORE_PATH =
  '/api/v1/cms/entries/' +
  ENTRY_ID +
  '/revisions/' +
  SOURCE_REVISION_ID +
  '/restore';
const IDEMPOTENCY_KEY = 'restore-slice10-0001';

const restoredResource = {
  id: RESTORED_REVISION_ID,
  version: '1',
  entryVersion: '3',
  createdAt: '2026-09-26T00:00:00Z',
  updatedAt: '2026-09-26T00:00:00Z',
  state: 'draft',
  entryId: ENTRY_ID,
  revisionNumber: '3',
  schemaVersionId: ACTIVE_SCHEMA_VERSION_ID,
  templateVersionId: null,
  taxonomyVersionIds: [],
  locale: 'en-US',
  contentHash: 'a'.repeat(64),
  parentRevisionIds: [SOURCE_REVISION_ID],
  validationState: 'valid',
  conflictId: null,
};

/**
 * Server-produced restore attestation. A new draft under the current active
 * schema with parentRevisionIds = [currentDraftRevisionId, sourceRevisionId]
 * (BE03b restore result) and a chain that starts at the source schema and
 * terminates at the active schema.
 */
const restoreVerification: RevisionRestoreVerification = {
  request: {
    entryId: ENTRY_ID,
    revisionId: SOURCE_REVISION_ID,
    migrationChainId: MIGRATION_CHAIN_ID,
    expectedVersion: '2',
  },
  registry: {
    revisionId: SOURCE_REVISION_ID,
    migrationChainId: MIGRATION_CHAIN_ID,
    sourceSchemaVersionId: SOURCE_SCHEMA_VERSION_ID,
    activeSchemaVersionId: ACTIVE_SCHEMA_VERSION_ID,
    chainSchemaVersionIds: [SOURCE_SCHEMA_VERSION_ID, ACTIVE_SCHEMA_VERSION_ID],
    entryVersion: '2',
  },
  seams: [...REVISION_RESTORE_SEAMS],
};

const restoreBody = () => ({
  entryId: ENTRY_ID,
  revisionId: SOURCE_REVISION_ID,
  migrationChainId: MIGRATION_CHAIN_ID,
  expectedVersion: '2',
});

const envelope = () => ({
  resource: restoredResource,
  restoreVerification,
});

const restoreRequest = (): Request =>
  new Request('https://api.example.test' + RESTORE_PATH, {
    method: 'POST',
    headers: {
      'x-request-id': REQUEST_ID,
      'x-correlation-id': CORRELATION_ID,
    },
    body: JSON.stringify(restoreBody()),
  });

const restoreInput = (overrides: Record<string, unknown> = {}) =>
  portInput({
    operationId: 'CMS-03B-04',
    request: restoreRequest(),
    path: { entryId: ENTRY_ID, revisionId: SOURCE_REVISION_ID },
    body: restoreBody(),
    idempotencyKey: IDEMPOTENCY_KEY,
    ifMatch: '2',
    ...overrides,
  });

/**
 * The production restore port the composed adapter must expose. It is absent
 * today, which is exactly the RED this file records.
 */
const restorePort = (
  dependencies: ReturnType<typeof createProductionCmsEditorialDependencies>,
): ((input: unknown, signal: AbortSignal) => Promise<unknown>) | undefined =>
  (
    dependencies.ports as unknown as Record<
      string,
      ((input: unknown, signal: AbortSignal) => Promise<unknown>) | undefined
    >
  ).restoreRevision;

const sessionSeam = async () => ({
  ok: true as const,
  value: {
    userId: USER_ID,
    actingPartyId: PARTY_ID,
    capabilities: ['cms.author'],
    mfaFresh: true,
  },
});

const rateSeam = async (input: { limit: number }) => ({
  ok: true as const,
  value: {
    allowed: true,
    limit: input.limit,
    remaining: input.limit - 1,
    resetAt: 60_000,
  },
});

const wiredApp = (fetchImpl: typeof fetch) =>
  createCmsEditorialApp(
    compose(fetchImpl, {
      resolveSession: sessionSeam,
      rateLimit: rateSeam,
    }) as unknown as CmsEditorialDependencies,
  );

const postToWired = (
  app: ReturnType<typeof createCmsEditorialApp>,
  body: unknown = restoreBody(),
) =>
  app.request(RESTORE_PATH, {
    method: 'POST',
    headers: {
      origin: ORIGIN,
      'content-type': 'application/json',
      'idempotency-key': IDEMPOTENCY_KEY,
      'if-match': '"2"',
      'x-request-id': REQUEST_ID,
    },
    body: JSON.stringify(body),
  });

describe('CMS-03B-04 production restore port (RED: seam still returns 503)', () => {
  it('removes the 503 seam: the composed adapter exposes a real restoreRevision port', () => {
    const dependencies = compose(vi.fn() as unknown as typeof fetch);
    expect(restorePort(dependencies)).toBeTypeOf('function');
  });

  it('serves a restore through the composed production adapter, not the 503 fallback', async () => {
    const fetchImpl = vi.fn(async () => json(envelope()));
    const response = await postToWired(
      wiredApp(fetchImpl as unknown as typeof fetch),
    );
    expect(response.status).toBe(201);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('etag')).toBe('"3"');
    expect(response.headers.get('location')).toBe(
      '/api/v1/cms/entries/' + ENTRY_ID + '/revisions/' + RESTORED_REVISION_ID,
    );
    expect(await response.json()).toEqual(restoredResource);
  });

  it('binds the restore port to cms_restore_revision with server-derived context', async () => {
    const fetchImpl = vi.fn(async () => json(envelope()));
    const dependencies = compose(fetchImpl as unknown as typeof fetch);
    const restore = restorePort(dependencies);
    expect(restore).toBeTypeOf('function');
    if (restore === undefined) return;

    const result = await restore(restoreInput(), new AbortController().signal);
    expect(result).toMatchObject({ ok: true, value: envelope() });

    const { url, init } = captureInit(fetchImpl);
    expect(url).toBe(
      'https://supabase.example.test/rest/v1/rpc/cms_restore_revision',
    );
    const headers = init.headers as Record<string, string>;
    expect(headers['Accept-Profile']).toBe('platform_api');
    expect(headers['Content-Profile']).toBe('platform_api');
    expect(headers['X-Operation-Id']).toBe('CMS-03B-04');
    expect(headers['X-Request-Id']).toBe(REQUEST_ID);
    expect(headers['X-Correlation-Id']).toBe(CORRELATION_ID);
    // Replay/CAS binding: exact strong validator and idempotency key.
    expect(headers['If-Match']).toBe('"2"');
    expect(headers['X-Idempotency-Key']).toBe(IDEMPOTENCY_KEY);

    const body = JSON.parse(String(init.body)) as {
      p_request: Record<string, unknown>;
    };
    expect(body.p_request).toMatchObject({
      entryId: ENTRY_ID,
      revisionId: SOURCE_REVISION_ID,
      migrationChainId: MIGRATION_CHAIN_ID,
      expectedVersion: '2',
      ifMatch: '2',
      idempotencyKey: IDEMPOTENCY_KEY,
      context: {
        authUserId: USER_ID,
        actingPartyId: PARTY_ID,
        requestId: REQUEST_ID,
        correlationId: CORRELATION_ID,
        stepUpVerified: true,
      },
    });
  });

  it('propagates the migration-chain identity onto the request and the evidence', async () => {
    const fetchImpl = vi.fn(async () => json(envelope()));
    const dependencies = compose(fetchImpl as unknown as typeof fetch);
    const restore = restorePort(dependencies);
    expect(restore).toBeTypeOf('function');
    if (restore === undefined) return;

    const result = (await restore(
      restoreInput(),
      new AbortController().signal,
    )) as {
      ok: true;
      value: {
        restoreVerification: {
          request: { migrationChainId: string };
          registry: { migrationChainId: string };
        };
      };
    };
    expect(result.value.restoreVerification.request.migrationChainId).toBe(
      MIGRATION_CHAIN_ID,
    );
    expect(result.value.restoreVerification.registry.migrationChainId).toBe(
      MIGRATION_CHAIN_ID,
    );
    const { init } = captureInit(fetchImpl);
    const body = JSON.parse(String(init.body)) as {
      p_request: { migrationChainId: string };
    };
    expect(body.p_request.migrationChainId).toBe(MIGRATION_CHAIN_ID);
  });

  it('rejects caller-supplied authority keys with 422 and no RPC call', async () => {
    const fetchImpl = vi.fn(async () => json(envelope()));
    const dependencies = compose(fetchImpl as unknown as typeof fetch);
    const restore = restorePort(dependencies);
    expect(restore).toBeTypeOf('function');
    if (restore === undefined) return;

    const result = await restore(
      restoreInput({
        body: {
          ...restoreBody(),
          ['ow' + 'ner']: 'attacker',
          ['cap' + 'ability']: 'cms.publish',
        },
      }),
      new AbortController().signal,
    );
    expect(result).toMatchObject({
      ok: false,
      status: 422,
      code: 'VALIDATION_FAILED',
      details: { reasonCode: 'caller_authority_rejected' },
    });
    expect(JSON.stringify(result)).not.toContain('attacker');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects a path/body disagreement and a weak validator before any RPC call', async () => {
    const fetchImpl = vi.fn(async () => json(envelope()));
    const dependencies = compose(fetchImpl as unknown as typeof fetch);
    const restore = restorePort(dependencies);
    expect(restore).toBeTypeOf('function');
    if (restore === undefined) return;

    const disagreement = await restore(
      restoreInput({ body: { ...restoreBody(), entryId: MIGRATION_CHAIN_ID } }),
      new AbortController().signal,
    );
    expect(disagreement).toMatchObject({ ok: false, status: 422 });

    const weakValidator = await restore(
      restoreInput({ ifMatch: 'W/"2"' }),
      new AbortController().signal,
    );
    expect(weakValidator).toMatchObject({ ok: false, status: 400 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('maps every declared restore failure to a typed ApiError', async () => {
    const cases = [
      { payload: { code: 'VERSION_MISMATCH' }, status: 409, expected: 409 },
      { payload: { code: 'FORBIDDEN' }, status: 403, expected: 403 },
      { payload: { code: 'NOT_FOUND' }, status: 404, expected: 404 },
      {
        payload: { message: 'pg internal detail leak' },
        status: 500,
        expected: 503,
      },
    ];
    for (const failure of cases) {
      const fetchImpl = vi.fn(async () =>
        json(failure.payload, failure.status),
      );
      const dependencies = compose(fetchImpl as unknown as typeof fetch);
      const restore = restorePort(dependencies);
      expect(restore).toBeTypeOf('function');
      if (restore === undefined) return;
      const result = await restore(
        restoreInput(),
        new AbortController().signal,
      );
      expect(result).toMatchObject({ ok: false, status: failure.expected });
      expect(JSON.stringify(result)).not.toContain('leak');
    }
  });

  it('conceals an unreadable restore source through the composed adapter', async () => {
    const fetchImpl = vi.fn(async () => json({ code: 'NOT_FOUND' }, 404));
    const response = await postToWired(
      wiredApp(fetchImpl as unknown as typeof fetch),
    );
    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const text = await response.text();
    expect(text).not.toContain('rpc');
    expect(JSON.parse(text)).toMatchObject({
      code: 'NOT_FOUND',
      details: {},
    });
  });

  it('rejects a non-JSON success payload as an invalid dependency response', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response('<html>bad gateway</html>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        }),
    );
    const dependencies = compose(fetchImpl as unknown as typeof fetch);
    const restore = restorePort(dependencies);
    expect(restore).toBeTypeOf('function');
    if (restore === undefined) return;
    const result = await restore(restoreInput(), new AbortController().signal);
    expect(result).toMatchObject({
      ok: false,
      status: 502,
      code: 'BAD_GATEWAY',
    });
  });
});
