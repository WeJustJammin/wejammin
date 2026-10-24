import {
  evaluateCmsCompositionAlerts,
  type CmsCompositionAlert,
  type CmsCompositionOperationalSnapshot,
} from './cms-composition-alert-policy';

export type CmsCompositionAlertSink = (alert: CmsCompositionAlert) => void;

/**
 * Provider-free delivery seam for a scheduled/native observability query, the
 * Slice 12 twin of `evaluateAndEmitContentSchemaRegistryAlerts`. Callers pass
 * only the redacted aggregate snapshot and own the final sink; a missing
 * measurement stays non-alerting according to the policy module.
 */
export const evaluateAndEmitCmsCompositionAlerts = (
  snapshot: CmsCompositionOperationalSnapshot,
  sink: CmsCompositionAlertSink,
): readonly CmsCompositionAlert[] => {
  const alerts = evaluateCmsCompositionAlerts(snapshot);
  for (const alert of alerts) sink(alert);
  return alerts;
};
