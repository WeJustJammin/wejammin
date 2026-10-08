import { describe, it } from 'vitest';

import type { Logger } from '@wejammin/observability/logging';

import { createProductionCmsEditorialDependencies } from './cms-editorial-production';
import {
  defaultCmsEditorialLogger,
  productionCmsEditorialTelemetry,
} from './cms-editorial-production-telemetry';
import {
  environment,
  expect,
  vi,
} from './cms-editorial-production.test-support';

const withLogger = (info: ReturnType<typeof vi.fn>) =>
  createProductionCmsEditorialDependencies({
    environment,
    fetchImpl: vi.fn() as unknown as typeof fetch,
    logger: { info } as unknown as Logger,
  });

describe('cms editorial production telemetry', () => {
  it('fills optional fields with scrubbed defaults', () => {
    const info = vi.fn();
    const telemetry = productionCmsEditorialTelemetry({
      info,
    } as unknown as Logger);
    telemetry({
      operationId: 'CMS-03B-01',
      requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      outcome: 'failure',
      status: 503,
      durationMs: 5,
      actorClass: 'human',
      runbook: 'cms-editorial',
      traceSteps: ['cms.admission', 'cms.rpc', 'cms.response'],
    });
    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'cms.editorial.request',
        operation: 'cms.editorial.CMS-03B-01',
        outcome: 'failure',
        retryable: true,
        attributes: expect.objectContaining({
          rate_class: 'unknown',
          rate_limit: 0,
          rate_window_seconds: 0,
          deadline_ms: 0,
          alert_class: 'cms_editorial_tier2',
          alert_route: 'platform.on_call',
          runbook: 'cms-editorial',
        }),
      }),
      expect.objectContaining({ samplingClass: 'always', highRisk: true }),
    );
    // A failed command that reached the RPC logs request, command and rpc;
    // acceptance is reserved for a command that succeeded.
    expect(info).toHaveBeenCalledTimes(3);
  });

  it('logs no rpc or acceptance event for a command that never reached the RPC', () => {
    const info = vi.fn();
    productionCmsEditorialTelemetry({ info } as unknown as Logger)({
      operationId: 'CMS-03B-01',
      requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      outcome: 'rejected',
      status: 401,
      durationMs: 1,
      actorClass: 'human',
      runbook: 'cms-editorial',
      traceSteps: ['cms.admission', 'cms.authority', 'cms.response'],
    });
    expect(
      info.mock.calls.map(
        ([details]) => (details as { eventName: string }).eventName,
      ),
    ).toEqual(['cms.editorial.request', 'cms.editorial.command']);
  });

  it('forwards declared optional telemetry values and success sampling', () => {
    const info = vi.fn();
    const telemetry = productionCmsEditorialTelemetry({
      info,
    } as unknown as Logger);
    telemetry({
      operationId: 'CMS-03B-11',
      requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      correlationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      outcome: 'success',
      errorCode: 'NONE',
      status: 200,
      durationMs: 3,
      actorClass: 'human',
      rateClass: 'cms-entry-read',
      rateLimit: 300,
      rateWindowSeconds: 60,
      deadlineMs: 8000,
      alertClass: 'custom_tier',
      alertRoute: 'custom.route',
      runbook: 'custom-runbook',
      traceSteps: ['resolve', 'rpc'],
      metrics: { rpc_calls: 1 },
    });
    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({
        correlationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        errorCode: 'NONE',
        retryable: false,
        traceSteps: ['resolve', 'rpc'],
        metrics: { rpc_calls: 1 },
        attributes: expect.objectContaining({
          rate_class: 'cms-entry-read',
          rate_limit: 300,
          rate_window_seconds: 60,
          deadline_ms: 8000,
          alert_class: 'custom_tier',
          alert_route: 'custom.route',
          runbook: 'custom-runbook',
        }),
      }),
      expect.objectContaining({ highRisk: false }),
    );
  });

  it('writes only what the event carries: a bare read event has no optional member, a full one has them all', () => {
    const base = {
      operationId: 'CMS-03B-11',
      requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      outcome: 'success',
      status: 200,
      durationMs: 1,
      actorClass: 'human',
      runbook: 'cms-editorial',
    } as const;
    const bare = vi.fn();
    productionCmsEditorialTelemetry({ info: bare } as unknown as Logger)(base);
    const bareDetails = bare.mock.calls[0]?.[0] as Record<string, unknown>;
    for (const absent of [
      'correlationId',
      'traceId',
      'errorCode',
      'actingContextClass',
      'dependency',
      'entityType',
      'entityIdHash',
      'entityVersion',
      'traceSteps',
      'metrics',
    ])
      expect(bareDetails).not.toHaveProperty(absent);
    expect(bare).toHaveBeenCalledTimes(1);

    const full = vi.fn();
    productionCmsEditorialTelemetry({ info: full } as unknown as Logger)({
      ...base,
      outcome: 'failure',
      status: 503,
      traceId: '0af7651916cd43dd8448eb211c80319c',
      actingContextClass: 'party',
      eventType: 'cms.entry.revision-created.v1',
      dependency: 'cms_editorial',
      entityIdHash: `sha256:${'a'.repeat(64)}`,
      entityVersion: '7',
      slo: {
        tier: 1,
        commandP95Ms: 750,
        protectedRpcP95Ms: 300,
        acceptanceP99Ms: 1000,
      },
      retryable: false,
    });
    expect(full).toHaveBeenCalledWith(
      expect.objectContaining({
        traceId: '0af7651916cd43dd8448eb211c80319c',
        actingContextClass: 'party',
        dependency: 'cms_editorial',
        entityType: 'cms_entry',
        entityIdHash: `sha256:${'a'.repeat(64)}`,
        entityVersion: '7',
        retryable: false,
        attributes: expect.objectContaining({
          alert_class: 'cms_editorial_tier1',
          event_type: 'cms.entry.revision-created.v1',
        }),
      }),
      expect.objectContaining({ highRisk: true }),
    );
    // An entity hash without a version logs the entity, not a version.
    const hashOnly = vi.fn();
    productionCmsEditorialTelemetry({ info: hashOnly } as unknown as Logger)({
      ...base,
      entityIdHash: `sha256:${'b'.repeat(64)}`,
    });
    expect(hashOnly.mock.calls[0]?.[0]).not.toHaveProperty('entityVersion');
  });

  it('exposes the factory default telemetry sink', () => {
    const info = vi.fn();
    withLogger(info).telemetry?.({
      operationId: 'CMS-03B-01',
      requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      outcome: 'rejected',
      status: 409,
      durationMs: 2,
      actorClass: 'human',
      runbook: 'cms-editorial',
      traceSteps: ['cms.admission', 'cms.rpc', 'cms.response'],
    });
    expect(info).toHaveBeenCalledTimes(3);
  });

  it('builds a logger bound to the environment release', () => {
    const logger = defaultCmsEditorialLogger(environment);
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
  });
});
