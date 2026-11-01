/**
 * The closed alert codes of BE03c Observability (Slice 12): "Alert on DLQ >0, outbox age >2m,
 * activation blocked >15m, stale locale legal-field count >0, or target-filter anomaly."
 * The tuple order is the evaluation order.
 */
export const CMS_COMPOSITION_ALERT_CODES = [
  'dlq_nonempty',
  'outbox_age_exceeded',
  'activation_blocked',
  'stale_locale_legal_fields',
  'locale_observability_unavailable',
  'target_filter_anomaly',
] as const;

export type CmsCompositionAlertCode =
  (typeof CMS_COMPOSITION_ALERT_CODES)[number];

/**
 * Redacted aggregate measurements; every member is optional and a missing or
 * non-finite one never alerts. `targetFilterCount` and `targetFilterBaseline`
 * are the counts of public related-target filter outcomes
 * (`cms_related_target_filtered_total`) in the current and the preceding
 * five-minute window.
 */
export type CmsCompositionOperationalSnapshot = Readonly<{
  dlqDepth?: number;
  outboxAgeMs?: number;
  activationBlockedMs?: number;
  staleLocaleLegalFieldCount?: number;
  /** Failed locale observability reads of this firing (DEC-220): 1 for a failed, timed-out or malformed read. */
  localeObservabilityFailedReads?: number;
  targetFilterCount?: number;
  targetFilterBaseline?: number;
}>;

export type CmsCompositionAlert = Readonly<{
  code: CmsCompositionAlertCode;
  observed: number;
  threshold: number;
  route: 'platform.on_call';
  runbook: 'cms-composition';
}>;
