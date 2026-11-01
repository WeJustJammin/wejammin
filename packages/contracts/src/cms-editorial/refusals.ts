import { z } from 'zod';

import {
  CmsHashSchema,
  CmsInstantSchema,
  CmsVersionSchema,
} from '../content-schema-registry/primitives.ts';
import { PreflightRefusalEntrySchema } from './preflight.ts';
import { CmsScheduleLocalDateTimeSchema } from './publication-schedule-contracts.ts';
import { CmsTzdbVersionSchema } from './publication-resources.ts';

/*
 * BE03b "Contract and error matrix": Slice 11 typed refusals carry exactly one
 * lowercase `details.reasonCode` token from this closed catalog, plus only the
 * members named per token. A stale CAS operand is 409 `CONFLICT` with
 * `details.conflict` `VERSION_MISMATCH`; a missing or stale MFA is 401
 * `STEP_UP_REQUIRED`. The internal operations return typed results instead.
 */

/** 403 `FORBIDDEN` tokens. */
export const CMS_SLICE_11_FORBIDDEN_REASONS = [
  'capability_missing',
  'separation_of_duties',
] as const;

/** 409 `CONFLICT` tokens. */
export const CMS_SLICE_11_CONFLICT_REASONS = [
  'revision_not_submittable',
  'dependency_changed',
  'version_set_stale',
  'review_not_open',
  'duplicate_decision',
  'specialist_slot_unsatisfiable',
  'reviewer_not_eligible',
  'assignment_exists',
  'assignment_limit',
  'publication_conflict',
  'publication_not_active',
  'preview_expired',
  'preflight_evidence_stale',
] as const;

/** 422 `VALIDATION_FAILED` tokens. */
export const CMS_SLICE_11_VALIDATION_REASONS = [
  'preflight_failed',
  'dependency_manifest_too_large',
  'unknown_timezone',
  'tzdb_version_mismatch',
  'nonexistent_local_time',
  'ambiguous_local_time',
  'disambiguation_not_applicable',
  'resolved_utc_mismatch',
  'schedule_out_of_horizon',
  'authority_ends_before_schedule',
  'expiry_out_of_bounds',
] as const;

export const CmsSlice11ReasonCodeSchema = z.enum([
  ...CMS_SLICE_11_FORBIDDEN_REASONS,
  ...CMS_SLICE_11_CONFLICT_REASONS,
  ...CMS_SLICE_11_VALIDATION_REASONS,
]);
export type CmsSlice11ReasonCode = z.infer<typeof CmsSlice11ReasonCodeSchema>;

/**
 * Tokens that surface only as an executor `reasonCode` of a blocked schedule
 * (CMS-03B-20), never as a browser refusal: the browser publication command
 * always publishes, so it has no active head to require.
 */
export const CMS_SLICE_11_EXECUTOR_ONLY_REASONS = [
  'publication_not_active',
] as const;

/** The one HTTP status of a reason token: 403, 409 or 422. */
export const cmsSlice11ReasonStatus = (
  reason: CmsSlice11ReasonCode,
): 403 | 409 | 422 =>
  (CMS_SLICE_11_FORBIDDEN_REASONS as readonly string[]).includes(reason)
    ? 403
    : (CMS_SLICE_11_CONFLICT_REASONS as readonly string[]).includes(reason)
      ? 409
      : 422;

/**
 * The tokens each browser operation may publish, derived from the BE03b route
 * field validation matrix and the contract and error matrix rows. Any other
 * token for the operation is dropped at the boundary.
 */
export const CMS_SLICE_11_OPERATION_REASONS = {
  'CMS-03B-05': [
    'capability_missing',
    'separation_of_duties',
    'revision_not_submittable',
    'dependency_changed',
    'preflight_failed',
    'dependency_manifest_too_large',
    'preflight_evidence_stale',
  ],
  'CMS-03B-06': [
    'capability_missing',
    'separation_of_duties',
    'review_not_open',
    'duplicate_decision',
    'specialist_slot_unsatisfiable',
    'dependency_changed',
  ],
  'CMS-03B-07': [
    'capability_missing',
    'separation_of_duties',
    'version_set_stale',
    'dependency_changed',
    'preflight_failed',
    'preflight_evidence_stale',
    'unknown_timezone',
    'tzdb_version_mismatch',
    'nonexistent_local_time',
    'ambiguous_local_time',
    'disambiguation_not_applicable',
    'resolved_utc_mismatch',
    'schedule_out_of_horizon',
    'authority_ends_before_schedule',
  ],
  'CMS-03B-08': ['capability_missing', 'version_set_stale', 'preview_expired'],
  'CMS-03B-09': [
    'capability_missing',
    'separation_of_duties',
    'version_set_stale',
    'dependency_changed',
    'publication_conflict',
    'preflight_failed',
    'preflight_evidence_stale',
  ],
  'CMS-03B-15': ['capability_missing'],
  'CMS-03B-16': ['capability_missing'],
  'CMS-03B-17': [],
  'CMS-03B-18': [
    'capability_missing',
    'reviewer_not_eligible',
    'assignment_exists',
    'assignment_limit',
    'review_not_open',
    'expiry_out_of_bounds',
  ],
} as const satisfies Readonly<Record<string, readonly CmsSlice11ReasonCode[]>>;

/** A violation pointer: RFC 6901 over a bounded safe alphabet, at most 32 segments. */
const SafePointerSchema = z
  .string()
  .max(256)
  .regex(/^(?:\/(?:[A-Za-z0-9_.-]|~[01])*){1,32}$/u, 'pointer_invalid');

/** One violation: a pointer, a lowercase machine code and a safe fixed message. */
export const CmsViolationSchema = z
  .strictObject({
    path: SafePointerSchema,
    code: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/u),
    message: z.string().min(1).max(200),
  })
  .readonly();

const ViolationsSchema = z.array(CmsViolationSchema).max(50).readonly();

const plainDetails = <const Token extends CmsSlice11ReasonCode>(token: Token) =>
  z
    .strictObject({
      reasonCode: z.literal(token),
      violations: ViolationsSchema.optional(),
    })
    .readonly();

/** Time-authority alternatives of a nonexistent local time: earlier and later shifts. */
const GapAlternativesSchema = z
  .tuple([
    z
      .strictObject({
        localDateTime: CmsScheduleLocalDateTimeSchema,
        resolvedUtc: CmsInstantSchema,
      })
      .readonly(),
    z
      .strictObject({
        localDateTime: CmsScheduleLocalDateTimeSchema,
        resolvedUtc: CmsInstantSchema,
      })
      .readonly(),
  ])
  .readonly();

/** Time-authority alternatives of an ambiguous local time: earlier then later. */
const FoldAlternativesSchema = z
  .tuple([
    z
      .strictObject({
        disambiguation: z.literal('earlier'),
        resolvedUtc: CmsInstantSchema,
      })
      .readonly(),
    z
      .strictObject({
        disambiguation: z.literal('later'),
        resolvedUtc: CmsInstantSchema,
      })
      .readonly(),
  ])
  .readonly();

/**
 * The `details` of a Slice 11 typed 403/409/422 refusal, keyed by its single
 * `reasonCode`. Only the members named per token are allowed, and a violation is
 * a safe pointer, a machine code and a fixed message (never a caller value).
 */
export const CmsEditorialRefusalDetailsSchema = z.discriminatedUnion(
  'reasonCode',
  [
    z
      .strictObject({
        reasonCode: z.literal('preflight_failed'),
        preflight: z.array(PreflightRefusalEntrySchema).max(17).readonly(),
      })
      .readonly(),
    z
      .strictObject({
        reasonCode: z.literal('dependency_changed'),
        dependencyHash: CmsHashSchema,
      })
      .readonly(),
    z
      .strictObject({
        reasonCode: z.literal('tzdb_version_mismatch'),
        pinnedVersion: CmsTzdbVersionSchema,
        violations: ViolationsSchema.optional(),
      })
      .readonly(),
    z
      .strictObject({
        reasonCode: z.literal('resolved_utc_mismatch'),
        expectedUtc: CmsInstantSchema,
        violations: ViolationsSchema.optional(),
      })
      .readonly(),
    z
      .strictObject({
        reasonCode: z.literal('schedule_out_of_horizon'),
        minUtc: CmsInstantSchema,
        maxUtc: CmsInstantSchema,
        violations: ViolationsSchema.optional(),
      })
      .readonly(),
    z
      .strictObject({
        reasonCode: z.literal('nonexistent_local_time'),
        alternatives: GapAlternativesSchema,
        violations: ViolationsSchema.optional(),
      })
      .readonly(),
    z
      .strictObject({
        reasonCode: z.literal('ambiguous_local_time'),
        alternatives: FoldAlternativesSchema,
        violations: ViolationsSchema.optional(),
      })
      .readonly(),
    plainDetails('capability_missing'),
    plainDetails('separation_of_duties'),
    plainDetails('revision_not_submittable'),
    plainDetails('version_set_stale'),
    plainDetails('review_not_open'),
    plainDetails('duplicate_decision'),
    plainDetails('specialist_slot_unsatisfiable'),
    plainDetails('reviewer_not_eligible'),
    plainDetails('assignment_exists'),
    plainDetails('assignment_limit'),
    plainDetails('publication_conflict'),
    plainDetails('publication_not_active'),
    plainDetails('preview_expired'),
    plainDetails('preflight_evidence_stale'),
    plainDetails('dependency_manifest_too_large'),
    plainDetails('unknown_timezone'),
    plainDetails('disambiguation_not_applicable'),
    plainDetails('authority_ends_before_schedule'),
    plainDetails('expiry_out_of_bounds'),
  ],
);

/**
 * 503 `DEPENDENCY_UNAVAILABLE` for an unavailable preflight provider: the
 * command is refused, nothing commits and no success idempotency record is kept.
 */
export const CmsPreflightUnavailableDetailsSchema = z
  .strictObject({
    dependencyClass: z.literal('preflight'),
    retryable: z.literal(true),
    retryAfterSeconds: z.number().int().min(1).max(3_600).optional(),
  })
  .readonly();

/** 409 `CONFLICT` for a stale CAS operand: authorized expected/current versions only. */
export const CmsStaleVersionDetailsSchema = z
  .strictObject({
    conflict: z.literal('VERSION_MISMATCH'),
    recoveryAction: z.enum(['reload', 'refresh']),
    expectedVersion: CmsVersionSchema.optional(),
    currentVersion: CmsVersionSchema.optional(),
  })
  .readonly();

export type CmsViolation = z.infer<typeof CmsViolationSchema>;
export type CmsEditorialRefusalDetails = z.infer<
  typeof CmsEditorialRefusalDetailsSchema
>;
