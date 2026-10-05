import { z } from 'zod';

import { JsonValueSchema } from '../api-error.ts';
import {
  CmsHashSchema,
  CmsUuidSchema,
  CmsVersionSchema,
} from '../content-schema-registry/primitives.ts';
import {
  ConflictRecordStateSchema,
  ConflictYoursSourceSchema,
  entryRevisionResourceMetaShape,
} from './models.ts';
import { JsonPointerSchema } from './primitives.ts';

/**
 * BE03b CMS-03B-12 read addressing: the entry and the open conflict, no filter
 * parameters.  The query is an empty strict object rather than an optional one
 * so an unknown selector is refused instead of silently ignored.
 */
export const ConflictDetailQuerySchema = z.strictObject({}).readonly();

/** BE03b CMS-03B-12 addressing: exactly the entry and conflict UUIDs. */
export const ConflictDetailPathParamsSchema = z
  .strictObject({ entryId: CmsUuidSchema, conflictId: CmsUuidSchema })
  .readonly();

/**
 * OpenAPI transport view for CMS-03B-12: the two UUID path parameters plus the
 * empty strict query.  A safe read accepts no body, Idempotency-Key, or
 * If-Match, so this schema deliberately declares neither headers nor body.
 */
export const ConflictDetailApiRequestSchema = z.strictObject({
  entryId: CmsUuidSchema,
  conflictId: CmsUuidSchema,
  query: z.strictObject({}),
});

/**
 * One participant in a divergent field.  value is bounded JSON and may be
 * null when the provenance is explicit_null or missing; provenance is the
 * same closed vocabulary the draft detail uses, and valueHash is the safe
 * digest of the value, null exactly when there is nothing to hash.
 */
export const ConflictDetailSideSchema = z
  .strictObject({
    value: JsonValueSchema.nullable(),
    provenance: z.enum([
      'authored',
      'default',
      'inherited',
      'localized_fallback',
      'explicit_null',
      'missing',
    ]),
    valueHash: CmsHashSchema.nullable(),
  })
  .readonly();

/** BE03b one divergent pointer and its three resolved sides. */
export const ConflictDetailPathSchema = z
  .strictObject({
    path: JsonPointerSchema,
    base: ConflictDetailSideSchema,
    theirs: ConflictDetailSideSchema,
    yours: ConflictDetailSideSchema,
  })
  .readonly();

/** The base or theirs revision reference carried into a conflict detail. */
const conflictDetailRevisionRefSchema = z
  .strictObject({
    revisionId: CmsUuidSchema,
    revisionNumber: CmsVersionSchema,
    schemaVersionId: CmsUuidSchema,
    contentHash: CmsHashSchema,
  })
  .readonly();

/**
 * The yours-side revision reference.  source repeats the durable record's
 * bounded vocabulary so a proposed (never-revisioned) autosave is stated as
 * such; only a revision-bound yours carries an id, and contentHash is always
 * the safe digest.  The unpublished proposed values stay server-side and are
 * never part of this read envelope.
 */
const conflictDetailYoursSchema = z
  .strictObject({
    source: ConflictYoursSourceSchema,
    revisionId: CmsUuidSchema.nullable(),
    contentHash: CmsHashSchema,
  })
  .readonly();

/** The conflict envelope: strict meta plus the closed state, paths, and hash. */
const conflictDetailConflictSchema = z
  .strictObject({
    ...entryRevisionResourceMetaShape,
    state: ConflictRecordStateSchema,
    changedPaths: z.array(JsonPointerSchema).min(1).max(128).readonly(),
    conflictHash: CmsHashSchema,
  })
  .readonly();

/**
 * BE03b conflict detail read envelope.  A conflict is open while the entry is
 * divergent, so only then may it carry the resolved per-path sides; a resolved
 * or superseded record has no divergent paths left, so paths must be empty.
 * Private identity and ownership (resolvedByPersonId, ownerId, assigneeId) are
 * deliberately absent at every level, and every nested object is strict so any
 * attempt to add them is refused rather than ignored.
 */
export const ConflictDetailResourceSchema = z
  .strictObject({
    conflict: conflictDetailConflictSchema,
    entry: z.strictObject(entryRevisionResourceMetaShape).readonly(),
    base: conflictDetailRevisionRefSchema,
    theirs: conflictDetailRevisionRefSchema,
    yours: conflictDetailYoursSchema,
    paths: z.array(ConflictDetailPathSchema).max(128).readonly(),
    resolvedRevisionId: CmsUuidSchema.nullable(),
  })
  .superRefine((value, context) => {
    if (value.conflict.state !== 'open' && value.paths.length !== 0)
      context.addIssue({
        code: 'custom',
        path: ['paths'],
        message: 'conflict_detail_closed_state_requires_empty_paths',
      });
  })
  .readonly();

export type ConflictDetailQuery = z.infer<typeof ConflictDetailQuerySchema>;
export type ConflictDetailPathParams = z.infer<
  typeof ConflictDetailPathParamsSchema
>;
export type ConflictDetailSide = z.infer<typeof ConflictDetailSideSchema>;
export type ConflictDetailPath = z.infer<typeof ConflictDetailPathSchema>;
export type ConflictDetailResource = z.infer<
  typeof ConflictDetailResourceSchema
>;
