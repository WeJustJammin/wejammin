import { registryMetrics } from './route-registry-metrics';
import { rateLimitedError } from './route-rate-refusal';
import { policyFor, runTelemetry } from './route-response';
import type { FeatureContext } from './route-types';
import type {
  ContentSchemaRegistryDependencies,
  ContentSchemaRegistryOperationId,
  RateLimitDecision,
} from './types';

/**
 * A limiter refusal happens before the operation port and so never reaches the
 * executor's telemetry. For the original A01-A08 operations it is still one
 * request with a `rate_limited` outcome, so it is reported here with the same
 * counters (`registryMetrics` returns nothing for any other operation, and
 * then no event is emitted).
 */
export const reportRateRefusal = async (
  dependencies: ContentSchemaRegistryDependencies,
  context: FeatureContext,
  operationId: ContentSchemaRegistryOperationId,
  actorClass: 'human' | 'release-worker',
  decision: RateLimitDecision,
  startedAt: number,
): Promise<void> => {
  const nowMs = dependencies.now?.() ?? Date.now();
  const refusal = rateLimitedError(decision, nowMs);
  const durationMs = Math.max(0, nowMs - startedAt);
  const metrics = registryMetrics(operationId, refusal, durationMs);
  if (Object.keys(metrics).length === 0) return;
  const policy = policyFor(operationId);
  await runTelemetry(dependencies, {
    operationId,
    requestId: context.get('requestId'),
    outcome: 'rejected',
    status: 429,
    errorCode: refusal.code,
    durationMs,
    actorClass,
    rateClass: policy.rateClass,
    rateLimit: policy.rateLimit,
    rateWindowSeconds: policy.rateWindowSeconds,
    deadlineMs: policy.timeoutMs,
    slo: policy.slo,
    traceSteps: ['cms.admission', 'cms.authority', 'cms.rate_limit'],
    metrics,
  });
};
