import { z } from 'zod';

import { SafeReleaseTimestampSchema } from '../release-recovery-common.ts';

export const CONTENT_SCHEMA_REGISTRY_ALERT_CONDITIONS = [
  'activation_blocked',
  'migration_retry_exceeded',
  'nonce_rejection_spike',
  'dlq_nonempty',
  'outbox_age_exceeded',
  'conflict_rate_exceeded',
  'unknown_event_version',
  'command_p95_exceeded',
  'protected_rpc_p95_exceeded',
  'acceptance_p99_exceeded',
  'queue_first_attempt_p95_exceeded',
  'daily_dlq_rate_exceeded',
  'review_open_past_window',
  'decision_denial_spike',
  'assignment_denial_spike',
  'capability_grant_denial_spike',
] as const;

export const CONTENT_SCHEMA_REGISTRY_HOSTED_ROLES = [
  'entitled_read',
  'owner_full',
  'guardian_mandate',
  'junior_restricted',
  'business_mandate',
  'staff_case_scoped',
  'admin_step_up',
  'forbidden_hidden',
  'disabled_prerequisite',
] as const;

export const CONTENT_SCHEMA_REGISTRY_HOSTED_SCENARIOS = [
  'idp_sign_in',
  'server_authoritative_rls',
  'keyboard_landmarks_live_regions',
  'three_breakpoints',
  'zoom_200',
  'offline_reconnect',
  'stale_multi_tab',
  'auth_expiry',
  'rate_limit_429',
  'dependency_outage',
] as const;

export const CONTENT_SCHEMA_REGISTRY_MANUAL_A11Y_CHECKS = [
  'contrast_and_non_color_cues',
  'keyboard',
  'landmarks_and_live_regions',
  'zoom_200',
  'zoom_400',
  'forced_colors',
  'reduced_motion',
  'target_size',
  'focus',
  'no_trap',
  'error_and_status_announcements',
] as const;

export const CONTENT_SCHEMA_REGISTRY_SLO_THRESHOLDS = Object.freeze({
  commandP95Ms: 1_200,
  protectedRpcP95Ms: 300,
  acceptanceP99Ms: 1_000,
  queueFirstAttemptP95Ms: 60_000,
  dailyDlqRate: 0.001,
});

export const ReleaseEvidenceSourceRevisionSchema = z
  .string()
  .regex(/^[a-f0-9]{40}$/);
export const ReleaseEvidenceDigestSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const ReleaseEvidenceReportPathSchema = z
  .string()
  .min(1)
  .max(240)
  .regex(
    /^(?!\/)(?!.*(?:^|\/)\.{1,2}(?:\/|$))(?!.*\/\/)(?!.*\\)[A-Za-z0-9](?:[A-Za-z0-9._/-]*[A-Za-z0-9])?$/,
  );
export const ReleaseEvidenceReportReferenceSchema = z
  .object({
    path: ReleaseEvidenceReportPathSchema,
    sha256: ReleaseEvidenceDigestSchema,
  })
  .strict()
  .readonly();

const isPathlessHttpsOrigin = (value: string): boolean => {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.username === '' &&
      url.password === '' &&
      url.pathname === '/' &&
      url.search === '' &&
      url.hash === ''
    );
  } catch {
    return false;
  }
};

export const ReleaseEvidenceHttpsOriginSchema = z
  .string()
  .url()
  .startsWith('https://')
  .max(2_048)
  .refine(
    isPathlessHttpsOrigin,
    'Hosted origins must be pathless HTTPS origins without credentials',
  );

const PRIVATE_HOST_PATTERN =
  /^(?:localhost|.+\.localhost|.+\.local|(?:0|10|127)(?:\.[0-9]{1,3}){3}|100\.(?:6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])(?:\.[0-9]{1,3}){2}|169\.254(?:\.[0-9]{1,3}){2}|172\.(?:1[6-9]|2[0-9]|3[01])(?:\.[0-9]{1,3}){2}|192\.168(?:\.[0-9]{1,3}){2}|\[(?:::|::1|::ffff:[0-9a-f:]+|f[cd][0-9a-f:]*|fe[89ab][0-9a-f:]*)\])$/u;

const isPublicHostedOrigin = (value: string): boolean => {
  try {
    const hostname = new URL(value).hostname.toLowerCase().replace(/\.$/, '');
    return !PRIVATE_HOST_PATTERN.test(hostname);
  } catch {
    return false;
  }
};

export const ReleaseEvidenceHostedOriginSchema =
  ReleaseEvidenceHttpsOriginSchema.refine(
    isPublicHostedOrigin,
    'Hosted origins must not use loopback or private-network hosts',
  );
export const ReleaseEvidenceWindowSchema = z
  .object({
    startedAt: SafeReleaseTimestampSchema,
    endedAt: SafeReleaseTimestampSchema,
  })
  .strict()
  .readonly();
