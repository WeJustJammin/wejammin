import type { CmsSlice12ReasonCode } from '@wejammin/contracts';

import { metricKey } from '../content-schema-registry/route-metric-key';
import { metricOutcome } from '../cms-editorial/route-telemetry';
import type { RequestFacts } from './observability-facts';

/**
 * BE03c Observability (Slice 12): the counters a request emits, derived from closed facts only
 * (`observability-facts`) and the response status. Each counter is emitted by the operation that owns its
 * event, and a registry test (`observability-metrics.test.ts`) proves every produced key is a registered
 * metric with closed label values. `cms_governed_activation_total` (route and sweep),
 * `cms_governed_schedule_blocked_total` (sweep) and the recheck invalidations are emitted where they already
 * were; they are deliberately not duplicated here.
 */

type Counters = Record<string, number>;

/** A refusal reason a given operation publishes, counted exactly once per refused request. */
const refused = (
  facts: RequestFacts,
  status: number,
  reason: CmsSlice12ReasonCode,
): boolean =>
  facts.refusal?.status === status && facts.refusal.reasonCode === reason;

const canonical = (facts: RequestFacts, counters: Counters): void => {
  const refusal = facts.refusal;
  if (refusal?.domain === undefined) return;
  if (refusal.reasonCode === 'canonical_overlap')
    counters[
      metricKey('cms_canonical_match_total', {
        domain: refusal.domain,
        outcome: 'match',
      })
    ] = 1;
  if (refusal.reasonCode === 'canonical_source_unavailable') {
    counters[
      metricKey('cms_canonical_match_total', {
        domain: refusal.domain,
        outcome: 'source_unavailable',
      })
    ] = 1;
    counters[
      metricKey('cms_canonical_source_unavailable_total', {
        domain: refusal.domain,
      })
    ] = 1;
  }
};

export const compositionMetrics = (
  operationId: string,
  status: number,
  facts: RequestFacts,
): Counters => {
  const counters: Counters = {};
  const outcome = metricOutcome(status);
  if (operationId === 'CMS-03C-06' && facts.subjectKind !== undefined)
    counters[
      metricKey('cms_governed_review_total', {
        outcome,
        subject_kind: facts.subjectKind,
      })
    ] = 1;
  if (operationId === 'CMS-03C-07' && facts.decision !== undefined)
    counters[
      metricKey('cms_governed_decision_total', {
        decision: facts.decision,
        outcome,
      })
    ] = 1;
  if (operationId === 'CMS-03C-15' && facts.updateAction !== undefined)
    counters[
      metricKey('cms_pattern_update_total', {
        action: facts.updateAction,
        outcome,
      })
    ] = 1;
  if (
    operationId === 'CMS-03C-03' ||
    operationId === 'CMS-03C-06' ||
    operationId === 'CMS-03C-09'
  )
    canonical(facts, counters);
  if (
    operationId === 'CMS-03C-05' &&
    refused(facts, 422, 'related_target_ineligible')
  )
    counters.cms_related_target_ineligible_total = 1;
  if (
    operationId === 'CMS-03C-04' &&
    refused(facts, 409, 'locale_limit_reached')
  )
    counters.cms_locale_limit_reached_total = 1;
  return counters;
};

/**
 * A decision or an activation refused as `dependency_changed` commits the invalidation of its review
 * (BE03c 1262): `cms_governed_review_invalidated_total{reason}`. It is its own event, never a member of the
 * request counters, so the request event of CMS-03C-09 keeps carrying `cms_governed_activation_total` alone.
 */
export const invalidationMetrics = (
  operationId: string,
  facts: RequestFacts,
): Counters =>
  (operationId === 'CMS-03C-07' || operationId === 'CMS-03C-09') &&
  refused(facts, 409, 'dependency_changed')
    ? {
        [metricKey('cms_governed_review_invalidated_total', {
          reason: 'dependency_changed',
        })]: 1,
      }
    : {};
