import { CmsUuidSchema } from '@wejammin/contracts';
import { z } from 'zod';

/*
 * BE03c "Governed review machinery" Invalidation and "Job transport (DEC-166,
 * DEC-180 G9)": the consumers of `cms.block.lifecycle.changed.v1`,
 * `cms.schema.activated.v1` and `cms.pattern.activated.v1` enqueue the typed
 * platform-queue message `cms.governed_review.recheck` (system-initiated, no
 * actor and acting party, so no `platform_private.jobs` row). The message
 * carries identifiers only: never content, comments, tokens or authority.
 */

export const CMS_GOVERNED_RECHECK_JOB_TYPE =
  'cms.governed_review.recheck' as const;

/** A recheck run handles at most 500 reviews and then continues from a cursor. */
export const CMS_GOVERNED_RECHECK_BATCH_MAX = 500 as const;

/** The kinds of `cms_governed_review_dependencies (review_id, kind, ref_id)`. */
export const GovernedRecheckKindSchema = z.enum([
  'block',
  'pattern',
  'content_type',
  'canonical_domain',
]);

const QueueUuidSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
  );

export const GovernedRecheckJobSchema = z
  .strictObject({
    eventId: CmsUuidSchema,
    kind: GovernedRecheckKindSchema,
    refId: CmsUuidSchema,
  })
  .readonly();

/** The queue message of one run: the strict job payload plus its continuation cursor. */
export const GovernedRecheckMessageSchema = z
  .strictObject({
    jobType: z.literal(CMS_GOVERNED_RECHECK_JOB_TYPE),
    schemaVersion: z.literal(1),
    payload: GovernedRecheckJobSchema,
    cursor: CmsUuidSchema.nullable(),
    correlationId: QueueUuidSchema,
  })
  .readonly();

/**
 * `platform_api.cms_governed_recheck_resolve_event`: the committed event's identity as a governed
 * dependency lookup, or `found: false` when the event row is absent or is not one of the three
 * source events with the identity its published contract names.
 */
export const GovernedRecheckEventResolutionSchema = z.union([
  z.strictObject({ found: z.literal(false) }).readonly(),
  z
    .strictObject({
      found: z.literal(true),
      kind: GovernedRecheckKindSchema,
      refId: CmsUuidSchema,
    })
    .readonly(),
]);

/** `platform_api.cms_recheck_governed_reviews` request: the job payload plus its cursor. */
export const GovernedRecheckRunRequestSchema = z
  .strictObject({
    eventId: CmsUuidSchema,
    kind: GovernedRecheckKindSchema,
    refId: CmsUuidSchema,
    cursor: CmsUuidSchema.nullable(),
  })
  .readonly();

const CountSchema = z.number().int().min(0).max(CMS_GOVERNED_RECHECK_BATCH_MAX);

/**
 * One run's answer: at most 500 reviews examined, the reviews invalidated by
 * each closed reason, the reviews left live because their policy evidence was
 * unavailable, and a continuation cursor only after a full run.
 */
export const GovernedRecheckRunResultSchema = z
  .strictObject({
    examined: CountSchema,
    invalidated: CountSchema,
    dependencyChanged: CountSchema,
    reviewerAuthorityChanged: CountSchema,
    unavailable: CountSchema,
    nextCursor: CmsUuidSchema.nullable(),
  })
  .readonly()
  .refine(
    (run) =>
      run.invalidated ===
        run.dependencyChanged + run.reviewerAuthorityChanged &&
      run.invalidated + run.unavailable <= run.examined &&
      (run.nextCursor === null ||
        run.examined === CMS_GOVERNED_RECHECK_BATCH_MAX),
    { message: 'governed_recheck_run_inconsistent' },
  );

export type GovernedRecheckEventResolution = z.infer<
  typeof GovernedRecheckEventResolutionSchema
>;
export type GovernedRecheckKind = z.infer<typeof GovernedRecheckKindSchema>;
export type GovernedRecheckMessage = z.infer<
  typeof GovernedRecheckMessageSchema
>;
export type GovernedRecheckRunRequest = z.infer<
  typeof GovernedRecheckRunRequestSchema
>;
export type GovernedRecheckRunResult = z.infer<
  typeof GovernedRecheckRunResultSchema
>;
