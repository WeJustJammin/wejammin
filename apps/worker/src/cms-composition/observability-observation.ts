import type { LogEventDetails } from '@wejammin/observability/logging';

import {
  compositionMetrics,
  invalidationMetrics,
} from './observability-metrics';
import { factsOf } from './observability-facts';
import {
  CMS_COMPOSITION_TRACE_STAGES,
  type CmsCompositionTraceStage,
} from './observability-registry';

/**
 * The redacted observation of one Slice 12 request (BE03c Observability): its trace, counters and the
 * allowlisted log members, built from closed facts and the finished response status. Telemetry is
 * non-authoritative and never alters the response; it cannot claim a stage the request did not enter.
 */
export type CompositionObservation = Readonly<{
  correlationId: string;
  traceId: string;
  actingContextClass: 'none' | 'party';
  errorCode?: string;
  retryable: boolean;
  dependency?: string;
  traceSteps: readonly string[];
  metrics: Readonly<Record<string, number>>;
  /** The invalidation counter of a committed `dependency_changed` refusal: its own event, not a request member. */
  invalidated: Readonly<Record<string, number>>;
}>;

const SAFE_TOKEN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/u;
const TRACE_PARENT = /^[0-9a-f]{32}$/u;

const traceId = (request: Request, requestId: string): string => {
  const parent = request.headers.get('traceparent')?.split('-')[1];
  return parent !== undefined && TRACE_PARENT.test(parent) ? parent : requestId;
};

const correlationId = (request: Request, requestId: string): string => {
  const supplied = request.headers.get('x-correlation-id');
  return supplied !== null && SAFE_TOKEN.test(supplied) ? supplied : requestId;
};

/** 429, 503 and 504 carry Retry-After; 500 and 502 are never retryable (the S11 rule). */
const retryable = (status: number): boolean =>
  status === 429 || status === 503 || status === 504;

const steps = (
  entered: readonly string[],
  committed: boolean,
): readonly string[] => {
  const reached = new Set<CmsCompositionTraceStage | string>([
    'validation',
    ...entered,
  ]);
  if (committed) reached.add('audit_outbox');
  return CMS_COMPOSITION_TRACE_STAGES.filter(({ stage }) =>
    reached.has(stage),
  ).map(({ step }) => step);
};

export const observeRequest = (
  request: Request,
  requestId: string,
  operationId: string,
  status: number,
): CompositionObservation => {
  const facts = factsOf(request);
  const code = facts.refusal?.code;
  return {
    correlationId: correlationId(request, requestId),
    traceId: traceId(request, requestId),
    actingContextClass: facts.actingContext ?? 'none',
    ...(code === undefined || status < 400 ? {} : { errorCode: code }),
    retryable: retryable(status),
    ...(status >= 502 && status <= 504
      ? { dependency: 'cms_composition' }
      : {}),
    // A write is the command that reserved an idempotency key; answered below 400 it committed audit and outbox.
    traceSteps: steps(
      facts.stages,
      status < 400 && facts.stages.includes('idempotency'),
    ),
    metrics: compositionMetrics(operationId, status, facts),
    invalidated: invalidationMetrics(operationId, facts),
  };
};

/** The shape every Slice 12 route telemetry event shares. */
export type CompositionTelemetryEvent = Readonly<{
  requestId: string;
  status: number;
  outcome: 'success' | 'rejected' | 'failure';
  actorClass?: 'human';
  durationMs: number;
  observation?: CompositionObservation;
}>;

/**
 * The one structured log line of a request: the members every Slice 12 request event always carried plus the
 * observation. Empty counter maps are omitted so a read logs no `metrics` member.
 */
export const compositionRequestLog = (
  event: CompositionTelemetryEvent,
  names: Readonly<{ eventName: string; operation: string }>,
): LogEventDetails => {
  const observation = event.observation;
  return {
    eventName: names.eventName,
    operation: names.operation,
    requestId: event.requestId,
    outcome: event.outcome,
    durationMs: event.durationMs,
    attributes: {
      actor_class: event.actorClass ?? 'human',
      status: event.status,
      runbook: 'cms-composition',
    },
    ...(observation === undefined
      ? {}
      : {
          correlationId: observation.correlationId,
          traceId: observation.traceId,
          actingContextClass: observation.actingContextClass,
          retryable: observation.retryable,
          traceSteps: [...observation.traceSteps],
          ...(observation.errorCode === undefined
            ? {}
            : { errorCode: observation.errorCode }),
          ...(observation.dependency === undefined
            ? {}
            : { dependency: observation.dependency }),
          ...(Object.keys(observation.metrics).length === 0
            ? {}
            : { metrics: { ...observation.metrics } }),
        }),
  };
};

/**
 * The separate event of a committed review invalidation (`cms_governed_review_invalidated_total`), or null when
 * the request invalidated nothing.
 */
export const compositionInvalidationLog = (
  event: CompositionTelemetryEvent,
  names: Readonly<{ eventName: string; operation: string }>,
): LogEventDetails | null => {
  const observation = event.observation;
  const invalidated = observation?.invalidated ?? {};
  if (observation === undefined || Object.keys(invalidated).length === 0)
    return null;
  return {
    eventName: `${names.eventName}.invalidated`,
    operation: names.operation,
    requestId: event.requestId,
    correlationId: observation.correlationId,
    traceId: observation.traceId,
    outcome: event.outcome,
    durationMs: event.durationMs,
    metrics: { ...invalidated },
  };
};
