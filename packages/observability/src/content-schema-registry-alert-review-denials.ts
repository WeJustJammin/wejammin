import { CONTENT_SCHEMA_REGISTRY_REVIEW_ALERT_THRESHOLDS } from './content-schema-registry-alert-review-thresholds';
import type {
  ContentSchemaRegistryAlert,
  ContentSchemaRegistryAlertCode,
  ContentSchemaRegistryOperationalSnapshot,
} from './content-schema-registry-alert-types';

const isFiniteNumber = (value: number | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const alert = (
  code: ContentSchemaRegistryAlertCode,
  observed: number,
  threshold: number,
): ContentSchemaRegistryAlert =>
  Object.freeze({
    code,
    observed,
    threshold,
    route: 'platform.on_call' as const,
    runbook: 'content-schema-registry' as const,
  });

type DenialSpikeRule = Readonly<{
  code: ContentSchemaRegistryAlertCode;
  current: keyof ContentSchemaRegistryOperationalSnapshot;
  baseline: keyof ContentSchemaRegistryOperationalSnapshot;
}>;

// BE03a Observability: "a decision, assignment or capability-grant denial
// spike". Counts come from the denied outcome label of
// cms_schema_review_decision_total, cms_schema_review_assignment_total and
// cms_capability_grant_total. Same spike convention as nonce_rejection_spike:
// the current five-minute count must exceed the preceding five-minute baseline.
const DENIAL_SPIKE_RULES: readonly DenialSpikeRule[] = [
  {
    code: 'decision_denial_spike',
    current: 'decisionDenialRate',
    baseline: 'decisionDenialBaseline',
  },
  {
    code: 'assignment_denial_spike',
    current: 'assignmentDenialRate',
    baseline: 'assignmentDenialBaseline',
  },
  {
    code: 'capability_grant_denial_spike',
    current: 'capabilityGrantDenialRate',
    baseline: 'capabilityGrantDenialBaseline',
  },
];

export const evaluateReviewAndDenialAlerts = (
  snapshot: ContentSchemaRegistryOperationalSnapshot,
): readonly ContentSchemaRegistryAlert[] => {
  const alerts: ContentSchemaRegistryAlert[] = [];
  const window =
    CONTENT_SCHEMA_REGISTRY_REVIEW_ALERT_THRESHOLDS.reviewOpenWindowMs;
  if (
    isFiniteNumber(snapshot.reviewOpenAgeMs) &&
    snapshot.reviewOpenAgeMs > window
  )
    alerts.push(
      alert('review_open_past_window', snapshot.reviewOpenAgeMs, window),
    );
  for (const rule of DENIAL_SPIKE_RULES) {
    const current = snapshot[rule.current];
    const baseline = snapshot[rule.baseline];
    if (
      isFiniteNumber(current) &&
      isFiniteNumber(baseline) &&
      current > baseline
    )
      alerts.push(alert(rule.code, current, baseline));
  }
  return alerts;
};
