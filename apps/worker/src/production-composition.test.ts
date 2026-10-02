import { describe, expect, it, vi } from 'vitest';

import type { ProductionVerificationDependencies } from './production-job-effect-dispatcher';
import {
  createProductionAsyncEntrypoint,
  createProductionWorkerApp,
  type WorkerBindings,
} from './index';
import { createProductionProviderEffectRegistry } from './provider-effects/provider-effect';
import { createProductionUploadStorageRegistry } from './storage/upload-storage';

const JOB_ID = '11111111-1111-4111-8111-111111111111';
const EVENT_ID = '22222222-2222-4222-8222-222222222222';
const CORRELATION_ID = '33333333-3333-4333-8333-333333333333';
const LEASE_TOKEN = '44444444-4444-4444-8444-444444444444';
const CONFIGURATION_DEFINITION_ID = '55555555-5555-4555-8555-555555555555';
const CONFIGURATION_DEFINITION_VERSION_ID =
  '66666666-6666-4666-8666-666666666666';
const CONFIGURATION_CORRELATION_ID = '77777777-7777-4777-8777-777777777777';

const bindings: WorkerBindings = {
  APP_ENVIRONMENT: 'production',
  APP_RELEASE: 'test-release',
  SUPABASE_SECRET_KEY: 'sb_secret_test_only',
  SUPABASE_URL: 'https://production.example.supabase.co',
};

const envelope = {
  aggregateId: JOB_ID,
  aggregateType: 'job',
  aggregateVersion: '1',
  causationId: null,
  correlationId: CORRELATION_ID,
  eventId: EVENT_ID,
  eventType: 'job.requested' as const,
  schemaVersion: 1 as const,
};

const migrationEvent = {
  eventId: '88888888-8888-4888-8888-888888888888',
  eventType: 'cms.schema.activated.v1' as const,
  schemaVersion: 1 as const,
  occurredAt: '2026-09-02T12:00:00.000Z',
  producer: 'cms.schema_registry',
  correlationId: CORRELATION_ID,
  causationId: null,
  aggregateType: 'cms.schema.migration',
  aggregateId: '99999999-9999-4999-8999-999999999999',
  aggregateVersion: '7',
  payload: {
    contentTypeId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    schemaVersionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    migrationPlanId: null,
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

describe('production Worker composition', () => {
  it('executes approved internal object verification through the queue seam', async () => {
    const verifyObject = vi.fn<
      ProductionVerificationDependencies['verifyObject']
    >(async (input) => ({
      errorCode: null,
      resultRef: { id: input.job.id, type: 'object' },
      state: 'succeeded',
    }));
    const fetchImpl = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        void init;
        const operation = new URL(String(input)).pathname.split('/').at(-1);
        const response: Readonly<Record<string, unknown>> = {
          apply_job_outcome: true,
          claim_job: {
            jobId: JOB_ID,
            leaseToken: LEASE_TOKEN,
            expectedVersion: '1',
            leaseUntilMs: 1_756_560_300_000,
            version: '2',
          },
          read_canonical_job: {
            id: JOB_ID,
            leaseUntilMs: null,
            state: 'queued',
            type: 'platform.object.verify',
            version: '1',
          },
          read_restore_fence: {
            expected_epoch: '1',
            consumer_epoch: '1',
            integrity_verified: true,
            reconciliation_complete: true,
          },
          record_processed_event: 'recorded',
        };
        return Response.json(response[operation ?? ''] ?? null);
      },
    );
    const ack = vi.fn();
    const retry = vi.fn();

    await createProductionAsyncEntrypoint(fetchImpl, { verifyObject }).queue(
      {
        messages: [
          { ack, attempts: 1, body: envelope, id: 'message-1', retry },
        ],
        queue: 'platform-jobs',
      },
      { ...bindings, PLATFORM_JOBS: { send: vi.fn() } },
      { waitUntil: vi.fn() },
    );

    expect(verifyObject).toHaveBeenCalledOnce();
    expect(ack).toHaveBeenCalledOnce();
    expect(retry).not.toHaveBeenCalled();
    const outcome = fetchImpl.mock.calls.find(([input]) =>
      String(input).endsWith('/apply_job_outcome'),
    );
    expect(outcome).toBeDefined();
    expect(JSON.parse(String(outcome?.[1]?.body))).toMatchObject({
      p_next_state: 'succeeded',
      p_result_ref: { id: JOB_ID, type: 'object' },
    });
  });

  it('dispatches schema activation events through the production migration queue entry', async () => {
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
    const ack = vi.fn();
    const retry = vi.fn();

    await createProductionAsyncEntrypoint(fetchImpl).queue(
      {
        messages: [
          { ack, attempts: 1, body: migrationEvent, id: 'message-2', retry },
        ],
        queue: 'platform-jobs',
      } as never,
      { ...bindings, PLATFORM_JOBS: { send: vi.fn() } },
      { waitUntil: vi.fn() },
    );

    expect(ack).toHaveBeenCalledOnce();
    expect(retry).not.toHaveBeenCalled();
    expect(
      fetchImpl.mock.calls.some(([input]) =>
        String(input).endsWith('/cms_claim_schema_migration_event'),
      ),
    ).toBe(true);
  });

  it('keeps production storage and webhook surfaces disabled instead of faking success', async () => {
    const fetchImpl = vi.fn(async () => Response.json([]));
    const app = createProductionWorkerApp(bindings, fetchImpl);

    const upload = await app.request(
      '/api/v1/upload-intents',
      { method: 'POST' },
      bindings,
    );
    expect(upload.status).toBe(503);
    await expect(upload.json()).resolves.toMatchObject({
      code: 'DEPENDENCY_UNAVAILABLE',
    });

    const webhook = await app.request(
      '/api/v1/webhooks/unknown-provider',
      { method: 'POST', body: '{}' },
      bindings,
    );
    expect(webhook.status).toBe(404);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(createProductionProviderEffectRegistry()).toEqual({});
    expect(createProductionUploadStorageRegistry()).toEqual({});
  });

  it('keeps production readiness closed until an explicit checker verifies it', async () => {
    const fetchImpl = vi.fn(async () => Response.json([]));
    const closedApp = createProductionWorkerApp(bindings, fetchImpl);
    const closed = await closedApp.request('/api/v1/ready', {}, bindings);

    expect(closed.status).toBe(503);
    expect(closed.headers.get('cache-control')).toBe('no-store');
    expect(closed.headers.get('retry-after')).toBe('5');
    await expect(closed.json()).resolves.toMatchObject({
      status: 'not_ready',
    });

    const checkReadiness = vi.fn(() => ({ ready: true }));
    const verifiedApp = createProductionWorkerApp(
      bindings,
      fetchImpl,
      undefined,
      checkReadiness,
    );
    const verified = await verifiedApp.request('/api/v1/ready', {}, bindings);

    expect(verified.status).toBe(200);
    await expect(verified.json()).resolves.toMatchObject({
      status: 'ready',
    });
    expect(checkReadiness).toHaveBeenCalledOnce();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('passes deployment configuration verifiers through production composition', async () => {
    const resolveReleasePrincipal = vi.fn(async () => ({
      ok: true as const,
      value: { principalId: 'release.ci' },
    }));
    const resolveServiceConsumer = vi.fn(async () => ({
      ok: true as const,
      value: { principalId: 'config.worker', consumerKey: 'web.profile' },
    }));
    const fetchImpl = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        void init;
        const operation = new URL(String(input)).pathname.split('/').at(-1);
        if (operation === 'auth_rate_limit') {
          return Response.json({
            allowed: true,
            limit: 600,
            remaining: 599,
            resetAt: 2_000_000_000,
          });
        }
        if (operation === 'cfg_resolve_effective_value') {
          return Response.json({
            compatibility: 'exact',
            correlationId: CONFIGURATION_CORRELATION_ID,
            definitionId: CONFIGURATION_DEFINITION_ID,
            definitionVersionId: CONFIGURATION_DEFINITION_VERSION_ID,
            effectiveFrom: null,
            effectiveTo: null,
            evaluatedAt: '2026-09-02T03:00:00.000Z',
            evaluatorVersion: '1',
            isDefault: true,
            key: 'profile.visibility',
            ownerCapability: 'settings.profile.write',
            sourceScope: 'platform',
            sourceSubjectId: null,
            sourceValueVersionId: null,
            typedValue: false,
            valueKind: 'boolean',
          });
        }
        if (operation === 'cfg_register_definition') {
          return Response.json({
            allowedScopes: ['platform'],
            contractRelease: 'phase-2.7',
            createdAt: '2026-09-02T03:00:00.000Z',
            definitionId: CONFIGURATION_DEFINITION_ID,
            definitionVersionId: CONFIGURATION_DEFINITION_VERSION_ID,
            key: 'feature.release',
            lifecycle: 'active',
            mergeMode: 'replace',
            precedence: ['platform'],
            riskClass: 'low',
            schemaHash:
              'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            synchronized: true,
            valueKind: 'boolean',
            version: '1',
          });
        }
        return Response.json({});
      },
    );
    const app = createProductionWorkerApp(
      bindings,
      fetchImpl,
      undefined,
      undefined,
      { resolveReleasePrincipal, resolveServiceConsumer },
    );

    const effective = await app.request(
      new Request(
        'https://api.wejammin.test/api/v1/config/profile.visibility/effective?consumerKey=web.profile&supportedDefinitionVersions=1',
        {
          headers: {
            origin: 'https://api.wejammin.test',
            'x-consumer-key': 'web.profile',
            'x-worker-consumer': 'config.worker',
            'x-worker-signature': '0123456789abcdef',
          },
        },
      ),
      {},
      bindings,
    );
    expect(effective.status).toBe(200);
    expect(resolveServiceConsumer).toHaveBeenCalledOnce();

    const registered = await app.request(
      new Request(
        'https://api.wejammin.test/api/v1/internal/config/definitions',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'idempotency-key': 'production-registration-001',
            origin: 'https://api.wejammin.test',
            'x-release-principal': 'release.ci',
            'x-release-signature': '0123456789abcdef',
          },
          body: JSON.stringify({
            allowedScopes: ['platform'],
            approverPolicy: {
              minimumDistinct: 1,
              notifyCapabilities: [],
              requiresCanary: false,
              requiresMfa: false,
            },
            consumerKeys: ['web.profile'],
            contractRelease: 'phase-2.7',
            defaultSource: 'literal',
            defaultValue: false,
            key: 'feature.release',
            mergeMode: 'replace',
            ownerCapability: 'settings.profile.write',
            precedence: ['platform'],
            reason: 'Register a release setting.',
            riskClass: 'low',
            schema: { type: 'boolean' },
            sensitivity: 'internal',
            valueKind: 'boolean',
          }),
        },
      ),
      {},
      bindings,
    );
    expect(registered.status).toBe(201);
    expect(resolveReleasePrincipal).toHaveBeenCalledOnce();

    const effectiveCall = fetchImpl.mock.calls.find(([input]) =>
      String(input).endsWith('/cfg_resolve_effective_value'),
    );
    expect(JSON.parse(String(effectiveCall?.[1]?.body))).toMatchObject({
      p_request: {
        context: {
          releasePrincipalId: 'config.worker',
          serviceConsumerKey: 'web.profile',
        },
      },
    });
    const registerCall = fetchImpl.mock.calls.find(([input]) =>
      String(input).endsWith('/cfg_register_definition'),
    );
    expect(JSON.parse(String(registerCall?.[1]?.body))).toMatchObject({
      p_request: { context: { releasePrincipalId: 'release.ci' } },
    });
  });
});
