import { z } from 'zod';

import {
  CmsUuidSchema,
  CmsVersionSchema,
} from '../content-schema-registry/primitives.ts';
import {
  IdempotencyKeySchema,
  QuotedVersionSchema,
} from '../request-navigation-security.ts';
import { refineIfMatchEqualsExpectedVersion } from './if-match.ts';

/**
 * BE03b RevisionRestoreRequest: the CMS-03B-04 body.  Restoring never edits or
 * activates the source revision; it resolves the named immutable migration
 * chain and inserts a new draft.  Ownership, the restoring party, and the
 * capability are absent because the server derives each one.
 */
export const RevisionRestoreRequestSchema = z
  .strictObject({
    entryId: CmsUuidSchema,
    revisionId: CmsUuidSchema,
    migrationChainId: CmsUuidSchema,
    expectedVersion: CmsVersionSchema,
  })
  .readonly();

/** BE03b CMS-03B-04 addressing: the entry plus the source revision. */
export const RevisionRestorePathParamsSchema = z
  .strictObject({ entryId: CmsUuidSchema, revisionId: CmsUuidSchema })
  .readonly();

/**
 * CMS-03B-04 headers.  BE03b binds the route to key + If-Match and requires it
 * to CAS the current entry, so the command takes an Idempotency-Key and an
 * exact strong If-Match version.
 */
export const RevisionRestoreHeadersSchema = z
  .strictObject({
    contentType: z.literal('application/json'),
    idempotencyKey: IdempotencyKeySchema,
    ifMatch: QuotedVersionSchema,
  })
  .readonly();

/**
 * The authority names CMS-03B-04 must never accept from a caller: the restoring
 * party, its capability, and the translated values are all server-derived.
 */
export const RevisionRestoreForbiddenAuthoritySchema = z
  .strictObject({})
  .readonly();

/** OpenAPI transport view for CMS-03B-04: both UUIDs, headers, and body. */
export const RevisionRestoreApiRequestSchema = z
  .strictObject({
    entryId: CmsUuidSchema,
    revisionId: CmsUuidSchema,
    headers: RevisionRestoreHeadersSchema,
    body: RevisionRestoreRequestSchema,
  })
  .superRefine(refineIfMatchEqualsExpectedVersion);

/**
 * Implementation checklist only.  These are the checks CMS-03B-04 must perform
 * at runtime; the names are NOT attestation labels and this array is NOT proof
 * that any check ran.  Nothing here binds a caller-supplied list to a migration
 * or registry read, so the runtime is the sole authority.
 */
export const REVISION_RESTORE_SEAMS = [
  'source_revision_readable_and_immutable',
  'migration_chain_registered_and_ordered',
  'migration_chain_covers_source_to_active_schema',
  'active_schema_compatibility_recheck',
  'non_fabricating_defaults_and_relations_translation',
  'entry_version_cas',
  'new_draft_revision_only_never_activates_source',
  'restore_idempotency_and_epoch_fencing',
] as const;

export type RevisionRestoreSeam = (typeof REVISION_RESTORE_SEAMS)[number];

/**
 * The closed set of migration facts a trusted server-side restore must resolve
 * before a new draft may be trusted.  A caller cannot supply the recorded chain
 * order or the resolved source and active schema versions, which is what
 * separates this evidence from a repeated list of seam names.
 */
const revisionRestoreRegistryEvidenceSchema = z
  .strictObject({
    revisionId: CmsUuidSchema,
    migrationChainId: CmsUuidSchema,
    sourceSchemaVersionId: CmsUuidSchema,
    activeSchemaVersionId: CmsUuidSchema,
    // A chain of at most 64 completed plan edges (BE03b D6) names the source schema
    // version plus one version per edge: at most 65 versions.
    chainSchemaVersionIds: z.array(CmsUuidSchema).min(1).max(65).readonly(),
    entryVersion: CmsVersionSchema,
  })
  .readonly();

/**
 * Server-produced restore attestation.  A caller-supplied seam-name list can
 * never satisfy this schema: the accepted input is the migration evidence the
 * runtime actually resolved, and the recorded chain must both start at the
 * source schema and terminate at the current active schema.  A consumer still
 * must cross-check the evidence against the live registry read; the shape alone
 * is not authority.
 */
export const RevisionRestoreVerificationSchema = z
  .strictObject({
    request: RevisionRestoreRequestSchema,
    registry: revisionRestoreRegistryEvidenceSchema,
    /** Every checklist name, so the runtime must have considered each one. */
    seams: z
      .array(z.enum([...REVISION_RESTORE_SEAMS]))
      .length(REVISION_RESTORE_SEAMS.length)
      .refine(
        (seams) => new Set(seams).size === seams.length,
        'restore_seams_must_be_unique',
      )
      .readonly(),
  })
  .refine(
    ({ request, registry }) =>
      registry.revisionId === request.revisionId &&
      registry.migrationChainId === request.migrationChainId &&
      registry.entryVersion === request.expectedVersion &&
      registry.chainSchemaVersionIds[0] === registry.sourceSchemaVersionId &&
      registry.chainSchemaVersionIds[
        registry.chainSchemaVersionIds.length - 1
      ] === registry.activeSchemaVersionId,
    'restore_evidence_must_match_request',
  )
  .readonly();

export type RevisionRestoreRequest = z.infer<
  typeof RevisionRestoreRequestSchema
>;
export type RevisionRestorePathParams = z.infer<
  typeof RevisionRestorePathParamsSchema
>;
export type RevisionRestoreHeaders = z.infer<
  typeof RevisionRestoreHeadersSchema
>;
export type RevisionRestoreVerification = z.infer<
  typeof RevisionRestoreVerificationSchema
>;
