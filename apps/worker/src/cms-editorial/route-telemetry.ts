import type { CmsEditorialRoutePolicy } from '@wejammin/contracts';

import { metricKey } from '../content-schema-registry/route-metric-key';
import { emitTelemetry } from './route-execution';
import { actingContextOf, stagesEntered } from './route-stages';
import {
  workflowMetrics,
  type WorkflowLabels,
  type WorkflowPreflightFact,
} from './workflow-telemetry';
import {
  CMS_EDITORIAL_RUNBOOK,
  type CmsEditorialDependencies,
  type CmsEditorialError,
  type CmsEditorialTelemetryEvent,
} from './types';

/**
 * BE03b "Observability" for the Slice 10 operations. One event per request,
 * built from facts the route already holds: the status, the PUBLISHED error
 * (so an event never carries a code the client did not see), safe counts, and
 * the stages the request really entered. It carries no request body, field
 * value, token, email, party name or capability graph, only closed labels, the
 * operation id, safe counts and a hash of the entry id.
 */

export type EntryFacts = Readonly<{ idHash: string; version?: string }>;

export type RouteFacts = Readonly<{
  /** The error exactly as published to the client. */
  error?: CmsEditorialError;
  /** Safe aggregate counts (never values), e.g. `items_returned`. */
  counts?: Readonly<Record<string, number>>;
  /** The entry the response is about; only its hash and version are logged. */
  entry?: EntryFacts;
  /** An exact-key replay of an earlier committed command. */
  replayed?: boolean;
  /** Slice 11 closed labels (risk class, decision, assignment action). */
  labels?: WorkflowLabels;
  /** Slice 11 preflight categories a successful workflow read served. */
  preflight?: readonly WorkflowPreflightFact[];
}>;

const REVISION_WRITES: ReadonlySet<string> = new Set([
  'CMS-03B-01',
  'CMS-03B-02',
  'CMS-03B-10',
]);

/** The operations whose success creates a revision (the review family does not). */
const REVISION_CREATING: ReadonlySet<string> = new Set([
  'CMS-03B-01',
  'CMS-03B-02',
  'CMS-03B-04',
  'CMS-03B-10',
]);

const ERROR_CODE = /^[A-Z][A-Z_]{2,39}$/u;
const SAFE_TOKEN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/u;
const SAFE_COUNT = /^[a-z][a-z0-9_]{0,47}$/u;

/** Closed outcome vocabulary shared by every `outcome` metric label. */
export const metricOutcome = (status: number): string => {
  if (status < 400) return 'success';
  if (status === 429) return 'rate_limited';
  if (status === 401 || status === 403 || status === 404) return 'denied';
  if (status === 409) return 'conflict';
  if (status === 400 || status === 415 || status === 422) return 'invalid';
  return 'failed';
};

/** 429, 503 and 504 carry Retry-After; 500 and 502 are never retryable. */
const retryableStatus = (status: number): boolean =>
  status === 429 || status === 503 || status === 504;

/**
 * A committed same-field conflict is the only CMS-03B-01 409 that names both
 * entry versions: the adapter converts the SQL `kind: conflict` disposition to
 * this envelope after the private conflict record committed.
 */
const conflictRecorded = (
  operationId: string,
  error: CmsEditorialError | undefined,
): boolean =>
  operationId === 'CMS-03B-01' &&
  error?.status === 409 &&
  error.details?.conflict === 'VERSION_MISMATCH' &&
  typeof error.details.expectedVersion === 'string' &&
  typeof error.details.currentVersion === 'string';

const sha256Hex = async (value: string): Promise<string> =>
  [
    ...new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
    ),
  ]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

/**
 * The log form of an entry: `sha256:<hex>` of its id plus the committed entry
 * version. Hashed before the response is built so the event itself is emitted
 * synchronously with the response, never after it.
 */
export const entryFacts = async (
  id: string,
  version?: string,
): Promise<EntryFacts> => ({
  idHash: `sha256:${await sha256Hex(id)}`,
  ...(version === undefined ? {} : { version }),
});

const outcomeLabels = (
  operationId: string,
  status: number,
  facts: RouteFacts,
  durationMs: number,
  policy: CmsEditorialRoutePolicy,
): Record<string, number> => {
  const outcome = metricOutcome(status);
  const metrics: Record<string, number> = {
    [metricKey('cms_editorial_request_total', {
      operation: operationId,
      outcome,
    })]: 1,
    cms_editorial_latency_ms: durationMs,
    request_status: status,
    slo_command_p95_ms: policy.slo.commandP95Ms,
    slo_protected_rpc_p95_ms: policy.slo.protectedRpcP95Ms,
    slo_acceptance_p99_ms: policy.slo.acceptanceP99Ms,
  };
  for (const [name, value] of Object.entries(facts.counts ?? {}))
    if (SAFE_COUNT.test(name) && Number.isFinite(value) && value >= 0)
      metrics[name] = value;
  if (status < 400) {
    if (REVISION_CREATING.has(operationId))
      metrics.cms_revision_created_total = 1;
    if (operationId === 'CMS-03B-02') metrics.cms_conflict_closed_total = 1;
    if (operationId === 'CMS-03B-10' && facts.replayed === true)
      metrics.cms_entry_create_replayed_total = 1;
    // A replay returns the first revision: it is not a second creation.
    if (facts.replayed === true) delete metrics.cms_revision_created_total;
  } else {
    const code = facts.error?.code ?? 'INTERNAL_ERROR';
    metrics[
      metricKey('cms_editorial_error_total', {
        code: ERROR_CODE.test(code) ? code : 'UNREGISTERED',
        operation: operationId,
      })
    ] = 1;
    if (status === 429) metrics.cms_editorial_rate_limited_total = 1;
    if (status === 409) {
      const conflict = facts.error?.details?.conflict;
      metrics[
        metricKey('cms_editorial_conflict_total', {
          operation: operationId,
          reason:
            conflict === 'VERSION_MISMATCH' ||
            conflict === 'IDEMPOTENCY_MISMATCH' ||
            conflict === 'INVALID_TRANSITION'
              ? conflict
              : 'INVALID_TRANSITION',
        })
      ] = 1;
    }
    if (REVISION_WRITES.has(operationId) && status === 422)
      metrics.cms_revision_validation_failed_total = 1;
    if (conflictRecorded(operationId, facts.error)) {
      metrics.cms_conflict_open_total = 1;
      metrics.cms_conflict_records_created_total = 1;
    }
  }
  Object.assign(
    metrics,
    workflowMetrics({
      operationId,
      outcome,
      labels: facts.labels,
      error: facts.error,
      preflight: facts.preflight,
    }),
  );
  if (operationId === 'CMS-03B-10') {
    metrics[metricKey('cms_entry_create_total', { outcome })] = 1;
    if (status === 409) metrics.cms_entry_create_conflict_total = 1;
  }
  if (operationId === 'CMS-03B-11') {
    metrics[metricKey('cms_entry_draft_detail_total', { outcome })] = 1;
    if (outcome === 'denied') metrics.cms_entry_draft_detail_denied_total = 1;
  }
  return metrics;
};

const traceId = (request: Request, requestId: string): string => {
  const parent = request.headers.get('traceparent')?.split('-')[1];
  return parent !== undefined && /^[0-9a-f]{32}$/u.test(parent)
    ? parent
    : requestId;
};

const correlationId = (request: Request, requestId: string): string => {
  const supplied = request.headers.get('x-correlation-id');
  return supplied !== null && SAFE_TOKEN.test(supplied) ? supplied : requestId;
};

export const buildRouteEvent = (
  context: Readonly<{
    request: Request;
    requestId: string;
    policy: CmsEditorialRoutePolicy;
    startedAt: number;
    now: number;
  }>,
  response: Response,
  facts: RouteFacts,
): CmsEditorialTelemetryEvent => {
  const { request, requestId, policy } = context;
  const status = response.status;
  const operationId = policy.operationId;
  const entered = stagesEntered(request);
  const durationMs = Math.max(0, context.now - context.startedAt);
  const error = facts.error;
  const dependencyClass = error?.details?.dependencyClass;
  return {
    operationId,
    requestId,
    correlationId: correlationId(request, requestId),
    traceId: traceId(request, requestId),
    outcome: status < 400 ? 'success' : status < 500 ? 'rejected' : 'failure',
    status,
    ...(error === undefined ? {} : { errorCode: error.code }),
    durationMs,
    actorClass: 'human',
    actingContextClass: actingContextOf(request),
    rateClass: policy.rateClass,
    rateLimit: policy.rateLimit,
    rateWindowSeconds: policy.rateWindowSeconds,
    deadlineMs: policy.timeoutMs,
    eventType: policy.eventType,
    slo: policy.slo,
    runbook: CMS_EDITORIAL_RUNBOOK,
    retryable: retryableStatus(status),
    ...(status >= 502 &&
    status <= 504 &&
    typeof dependencyClass === 'string' &&
    SAFE_TOKEN.test(dependencyClass)
      ? { dependency: dependencyClass }
      : {}),
    ...(facts.entry === undefined
      ? {}
      : {
          entityIdHash: facts.entry.idHash,
          ...(facts.entry.version === undefined
            ? {}
            : { entityVersion: facts.entry.version }),
        }),
    traceSteps: [
      'cms.admission',
      ...(entered.has('authority') ? ['cms.authority'] : []),
      ...(entered.has('rate_limit') ? ['cms.rate_limit'] : []),
      ...(entered.has('rpc') ? ['cms.rpc'] : []),
      'cms.response',
    ],
    metrics: outcomeLabels(operationId, status, facts, durationMs, policy),
  };
};

/**
 * One request, one event: builds the redacted event from the finished response
 * and hands it to the injected sink without ever delaying or altering the
 * response (telemetry is non-authoritative).
 */
export const createRouteFinish = (
  dependencies: CmsEditorialDependencies,
  request: Request,
  requestId: string,
  policy: CmsEditorialRoutePolicy,
  startedAt: number,
): ((response: Response, facts?: RouteFacts) => Response) => {
  return (response, facts = {}) => {
    void emitTelemetry(
      dependencies,
      buildRouteEvent(
        {
          request,
          requestId,
          policy,
          startedAt,
          now: dependencies.now?.() ?? Date.now(),
        },
        response,
        facts,
      ),
    );
    return response;
  };
};
