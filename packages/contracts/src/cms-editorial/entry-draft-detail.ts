import { z } from 'zod';

import { JsonValueSchema } from '../api-error.ts';
import {
  CmsHashSchema,
  CmsTargetTypeSchema,
  CmsUuidSchema,
  CmsVersionSchema,
} from '../content-schema-registry/primitives.ts';
import {
  EntryLifecycleSchema,
  EntryRevisionStateSchema,
  EntryValidationStateSchema,
  entryRevisionResourceMetaShape,
} from './models.ts';
import { Bcp47Schema } from './primitives.ts';

/** BE03b CMS-03B-11 addressing: exactly one UUID path parameter. */
export const EntryDraftDetailPathParamsSchema = z
  .strictObject({ entryId: CmsUuidSchema })
  .readonly();

/** BE03b `EntryDraftDetailQuery`: the bound entry id plus an optional locale. */
export const EntryDraftDetailQuerySchema = z
  .strictObject({
    entryId: CmsUuidSchema,
    locale: Bcp47Schema.optional(),
  })
  .readonly();

/** OpenAPI transport shape separates the UUID path from optional locale. */
export const EntryDraftDetailApiRequestSchema = z.strictObject({
  entryId: CmsUuidSchema,
  query: z.strictObject({ locale: Bcp47Schema.optional() }),
});

/**
 * BE03b `EntryDraftFieldValue`.  `value` is bounded JSON, never an untyped
 * pass-through: active-schema typing is a runtime seam, so this contract only
 * guarantees the JSON bounds and the closed provenance vocabulary.
 */
export const EntryDraftFieldValueSchema = z
  .strictObject({
    fieldId: CmsUuidSchema,
    fieldDefinitionId: CmsUuidSchema,
    locale: Bcp47Schema,
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

/**
 * The opaque fallback for an unavailable relation target under the
 * `placeholder` policy: exactly `{status:'unavailable', reason:'unavailable'}`
 * (BE03a OpaqueRelationPlaceholder, BE03b). It carries no target identifier,
 * type, key, title, data or existence distinction.
 */
const OpaqueUnavailableSchema = z
  .strictObject({
    status: z.literal('unavailable'),
    reason: z.literal('unavailable'),
  })
  .readonly();

const relationPositionSchema = z.number().int().min(0).max(511);

/** A relation whose target was readable on the recheck: the target binding. */
const ResolvedEntryDraftRelationSchema = z
  .strictObject({
    fieldId: CmsUuidSchema,
    fieldDefinitionId: CmsUuidSchema,
    targetKind: CmsTargetTypeSchema,
    targetId: CmsUuidSchema,
    expectedTargetVersion: CmsVersionSchema.nullable(),
    position: relationPositionSchema,
    onUnavailable: z.enum(['omit', 'block', 'placeholder']),
    unavailable: z.null(),
  })
  .readonly();

/**
 * A relation whose target was unavailable under the `placeholder` policy
 * (P2-S09-AC-081, AC203). Only the field binding, the position and the policy
 * remain; a target id, kind or version beside the fallback is refused.
 */
const PlaceholderEntryDraftRelationSchema = z
  .strictObject({
    fieldId: CmsUuidSchema,
    fieldDefinitionId: CmsUuidSchema,
    position: relationPositionSchema,
    onUnavailable: z.literal('placeholder'),
    unavailable: OpaqueUnavailableSchema,
  })
  .readonly();

/** BE03b `EntryDraftRelation`: a resolved target binding or the opaque placeholder. */
export const EntryDraftRelationSchema = z.union([
  ResolvedEntryDraftRelationSchema,
  PlaceholderEntryDraftRelationSchema,
]);

const draftDetailMetaSchema = z.strictObject(entryRevisionResourceMetaShape);

/**
 * BE03b `OpenConflict`: the safe pointer to the entry's currently open
 * conflict.  It carries only the conflict identity, its version, and the
 * divergence hash a reader compares against; the durable record's proposed
 * values, resolver identity, and ownership stay server-side.
 */
const OpenConflictSchema = z
  .strictObject({
    conflictId: CmsUuidSchema,
    version: CmsVersionSchema,
    conflictHash: CmsHashSchema,
  })
  .readonly();

/** BE03b `EntryDraftDetailResource`: the closed draft-detail envelope. */
export const EntryDraftDetailResourceSchema = z
  .strictObject({
    entry: draftDetailMetaSchema,
    revision: draftDetailMetaSchema,
    revisionNumber: CmsVersionSchema,
    lifecycle: EntryLifecycleSchema,
    state: EntryRevisionStateSchema,
    locale: Bcp47Schema,
    contentHash: CmsHashSchema,
    schemaVersionId: CmsUuidSchema,
    validationState: EntryValidationStateSchema,
    openConflict: OpenConflictSchema.nullable(),
    fields: z.array(EntryDraftFieldValueSchema).max(128).readonly(),
    relations: z.array(EntryDraftRelationSchema).max(512).readonly(),
  })
  .readonly();

/**
 * CMS-03B-11 uses an actor-bound representation hash as well as both entry
 * and current-revision identities/versions. It is not the numeric ETag used
 * by entry mutations, and a numeric validator cannot prove this read base.
 */
const draftDetailEtagParts = (
  etag: string,
): readonly [string, string, string, string, string] | null => {
  const match = /^"([^":]+):([^":]+):([^":]+):([^":]+):([^":]+)"$/u.exec(etag);
  if (
    match === null ||
    !CmsUuidSchema.safeParse(match[1]).success ||
    !CmsVersionSchema.safeParse(match[2]).success ||
    !CmsUuidSchema.safeParse(match[3]).success ||
    !CmsVersionSchema.safeParse(match[4]).success ||
    !CmsHashSchema.safeParse(match[5]).success
  )
    return null;
  return [match[1]!, match[2]!, match[3]!, match[4]!, match[5]!];
};

export const EntryDraftDetailEtagSchema = z
  .string()
  .max(180)
  .refine(
    (etag) => draftDetailEtagParts(etag) !== null,
    'draft_detail_etag_invalid',
  );

/** The web proxy can verify the identity/version binding without actor secrets. */
export const entryDraftDetailEtagMatchesResource = (
  etag: string,
  resource: EntryDraftDetailResource,
): boolean => {
  if (!EntryDraftDetailEtagSchema.safeParse(etag).success) return false;
  const parts = draftDetailEtagParts(etag);
  return (
    parts !== null &&
    parts[0] === resource.entry.id &&
    parts[1] === resource.entry.version &&
    parts[2] === resource.revision.id &&
    parts[3] === resource.revision.version
  );
};

/**
 * Implementation checklist only.  These are the eight checks CMS-03B-11 must
 * perform at runtime against the active schema; the names are NOT attestation
 * labels and this array is NOT proof that any check ran.  Nothing here binds a
 * caller-supplied list to an active-schema read, so the runtime is the sole
 * authority on field typing, target visibility, and hash recomputation.
 */
export const ENTRY_DRAFT_DETAIL_SCHEMA_VALIDATION_SEAMS = [
  'active_schema_field_definition_resolution',
  'active_schema_field_value_validation',
  'locale_field_set_membership',
  'relation_on_unavailable_policy_application',
  'relation_target_active_schema_resolution',
  'relation_target_visibility_and_capability',
  'relation_expected_target_version_comparison',
  'content_hash_recomputation_over_returned_fields',
] as const;

export type EntryDraftDetailSchemaValidationSeam =
  (typeof ENTRY_DRAFT_DETAIL_SCHEMA_VALIDATION_SEAMS)[number];

/**
 * The closed set of active-schema facts a trusted server-side read must
 * resolve before a draft detail may be trusted.  A caller cannot supply the
 * compiled schema identity or the recomputed content hash, which is what
 * separates this evidence from a fabricated list of seam names.
 */
const draftDetailRegistryEvidenceSchema = z
  .strictObject({
    contentTypeVersionId: CmsUuidSchema,
    schemaVersionId: CmsUuidSchema,
    artifactHash: CmsHashSchema,
    fieldDefinitionIds: z.array(CmsUuidSchema).max(128).readonly(),
    recomputedContentHash: CmsHashSchema,
  })
  .readonly();

/**
 * Server-produced draft-detail attestation.  A caller-supplied seam-name list
 * can never satisfy this schema: the accepted input is the active-schema
 * evidence the runtime resolved, and the recomputed hash must equal the
 * resource hash it claims to prove.  A consumer still must cross-check the
 * evidence against the live registry read; the shape alone is not authority.
 */
export const EntryDraftDetailSchemaValidationSchema = z
  .strictObject({
    resource: EntryDraftDetailResourceSchema,
    registry: draftDetailRegistryEvidenceSchema,
    /** Every checklist name, so the runtime must have considered each one. */
    seams: z
      .array(z.enum([...ENTRY_DRAFT_DETAIL_SCHEMA_VALIDATION_SEAMS]))
      .length(ENTRY_DRAFT_DETAIL_SCHEMA_VALIDATION_SEAMS.length)
      .refine(
        (seams) => new Set(seams).size === seams.length,
        'schema_validation_seams_must_be_unique',
      )
      .readonly(),
  })
  .refine(
    ({ resource, registry }) =>
      registry.recomputedContentHash === resource.contentHash,
    'recomputed_hash_must_match_returned_resource',
  )
  .readonly();

export type EntryDraftDetailPathParams = z.infer<
  typeof EntryDraftDetailPathParamsSchema
>;
export type EntryDraftDetailQuery = z.infer<typeof EntryDraftDetailQuerySchema>;
export type EntryDraftFieldValue = z.infer<typeof EntryDraftFieldValueSchema>;
export type EntryDraftRelation = z.infer<typeof EntryDraftRelationSchema>;
export type EntryDraftDetailResource = z.infer<
  typeof EntryDraftDetailResourceSchema
>;
export type EntryDraftDetailSchemaValidation = z.infer<
  typeof EntryDraftDetailSchemaValidationSchema
>;
