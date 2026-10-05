import { createHash } from 'node:crypto';

import { beforeAll, describe, expect, it, vi } from 'vitest';

import { LogEventSchema, createLogger } from '@wejammin/observability/logging';

import { createProductionOperationalAlertDependencies } from './operational-alert-production';
import { productionMigrationTelemetry } from '../production-worker-runtime-cms';

import { createContentSchemaRegistryProductionApp } from './phase-02-slice-09-pre-release-production';
import {
  NOW,
  releaseHttp,
  makeSigning,
  type Signing,
} from './phase-02-slice-09-pre-release-support';
import {
  API_ORIGIN,
  CMS_ORIGIN,
  PARTY_ID,
  REQUEST_ID,
  TYPE_ID,
  USER_ID,
  VERSION_ID,
  block,
  field,
  ok,
  resource,
  session,
  validBlock,
  validDraft,
  validField,
  validLifecycle,
  lifecycleEvent,
  validRelation,
} from './phase-02-slice-09-test-values';
import { makeHarness as makeAdversarial } from './phase-02-slice-09-adversarial-test-support';
import {
  jsonRequest,
  makeHarness,
  mutationPath,
} from './phase-02-slice-09-worker-test-support';

let signing: Signing;
beforeAll(async () => {
  signing = await makeSigning();
});

const sha = (value: string) =>
  `sha256:${createHash('sha256').update(value).digest('hex')}`;
const rpcJson = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const loggedApp = (
  fetchImpl: typeof fetch,
  extra: Parameters<typeof createContentSchemaRegistryProductionApp>[3] = {},
) => {
  const lines: string[] = [];
  const logger = createLogger(
    {
      environment: 'staging',
      release: 'slice-09-pre',
      service: 'wejammin-api',
    },
    { sink: (line) => lines.push(line), random: () => 0 },
  );
  const app = createContentSchemaRegistryProductionApp(
    signing.registry,
    fetchImpl,
    () => NOW,
    {
      logger,
      resolveSession: async () =>
        ok({
          ...session,
          capabilities: ['cms.schema_designer', 'cms.schema_registry.read'],
        }),
      ...extra,
    },
  );
  const events = () =>
    lines.map((line) => LogEventSchema.parse(JSON.parse(line)));
  return { app, lines, events };
};

describe('registry diagnostics for A01-A08', () => {
  it('[P2-S09-AC-205] maps invalid upstream data to 502, an unavailable dependency to 503 and an exceeded deadline to 504 before the mutation completes', async () => {
    const hanging = makeAdversarial({ deadlineMs: 20 });
    let aborted = false;
    const hangingPort = hanging.ports.createTypeDraft;
    if (hangingPort === undefined)
      throw new Error('createTypeDraft port missing');
    hangingPort.mockImplementationOnce(
      (_input: unknown, signal: AbortSignal) =>
        new Promise(() => {
          signal.addEventListener('abort', () => {
            aborted = true;
          });
        }),
    );
    const slow = await hanging.app.request(
      jsonRequest('/api/v1/cms/content-types', validDraft),
    );
    expect(slow.status).toBe(504);
    expect(aborted).toBe(true);
    const invalid = makeHarness();
    invalid.ports.addFieldDefinition.mockResolvedValueOnce(
      ok({ ...field, ownerId: USER_ID }),
    );
    expect(
      (
        await invalid.app.request(
          jsonRequest(mutationPath.field, validField, { 'if-match': '"1"' }),
        )
      ).status,
    ).toBe(502);
    const missingPort = makeHarness();
    (missingPort.ports as Record<string, unknown>).bindRelation = undefined;
    const noPort = await missingPort.app.request(
      jsonRequest(mutationPath.relation, validRelation, { 'if-match': '"1"' }),
    );
    expect(noPort.status).toBe(503);
    const fetchDown = loggedApp(
      vi.fn<typeof fetch>(async () => {
        throw new TypeError('connection refused');
      }),
    );
    expect(
      (
        await fetchDown.app.request(
          jsonRequest('/api/v1/cms/content-types', validDraft),
        )
      ).status,
    ).toBe(503);
    const fetchHang = createContentSchemaRegistryProductionApp(
      signing.registry,
      vi.fn<typeof fetch>(() => new Promise<Response>(() => undefined)),
      () => NOW,
      { deadlineMs: 20, resolveSession: async () => ok(session) },
    );
    expect(
      (
        await fetchHang.request(
          jsonRequest('/api/v1/cms/content-types', validDraft),
        )
      ).status,
    ).toBe(504);
    const badJson = loggedApp(
      vi.fn<typeof fetch>(
        async () =>
          new Response('<html>', {
            status: 200,
            headers: { 'content-type': 'text/html' },
          }),
      ),
    );
    expect(
      (
        await badJson.app.request(
          jsonRequest('/api/v1/cms/content-types', validDraft),
        )
      ).status,
    ).toBe(502);
  });

  it('[P2-S09-AC-206] logs the operation, request, trace and correlation ids, actor and acting classes, safe id hash and expected version, outcome, code, duration, dependency and retryability only', async () => {
    const success = loggedApp(vi.fn<typeof fetch>(async () => rpcJson(field)));
    const response = await success.app.request(
      jsonRequest(mutationPath.field, validField, {
        'if-match': '"7"',
        'x-correlation-id': 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      }),
    );
    expect(response.status).toBe(201);
    const event = success
      .events()
      .find((candidate) => candidate.eventName === 'cms.registry.request');
    expect(event).toMatchObject({
      operation: 'cms.registry.CMS-03A-02',
      requestId: REQUEST_ID,
      correlationId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      traceId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      actorClass: 'human',
      actingContextClass: 'party',
      entityType: 'content_type_version',
      entityIdHash: sha(VERSION_ID),
      entityVersion: '7',
      outcome: 'success',
      retryable: false,
    });
    expect(typeof event?.durationMs).toBe('number');
    expect(success.lines.join('\n')).not.toContain(VERSION_ID);
    const failure = loggedApp(
      vi.fn<typeof fetch>(async () =>
        rpcJson({ code: '57014', message: 'timeout' }, 503),
      ),
    );
    expect(
      (
        await failure.app.request(
          jsonRequest(mutationPath.field, validField, { 'if-match': '"7"' }),
        )
      ).status,
    ).toBe(503);
    expect(
      failure
        .events()
        .find((candidate) => candidate.eventName === 'cms.registry.request'),
    ).toMatchObject({
      outcome: 'failure',
      errorCode: 'DEPENDENCY_UNAVAILABLE',
      dependency: 'cms_registry',
      retryable: true,
    });
    const release = loggedApp(vi.fn<typeof fetch>(async () => rpcJson(block)));
    const raw = JSON.stringify(validBlock);
    const registered = await release.app.request(
      releaseHttp('CMS-03A-05', raw, await signing.sign('CMS-03A-05', raw)),
    );
    expect(registered.status).toBe(201);
    expect(
      release
        .events()
        .find((candidate) => candidate.eventName === 'cms.registry.request'),
    ).toMatchObject({
      actorClass: 'release-worker',
      actingContextClass: 'none',
      operation: 'cms.registry.CMS-03A-05',
    });
    for (const line of [...success.lines, ...failure.lines, ...release.lines])
      expect(() => LogEventSchema.parse(JSON.parse(line))).not.toThrow();
    const read = loggedApp(
      vi.fn<typeof fetch>(async () => rpcJson({ items: [], nextCursor: null })),
    );
    await read.app.request(
      new Request(`${API_ORIGIN}/api/v1/cms/content-types`, {
        headers: {
          origin: CMS_ORIGIN,
          authorization: 'Bearer x',
          'x-request-id': REQUEST_ID,
        },
      }),
    );
    expect(
      read
        .events()
        .find((candidate) => candidate.eventName === 'cms.registry.request'),
    ).not.toHaveProperty('entityIdHash');
  });

  it('[P2-S09-AC-207] keeps request bodies, labels and values, capability graphs, renderer references, signatures, tokens and PII out of every log line and provider diagnostic', async () => {
    const secrets = [
      'TOP SECRET LABEL',
      'secret-help-text',
      'renderer/secret-renderer',
      'Bearer SECRET_TOKEN_VALUE',
      'SECRET_COOKIE_VALUE',
      'person@example.test',
      'cms.secret_graph_capability',
      'secret-default-value',
    ];
    const human = loggedApp(vi.fn<typeof fetch>(async () => rpcJson(resource)));
    await human.app.request(
      jsonRequest(
        '/api/v1/cms/content-types',
        {
          ...validDraft,
          label: secrets[0],
          ownerCapability: secrets[6],
          capabilityBindings: [
            { capabilityKey: secrets[6], capabilityVersion: '1' },
          ],
        },
        {
          authorization: secrets[3] as string,
          cookie: `wj_session_ref=${secrets[4]}; wj_csrf=x`,
          'x-csrf-token': 'x',
          'x-user-email': secrets[5] as string,
        },
      ),
    );
    await human.app.request(
      jsonRequest(
        mutationPath.field,
        {
          ...validField,
          editorConfig: { label: secrets[0], helpText: secrets[1], order: 0 },
          defaultMode: 'literal',
          defaultValue: secrets[7],
        },
        { 'if-match': '"1"', authorization: secrets[3] as string },
      ),
    );
    const failing = loggedApp(
      vi.fn<typeof fetch>(async () =>
        rpcJson(
          { message: `leak ${secrets[0]} ${secrets[5]}`, code: 'XX000' },
          500,
        ),
      ),
    );
    await failing.app.request(
      jsonRequest('/api/v1/cms/content-types', {
        ...validDraft,
        label: secrets[0],
      }),
    );
    const raw = JSON.stringify({ ...validBlock, rendererRef: secrets[2] });
    const headers = await signing.sign('CMS-03A-05', raw);
    const release = loggedApp(vi.fn<typeof fetch>(async () => rpcJson(block)));
    await release.app.request(releaseHttp('CMS-03A-05', raw, headers));
    const telemetryHarness = makeHarness();
    await telemetryHarness.app.request(
      jsonRequest(
        '/api/v1/cms/content-types',
        { ...validDraft, label: secrets[0] },
        { authorization: secrets[3] as string },
      ),
    );
    const everything = [
      ...human.lines,
      ...failing.lines,
      ...release.lines,
      JSON.stringify(telemetryHarness.telemetry.mock.calls),
    ].join('\n');
    for (const secret of [
      ...secrets,
      headers['X-WeJammin-Release-Signature'] as string,
      PARTY_ID,
      USER_ID,
      TYPE_ID,
    ])
      expect(everything, secret).not.toContain(secret);
    expect(human.lines.length).toBeGreaterThan(0);
    expect(release.lines.length).toBeGreaterThan(0);
  });

  it('[P2-S09-AC-210] traces admission, authority, rate limit, RPC and response in execution order with allowlisted diagnostics only', async () => {
    const harness = makeHarness();
    await harness.app.request(
      jsonRequest('/api/v1/cms/content-types', validDraft),
    );
    const event = harness.telemetry.mock.calls.at(-1)?.[0] as {
      traceSteps: string[];
    };
    expect(event.traceSteps).toEqual([
      'cms.admission',
      'cms.authority',
      'cms.rate_limit',
      'cms.rpc',
      'cms.response',
    ]);
    const order = [
      harness.resolveSession,
      harness.rateLimit,
      harness.ports.createTypeDraft,
      harness.telemetry,
    ].map((mock) => mock.mock.invocationCallOrder[0] as number);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    const logged = loggedApp(
      vi.fn<typeof fetch>(async () => rpcJson(resource)),
    );
    await logged.app.request(
      jsonRequest('/api/v1/cms/content-types', validDraft),
    );
    const requestEvent = logged
      .events()
      .find((candidate) => candidate.eventName === 'cms.registry.request');
    expect(requestEvent?.traceSteps).toEqual(event.traceSteps);
    for (const line of logged.lines)
      expect(() => LogEventSchema.parse(JSON.parse(line))).not.toThrow();
  });

  it('[P2-S09-AC-212] never rolls back or masks a committed definition when telemetry fails and shows no success when the RPC rolled back', async () => {
    for (const failure of [
      () => {
        throw new Error('telemetry down');
      },
      () => Promise.reject(new Error('telemetry rejected')),
    ]) {
      const harness = makeHarness();
      harness.telemetry.mockImplementation(failure);
      const response = await harness.app.request(
        jsonRequest('/api/v1/cms/content-types', validDraft),
      );
      expect(response.status).toBe(201);
      expect(harness.ports.createTypeDraft).toHaveBeenCalledTimes(1);
      expect(
        ((await response.json()) as { resourceKind: string }).resourceKind,
      ).toBe('content_type_version');
    }
    const rolledBack = makeHarness();
    rolledBack.ports.createTypeDraft.mockResolvedValueOnce({
      ok: false,
      status: 503,
      code: 'DEPENDENCY_UNAVAILABLE',
      message: 'audit insert failed',
      details: {},
    });
    const response = await rolledBack.app.request(
      jsonRequest('/api/v1/cms/content-types', validDraft),
    );
    expect(response.status).toBe(503);
    expect(response.headers.get('location')).toBeNull();
  });

  it('[P2-S09-AC-208] emits every declared A01-A08 metric to the production log: request, latency, error, rate, conflict, allowlist, migration, activation, block, nonce, outbox, queue retry and DLQ', async () => {
    const names = new Set<string>();
    const collect = (lines: string[]) => {
      for (const line of lines) {
        const event = LogEventSchema.parse(JSON.parse(line));
        for (const key of Object.keys(event.metrics ?? {}))
          names.add(key.replace(/\{.*$/u, ''));
      }
    };
    const run = async (
      fetchImpl: typeof fetch,
      send: (
        app: ReturnType<typeof loggedApp>['app'],
      ) => Response | Promise<Response>,
      extra?: Parameters<typeof loggedApp>[1],
    ) => {
      const logged = loggedApp(fetchImpl, extra);
      await send(logged.app);
      collect(logged.lines);
    };
    const create = (app: ReturnType<typeof loggedApp>['app']) =>
      app.request(jsonRequest('/api/v1/cms/content-types', validDraft));
    await run(
      vi.fn<typeof fetch>(async () => rpcJson(resource)),
      create,
    );
    await run(
      vi.fn<typeof fetch>(async () =>
        rpcJson(
          {
            code: 'P0001',
            message: 'CONFLICT version',
            details: 'VERSION_MISMATCH',
          },
          409,
        ),
      ),
      create,
    );
    await run(
      vi.fn<typeof fetch>(async () =>
        rpcJson(
          {
            code: 'P0001',
            message: 'VALIDATION_FAILED',
            details: JSON.stringify({
              violations: [
                { path: '/ownerCapability', message: 'not a registry member' },
              ],
            }),
          },
          422,
        ),
      ),
      create,
    );
    await run(
      vi.fn<typeof fetch>(async () => rpcJson({})),
      create,
      {
        rateLimit: async () => ({
          ok: true as const,
          value: {
            allowed: false,
            limit: 30,
            remaining: 0,
            resetAt: 1_788_345_660,
          },
        }),
      },
    );
    const raw = JSON.stringify(validBlock);
    await run(
      vi.fn<typeof fetch>(async () => rpcJson(block)),
      async (app) =>
        app.request(
          releaseHttp('CMS-03A-05', raw, await signing.sign('CMS-03A-05', raw)),
        ),
    );
    const lifecycleRaw = JSON.stringify(validLifecycle);
    await run(
      vi.fn<typeof fetch>(async () => rpcJson(lifecycleEvent)),
      async (app) =>
        app.request(
          releaseHttp(
            'CMS-03A-08',
            lifecycleRaw,
            await signing.sign('CMS-03A-08', lifecycleRaw),
          ),
        ),
    );
    const migration: string[] = [];
    const migrationLogger = createLogger(
      {
        environment: 'staging',
        release: 'slice-09-pre',
        service: 'wejammin-api',
      },
      { sink: (line) => migration.push(line), random: () => 0 },
    );
    const emit = productionMigrationTelemetry(migrationLogger);
    const base = {
      operation: 'migration.batch',
      migrationPlanId: null,
      schemaVersionId: null,
      eventId: null,
      correlationId: null,
      cursor: null,
      progress: null,
      attempt: 1,
      retryable: false,
      reasonCode: null,
      durationMs: 4,
    } as const;
    emit({ ...base, outcome: 'progress', progress: 0.4 });
    emit({ ...base, outcome: 'blocked', reasonCode: 'BLOCKED' });
    emit({ ...base, outcome: 'retry', retryable: true });
    emit({ ...base, outcome: 'dead_letter' });
    collect(migration);
    const gauges: string[] = [];
    const gaugeLogger = createLogger(
      {
        environment: 'production',
        release: 'slice-09-pre',
        service: 'wejammin-api',
      },
      { sink: (line) => gauges.push(line), random: () => 0 },
    );
    const fetchSnapshot = vi.fn<typeof fetch>(async (url) => {
      const target = String(url);
      if (target.includes('cms_get_operational_state_snapshot'))
        return Response.json({
          activationBlockedMs: 61_000,
          outboxAgeMs: 7_000,
          reviewOpenAgeMs: 5,
        });
      if (target.includes('/telemetry/query'))
        return Response.json({ result: { events: { events: [] } } });
      return Response.json({
        data: {
          viewer: {
            accounts: [
              { queueBacklogAdaptiveGroups: [{ avg: { messages: 2 } }] },
            ],
          },
        },
      });
    });
    const alerts = createProductionOperationalAlertDependencies(
      {
        CLOUDFLARE_ACCOUNT_ID: 'a',
        CLOUDFLARE_OBSERVABILITY_API_TOKEN: 't',
        CLOUDFLARE_PLATFORM_DLQ_ID: 'd',
        PLATFORM_ALERT_EMAIL: { send: vi.fn() },
        SUPABASE_SECRET_KEY: 'sb_secret_x',
        SUPABASE_URL: 'https://p.supabase.co',
      },
      fetchSnapshot,
      { logger: gaugeLogger },
    );
    await alerts.loadSnapshot({
      environment: 'production',
      release: 'slice-09-pre',
      scheduledAt: '2026-09-05T12:00:00.000Z',
    });
    collect(gauges);
    const declared = [
      'cms_definition_request_total',
      'cms_definition_latency_ms',
      'cms_definition_error_total',
      'cms_definition_rate_limited_total',
      'cms_definition_conflict_total',
      'cms_registry_allowlist_reject_total',
      'cms_migration_progress',
      'cms_migration_blocked_total',
      'cms_activation_age',
      'cms_block_registration_total',
      'cms_block_lifecycle_advance_total',
      'cms_release_nonce_claim_total',
      'cms_outbox_lag',
      'cms_queue_retry_total',
      'cms_queue_dlq_total',
    ];
    expect(declared.filter((name) => !names.has(name))).toEqual([]);
  });
});
