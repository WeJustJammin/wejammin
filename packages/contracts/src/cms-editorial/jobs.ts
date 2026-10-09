import { z } from 'zod';

import { CmsUuidSchema } from '../content-schema-registry/primitives.ts';

/*
 * BE00 job types owned by the Slice 11 editorial workflow. Both jobs carry
 * identifiers only: never content, comments, field values, tokens or authority.
 */

export const CMS_EDITORIAL_JOB_TYPES = {
  /** The Worker `scheduled` sweep that claims and executes due schedules (CMS-03B-20). */
  scheduleExecute: 'cms.publication_schedule.execute',
  /** The dependency recheck that invalidates reviews whose frozen identity moved. */
  dependencyRecheck: 'cms.review.dependency_recheck',
} as const;

/**
 * BE03b `ReviewDependency` kinds: the identities frozen from the manifest and
 * indexed by `cms_editorial_review_dependencies (review_id, kind, ref_id)`.
 */
export const ReviewDependencyKindSchema = z.enum([
  'schema',
  'template',
  'block',
  'pattern',
  'term',
  'taxonomy_version',
  'locale_source',
  'relation_target',
  'settings',
]);

/**
 * The `cms.review.dependency_recheck` payload enqueued by the consumers of the
 * schema, template, pattern, taxonomy, localization and block lifecycle events.
 * The job selects live reviews through the dependency index, rebuilds each
 * manifest and invalidates on inequality; it is idempotent and bounded.
 */
export const ReviewDependencyRecheckJobSchema = z
  .strictObject({
    eventId: CmsUuidSchema,
    kind: ReviewDependencyKindSchema,
    refId: CmsUuidSchema,
  })
  .readonly();

/** A recheck run handles at most 500 reviews and then continues from a cursor. */
export const CMS_REVIEW_RECHECK_BATCH_MAX = 500 as const;

export type ReviewDependencyKind = z.infer<typeof ReviewDependencyKindSchema>;
export type ReviewDependencyRecheckJob = z.infer<
  typeof ReviewDependencyRecheckJobSchema
>;
