import { z } from 'zod';

import {
  CmsHashSchema,
  CmsInstantSchema,
  CmsUuidSchema,
  CmsVersionSchema,
} from '../content-schema-registry/primitives.ts';
import { Bcp47Schema } from './primitives.ts';
import { PreflightEvidenceSchema } from './preflight.ts';
import { VersionSetSchema } from './publication-contracts.ts';
import { CmsPublicationAudienceSchema } from './publication-schedule-contracts.ts';
import { ScheduleReasonCodeSchema } from './workflow-models.ts';

/*
 * BE03b "Internal service operations": CMS-03B-19 and CMS-03B-20 are NOT browser
 * routes and are never listed in the BE00 browser route inventory or the
 * generated OpenAPI document. Each is a named database RPC reachable only by one
 * registered non-browser principal (PUBLIC, anon, authenticated and every other
 * role have EXECUTE revoked). They return typed results instead of ApiError.
 */

export const CMS_EDITORIAL_INTERNAL_OPERATIONS = {
  'CMS-03B-19': {
    rpcs: ['platform_api.cms_verify_preview_token'],
    /** The Shard 04 delivery principal serving DLV-DEL-API-02 (BE04c seam). */
    principal: 'shard04_delivery',
    requestSchema: 'PreviewVerificationRequestSchema',
    resultSchema: 'PreviewVerificationResultSchema',
    /** No insert, update, delete, audit row or outbox row. */
    readSafe: true,
  },
  'CMS-03B-20': {
    rpcs: [
      'platform_private.cms_claim_due_publication_schedules',
      'platform_private.cms_execute_publication_schedule',
    ],
    /** The Worker `scheduled` sweep running BE00 job `cms.publication_schedule.execute`. */
    principal: 'worker_scheduled_sweep',
    requestSchema: 'ExecuteScheduleRequestSchema',
    resultSchema: 'ScheduleExecutionResultSchema',
    readSafe: false,
  },
} as const;

export type CmsEditorialInternalOperationId =
  keyof typeof CMS_EDITORIAL_INTERNAL_OPERATIONS;

/** CMS-03B-08: a preview token lives exactly 900 seconds (IA default and maximum). */
export const CMS_PREVIEW_TOKEN_TTL_SECONDS = 900 as const;
/** HMAC domain separator of the derived preview token (never stored). */
export const CMS_PREVIEW_TOKEN_DOMAIN = 'cms.preview.token.v1' as const;
/** BE04c verifier seam: 500 ms RPC timeout. */
export const CMS_PREVIEW_VERIFIER_TIMEOUT_MS = 500 as const;
/** BE04c verifier seam: two retries at 75 ms and 150 ms. */
export const CMS_PREVIEW_VERIFIER_RETRY_DELAYS_MS = [75, 150] as const;
/** BE04c verifier seam: the circuit opens for 30 seconds. */
export const CMS_PREVIEW_VERIFIER_CIRCUIT_OPEN_SECONDS = 30 as const;

/**
 * BE03b `PreviewVerificationRequest` (CMS-03B-19), aligned with the BE04c
 * `Shard 03 preview-token verifier` seam. The caller sends the lowercase
 * SHA-256 hex of the presented token's UTF-8 bytes: plaintext never reaches the
 * RPC. `actingContextVersion` is the token's `capability_snapshot_hash`.
 */
export const PreviewVerificationRequestSchema = z
  .strictObject({
    tokenHash: CmsHashSchema,
    actorPersonId: CmsUuidSchema,
    actingContextVersion: CmsHashSchema,
    route: z.string().max(4096),
    locale: Bcp47Schema,
    audience: CmsPublicationAudienceSchema,
  })
  .readonly();

/**
 * BE03b `PreviewVerificationResult`. An invalid result is byte-identical for
 * every denial cause except `revoked`, which is true only for the token's own
 * bound actor, so the verifier is not an existence oracle.
 */
export const PreviewVerificationResultSchema = z
  .discriminatedUnion('valid', [
    z
      .strictObject({
        valid: z.literal(true),
        userId: CmsUuidSchema,
        entryId: CmsUuidSchema,
        revisionId: CmsUuidSchema,
        exactVersionSet: VersionSetSchema,
        expiresAt: CmsInstantSchema,
        revoked: z.literal(false),
      })
      .readonly(),
    z
      .strictObject({
        valid: z.literal(false),
        userId: z.null(),
        entryId: z.null(),
        revisionId: z.null(),
        exactVersionSet: z.null(),
        expiresAt: z.null(),
        revoked: z.boolean(),
      })
      .readonly(),
  ])
  .readonly();

/**
 * The one denial value: also the caller's answer for an unknown, ambiguous,
 * timed-out or transport-failed verifier call (it never guesses `revoked`).
 */
export const previewVerificationDenial = (
  revoked = false,
): Extract<
  z.infer<typeof PreviewVerificationResultSchema>,
  { valid: false }
> => ({
  valid: false,
  userId: null,
  entryId: null,
  revisionId: null,
  exactVersionSet: null,
  expiresAt: null,
  revoked,
});

/** BE03b Schedule execution: the sweep runs every minute and claims 25 per call. */
export const CMS_SCHEDULE_SWEEP_INTERVAL_SECONDS = 60 as const;
export const CMS_SCHEDULE_CLAIM_BATCH_DEFAULT = 25 as const;
export const CMS_SCHEDULE_CLAIM_BATCH_MAX = 100 as const;
/** A claim leases the schedule for five minutes (`lease_until` now + 300 s). */
export const CMS_SCHEDULE_LEASE_SECONDS = 300 as const;
/** Claim and execute run under the 15,000 ms job deadline. */
export const CMS_SCHEDULE_DEADLINE_MS = 15_000 as const;
/** Retry ladder after the first, second and third retryable failure. */
export const CMS_SCHEDULE_RETRY_DELAYS_SECONDS = [15, 60, 300] as const;
/** A fourth consecutive retryable failure blocks with `retries_exhausted`. */
export const CMS_SCHEDULE_MAX_RETRY_ATTEMPTS = 3 as const;

/**
 * The delay before the retry that follows the `failureNumber`th consecutive
 * retryable failure (1-3), or null when the failure exhausts the ladder.
 */
export const cmsScheduleRetryDelaySeconds = (
  failureNumber: number,
): number | null =>
  Number.isInteger(failureNumber) &&
  failureNumber >= 1 &&
  failureNumber <= CMS_SCHEDULE_MAX_RETRY_ATTEMPTS
    ? (CMS_SCHEDULE_RETRY_DELAYS_SECONDS[failureNumber - 1] ?? null)
    : null;

/** CMS-03B-20 claim argument: `batch` integer 1-100. */
export const ClaimDueSchedulesRequestSchema = z
  .strictObject({
    batch: z.number().int().min(1).max(CMS_SCHEDULE_CLAIM_BATCH_MAX),
  })
  .readonly();

/**
 * BE03b `ClaimedSchedule`: identifiers, versions, hashes and correlation data
 * only, never content, comments, field values or tokens. `scheduleVersion` is the
 * schedule row version the claim produced (the CAS operand); `expectedVersion` is
 * the approved review version stored at schedule time.
 */
export const ClaimedScheduleSchema = z
  .strictObject({
    scheduleId: CmsUuidSchema,
    revisionId: CmsUuidSchema,
    scheduleVersion: CmsVersionSchema,
    expectedVersion: CmsVersionSchema,
    leaseId: CmsUuidSchema,
    dependencyHash: CmsHashSchema,
    activationEvidenceHash: CmsHashSchema,
    correlationId: CmsUuidSchema,
  })
  .readonly();

/** The claim result: at most `batch` (so at most 100) distinct claimed schedules. */
export const ClaimDueSchedulesResultSchema = z
  .array(ClaimedScheduleSchema)
  .max(CMS_SCHEDULE_CLAIM_BATCH_MAX)
  .refine(
    (claims) =>
      new Set(claims.map((claim) => claim.scheduleId)).size === claims.length,
    'claimed_schedules_must_be_unique',
  )
  .readonly();

/**
 * CMS-03B-20 execute arguments `(schedule_id, expected_version, lease_id,
 * evidence)`. `expectedVersion` is the `scheduleVersion` the claim returned: the
 * schedule row CAS operand that, with the lease, fences a stale or duplicate
 * worker. The approved-review version is read from the schedule row itself. The
 * `evidence` is the verified accessibility `PreflightEvidence`, or `null` when
 * the Worker checker produced no proof (unreadable input, dependency failure or
 * timeout); the database maps `null` to the `unavailable` / `checker_failed`
 * result (DEC-150, DEC-159), never to a pass. The RPC accepts it from the Worker
 * role only and never from a browser or PostgREST caller.
 */
export const ExecuteScheduleRequestSchema = z
  .strictObject({
    scheduleId: CmsUuidSchema,
    expectedVersion: CmsVersionSchema,
    leaseId: CmsUuidSchema,
    evidence: PreflightEvidenceSchema.nullable(),
  })
  .readonly();

/**
 * BE03b `ScheduleExecutionResult`: exactly four outcomes. Cancellation happens
 * only inside the review-invalidation transaction (DEC-158), so the executor
 * never reports `cancelled`; an executing schedule whose approval was
 * invalidated is `blocked` with `approval_invalidated`. A `blocked` outcome
 * carries the closed schedule `reasonCode`; a `failed_retryable` outcome stays
 * reasonless (the retry ladder is the schedule's own `attempt_count`).
 */
export const ScheduleExecutionResultSchema = z
  .strictObject({
    scheduleId: CmsUuidSchema,
    outcome: z.enum([
      'completed',
      'blocked',
      'failed_retryable',
      'already_completed',
    ]),
    reasonCode: ScheduleReasonCodeSchema.nullable(),
    publicationVersionId: CmsUuidSchema.nullable(),
    actualUtc: CmsInstantSchema.nullable(),
    deviationSeconds: z.number().int().nullable(),
  })
  .superRefine((value, context) => {
    if ((value.outcome === 'blocked') !== (value.reasonCode !== null))
      context.addIssue({
        code: 'custom',
        path: ['reasonCode'],
        message: 'reasonCode exists exactly for a blocked outcome',
      });
    if (value.outcome === 'completed') {
      if (value.publicationVersionId === null)
        context.addIssue({
          code: 'custom',
          path: ['publicationVersionId'],
          message: 'a completed execution appended a publication row',
        });
      if (value.actualUtc === null)
        context.addIssue({
          code: 'custom',
          path: ['actualUtc'],
          message: 'a completed execution records the actual instant',
        });
      if (value.deviationSeconds === null)
        context.addIssue({
          code: 'custom',
          path: ['deviationSeconds'],
          message: 'a completed execution records its deviation',
        });
    } else if (value.outcome !== 'already_completed') {
      if (
        value.publicationVersionId !== null ||
        value.actualUtc !== null ||
        value.deviationSeconds !== null
      )
        context.addIssue({
          code: 'custom',
          path: ['publicationVersionId'],
          message: 'only a completed execution carries publication evidence',
        });
    }
  })
  .readonly();

export type PreviewVerificationRequest = z.infer<
  typeof PreviewVerificationRequestSchema
>;
export type PreviewVerificationResult = z.infer<
  typeof PreviewVerificationResultSchema
>;
export type ClaimedSchedule = z.infer<typeof ClaimedScheduleSchema>;
export type ExecuteScheduleRequest = z.infer<
  typeof ExecuteScheduleRequestSchema
>;
export type ScheduleExecutionResult = z.infer<
  typeof ScheduleExecutionResultSchema
>;
