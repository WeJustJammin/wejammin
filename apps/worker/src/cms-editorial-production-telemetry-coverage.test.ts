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
    expect(info).toHaveBeenCalledTimes(4);
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
    });
    expect(info).toHaveBeenCalledTimes(4);
  });

  it('builds a logger bound to the environment release', () => {
    const logger = defaultCmsEditorialLogger(environment);
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
  });
});
