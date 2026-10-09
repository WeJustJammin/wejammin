/*
 * BE03b Observability: the Slice 11 metrics and their label sets. A label never
 * carries an id, hash, reason text or person; the value sets are the closed
 * vocabularies of the contracts (risk class, decision, action, reason token,
 * preflight category/outcome/phase, schedule outcome, operation id).
 */
export const CMS_SLICE_11_METRICS = {
  cms_review_submitted_total: ['risk_class', 'outcome'],
  cms_review_decision_total: ['decision', 'outcome'],
  cms_review_assignment_total: ['action', 'outcome'],
  cms_review_invalidated_total: ['reason'],
  cms_preflight_result_total: ['category', 'outcome', 'phase'],
  cms_preflight_latency_ms: ['category'],
  cms_a11y_checker_duration_ms: [],
  cms_schedule_blocked_total: ['reason'],
  cms_schedule_attempt_total: ['outcome'],
  cms_schedule_claim_batch_size: [],
  cms_preview_verify_total: ['valid'],
  cms_publication_lineage_conflict_total: [],
  cms_settings_snapshot_ordinal: [],
  cms_separation_of_duties_refusal_total: ['operation'],
} as const satisfies Readonly<Record<string, readonly string[]>>;

export type CmsSlice11MetricName = keyof typeof CMS_SLICE_11_METRICS;
