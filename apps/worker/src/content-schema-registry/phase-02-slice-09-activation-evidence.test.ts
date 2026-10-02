/**
 * BE03a acceptance evidence for the original operations the DEC-108 amendment
 * reopened: the route registry parity, the draft 201 resource, the activation
 * success statuses and error mapping, and the protected detail projection.
 * Every case drives the real Hono app and admission pipeline; only the
 * dependency ports are faked.
 */
import { contentSchemaRegistryRoutePolicies } from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import {
  activation,
  detail,
  error,
  resource,
} from './phase-02-slice-09-test-values';
import {
  detailWithPreparation,
  activationPreparation,
} from './phase-02-slice-09-dec108-test-values';
import { createContentSchemaRegistryApp } from './routes';
import {
  CMS_ORIGIN,
  REQUEST_ID,
  TYPE_ID,
  VERSION_ID,
  activationBody,
  expectError,
  humanRequest,
  makeDependencies,
  ok,
} from './routes.coverage.fixtures';

const BASE = `/api/v1/cms/content-types/${TYPE_ID}/versions/${VERSION_ID}`;
const ACTIVATE = `${BASE}/activate`;
const ENVELOPE_KEYS = ['code', 'details', 'message', 'requestId'];
const JOB_ID = 'b0000000-0000-4000-8000-0000000000b0';

type Policy = Readonly<{ operationId: string; method: string; path: string }>;
const policies = contentSchemaRegistryRoutePolicies as readonly Policy[];

const activate = async (
  options: Parameters<typeof makeDependencies>[0] = {},
  body: unknown = activationBody,
  headers: Record<string, string> = { 'if-match': '"1"' },
) => {
  const made = makeDependencies(options);
  const response = await createContentSchemaRegistryApp(
    made.dependencies,
  ).request(humanRequest(ACTIVATE, body, headers));
  return { ...made, response };
};

const detailRequest = (): Request =>
  new Request(`https://api.example.test${BASE}`, {
    headers: {
      origin: CMS_ORIGIN,
      authorization: 'Bearer verified-session',
      'x-request-id': REQUEST_ID,
    },
  });

describe('BE03a route registry parity', () => {
  it('[P2-S09-AC-019] discovered Hono routes match every BE03a route-registry row with no missing, extra, duplicate or stale operation', () => {
    expect(policies).toHaveLength(18);
    const ids = policies.map((policy) => policy.operationId);
    expect(new Set(ids).size).toBe(18);
    expect(ids).toEqual(
      Array.from(
        { length: 18 },
        (_, index) => `CMS-03A-${String(index + 1).padStart(2, '0')}`,
      ),
    );

    const app = createContentSchemaRegistryApp(makeDependencies().dependencies);
    const discovered = app.routes
      .filter((route) => route.method !== 'ALL' && route.method !== 'OPTIONS')
      .map(
        (route) => `${route.method} ${route.path.replace(/:(\w+)/gu, '{$1}')}`,
      );
    const registered = policies.map(
      (policy) => `${policy.method} ${policy.path}`,
    );
    expect(new Set(discovered).size).toBe(discovered.length);
    expect([...discovered].sort()).toEqual([...registered].sort());
  });
});

describe('BE03a CMS-03A-01 draft response', () => {
  it('[P2-S09-AC-054] returns strict 201 ContentTypeVersionResource with ResourceMeta and the complete projection including sourceLocale, defaultLocale, supportedLocales, fallbackChains and localeConfigHash', async () => {
    const made = makeDependencies({ port: ok(resource) });
    const app = createContentSchemaRegistryApp(made.dependencies);
    const response = await app.request(
      humanRequest('/api/v1/cms/content-types'),
    );
    expect(response.status).toBe(201);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toEqual(resource);
    for (const key of [
      'id',
      'version',
      'contentHash',
      'createdAt',
      'updatedAt',
      'sourceLocale',
      'defaultLocale',
      'supportedLocales',
      'fallbackChains',
      'localeConfigHash',
    ])
      expect(body, key).toHaveProperty(key);
    expect(response.headers.get('etag')).toBe('"1"');
    expect(response.headers.get('location')).toContain(
      '/api/v1/cms/content-types',
    );
    expect(response.headers.get('cache-control')).toBe('no-store');

    for (const mutation of [
      { ownerId: TYPE_ID },
      { localeConfigHash: undefined },
      { supportedLocales: undefined },
    ]) {
      const refused = makeDependencies({
        port: ok({ ...resource, ...mutation }),
      });
      const refusedResponse = await createContentSchemaRegistryApp(
        refused.dependencies,
      ).request(humanRequest('/api/v1/cms/content-types'));
      expect(refusedResponse.status, JSON.stringify(mutation)).toBe(502);
    }
  });
});

describe('BE03a CMS-03A-04 activation response', () => {
  it('[P2-S09-AC-100] returns 202 with SchemaActivationResource including localeConfigHash and jobId when work is queued, otherwise the synchronous 200 success resource', async () => {
    const queued = await activate({
      port: ok({ ...activation, jobId: JOB_ID }),
    });
    expect(queued.response.status).toBe(202);
    const queuedBody = (await queued.response.json()) as typeof activation;
    expect(queuedBody.jobId).toBe(JOB_ID);
    expect(queuedBody.localeConfigHash).toBe(activation.localeConfigHash);
    expect(queuedBody.eventType).toBe('cms.schema.activated.v1');

    const synchronous = await activate({ port: ok(activation) });
    expect(synchronous.response.status).toBe(200);
    const syncBody = (await synchronous.response.json()) as typeof activation;
    expect(syncBody.jobId).toBeNull();
    expect(syncBody.localeConfigHash).toBe(activation.localeConfigHash);

    const missingHash = Object.fromEntries(
      Object.entries(activation).filter(([key]) => key !== 'localeConfigHash'),
    );
    const refused = await activate({ port: ok(missingHash) });
    expect(refused.response.status).toBe(502);
  });

  it('[P2-S09-AC-196] maps every A04 failure to its declared validation, auth, step-up, policy, approval, artifact, dry-run, compatibility, locale-hash, stale-state and RPC error with the BE00 envelope', async () => {
    const envelope = async (
      response: Response,
      status: number,
      code: string,
    ) => {
      const body = await expectError(response, status);
      expect(Object.keys(body).sort()).toEqual(ENVELOPE_KEYS);
      expect(body.code).toBe(code);
      expect(response.headers.get('cache-control')).toBe('no-store');
      return body;
    };

    const missingKey = await activate({}, activationBody, {});
    await envelope(missingKey.response, 400, 'INVALID_REQUEST');
    const badBody = await activate({}, { ...activationBody, dryRunId: 'x' });
    await envelope(badBody.response, 422, 'VALIDATION_FAILED');
    const unauthenticated = await activate({
      session: error(401, 'UNAUTHENTICATED', 'no', {
        recoveryAction: 'reauthenticate',
      }),
    });
    await envelope(unauthenticated.response, 401, 'UNAUTHENTICATED');
    const stale = await activate({
      session: ok({
        userId: '10000000-0000-4000-8000-000000000001',
        actingPartyId: '20000000-0000-4000-8000-000000000002',
        capabilities: ['cms.schema_designer'],
        mfaFresh: false,
      }),
    });
    const stepUp = await envelope(stale.response, 401, 'STEP_UP_REQUIRED');
    expect(stepUp.details).toMatchObject({ recoveryAction: 'step_up' });
    expect(stale.ports.activateSchema).not.toHaveBeenCalled();
    const noCapability = await activate({
      session: ok({
        userId: '10000000-0000-4000-8000-000000000001',
        actingPartyId: '20000000-0000-4000-8000-000000000002',
        capabilities: ['cms.schema_registry.read'],
        mfaFresh: true,
      }),
    });
    await envelope(noCapability.response, 403, 'FORBIDDEN');
    expect(noCapability.ports.activateSchema).not.toHaveBeenCalled();

    const portFailures: readonly [
      number,
      string,
      string,
      Record<string, unknown>,
      Record<string, unknown>,
    ][] = [
      [
        403,
        'FORBIDDEN',
        'FORBIDDEN',
        { reasonCode: 'POLICY_NOT_MET', sql: 'x' },
        { reasonCode: 'POLICY_NOT_MET' },
      ],
      [404, 'NOT_FOUND', 'NOT_FOUND', { leak: 'hidden' }, {}],
      [
        409,
        'CONFLICT',
        'CONFLICT',
        { expectedVersion: '1', currentVersion: '2', x: 1 },
        { expectedVersion: '1', currentVersion: '2' },
      ],
      [409, 'CONFLICT', 'CONFLICT', { sql: 'locale_config_hash_mismatch' }, {}],
      [
        422,
        'VALIDATION_FAILED',
        'VALIDATION_FAILED',
        {
          violations: [
            {
              pointer: '/approvalIds',
              message: 'approvals must match one approved review',
              code: 'APPROVAL',
            },
          ],
        },
        {
          violations: [
            {
              pointer: '/approvalIds',
              message: 'approvals must match one approved review',
              code: 'APPROVAL',
            },
          ],
        },
      ],
      [
        502,
        'DEPENDENCY_INVALID_RESPONSE',
        'DEPENDENCY_UNAVAILABLE',
        { dependencyClass: 'cms_registry', retryable: false },
        { dependencyClass: 'cms_registry', retryable: true },
      ],
      [
        503,
        'DEPENDENCY_UNAVAILABLE',
        'DEPENDENCY_UNAVAILABLE',
        { dependencyClass: 'cms_registry', retryable: true },
        { dependencyClass: 'cms_registry', retryable: true },
      ],
      [
        504,
        'DEPENDENCY_DEADLINE_EXCEEDED',
        'DEPENDENCY_UNAVAILABLE',
        { dependencyClass: 'cms_registry', retryable: true },
        { dependencyClass: 'cms_registry', retryable: true },
      ],
    ];
    for (const [
      status,
      portCode,
      wireCode,
      details,
      expected,
    ] of portFailures) {
      const made = await activate({
        port: error(status as 403, portCode, 'x', details),
      });
      const body = await envelope(made.response, status, wireCode);
      expect(body.details, `${status} ${portCode}`).toEqual(expected);
    }
    const limited = await activate({
      rate: ok({
        allowed: false,
        limit: 10,
        remaining: 0,
        resetAt: 1_788_345_660,
      }),
    });
    await envelope(limited.response, 429, 'RATE_LIMITED');
    expect(limited.ports.activateSchema).not.toHaveBeenCalled();
    const thrown = makeDependencies();
    (
      thrown.ports.activateSchema as unknown as {
        mockRejectedValueOnce: (reason: Error) => void;
      }
    ).mockRejectedValueOnce(new Error('pg down'));
    const scrubbed = await createContentSchemaRegistryApp(
      thrown.dependencies,
    ).request(humanRequest(ACTIVATE, activationBody, { 'if-match': '"1"' }));
    expect(scrubbed.status).toBe(503);
    expect(await scrubbed.text()).not.toContain('pg down');
  });
});

describe('BE03a CMS-03A-07 protected detail', () => {
  it('[P2-S09-AC-143] returns 200 ContentSchemaRegistryDetail with one ContentTypeVersionResource including its locale configuration, the required activationPreparation and bounded fields, relations, schemaArtifact, templateBindings, capabilityBindings and blockDefinitions', async () => {
    const send = async (value: unknown) => {
      const made = makeDependencies({ port: ok(value) });
      return createContentSchemaRegistryApp(made.dependencies).request(
        detailRequest(),
      );
    };
    const success = await send(detailWithPreparation);
    expect(success.status).toBe(200);
    const body = (await success.json()) as typeof detailWithPreparation;
    expect(body.resource).toMatchObject({
      supportedLocales: expect.any(Array),
      fallbackChains: expect.any(Object),
      localeConfigHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });
    expect(body.activationPreparation).toEqual(activationPreparation);
    for (const key of [
      'fields',
      'relations',
      'schemaArtifact',
      'templateBindings',
      'capabilityBindings',
      'blockDefinitions',
    ])
      expect(body, key).toHaveProperty(key);

    const withoutPreparation = await send(detail);
    expect(withoutPreparation.status).toBe(502);

    for (const [key, count] of [
      ['fields', 129],
      ['relations', 129],
      ['templateBindings', 33],
      ['capabilityBindings', 33],
      ['blockDefinitions', 129],
    ] as const) {
      const filler = Array.from({ length: count }, () => ({}));
      const over = await send({ ...detailWithPreparation, [key]: filler });
      expect(over.status, key).toBe(502);
    }
  });
});
