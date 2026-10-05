import { createLogger, type Logger } from '@wejammin/observability/logging';

import type { CmsEditorialTelemetryEvent } from './cms-editorial-production-types';

/**
 * Redacted editorial telemetry. A failure is high-risk and sampled always, but
 * the payload never carries a body, token, capability value, or actor identity
 * beyond the derived class and rate bucket.
 */
export const productionCmsEditorialTelemetry =
  (logger: Logger): ((event: CmsEditorialTelemetryEvent) => void) =>
  (event) => {
    const details = {
      eventName: 'cms.editorial.request',
      operation: `cms.editorial.${event.operationId}`,
      outcome: event.outcome,
      requestId: event.requestId,
      ...(event.correlationId === undefined
        ? {}
        : { correlationId: event.correlationId }),
      ...(event.errorCode === undefined ? {} : { errorCode: event.errorCode }),
      attributes: {
        rate_class: event.rateClass ?? 'unknown',
        rate_limit: event.rateLimit ?? 0,
        rate_window_seconds: event.rateWindowSeconds ?? 0,
        deadline_ms: event.deadlineMs ?? 0,
        actor_class: event.actorClass,
        alert_class: event.alertClass ?? 'cms_editorial_tier2',
        alert_route: event.alertRoute ?? 'platform.on_call',
        runbook: event.runbook,
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
    measurement('cms.editorial.command');
    measurement('cms.editorial.rpc');
    measurement('cms.editorial.acceptance');
  };

export const defaultCmsEditorialLogger = (environment: {
  APP_ENVIRONMENT: string;
  APP_RELEASE: string;
}): Logger =>
  createLogger({
    environment: environment.APP_ENVIRONMENT,
    release: environment.APP_RELEASE,
    service: 'wejammin-api',
  });
