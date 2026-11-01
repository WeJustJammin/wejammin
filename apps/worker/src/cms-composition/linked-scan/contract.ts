import { CmsUuidSchema } from '@wejammin/contracts';
import { z } from 'zod';

/*
 * BE03c "Linked update (diff, accept, detach)" and "Job transport (DEC-166, DEC-180 G9)": the consumer of
 * `cms.pattern.activated.v1` enqueues the typed platform-queue message `cms.pattern.linked_update_scan`
 * (system-initiated, no actor and acting party, so no `platform_private.jobs` row). The message carries
 * identifiers only: never content, props, comments, tokens or authority.
 */

export const CMS_LINKED_SCAN_JOB_TYPE =
  'cms.pattern.linked_update_scan' as const;

/** A scan run handles at most 500 instances and then continues from a cursor. */
export const CMS_LINKED_SCAN_BATCH_MAX = 500 as const;

const QueueUuidSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
  );

/**
 * The opaque continuation of a run: `<entry uuid>.<hex of the UTF-8 octets of a composition path>`
 * (1 to 512 octets, lower-case hex). The Worker never builds or reads one; it hands back what the
 * database answered.
 */
export const LinkedScanCursorSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:[0-9a-f]{2}){1,512}$/u,
  );

export const LinkedScanJobSchema = z
  .strictObject({
    patternId: CmsUuidSchema,
    patternVersionId: CmsUuidSchema,
  })
  .readonly();

/** The queue message of one run: the strict job payload plus its continuation cursor. */
export const LinkedScanMessageSchema = z
  .strictObject({
    jobType: z.literal(CMS_LINKED_SCAN_JOB_TYPE),
    schemaVersion: z.literal(1),
    payload: LinkedScanJobSchema,
    cursor: LinkedScanCursorSchema.nullable(),
    correlationId: QueueUuidSchema,
  })
  .readonly();

/**
 * `platform_api.cms_linked_scan_resolve_event`: the committed pattern activation as the job payload it
 * names, or `found: false` when the event row is absent, is not that event or names no stored version.
 */
export const LinkedScanEventResolutionSchema = z.union([
  z.strictObject({ found: z.literal(false) }).readonly(),
  z
    .strictObject({
      found: z.literal(true),
      patternId: CmsUuidSchema,
      patternVersionId: CmsUuidSchema,
    })
    .readonly(),
]);

/** `platform_api.cms_scan_linked_pattern_updates` request: the job payload, its cursor and the correlation. */
export const LinkedScanRunRequestSchema = z
  .strictObject({
    patternId: CmsUuidSchema,
    patternVersionId: CmsUuidSchema,
    cursor: LinkedScanCursorSchema.nullable(),
    correlationId: QueueUuidSchema,
  })
  .readonly();

const CountSchema = z.number().int().min(0).max(CMS_LINKED_SCAN_BATCH_MAX);

/**
 * One run's answer: at most 500 instances examined, the `pending_diff` rows appended and a
 * continuation cursor only after a full run.
 */
export const LinkedScanRunResultSchema = z
  .strictObject({
    examined: CountSchema,
    appended: CountSchema,
    nextCursor: LinkedScanCursorSchema.nullable(),
  })
  .readonly()
  .refine(
    (run) =>
      run.appended <= run.examined &&
      (run.nextCursor === null || run.examined === CMS_LINKED_SCAN_BATCH_MAX),
    { message: 'linked_scan_run_inconsistent' },
  );

export type LinkedScanEventResolution = z.infer<
  typeof LinkedScanEventResolutionSchema
>;
export type LinkedScanMessage = z.infer<typeof LinkedScanMessageSchema>;
export type LinkedScanRunRequest = z.infer<typeof LinkedScanRunRequestSchema>;
export type LinkedScanRunResult = z.infer<typeof LinkedScanRunResultSchema>;
