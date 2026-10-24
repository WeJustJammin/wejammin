import { CONTENT_SCHEMA_REGISTRY_ALERT_THRESHOLDS } from './content-schema-registry-alert-thresholds';

/**
 * BE03c Observability (Slice 12) alert numbers. The outbox age and the blocked
 * activation window are the Slice 09 numbers (BE03a states the same two minutes
 * and fifteen minutes), read from that policy so the two cannot drift; the DLQ
 * depth and the stale legal-field count alert above zero. DEC-220: a failed
 * locale observability read alerts for its own firing (count strictly above
 * zero); the policy is stateless, so no window or history is kept.
 */
export const CMS_COMPOSITION_ALERT_THRESHOLDS = Object.freeze({
  dlqDepth: 0,
  outboxAgeMs: CONTENT_SCHEMA_REGISTRY_ALERT_THRESHOLDS.outboxAgeMs,
  activationBlockedMs:
    CONTENT_SCHEMA_REGISTRY_ALERT_THRESHOLDS.activationBlockedMs,
  staleLocaleLegalFieldCount: 0,
  localeObservabilityFailedReads: 0,
} as const);
