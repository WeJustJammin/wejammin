import { metricKey } from '../content-schema-registry/route-metric-key';
import type { CmsEditorialError } from './types';

/**
 * Closed metric labels of the Slice 11 operations (BE03b "Observability",
 * `docs/runbooks/platform/cms-publication.md`). Every label value comes from a
 * closed vocabulary; none is an identifier, hash, reason text or person.
 */

export type WorkflowLabels = Readonly<{
  riskClass?: 'ordinary' | 'protected';
  decision?: 'approve' | 'reject';
  assignmentAction?: 'create' | 'revoke';
}>;

/** One preflight category result as telemetry sees it (no reason, no count). */
export type WorkflowPreflightFact = Readonly<{
  category: string;
  outcome: string;
}>;

/** The registry phase each preflight-bearing operation evaluates. */
const PREFLIGHT_PHASE: Readonly<Record<string, string>> = {
  'CMS-03B-05': 'submit',
  'CMS-03B-07': 'schedule',
  'CMS-03B-09': 'publish',
  'CMS-03B-15': 'workflow_read',
};

const UNKNOWN = 'unknown';

const reasonOf = (error: CmsEditorialError | undefined): string | undefined => {
  const reason = error?.details?.reasonCode;
  return typeof reason === 'string' ? reason : undefined;
};

const refusedPreflight = (
  error: CmsEditorialError | undefined,
): readonly WorkflowPreflightFact[] => {
  const entries = error?.details?.preflight;
  return Array.isArray(entries)
    ? entries.map((entry: { category: string; outcome: string }) => ({
        category: entry.category,
        outcome: entry.outcome,
      }))
    : [];
};

export type WorkflowMetricInput = Readonly<{
  operationId: string;
  outcome: string;
  labels: WorkflowLabels | undefined;
  error: CmsEditorialError | undefined;
  preflight: readonly WorkflowPreflightFact[] | undefined;
}>;

/** The operation-specific counters; the common request counters live elsewhere. */
export const workflowMetrics = (
  input: WorkflowMetricInput,
): Record<string, number> => {
  const { operationId, outcome, labels, error } = input;
  const metrics: Record<string, number> = {};
  if (operationId === 'CMS-03B-05')
    metrics[
      metricKey('cms_review_submitted_total', {
        outcome,
        risk_class: labels?.riskClass ?? UNKNOWN,
      })
    ] = 1;
  if (operationId === 'CMS-03B-06') {
    metrics[
      metricKey('cms_review_decision_total', {
        decision: labels?.decision ?? UNKNOWN,
        outcome,
      })
    ] = 1;
    // A decision refused as dependency_changed commits the invalidation.
    if (reasonOf(error) === 'dependency_changed')
      metrics[
        metricKey('cms_review_invalidated_total', {
          reason: 'dependency_changed',
        })
      ] = 1;
  }
  if (operationId === 'CMS-03B-18')
    metrics[
      metricKey('cms_review_assignment_total', {
        action: labels?.assignmentAction ?? UNKNOWN,
        outcome,
      })
    ] = 1;
  const reason = reasonOf(error);
  if (reason === 'separation_of_duties')
    metrics[
      metricKey('cms_separation_of_duties_refusal_total', {
        operation: operationId,
      })
    ] = 1;
  if (reason === 'publication_conflict')
    metrics.cms_publication_lineage_conflict_total = 1;
  const phase = PREFLIGHT_PHASE[operationId];
  if (phase !== undefined)
    for (const result of [
      ...refusedPreflight(error),
      ...(input.preflight ?? []),
    ])
      metrics[
        metricKey('cms_preflight_result_total', {
          category: result.category,
          outcome: result.outcome,
          phase,
        })
      ] = 1;
  return metrics;
};
