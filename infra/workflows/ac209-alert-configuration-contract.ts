import { z } from '../../packages/contracts/node_modules/zod/index.js';
import { CONTENT_SCHEMA_REGISTRY_ALERT_CONDITIONS } from '../../packages/contracts/src/content-schema-registry/operational-release-evidence-common.ts';
import {
  SafeReleaseIdSchema,
  SafeReleaseTimestampSchema,
} from '../../packages/contracts/src/release-recovery-common.ts';
import { CONTENT_SCHEMA_REGISTRY_REVIEW_ALERT_THRESHOLDS } from '../../packages/observability/src/content-schema-registry-alert-review-thresholds.ts';
import { CONTENT_SCHEMA_REGISTRY_ALERT_THRESHOLDS } from '../../packages/observability/src/content-schema-registry-alert-thresholds.ts';
const CLOUDFLARE_ACCOUNT_ID = /^[0-9a-f]{32}$/u;
const SOURCE_REVISION = /^[0-9a-f]{40}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const SAFE_BINDING_NAME = /^[A-Za-z0-9_:-]{1,128}$/u;
const SAFE_REFERENCE = /^[A-Za-z0-9][A-Za-z0-9._:/#?=&%+@-]{0,255}$/u;
const SAFE_ARTIFACT_PATH = /^[A-Za-z0-9._/-]{1,256}$/u;
type ContentSchemaRegistryAlertCondition =
  (typeof CONTENT_SCHEMA_REGISTRY_ALERT_CONDITIONS)[number];
export const AC209_CONFIGURATION_SCHEMA_VERSION =
  'ac209-alert-configuration-v1' as const;
export const AC209_WORKER_NAME = 'wejammin-api' as const;
export const AC209_PRODUCTION_CRON = '* * * * *' as const;
export const AC209_ALERT_ROUTE = 'platform.on_call' as const;
export const AC209_RUNBOOK = 'content-schema-registry' as const;
export const AC209_DEFAULT_ARTIFACT_PATH =
  'ac209-reports/alerts/configuration.json' as const;
export const AC209_REQUIRED_BINDINGS = Object.freeze([
  { name: 'APP_ENVIRONMENT', type: 'plain_text' },
  { name: 'APP_RELEASE', type: 'plain_text' },
  { name: 'CLOUDFLARE_ACCOUNT_ID', type: 'plain_text' },
  { name: 'CLOUDFLARE_OBSERVABILITY_API_TOKEN', type: 'secret_text' },
  { name: 'CLOUDFLARE_PLATFORM_DLQ_ID', type: 'plain_text' },
  { name: 'PLATFORM_ALERT_EMAIL', type: 'send_email' },
  { name: 'PLATFORM_JOBS', type: 'queue' },
  { name: 'SUPABASE_SECRET_KEY', type: 'secret_text' },
  { name: 'SUPABASE_URL', type: 'plain_text' },
] as const);
const condition = <T extends ContentSchemaRegistryAlertCondition>(
  name: T,
  rule: string,
  threshold: number | string,
) => ({ name, rule, threshold });
/**
 * The evaluator has sixteen locked condition codes but twelve numeric constants.
 * The two boundary rules below and the three denial-spike rules are deliberately
 * recorded as evaluator rules, rather than inventing a numeric nonce, DLQ or
 * denial threshold. The review-open window is the review lifecycle constant
 * (the seven-day maximum assignment span), kept outside the thresholds object
 * the report mirrors key for key.
 */
export const AC209_ALERT_CONDITION_THRESHOLDS = Object.freeze([
  condition(
    'activation_blocked',
    `activationBlockedMs > ${CONTENT_SCHEMA_REGISTRY_ALERT_THRESHOLDS.activationBlockedMs}`,
    CONTENT_SCHEMA_REGISTRY_ALERT_THRESHOLDS.activationBlockedMs,
  ),
  condition(
    'migration_retry_exceeded',
    `migrationRetryCount > ${CONTENT_SCHEMA_REGISTRY_ALERT_THRESHOLDS.migrationRetryCount}`,
    CONTENT_SCHEMA_REGISTRY_ALERT_THRESHOLDS.migrationRetryCount,
  ),
  condition(
    'nonce_rejection_spike',
    'nonceRejectionRate > nonceRejectionBaseline',
    'nonceRejectionBaseline',
  ),
  condition('dlq_nonempty', 'dlqDepth > 0', 0),
  condition(
    'outbox_age_exceeded',
    `outboxAgeMs > ${CONTENT_SCHEMA_REGISTRY_ALERT_THRESHOLDS.outboxAgeMs}`,
    CONTENT_SCHEMA_REGISTRY_ALERT_THRESHOLDS.outboxAgeMs,
  ),
  condition(
    'conflict_rate_exceeded',
    `conflictRate > ${CONTENT_SCHEMA_REGISTRY_ALERT_THRESHOLDS.conflictRate} && conflictWindowMs >= ${CONTENT_SCHEMA_REGISTRY_ALERT_THRESHOLDS.conflictWindowMs}`,
    CONTENT_SCHEMA_REGISTRY_ALERT_THRESHOLDS.conflictRate,
  ),
  condition(
    'unknown_event_version',
    `unknownEventVersions > ${CONTENT_SCHEMA_REGISTRY_ALERT_THRESHOLDS.unknownEventVersions}`,
    CONTENT_SCHEMA_REGISTRY_ALERT_THRESHOLDS.unknownEventVersions,
  ),
  condition(
    'command_p95_exceeded',
    `commandP95Ms >= ${CONTENT_SCHEMA_REGISTRY_ALERT_THRESHOLDS.commandP95Ms}`,
    CONTENT_SCHEMA_REGISTRY_ALERT_THRESHOLDS.commandP95Ms,
  ),
  condition(
    'protected_rpc_p95_exceeded',
    `protectedRpcP95Ms >= ${CONTENT_SCHEMA_REGISTRY_ALERT_THRESHOLDS.protectedRpcP95Ms}`,
    CONTENT_SCHEMA_REGISTRY_ALERT_THRESHOLDS.protectedRpcP95Ms,
  ),
  condition(
    'acceptance_p99_exceeded',
    `acceptanceP99Ms >= ${CONTENT_SCHEMA_REGISTRY_ALERT_THRESHOLDS.acceptanceP99Ms}`,
    CONTENT_SCHEMA_REGISTRY_ALERT_THRESHOLDS.acceptanceP99Ms,
  ),
  condition(
    'queue_first_attempt_p95_exceeded',
    `queueFirstAttemptP95Ms >= ${CONTENT_SCHEMA_REGISTRY_ALERT_THRESHOLDS.queueFirstAttemptP95Ms}`,
    CONTENT_SCHEMA_REGISTRY_ALERT_THRESHOLDS.queueFirstAttemptP95Ms,
  ),
  condition(
    'daily_dlq_rate_exceeded',
    `dailyDlqRate >= ${CONTENT_SCHEMA_REGISTRY_ALERT_THRESHOLDS.dailyDlqRate}`,
    CONTENT_SCHEMA_REGISTRY_ALERT_THRESHOLDS.dailyDlqRate,
  ),
  condition(
    'review_open_past_window',
    `reviewOpenAgeMs > ${CONTENT_SCHEMA_REGISTRY_REVIEW_ALERT_THRESHOLDS.reviewOpenWindowMs}`,
    CONTENT_SCHEMA_REGISTRY_REVIEW_ALERT_THRESHOLDS.reviewOpenWindowMs,
  ),
  condition(
    'decision_denial_spike',
    'decisionDenialRate > decisionDenialBaseline',
    'decisionDenialBaseline',
  ),
  condition(
    'assignment_denial_spike',
    'assignmentDenialRate > assignmentDenialBaseline',
    'assignmentDenialBaseline',
  ),
  condition(
    'capability_grant_denial_spike',
    'capabilityGrantDenialRate > capabilityGrantDenialBaseline',
    'capabilityGrantDenialBaseline',
  ),
] as const);
const BindingSchema = z
  .object({
    name: z.string().regex(SAFE_BINDING_NAME),
    type: z.string().min(1).max(64),
  })
  .strict();
const DeploymentVersionSchema = z
  .object({
    id: SafeReleaseIdSchema,
    percentage: z.number().min(0.01).max(100),
  })
  .strict();
const DeploymentSchema = z
  .object({
    id: SafeReleaseIdSchema,
    source: z.literal('wrangler'),
    strategy: z.literal('percentage'),
    createdAt: SafeReleaseTimestampSchema,
    annotations: z
      .object({ 'workers/triggered_by': z.literal('deployment') })
      .strict(),
    versions: z.array(DeploymentVersionSchema).min(1),
  })
  .strict();
export const Ac209ProviderStateSchema = z
  .object({
    workerName: z.literal(AC209_WORKER_NAME),
    settings: z
      .object({
        versionId: SafeReleaseIdSchema,
        versionSource: z.literal('wrangler'),
        versionCreatedAt: SafeReleaseTimestampSchema,
        appEnvironment: z.literal('production'),
        appRelease: z.string().regex(SOURCE_REVISION),
        cloudflareAccountId: z.string().regex(CLOUDFLARE_ACCOUNT_ID),
        dlqId: z.string().regex(/^[0-9a-f]{32}$/u),
        supabaseUrl: z.string().url(),
        queueName: z.string().min(1).max(128),
        alertEmailSha256: z.string().regex(SHA256),
        versionAnnotations: z
          .object({
            tag: z.string().regex(SOURCE_REVISION),
            message: z.string().max(512),
            triggeredBy: z.literal('version_upload'),
          })
          .strict(),
        bindings: z.array(BindingSchema).min(AC209_REQUIRED_BINDINGS.length),
      })
      .strict(),
    observability: z
      .object({
        enabled: z.literal(true),
        headSamplingRate: z.literal(1),
        logs: z
          .object({
            enabled: z.literal(true),
            headSamplingRate: z.literal(1),
            invocationLogs: z.literal(true),
            persist: z.literal(true),
          })
          .strict(),
      })
      .strict(),
    schedules: z
      .array(z.object({ cron: z.string().min(1).max(128) }).strict())
      .min(1),
    deployments: z.array(DeploymentSchema).min(1),
  })
  .strict();
const ThresholdsSchema = z
  .object({
    activationBlockedMs: z.number(),
    migrationRetryCount: z.number(),
    outboxAgeMs: z.number(),
    conflictRate: z.number(),
    conflictWindowMs: z.number(),
    unknownEventVersions: z.number(),
    commandP95Ms: z.number(),
    protectedRpcP95Ms: z.number(),
    acceptanceP99Ms: z.number(),
    queueFirstAttemptP95Ms: z.number(),
    dailyDlqRate: z.number(),
  })
  .strict();
const ConditionThresholdSchema = z
  .object({
    name: z.enum(CONTENT_SCHEMA_REGISTRY_ALERT_CONDITIONS),
    rule: z.string().min(1).max(512),
    threshold: z.union([z.number(), z.string().min(1).max(128)]),
  })
  .strict();
const PermissionChecksSchema = z
  .object({
    observabilityLogs: z.literal(true),
    queueAnalytics: z.literal(true),
    workerSettings: z.literal(true),
    workerSchedules: z.literal(true),
    workerDeployments: z.literal(true),
  })
  .strict();
export const Ac209AlertConfigurationReportSchema = z
  .object({
    schemaVersion: z.literal(AC209_CONFIGURATION_SCHEMA_VERSION),
    artifactPath: z.string().regex(SAFE_ARTIFACT_PATH),
    sourceRevision: z.string().regex(SOURCE_REVISION),
    environment: z.literal('production'),
    provider: z.literal('approved_scheduled_boundary'),
    configurationId: SafeReleaseIdSchema,
    configurationReference: z.string().regex(SAFE_REFERENCE),
    worker: z
      .object({
        name: z.literal(AC209_WORKER_NAME),
        deploymentId: SafeReleaseIdSchema,
        versionId: SafeReleaseIdSchema,
        trafficPercent: z.literal(100),
        sourceRevision: z.string().regex(SOURCE_REVISION),
        deployedAt: SafeReleaseTimestampSchema,
        deploymentSource: z.literal('wrangler'),
        deploymentTriggeredBy: z.literal('deployment'),
        versionTriggeredBy: z.literal('version_upload'),
        versionTag: z.string().regex(SOURCE_REVISION),
        versionMessage: z.string().max(512),
      })
      .strict(),
    schedule: z.object({ cron: z.literal(AC209_PRODUCTION_CRON) }).strict(),
    bindings: z.array(BindingSchema).length(AC209_REQUIRED_BINDINGS.length),
    verifiedSettings: z
      .object({
        versionId: SafeReleaseIdSchema,
        versionSource: z.literal('wrangler'),
        versionCreatedAt: SafeReleaseTimestampSchema,
        appEnvironment: z.literal('production'),
        appRelease: z.string().regex(SOURCE_REVISION),
        cloudflareAccountId: z.string().regex(CLOUDFLARE_ACCOUNT_ID),
        dlqId: z.string().regex(/^[0-9a-f]{32}$/u),
        supabaseUrl: z.string().url(),
        queueName: z.literal('platform-jobs'),
        alertEmailSha256: z.string().regex(SHA256),
      })
      .strict(),
    observability: z
      .object({
        enabled: z.literal(true),
        headSamplingRate: z.literal(1),
        logs: z
          .object({
            enabled: z.literal(true),
            headSamplingRate: z.literal(1),
            invocationLogs: z.literal(true),
            persist: z.literal(true),
          })
          .strict(),
      })
      .strict(),
    configuredConditions: z
      .array(z.enum(CONTENT_SCHEMA_REGISTRY_ALERT_CONDITIONS))
      .length(CONTENT_SCHEMA_REGISTRY_ALERT_CONDITIONS.length),
    thresholds: ThresholdsSchema,
    conditionThresholds: z
      .array(ConditionThresholdSchema)
      .length(CONTENT_SCHEMA_REGISTRY_ALERT_CONDITIONS.length),
    route: z.literal(AC209_ALERT_ROUTE),
    runbook: z.literal(AC209_RUNBOOK),
    permissionChecks: PermissionChecksSchema,
    capturedAt: SafeReleaseTimestampSchema,
  })
  .strict();
export type Ac209ProviderState = z.infer<typeof Ac209ProviderStateSchema>;
export type Ac209AlertConfigurationReport = z.infer<
  typeof Ac209AlertConfigurationReportSchema
>;
