import { createLogger, type Logger } from '@wejammin/observability/logging';

import type { CmsEditorialTelemetryEvent } from './cms-editorial-production-types';

/** The four state-changing operations; every other operation is a safe read. */
const COMMAND_OPERATIONS: ReadonlySet<string> = new Set([
  'CMS-03B-01',
  'CMS-03B-02',
  'CMS-03B-04',
  'CMS-03B-10',
  'CMS-03B-05',
  'CMS-03B-06',
  'CMS-03B-07',
  'CMS-03B-08',
  'CMS-03B-09',
  'CMS-03B-18',
]);

/**
 * Redacted editorial telemetry (BE03b "Observability"). The request event is
 * always written; a command additionally writes its command event, an RPC event
 * only when the RPC stage was really entered, and an acceptance event only when
 * the command succeeded. A safe read writes the request event alone, so no
 * stage that never ran is reported as having run. A failure is high-risk and
 * sampled always, but the payload never carries a body, token, capability
 * value, or any identifier beyond the entry-id hash.
 */
export const productionCmsEditorialTelemetry =
  (logger: Logger): ((event: CmsEditorialTelemetryEvent) => void) =>
  (event) => {
    const isCommand = COMMAND_OPERATIONS.has(event.operationId);
    const alertClass =
      event.alertClass ??
      (event.slo?.tier === 1 ? 'cms_editorial_tier1' : 'cms_editorial_tier2');
    const details = {
      eventName: 'cms.editorial.request',
      operation: `cms.editorial.${event.operationId}`,
      outcome: event.outcome,
      requestId: event.requestId,
      ...(event.correlationId === undefined
        ? {}
        : { correlationId: event.correlationId }),
      ...(event.traceId === undefined ? {} : { traceId: event.traceId }),
      ...(event.errorCode === undefined ? {} : { errorCode: event.errorCode }),
      actorClass: event.actorClass,
      ...(event.actingContextClass === undefined
        ? {}
        : { actingContextClass: event.actingContextClass }),
      attributes: {
        rate_class: event.rateClass ?? 'unknown',
        rate_limit: event.rateLimit ?? 0,
        rate_window_seconds: event.rateWindowSeconds ?? 0,
        deadline_ms: event.deadlineMs ?? 0,
        actor_class: event.actorClass,
        alert_class: alertClass,
        alert_route: event.alertRoute ?? 'platform.on_call',
        runbook: event.runbook,
        ...(event.eventType === undefined
          ? {}
          : { event_type: event.eventType }),
      },
      ...(event.dependency === undefined
        ? {}
        : { dependency: event.dependency }),
      ...(event.entityIdHash === undefined
        ? {}
        : { entityType: 'cms_entry', entityIdHash: event.entityIdHash }),
      ...(event.entityVersion === undefined
        ? {}
        : { entityVersion: event.entityVersion }),
      ...(event.traceSteps === undefined
        ? {}
        : { traceSteps: [...event.traceSteps] }),
      ...(event.metrics === undefined ? {} : { metrics: { ...event.metrics } }),
      durationMs: event.durationMs,
      retryable: event.retryable ?? event.outcome === 'failure',
    } as const;
    const options = {
      samplingClass: 'always',
      highRisk: event.outcome !== 'success',
    } as const;
    logger.info(details, options);
    if (!isCommand) return;
    const measurement = (eventName: string): void => {
      logger.info({ ...details, eventName }, options);
    };
    measurement('cms.editorial.command');
    if (event.traceSteps?.includes('cms.rpc') === true)
      measurement('cms.editorial.rpc');
    if (event.outcome === 'success') measurement('cms.editorial.acceptance');
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
