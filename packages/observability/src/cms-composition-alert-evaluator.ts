import { CMS_COMPOSITION_ALERT_THRESHOLDS } from './cms-composition-alert-thresholds';
import type {
  CmsCompositionAlert,
  CmsCompositionAlertCode,
  CmsCompositionOperationalSnapshot,
} from './cms-composition-alert-types';

const isFiniteNumber = (value: number | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const alert = (
  code: CmsCompositionAlertCode,
  observed: number,
  threshold: number,
): CmsCompositionAlert =>
  Object.freeze({
    code,
    observed,
    threshold,
    route: 'platform.on_call' as const,
    runbook: 'cms-composition' as const,
  });

/**
 * One rule per BE03c Observability condition, evaluated in the order of
 * `CMS_COMPOSITION_ALERT_CODES`. Every rule is strictly "above": a measurement
 * equal to its threshold is healthy. The target-filter anomaly follows the
 * Slice 09 spike convention (the current five-minute count above the preceding
 * five-minute baseline) because the spec names the anomaly without a number.
 */
export const evaluateCmsCompositionAlerts = (
  snapshot: CmsCompositionOperationalSnapshot,
): readonly CmsCompositionAlert[] => {
  const limits = CMS_COMPOSITION_ALERT_THRESHOLDS;
  const alerts: CmsCompositionAlert[] = [];
  const { dlqDepth, outboxAgeMs, activationBlockedMs } = snapshot;
  const stale = snapshot.staleLocaleLegalFieldCount;
  const failedReads = snapshot.localeObservabilityFailedReads;
  const filtered = snapshot.targetFilterCount;
  const baseline = snapshot.targetFilterBaseline;
  if (isFiniteNumber(dlqDepth) && dlqDepth > limits.dlqDepth)
    alerts.push(alert('dlq_nonempty', dlqDepth, limits.dlqDepth));
  if (isFiniteNumber(outboxAgeMs) && outboxAgeMs > limits.outboxAgeMs)
    alerts.push(alert('outbox_age_exceeded', outboxAgeMs, limits.outboxAgeMs));
  if (
    isFiniteNumber(activationBlockedMs) &&
    activationBlockedMs > limits.activationBlockedMs
  )
    alerts.push(
      alert(
        'activation_blocked',
        activationBlockedMs,
        limits.activationBlockedMs,
      ),
    );
  if (isFiniteNumber(stale) && stale > limits.staleLocaleLegalFieldCount)
    alerts.push(
      alert(
        'stale_locale_legal_fields',
        stale,
        limits.staleLocaleLegalFieldCount,
      ),
    );
  if (
    isFiniteNumber(failedReads) &&
    failedReads > limits.localeObservabilityFailedReads
  )
    alerts.push(
      alert(
        'locale_observability_unavailable',
        failedReads,
        limits.localeObservabilityFailedReads,
      ),
    );
  if (
    isFiniteNumber(filtered) &&
    isFiniteNumber(baseline) &&
    filtered > baseline
  )
    alerts.push(alert('target_filter_anomaly', filtered, baseline));
  return Object.freeze(alerts);
};
