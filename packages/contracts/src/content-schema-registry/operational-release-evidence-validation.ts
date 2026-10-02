import type { z } from 'zod';

import type { OperationalReleaseEvidenceShape } from './operational-release-evidence.ts';
import {
  CONTENT_SCHEMA_REGISTRY_ALERT_CONDITIONS,
  CONTENT_SCHEMA_REGISTRY_HOSTED_ROLES,
  CONTENT_SCHEMA_REGISTRY_HOSTED_SCENARIOS,
  CONTENT_SCHEMA_REGISTRY_MANUAL_A11Y_CHECKS,
  CONTENT_SCHEMA_REGISTRY_SLO_THRESHOLDS,
} from './operational-release-evidence-common.ts';

const addIssue = (
  context: z.RefinementCtx,
  path: readonly (string | number)[],
  message: string,
): void => context.addIssue({ code: 'custom', message, path: [...path] });

const hasExactMembers = (
  actual: readonly string[],
  expected: readonly string[],
): boolean => {
  const actualMembers = [...new Set(actual)].sort().join('\u0000');
  const expectedMembers = [...expected].sort().join('\u0000');
  return actual.length === expected.length && actualMembers === expectedMembers;
};

const validateChecklist = (
  context: z.RefinementCtx,
  actual: readonly string[],
  expected: readonly string[],
  path: readonly (string | number)[],
  message: string,
): void => {
  if (!hasExactMembers(actual, expected)) addIssue(context, path, message);
};

const validateArtifactIdentity = (
  evidence: OperationalReleaseEvidenceShape,
  context: z.RefinementCtx,
): void => {
  const expectedRevision = evidence.artifact.sourceRevision;
  const revisions = [
    evidence.alerting.sourceRevision,
    evidence.slo.sourceRevision,
    evidence.hostedE2e.sourceRevision,
    evidence.accessibility.sourceRevision,
  ];
  if (revisions.some((revision) => revision !== expectedRevision))
    addIssue(
      context,
      ['artifact', 'sourceRevision'],
      'Every release evidence record must match the artifact SHA',
    );
  if (
    evidence.hostedE2e.migrationVersion !== evidence.artifact.migrationVersion
  )
    addIssue(
      context,
      ['hostedE2e', 'migrationVersion'],
      'Hosted E2E evidence must match the artifact migration version',
    );
};

const validateAlerting = (
  evidence: OperationalReleaseEvidenceShape,
  context: z.RefinementCtx,
): void => {
  validateChecklist(
    context,
    evidence.alerting.configuredConditions,
    CONTENT_SCHEMA_REGISTRY_ALERT_CONDITIONS,
    ['alerting', 'configuredConditions'],
    'All locked alert conditions must be configured exactly once',
  );
  if (evidence.alerting.deploymentId !== evidence.slo.deploymentId)
    addIssue(
      context,
      ['slo', 'deploymentId'],
      'Production alert and SLO evidence must target the same deployment',
    );
  if (
    Date.parse(evidence.alerting.deliveryReceipt.deliveredAt) <=
    Date.parse(evidence.alerting.capturedAt)
  )
    addIssue(
      context,
      ['alerting', 'deliveryReceipt', 'deliveredAt'],
      'Alert delivery must follow the captured production configuration',
    );
};

const validateSlo = (
  evidence: OperationalReleaseEvidenceShape,
  context: z.RefinementCtx,
): void => {
  const thresholds = CONTENT_SCHEMA_REGISTRY_SLO_THRESHOLDS;
  const metrics = [
    [
      'commandP95Ms',
      thresholds.commandP95Ms,
      'Command p95 must remain below 1200 ms',
    ],
    [
      'protectedRpcP95Ms',
      thresholds.protectedRpcP95Ms,
      'Protected RPC p95 must remain below 300 ms',
    ],
    [
      'acceptanceP99Ms',
      thresholds.acceptanceP99Ms,
      'Acceptance p99 must remain below 1000 ms',
    ],
    [
      'queueFirstAttemptP95Ms',
      thresholds.queueFirstAttemptP95Ms,
      'Queue first-attempt p95 must remain below 60000 ms',
    ],
    [
      'dailyDlqRate',
      thresholds.dailyDlqRate,
      'Daily DLQ rate must remain below 0.1%',
    ],
  ] as const;
  for (const [metric, threshold, message] of metrics)
    if (evidence.slo.observed[metric] >= threshold)
      addIssue(context, ['slo', 'observed', metric], message);
  const derivedDlqRate =
    evidence.slo.samples.dlqMessages / evidence.slo.samples.queueAttempts;
  if (Math.abs(derivedDlqRate - evidence.slo.observed.dailyDlqRate) > 1e-12)
    addIssue(
      context,
      ['slo', 'observed', 'dailyDlqRate'],
      'Daily DLQ rate must be derived from the retained production counts',
    );
  const windowStart = new Date(evidence.slo.window.startedAt);
  const windowEnd = new Date(evidence.slo.window.endedAt);
  if (windowEnd.getTime() <= windowStart.getTime())
    addIssue(
      context,
      ['slo', 'window', 'endedAt'],
      'SLO window must end after it starts',
    );
  const canonicalUtcStart = Date.UTC(
    windowStart.getUTCFullYear(),
    windowStart.getUTCMonth(),
    windowStart.getUTCDate(),
  );
  const isCompleteUtcDay =
    windowStart.getTime() === canonicalUtcStart &&
    windowEnd.getTime() - windowStart.getTime() === 86_400_000;
  if (!isCompleteUtcDay)
    addIssue(
      context,
      ['slo', 'window'],
      'SLO evidence must cover one complete UTC day',
    );
};

export const validateHostedAndAccessibility = (
  evidence: Pick<
    OperationalReleaseEvidenceShape,
    'hostedE2e' | 'accessibility'
  >,
  context: z.RefinementCtx,
): void => {
  validateChecklist(
    context,
    evidence.hostedE2e.roles,
    CONTENT_SCHEMA_REGISTRY_HOSTED_ROLES,
    ['hostedE2e', 'roles'],
    'All locked hosted role variants must pass exactly once',
  );
  validateChecklist(
    context,
    evidence.hostedE2e.scenarios,
    CONTENT_SCHEMA_REGISTRY_HOSTED_SCENARIOS,
    ['hostedE2e', 'scenarios'],
    'All locked hosted E2E scenarios must pass exactly once',
  );
  for (const [index, run] of evidence.accessibility.manualRuns.entries())
    validateChecklist(
      context,
      run.checks,
      CONTENT_SCHEMA_REGISTRY_MANUAL_A11Y_CHECKS,
      ['accessibility', 'manualRuns', index, 'checks'],
      'Every locked manual accessibility check must pass exactly once',
    );
  if (evidence.accessibility.environment !== evidence.hostedE2e.environment)
    addIssue(
      context,
      ['accessibility', 'environment'],
      'Accessibility and hosted E2E evidence must target the same environment',
    );
  if (evidence.accessibility.deploymentId !== evidence.hostedE2e.deploymentId)
    addIssue(
      context,
      ['accessibility', 'deploymentId'],
      'Accessibility and hosted E2E evidence must target the same deployment',
    );
  if (evidence.accessibility.webOrigin !== evidence.hostedE2e.webOrigin)
    addIssue(
      context,
      ['accessibility', 'webOrigin'],
      'Accessibility and hosted E2E evidence must target the same web origin',
    );
};

const validateVerificationTime = (
  evidence: OperationalReleaseEvidenceShape,
  context: z.RefinementCtx,
): void => {
  const verifiedAt = Date.parse(evidence.verifiedAt);
  const retainedTimestamps = [
    evidence.alerting.capturedAt,
    evidence.alerting.deliveryReceipt.deliveredAt,
    evidence.slo.window.endedAt,
    evidence.hostedE2e.completedAt,
    ...evidence.accessibility.manualRuns.map((run) => run.completedAt),
  ];
  if (
    retainedTimestamps.some((timestamp) => Date.parse(timestamp) >= verifiedAt)
  )
    addIssue(
      context,
      ['verifiedAt'],
      'Verification must occur after every retained evidence record',
    );
};

export const validateOperationalReleaseEvidence = (
  evidence: OperationalReleaseEvidenceShape,
  context: z.RefinementCtx,
): void => {
  validateArtifactIdentity(evidence, context);
  validateAlerting(evidence, context);
  validateSlo(evidence, context);
  validateHostedAndAccessibility(evidence, context);
  validateVerificationTime(evidence, context);
};
