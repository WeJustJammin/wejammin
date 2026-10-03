import { createLogger, type Logger } from '@wejammin/observability/logging';

import { CONTENT_SCHEMA_REGISTRY_RUNBOOK, type TelemetryEvent } from './types';

const PROTECTED_READS: ReadonlySet<string> = new Set([
  'CMS-03A-06',
  'CMS-03A-07',
  'CMS-03A-13',
  'CMS-03A-18',
]);

export const productionTelemetry =
  (logger: Logger): ((event: TelemetryEvent) => void) =>
  (event) => {
    const details = {
      eventName: 'cms.registry.request',
      operation: `cms.registry.${event.operationId}`,
      outcome: event.outcome,
      requestId: event.requestId,
      ...(event.correlationId === undefined
        ? {}
        : { correlationId: event.correlationId, traceId: event.correlationId }),
      actorClass: event.actorClass,
      ...(event.actingContextClass === undefined
        ? {}
        : { actingContextClass: event.actingContextClass }),
      ...(event.entityType === undefined
        ? {}
        : { entityType: event.entityType }),
      ...(event.entityIdHash === undefined
        ? {}
        : { entityIdHash: event.entityIdHash }),
      ...(event.entityVersion === undefined
        ? {}
        : { entityVersion: event.entityVersion }),
      ...(event.dependency === undefined
        ? {}
        : { dependency: event.dependency }),
      ...(event.errorCode === undefined ? {} : { errorCode: event.errorCode }),
      attributes: {
        rate_class: event.rateClass ?? 'unknown',
        rate_limit: event.rateLimit ?? 0,
        rate_window_seconds: event.rateWindowSeconds ?? 0,
        deadline_ms: event.deadlineMs ?? 0,
        slo_tier: event.slo?.tier ?? 2,
        slo_command_p95_ms: event.slo?.commandP95Ms ?? 1_200,
        slo_protected_rpc_p95_ms: event.slo?.protectedRpcP95Ms ?? 300,
        slo_acceptance_p99_ms: event.slo?.acceptanceP99Ms ?? 1_000,
        alert_class: event.alertClass ?? 'content_schema_registry_tier2',
        alert_route: event.alertRoute ?? 'platform.on_call',
        runbook: event.runbook ?? CONTENT_SCHEMA_REGISTRY_RUNBOOK,
      },
      ...(event.traceSteps === undefined
        ? {}
        : { traceSteps: [...event.traceSteps] }),
      ...(event.metrics === undefined ? {} : { metrics: { ...event.metrics } }),
      durationMs: event.durationMs,
      retryable: event.outcome === 'failure',
    } as const;
    logger.info(details, {
      samplingClass: 'always',
      highRisk: event.outcome !== 'success',
    });
    const measurement = (eventName: string): void => {
      logger.info(
        { ...details, eventName },
        { samplingClass: 'always', highRisk: event.outcome !== 'success' },
      );
    };
    // Protected reads are measured as rpc and acceptance, never as commands.
    if (!PROTECTED_READS.has(event.operationId))
      measurement('cms.registry.command');
    measurement('cms.registry.rpc');
    measurement('cms.registry.acceptance');
  };

export const defaultProductionLogger = (environment: {
  APP_ENVIRONMENT: string;
  APP_RELEASE: string;
}): Logger =>
  createLogger({
    environment: environment.APP_ENVIRONMENT,
    release: environment.APP_RELEASE,
    service: 'wejammin-api',
  });
