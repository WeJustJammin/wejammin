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
import { FieldPointerSchema } from './primitives.ts';

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
  .superRefine((side, context) => {
    // A value is exposed only where provenance says one exists: a side the
    // draft holds no value for (`missing`) or holds an explicit null for
    // (`explicit_null`) carries a null value, so an upstream inconsistency can
    // never turn into a disclosure; every other provenance carries a value (a
    // written JSON null is `explicit_null`, never `authored`). `missing` has
    // nothing to hash either.
    const absent =
      side.provenance === 'missing' || side.provenance === 'explicit_null';
    if (absent && side.value !== null)
      context.addIssue({
        code: 'custom',
        path: ['value'],
        message: 'conflict_detail_side_absent_requires_null_value',
      });
    if (side.provenance === 'missing' && side.valueHash !== null)
      context.addIssue({
        code: 'custom',
        path: ['valueHash'],
        message: 'conflict_detail_side_missing_requires_null_hash',
      });
    if (!absent && side.value === null)
      context.addIssue({
        code: 'custom',
        path: ['value'],
        message: 'conflict_detail_side_valued_requires_value',
      });
  })
  .readonly();

/** BE03b one divergent pointer and its three resolved sides. */
export const ConflictDetailPathSchema = z
  .strictObject({
    path: FieldPointerSchema,
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
    changedPaths: z.array(FieldPointerSchema).min(1).max(128).readonly(),
    conflictHash: CmsHashSchema,
  })
  .readonly();

/**
 * BE03b conflict detail read envelope (DEC-139). CMS-03B-12 serves a conflict
 * only while it is `open`: a resolved or superseded conflict is concealed as the
 * same 404 as an absent one. So every served resource has `conflict.state`
 * `open`, `resolvedRevisionId` null and a non-empty `paths`; a payload with a
 * closed state is a server contract violation that the Worker, the web proxy and
 * the browser refuse as a dependency fault, never render as metadata. The closed
 * members stay in `ConflictRecordStateSchema` only because that vocabulary is
 * shared with the durable record. Private identity and ownership
 * (resolvedByPersonId, ownerId, assigneeId) are deliberately absent at every
 * level, and every nested object is strict so any attempt to add them is
 * refused rather than ignored.
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
    if (value.conflict.state !== 'open')
      context.addIssue({
        code: 'custom',
        path: ['conflict', 'state'],
        message: 'conflict_detail_requires_open_state',
      });
    if (value.resolvedRevisionId !== null)
      context.addIssue({
        code: 'custom',
        path: ['resolvedRevisionId'],
        message: 'conflict_detail_open_requires_null_resolved_revision',
      });
    if (value.paths.length === 0)
      context.addIssue({
        code: 'custom',
        path: ['paths'],
        message: 'conflict_detail_open_requires_paths',
      });
    // Each divergent field is shown once: the pointers are unique in both
    // arrays and `paths` is exactly `changedPaths` (the server emits one path
    // per changed path), or the resolution would be ambiguous.
    const changed = value.conflict.changedPaths;
    const shown = value.paths.map((path) => path.path);
    if (new Set(changed).size !== changed.length)
      context.addIssue({
        code: 'custom',
        path: ['conflict', 'changedPaths'],
        message: 'conflict_detail_changed_paths_must_be_unique',
      });
    if (new Set(shown).size !== shown.length)
      context.addIssue({
        code: 'custom',
        path: ['paths'],
        message: 'conflict_detail_paths_must_be_unique',
      });
    const changedSet = new Set(changed);
    if (
      shown.length > 0 &&
      (shown.some((pointer) => !changedSet.has(pointer)) ||
        changed.some((pointer) => !shown.includes(pointer)))
    )
      context.addIssue({
        code: 'custom',
        path: ['paths'],
        message: 'conflict_detail_paths_must_equal_changed_paths',
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
