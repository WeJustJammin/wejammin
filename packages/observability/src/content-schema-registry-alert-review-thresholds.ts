/**
 * Review-lifecycle alert thresholds (P2-S09-AC-693).
 *
 * Kept apart from CONTENT_SCHEMA_REGISTRY_ALERT_THRESHOLDS on purpose: that
 * object is mirrored key-for-key by the AC209 production alert-configuration
 * report, whose locked schema is a separate release-evidence contract.
 *
 * BE03a Observability names "a review open past its expected window" but does
 * not state a number. The window is derived from the seven-day maximum span of
 * a review assignment (CMS-03A-14): once longer than any assignment can live,
 * no reviewer can still be able to decide the review.
 */
export const CONTENT_SCHEMA_REGISTRY_REVIEW_ALERT_THRESHOLDS = Object.freeze({
  reviewOpenWindowMs: 7 * 24 * 60 * 60 * 1000,
} as const);
