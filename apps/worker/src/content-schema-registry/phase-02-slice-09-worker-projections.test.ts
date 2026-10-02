import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CONTENT_SCHEMA_REGISTRY_ACTING_PARTY_ID_HEADER,
  CONTENT_SCHEMA_REGISTRY_ACTOR_ID_HEADER,
  CONTENT_SCHEMA_REGISTRY_CAPABILITY_HEADER,
  CONTENT_SCHEMA_REGISTRY_PRESENTATION_VARIANT_HEADER,
  CONTENT_SCHEMA_REGISTRY_PRIVATE_SERVICE_HOST,
  CONTENT_SCHEMA_REGISTRY_RETRYABLE_HEADER,
} from '@wejammin/contracts';

import {
  expectApiError,
  jsonRequest,
  makeHarness,
  mutationPath,
  releaseRequest,
} from './phase-02-slice-09-worker-test-support';
import {
  API_ORIGIN,
  CMS_ORIGIN,
  PARTY_ID,
  USER_ID,
  TYPE_ID,
  VERSION_ID,
  REQUEST_ID,
  HASH,
  safeBlock,
  validDraft,
  validBlock,
  validLifecycle,
  session,
  ok,
  error,
} from './phase-02-slice-09-test-values';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('S09 worker content-schema-registry projections', () => {
  it.each([
    ['A05', '/api/v1/cms/blocks/versions', validBlock, 'registerBlock'],
    ['A08', mutationPath.lifecycle, validLifecycle, 'advanceBlockLifecycle'],
  ] as const)(
    'keeps %s full worker response outside browser-safe read projections',
    async (_label, path, body, port) => {
      const harness = makeHarness();
      const response = await harness.app.request(
        releaseRequest(path, body, {
          ...(_label === 'A08' ? { 'if-match': '"1"' } : {}),
        }),
      );
      expect(response.status).toBe(201);
      const payload = (await response.json()) as Record<string, unknown>;
      expect(payload).toHaveProperty('releaseKeyId');
      expect(JSON.stringify(payload)).toMatch(
        /releaseNonceHash|releaseVerifiedAt/,
      );
      expect(harness.ports[port]).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    ['lifecycle with state', '?resourceKind=content_type&state=active'],
    ['state-only lifecycle', '?resourceKind=schema_artifact&lifecycle=active'],
    [
      'incompatible pair',
      '?resourceKind=block_definition_registry_record&state=active',
    ],
    ['invalid limit', '?limit=101'],
    ['unknown query', '?ownerId=' + USER_ID],
  ] as const)('rejects %s before the list RPC', async (_label, query) => {
    const harness = makeHarness();
    const response = await harness.app.request(
      new Request(`${API_ORIGIN}/api/v1/cms/content-types${query}`, {
        headers: {
          origin: CMS_ORIGIN,
          authorization: 'Bearer verified-session',
          'x-request-id': REQUEST_ID,
        },
      }),
    );
    await expectApiError(response, 400, 'INVALID_REQUEST');
    expect(harness.ports.listContentTypes).not.toHaveBeenCalled();
  });

  it('rejects mutation-only headers and bodies on protected reads', async () => {
    const harness = makeHarness();
    const response = await harness.app.request(
      new Request(`${API_ORIGIN}/api/v1/cms/content-types`, {
        method: 'GET',
        headers: {
          origin: CMS_ORIGIN,
          authorization: 'Bearer verified-session',
          'idempotency-key': 'read-should-fail',
          'if-match': '"1"',
          'x-request-id': REQUEST_ID,
        },
      }),
    );
    await expectApiError(response, 400, 'INVALID_REQUEST');
    expect(harness.ports.listContentTypes).not.toHaveBeenCalled();
  });

  it('rejects a list result containing owner IDs or worker-only evidence', async () => {
    const harness = makeHarness();
    harness.ports.listContentTypes.mockResolvedValueOnce(
      ok({
        items: [{ ...safeBlock, ownerId: USER_ID, releaseNonceHash: HASH }],
        nextCursor: null,
      }),
    );
    const response = await harness.app.request(
      new Request(`${API_ORIGIN}/api/v1/cms/content-types`, {
        headers: {
          origin: CMS_ORIGIN,
          authorization: 'Bearer verified-session',
          'x-request-id': REQUEST_ID,
        },
      }),
    );
    await expectApiError(response, 502, 'DEPENDENCY_UNAVAILABLE');
  });

  it('returns safe detail projections with only browser-allowlisted block records', async () => {
    const harness = makeHarness();
    const response = await harness.app.request(
      new Request(
        `${API_ORIGIN}/api/v1/cms/content-types/${TYPE_ID}/versions/${VERSION_ID}`,
        {
          headers: {
            origin: CMS_ORIGIN,
            authorization: 'Bearer verified-session',
            'x-request-id': REQUEST_ID,
          },
        },
      ),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as Record<string, unknown>;
    expect(JSON.stringify(payload)).not.toMatch(
      /ownerId|releaseKeyId|propsSchemaSnapshot|releaseNonceHash/,
    );
    expect(payload).toMatchObject({ resourceKind: 'content_type_version' });
  });

  it('returns only trusted CMS capabilities on protected read responses', async () => {
    const harness = makeHarness({
      session: ok({
        ...session,
        capabilities: [
          'cms.schema_designer',
          'cms.schema_registry.read',
          'internal.provider.secret',
        ],
      }),
    });
    const response = await harness.app.request(
      new Request(
        `https://${CONTENT_SCHEMA_REGISTRY_PRIVATE_SERVICE_HOST}/api/v1/cms/content-types`,
        {
          headers: {
            authorization: 'Bearer verified-session',
            'x-request-id': REQUEST_ID,
          },
        },
      ),
    );

    expect(response.status).toBe(200);
    expect(
      response.headers.get(CONTENT_SCHEMA_REGISTRY_CAPABILITY_HEADER),
    ).toBe('cms.schema_designer,cms.schema_registry.read');
    expect(
      response.headers.get(CONTENT_SCHEMA_REGISTRY_PRESENTATION_VARIANT_HEADER),
    ).toBe('ownerFull');
    expect(response.headers.get(CONTENT_SCHEMA_REGISTRY_ACTOR_ID_HEADER)).toBe(
      USER_ID,
    );
    expect(
      response.headers.get(CONTENT_SCHEMA_REGISTRY_ACTING_PARTY_ID_HEADER),
    ).toBe(PARTY_ID);
  });

  it('does not expose capability proof on the public browser read response', async () => {
    const harness = makeHarness({
      session: ok({
        ...session,
        capabilities: ['cms.schema_designer', 'cms.schema_registry.read'],
      }),
    });
    const response = await harness.app.request(
      new Request(`${API_ORIGIN}/api/v1/cms/content-types`, {
        headers: {
          origin: CMS_ORIGIN,
          authorization: 'Bearer verified-session',
          'x-request-id': REQUEST_ID,
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(
      response.headers.get(CONTENT_SCHEMA_REGISTRY_CAPABILITY_HEADER),
    ).toBeNull();
    expect(
      response.headers.get(CONTENT_SCHEMA_REGISTRY_PRESENTATION_VARIANT_HEADER),
    ).toBeNull();
    expect(
      response.headers.get(CONTENT_SCHEMA_REGISTRY_ACTOR_ID_HEADER),
    ).toBeNull();
    expect(
      response.headers.get(CONTENT_SCHEMA_REGISTRY_ACTING_PARTY_ID_HEADER),
    ).toBeNull();
  });

  it('does not emit capability proof when protected read authorization fails', async () => {
    const harness = makeHarness({
      session: ok({ ...session, capabilities: [] }),
    });
    const response = await harness.app.request(
      new Request(`${API_ORIGIN}/api/v1/cms/content-types`, {
        headers: {
          origin: CMS_ORIGIN,
          authorization: 'Bearer verified-session',
          'x-request-id': REQUEST_ID,
        },
      }),
    );

    expect(response.status).toBe(403);
    expect(
      response.headers.get(CONTENT_SCHEMA_REGISTRY_CAPABILITY_HEADER),
    ).toBeNull();
    expect(
      response.headers.get(CONTENT_SCHEMA_REGISTRY_PRESENTATION_VARIANT_HEADER),
    ).toBeNull();
    expect(
      response.headers.get(CONTENT_SCHEMA_REGISTRY_ACTOR_ID_HEADER),
    ).toBeNull();
    expect(
      response.headers.get(CONTENT_SCHEMA_REGISTRY_ACTING_PARTY_ID_HEADER),
    ).toBeNull();
  });

  it.each([
    [
      502,
      'DEPENDENCY_UNAVAILABLE',
      { dependencyClass: 'cms_registry', retryable: false },
    ],
    [
      503,
      'DEPENDENCY_UNAVAILABLE',
      { dependencyClass: 'cms_registry', retryable: true },
    ],
    [
      504,
      'DEPENDENCY_UNAVAILABLE',
      { dependencyClass: 'cms_registry', retryable: true },
    ],
    [429, 'RATE_LIMITED', { limit: 20, retryAfterSeconds: 5 }],
    [500, 'INTERNAL_ERROR', { secret: 'must-not-leak' }],
  ] as const)(
    'maps port failures to sanitized ApiError for protected reads',
    async (status, code, details) => {
      const harness =
        status === 429
          ? makeHarness({
              rate: ok({
                allowed: false,
                limit: 20,
                remaining: 0,
                resetAt: 1_788_345_605,
              }),
            })
          : makeHarness();
      if (status !== 429)
        harness.ports.listContentTypes.mockResolvedValueOnce(
          error(status, code, 'unsafe SQL details', details),
        );
      const response = await harness.app.request(
        new Request(`${API_ORIGIN}/api/v1/cms/content-types`, {
          headers: {
            origin: CMS_ORIGIN,
            authorization: 'Bearer verified-session',
            'x-request-id': REQUEST_ID,
          },
        }),
      );
      const body = await expectApiError(response, status, code);
      expect(JSON.stringify(body)).not.toContain('unsafe SQL details');
      expect(JSON.stringify(body)).not.toContain('secret');
      if (status === 429) expect(response.headers.get('retry-after')).toBe('5');
      expect(
        response.headers.get(CONTENT_SCHEMA_REGISTRY_RETRYABLE_HEADER),
      ).toBe(
        status === 502 || status === 503 || status === 504 ? 'true' : null,
      );
    },
  );

  it('returns 404 with empty details for concealed resources', async () => {
    const harness = makeHarness();
    harness.ports.getContentTypeVersion.mockResolvedValueOnce(
      error(404, 'NOT_FOUND', 'hidden owner and version', { ownerId: USER_ID }),
    );
    const response = await harness.app.request(
      new Request(
        `${API_ORIGIN}/api/v1/cms/content-types/${TYPE_ID}/versions/${VERSION_ID}`,
        {
          headers: {
            origin: CMS_ORIGIN,
            authorization: 'Bearer verified-session',
            'x-request-id': REQUEST_ID,
          },
        },
      ),
    );
    const body = await expectApiError(response, 404, 'NOT_FOUND');
    expect(body.details).toEqual({});
  });

  it('emits scrubbed telemetry with operation and outcome but no body or private fields', async () => {
    const harness = makeHarness();
    await harness.app.request(
      jsonRequest('/api/v1/cms/content-types', validDraft),
    );
    expect(harness.telemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        operationId: 'CMS-03A-01',
        outcome: 'success',
        requestId: expect.any(String),
        rateClass: 'cms-definition-write',
        rateLimit: 30,
        rateWindowSeconds: 60,
        deadlineMs: 15_000,
        slo: {
          tier: 2,
          commandP95Ms: 1_200,
          protectedRpcP95Ms: 300,
          acceptanceP99Ms: 1_000,
        },
        traceSteps: [
          'cms.admission',
          'cms.authority',
          'cms.rate_limit',
          'cms.rpc',
          'cms.response',
        ],
        metrics: expect.objectContaining({
          duration_ms: expect.any(Number),
          request_status: 201,
          slo_command_p95_ms: 1_200,
          slo_protected_rpc_p95_ms: 300,
          slo_acceptance_p99_ms: 1_000,
        }),
        alertClass: 'content_schema_registry_tier2',
        alertRoute: 'platform.on_call',
        runbook: 'content-schema-registry',
      }),
    );
    expect(JSON.stringify(harness.telemetry.mock.calls)).not.toMatch(
      /Article|ownerId|releaseSignature/,
    );
  });
});
