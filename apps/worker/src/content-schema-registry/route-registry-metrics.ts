import { registeredConflict, conflictForCode } from './error-detail-values';
import { metricKey } from './route-metric-key';
import type {
  ContentSchemaRegistryOperationId,
  ContentSchemaRegistryResult,
} from './types';

/**
 * BE03a "Observability": the per-operation counters of the original A01-A08
 * operations. Each metric is one entry of the telemetry `metrics` map. Label
 * values come only from closed sets (operation id, outcome, a registered error
 * code, a registered conflict kind), never from request text or an identifier.
 * The migration, activation-age, outbox and queue gauges are produced where
 * that data lives (database and consumers), not at the request boundary.
 */
export const REGISTRY_OPERATIONS: ReadonlySet<string> = new Set([
  'CMS-03A-01',
  'CMS-03A-02',
  'CMS-03A-03',
  'CMS-03A-04',
  'CMS-03A-05',
  'CMS-03A-06',
  'CMS-03A-07',
  'CMS-03A-08',
]);

const ERROR_CODE = /^[A-Z][A-Z_]{2,39}$/u;

const outcomeFor = (result: ContentSchemaRegistryResult<unknown>): string => {
  if (result.ok) return 'success';
  if (result.status === 429) return 'rate_limited';
  if (result.status === 401 || result.status === 403 || result.status === 404)
    return 'denied';
  return result.status === 409 ? 'conflict' : 'failed';
};

const errorLabel = (code: string): string =>
  ERROR_CODE.test(code) ? code : 'UNREGISTERED';

export const registryMetrics = (
  operationId: ContentSchemaRegistryOperationId,
  result: ContentSchemaRegistryResult<unknown>,
  durationMs: number,
): Readonly<Record<string, number>> => {
  if (!REGISTRY_OPERATIONS.has(operationId)) return {};
  const metrics: Record<string, number> = {
    [metricKey('cms_definition_request_total', {
      operation: operationId,
      outcome: outcomeFor(result),
    })]: 1,
    cms_definition_latency_ms: durationMs,
  };
  const releaseWorker =
    operationId === 'CMS-03A-05' || operationId === 'CMS-03A-08';
  if (result.ok) {
    if (operationId === 'CMS-03A-05') metrics.cms_block_registration_total = 1;
    if (operationId === 'CMS-03A-08')
      metrics.cms_block_lifecycle_advance_total = 1;
    if (releaseWorker)
      metrics[
        metricKey('cms_release_nonce_claim_total', { outcome: 'claimed' })
      ] = 1;
    return metrics;
  }
  metrics[
    metricKey('cms_definition_error_total', {
      code: errorLabel(result.code),
      operation: operationId,
    })
  ] = 1;
  if (result.status === 429) metrics.cms_definition_rate_limited_total = 1;
  if (result.status === 409)
    metrics[
      metricKey('cms_definition_conflict_total', {
        operation: operationId,
        reason:
          registeredConflict(result.details?.conflict) ??
          conflictForCode(result.code),
      })
    ] = 1;
  if (releaseWorker && result.status === 401)
    metrics[
      metricKey('cms_release_nonce_claim_total', { outcome: 'rejected' })
    ] = 1;
  return metrics;
};
