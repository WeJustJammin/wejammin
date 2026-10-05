import { evaluateReviewAndDenialAlerts } from './content-schema-registry-alert-review-denials';
import { CONTENT_SCHEMA_REGISTRY_ALERT_THRESHOLDS } from './content-schema-registry-alert-thresholds';
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

export const evaluateContentSchemaRegistryAlerts = (
  snapshot: ContentSchemaRegistryOperationalSnapshot,
): readonly ContentSchemaRegistryAlert[] => {
  const thresholds = CONTENT_SCHEMA_REGISTRY_ALERT_THRESHOLDS;
  const alerts: ContentSchemaRegistryAlert[] = [];
  if (
    isFiniteNumber(snapshot.activationBlockedMs) &&
    snapshot.activationBlockedMs > thresholds.activationBlockedMs
  )
    alerts.push(
      alert(
        'activation_blocked',
        snapshot.activationBlockedMs,
        thresholds.activationBlockedMs,
      ),
    );
  if (
    isFiniteNumber(snapshot.migrationRetryCount) &&
    snapshot.migrationRetryCount > thresholds.migrationRetryCount
  )
    alerts.push(
      alert(
        'migration_retry_exceeded',
        snapshot.migrationRetryCount,
        thresholds.migrationRetryCount,
      ),
    );
  if (
    isFiniteNumber(snapshot.nonceRejectionRate) &&
    isFiniteNumber(snapshot.nonceRejectionBaseline) &&
    snapshot.nonceRejectionRate > snapshot.nonceRejectionBaseline
  )
    alerts.push(
      alert(
        'nonce_rejection_spike',
        snapshot.nonceRejectionRate,
        snapshot.nonceRejectionBaseline,
      ),
    );
  if (isFiniteNumber(snapshot.dlqDepth) && snapshot.dlqDepth > 0)
    alerts.push(alert('dlq_nonempty', snapshot.dlqDepth, 0));
  if (
    isFiniteNumber(snapshot.outboxAgeMs) &&
    snapshot.outboxAgeMs > thresholds.outboxAgeMs
  )
    alerts.push(
      alert(
        'outbox_age_exceeded',
        snapshot.outboxAgeMs,
        thresholds.outboxAgeMs,
      ),
    );
  if (
    isFiniteNumber(snapshot.conflictRate) &&
    isFiniteNumber(snapshot.conflictWindowMs) &&
    snapshot.conflictRate > thresholds.conflictRate &&
    snapshot.conflictWindowMs >= thresholds.conflictWindowMs
  )
    alerts.push(
      alert(
        'conflict_rate_exceeded',
        snapshot.conflictRate,
        thresholds.conflictRate,
      ),
    );
  if (
    isFiniteNumber(snapshot.unknownEventVersions) &&
    snapshot.unknownEventVersions > thresholds.unknownEventVersions
  )
    alerts.push(
      alert(
        'unknown_event_version',
        snapshot.unknownEventVersions,
        thresholds.unknownEventVersions,
      ),
    );
  if (
    isFiniteNumber(snapshot.commandP95Ms) &&
    snapshot.commandP95Ms >= thresholds.commandP95Ms
  )
    alerts.push(
      alert(
        'command_p95_exceeded',
        snapshot.commandP95Ms,
        thresholds.commandP95Ms,
      ),
    );
  if (
    isFiniteNumber(snapshot.protectedRpcP95Ms) &&
    snapshot.protectedRpcP95Ms >= thresholds.protectedRpcP95Ms
  )
    alerts.push(
      alert(
        'protected_rpc_p95_exceeded',
        snapshot.protectedRpcP95Ms,
        thresholds.protectedRpcP95Ms,
      ),
    );
  if (
    isFiniteNumber(snapshot.acceptanceP99Ms) &&
    snapshot.acceptanceP99Ms >= thresholds.acceptanceP99Ms
  )
    alerts.push(
      alert(
        'acceptance_p99_exceeded',
        snapshot.acceptanceP99Ms,
        thresholds.acceptanceP99Ms,
      ),
    );
  if (
    isFiniteNumber(snapshot.queueFirstAttemptP95Ms) &&
    snapshot.queueFirstAttemptP95Ms >= thresholds.queueFirstAttemptP95Ms
  )
    alerts.push(
      alert(
        'queue_first_attempt_p95_exceeded',
        snapshot.queueFirstAttemptP95Ms,
        thresholds.queueFirstAttemptP95Ms,
      ),
    );
  if (
    isFiniteNumber(snapshot.dailyDlqRate) &&
    snapshot.dailyDlqRate >= thresholds.dailyDlqRate
  )
    alerts.push(
      alert(
        'daily_dlq_rate_exceeded',
        snapshot.dailyDlqRate,
        thresholds.dailyDlqRate,
      ),
    );
  alerts.push(...evaluateReviewAndDenialAlerts(snapshot));
  return Object.freeze(alerts);
};
