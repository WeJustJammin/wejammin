import { registeredDependencyClass } from './error-detail-values';
import { lifecycleMetrics } from './route-lifecycle-metrics';
import { registryMetrics } from './route-registry-metrics';
import { errorResponse, policyFor, runTelemetry } from './route-response';
import type { FeatureContext } from './route-types';
import type {
  ContentSchemaRegistryDependencies,
  ContentSchemaRegistryError,
  ContentSchemaRegistryOperationId,
  ContentSchemaRegistryPortInput,
  TelemetryEvent,
} from './types';
import { CONTENT_SCHEMA_REGISTRY_RUNBOOK } from './types';

/**
 * Builds the response of one refusal. Every handler routes its early answers
 * through one of these, so a refusal is always reported before it is returned.
 */
export type Refuse = (error: ContentSchemaRegistryError) => Promise<Response>;

/**
 * BE03a Observability: each route emits one structured, scrubbed event per
 * request, a refusal included. A refusal that the Worker itself answers (origin,
 * body preflight, CSRF, session, path and body validation, capability, step-up,
 * idempotency headers, release signature) never reaches the executor, so without
 * this the decision, assignment, capability-grant and nonce-rejection alerts,
 * which count command events by status and error code, could not see it.
 *
 * The event names the operation, outcome, status, closed error code, actor class,
 * duration and the closed counters of `registryMetrics` and `lifecycleMetrics`;
 * it never carries an identifier, a header, a body or any request text. A 429
 * is reported by `reportRateRefusal` with the limiter counters and is not
 * repeated here.
 */
export const createRefuse = (
  dependencies: ContentSchemaRegistryDependencies,
  context: FeatureContext,
  operationId: ContentSchemaRegistryOperationId,
  startedAt: number,
  actorClass: () => TelemetryEvent['actorClass'],
): Refuse => {
  const requestId = context.get('requestId');
  return async (error) => {
    if (error.status !== 429) {
      const nowMs = dependencies.now?.() ?? Date.now();
      const durationMs = Math.max(0, nowMs - startedAt);
      const policy = policyFor(operationId);
      const partialInput = {
        operationId,
        requestId,
        request: context.req.raw,
      } as ContentSchemaRegistryPortInput;
      await runTelemetry(dependencies, {
        operationId,
        requestId,
        correlationId: context.req.header('x-correlation-id') ?? requestId,
        outcome: error.status >= 500 ? 'failure' : 'rejected',
        status: error.status,
        errorCode: error.code,
        durationMs,
        actorClass: actorClass(),
        actingContextClass: 'none',
        ...(error.status >= 502 && error.status <= 504
          ? {
              dependency:
                registeredDependencyClass(error.details?.dependencyClass) ??
                'cms_registry',
            }
          : {}),
        rateClass: policy.rateClass,
        rateLimit: policy.rateLimit,
        rateWindowSeconds: policy.rateWindowSeconds,
        deadlineMs: policy.timeoutMs,
        slo: policy.slo,
        alertClass: 'content_schema_registry_tier2',
        alertRoute: 'platform.on_call',
        runbook: CONTENT_SCHEMA_REGISTRY_RUNBOOK,
        traceSteps: ['cms.admission', 'cms.response'],
        metrics: {
          duration_ms: durationMs,
          request_status: error.status,
          slo_command_p95_ms: policy.slo.commandP95Ms,
          slo_protected_rpc_p95_ms: policy.slo.protectedRpcP95Ms,
          slo_acceptance_p99_ms: policy.slo.acceptanceP99Ms,
          ...registryMetrics(operationId, error, durationMs),
          ...lifecycleMetrics(operationId, partialInput, error, nowMs),
        },
      });
    }
    return errorResponse(context, error, requestId);
  };
};
