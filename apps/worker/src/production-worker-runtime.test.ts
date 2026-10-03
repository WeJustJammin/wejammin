import { describe, expect, it, vi } from 'vitest';
import type { Logger } from '@wejammin/observability/logging';

import type { ContentSchemaRegistryDependencies } from './content-schema-registry/types';
import type { WorkerApp, WorkerBindings, WorkerDependencies } from './index';
import {
  createProductionSchemaMigrationWorker,
  createProductionWorkerAppRuntime,
  migrationQueueOutcome,
} from './production-worker-runtime';

const environment: WorkerBindings = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'slice-09-runtime',
  SUPABASE_SECRET_KEY: 'sb_secret_slice_09_runtime',
  SUPABASE_URL: 'https://supabase.example.test',
};

const migrationEvent = {
  eventId: '44444444-4444-4444-8444-444444444444',
  eventType: 'cms.schema.activated.v1' as const,
  schemaVersion: 1 as const,
  occurredAt: '2026-09-02T12:00:00.000Z',
  producer: 'cms.schema_registry',
  correlationId: '55555555-5555-4555-8555-555555555555',
  causationId: null,
  aggregateType: 'cms.schema.migration',
  aggregateId: '66666666-6666-4666-8666-666666666666',
  aggregateVersion: '7',
  payload: {
    contentTypeId: '77777777-7777-4777-8777-777777777777',
    schemaVersionId: '88888888-8888-4888-8888-888888888888',
    migrationPlanId: null,
    localeConfigHash: 'c'.repeat(64),
    activationEvidence: {
      key: 'cms.schema.activate',
      version: '1',
      policyHash: 'a'.repeat(64),
      riskClass: 'ordinary',
      requiredDecisionCount: 1,
      requiredCapabilities: ['cms.schema_designer'],
      approvalEvidenceHash: 'b'.repeat(64),
    },
  },
} as const;

describe('production Worker runtime', () => {
  it('maps progress and retryable failures to queue retry while acknowledging terminal outcomes', () => {
    expect(migrationQueueOutcome({ outcome: 'progress' } as never)).toBe(
      'retry',
    );
    expect(migrationQueueOutcome({ outcome: 'retry' } as never)).toBe('retry');
    expect(
      migrationQueueOutcome({ outcome: 'failed_retryable' } as never),
    ).toBe('retry');
    expect(migrationQueueOutcome({ outcome: 'completed' } as never)).toBe(
      'ack',
    );
    expect(migrationQueueOutcome({ outcome: 'failed_terminal' } as never)).toBe(
      'ack',
    );
  });

  it('constructs the CMS registry with explicit deployment-only security seams', () => {
    let captured: WorkerDependencies | undefined;
    const app = {} as WorkerApp;
    const createApp = vi.fn((dependencies: WorkerDependencies) => {
      captured = dependencies;
      return app;
    });
    const verifyRelease =
      vi.fn<NonNullable<ContentSchemaRegistryDependencies['verifyRelease']>>();
    const rateLimit =
      vi.fn<NonNullable<ContentSchemaRegistryDependencies['rateLimit']>>();

    const result = createProductionWorkerAppRuntime(
      createApp,
      environment,
      vi.fn(async () => Response.json([])),
      undefined,
      undefined,
      undefined,
      {
        humanOrigins: ['https://cms.example.test'],
        rateLimit,
        releaseOrigins: ['https://release.example.test'],
        verifyRelease,
      },
    );

    expect(result).toBe(app);
    expect(createApp).toHaveBeenCalledOnce();
    expect(captured?.ac265Hosted).toBeDefined();
    expect(captured?.contentSchemaRegistry).toBeDefined();
    expect(captured?.contentSchemaRegistry?.verifyRelease).toEqual(
      expect.any(Function),
    );
    expect(captured?.contentSchemaRegistry?.rateLimit).toEqual(
      expect.any(Function),
    );
    expect(captured?.contentSchemaRegistry?.humanOrigins).toEqual([
      'https://cms.example.test',
    ]);
    expect(captured?.contentSchemaRegistry?.releaseOrigins).toEqual([
      'https://release.example.test',
    ]);
    expect(captured?.contentSchemaRegistry?.telemetry).toEqual(
      expect.any(Function),
    );
  });

  it('wires configured origins and the production auth limiter by default', async () => {
    let captured: WorkerDependencies | undefined;
    const createApp = vi.fn((dependencies: WorkerDependencies) => {
      captured = dependencies;
      return {} as WorkerApp;
    });
    const fetchImpl = vi.fn(async () =>
      Response.json({
        allowed: true,
        limit: 30,
        remaining: 29,
        resetAt: 1_788_236_460,
      }),
    );
    const configuredEnvironment = {
      ...environment,
      CMS_HUMAN_ORIGINS: 'https://cms.example.test',
      CMS_RELEASE_ORIGINS: 'https://release.example.test',
    };
    createProductionWorkerAppRuntime(
      createApp,
      configuredEnvironment,
      fetchImpl,
    );
    const registry = captured?.contentSchemaRegistry;
    expect(registry?.humanOrigins).toEqual(['https://cms.example.test']);
    expect(registry?.releaseOrigins).toEqual(['https://release.example.test']);
    if (registry === undefined) return;
    await expect(
      registry.rateLimit(
        {
          operationId: 'CMS-03A-01',
          request: new Request(
            'https://api.example.test/api/v1/cms/content-types',
          ),
          actorId: '10000000-0000-4000-8000-000000000001',
          actingPartyId: '20000000-0000-4000-8000-000000000002',
          principalClass: 'human',
          rateClass: 'cms-definition-write',
          limit: 30,
          windowSeconds: 60,
        },
        new AbortController().signal,
      ),
    ).resolves.toMatchObject({ ok: true, value: { limit: 30 } });
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining('/rpc/auth_rate_limit'),
      expect.any(Object),
    );
  });

  it('composes the migration worker with the protected RPC transport and scrubbed telemetry', async () => {
    const fetchImpl = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        void init;
        const operation = new URL(String(input)).pathname.split('/').at(-1);
        if (operation === 'cms_claim_schema_migration_event')
          return Response.json({ status: 'new' });
        if (operation === 'cms_acknowledge_schema_migration_event')
          return Response.json({ accepted: true });
        return Response.json(null);
      },
    );
    const telemetry = vi.fn();
    const worker = createProductionSchemaMigrationWorker(
      environment,
      fetchImpl,
      {
        telemetry,
      },
    );

    await expect(worker.process(migrationEvent)).resolves.toMatchObject({
      outcome: 'completed',
      eventId: migrationEvent.eventId,
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining('/rpc/cms_claim_schema_migration_event'),
      expect.objectContaining({
        headers: expect.objectContaining({
          apikey: environment.SUPABASE_SECRET_KEY,
        }),
        body: expect.stringContaining('p_request'),
      }),
    );
    const claimCall = fetchImpl.mock.calls.find(([input]) =>
      String(input).includes('/rpc/cms_claim_schema_migration_event'),
    );
    expect(new Headers(claimCall?.[1]?.headers).has('authorization')).toBe(
      false,
    );
    expect(telemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'migration.consume',
        outcome: 'success',
      }),
    );
  });

  it('uses bounded explicit worker options and the default scrubbed telemetry sink', async () => {
    const logger = { info: vi.fn() } as unknown as Logger;
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const operation = new URL(String(input)).pathname.split('/').at(-1);
      if (operation === 'cms_claim_schema_migration_event')
        return Response.json({ status: 'new' });
      if (
        operation === 'cms_acknowledge_schema_migration_event' ||
        operation === 'cms_dead_letter_schema_migration_event'
      )
        return Response.json({ accepted: true });
      return Response.json(null);
    });
    const worker = createProductionSchemaMigrationWorker(
      environment,
      fetchImpl,
      {
        workerId: 'cms-schema-migration-explicit',
        deadlineMs: 15_000,
        maxResponseBytes: 1024,
        leaseDurationMs: 1_000,
        maxBatchRows: 1,
        maxBatchesPerInvocation: 1,
        now: () => Date.parse('2026-09-02T12:00:00.000Z'),
        logger,
      },
    );

    await expect(worker.process(migrationEvent)).resolves.toMatchObject({
      outcome: 'completed',
    });
    await expect(
      worker.process({ ...migrationEvent, schemaVersion: 99 }, { attempt: 1 }),
    ).resolves.toMatchObject({ outcome: 'dead_letter' });
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        attributes: expect.objectContaining({
          'alert.route': 'platform.on_call',
          runbook: 'content-schema-registry',
        }),
        // BE03a also requires the alert-routing counters (cms_queue_*,
        // cms_migration_blocked_total) beside these three; assert the three
        // exactly and tolerate only those spec-required additions.
        metrics: expect.objectContaining({
          'cms.migration.dlq.total': expect.any(Number),
          'cms.migration.requests.total': 1,
          'cms.migration.retries.total': expect.any(Number),
          cms_queue_dlq_total: expect.any(Number),
          cms_queue_retry_total: expect.any(Number),
          cms_migration_blocked_total: expect.any(Number),
        }),
      }),
      expect.objectContaining({ samplingClass: 'always' }),
    );
    expect(logger.info).not.toHaveBeenCalledWith(
      expect.objectContaining({
        attributes: expect.objectContaining({
          'alert.route': 'platform.on-call',
        }),
      }),
      expect.anything(),
    );
  });
});
