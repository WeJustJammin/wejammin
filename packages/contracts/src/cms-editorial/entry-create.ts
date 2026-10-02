import { z } from 'zod';

import { WorkflowPolicyEvidenceSchema } from '../content-schema-registry/models-workflow.ts';
import {
  CmsHashSchema,
  CmsUuidSchema,
  CmsVersionSchema,
  CmsValidatorKeySchema,
} from '../content-schema-registry/primitives.ts';
import { IdempotencyKeySchema } from '../request-navigation-security.ts';
import {
  EntryLifecycleSchema,
  EntryRevisionStateSchema,
  EntryValidationStateSchema,
  entryRevisionResourceMetaShape,
} from './models.ts';
import {
  Bcp47Schema,
  BoundedEntryValuesSchema,
  ChangedPathsSchema,
} from './primitives.ts';
import {
  SchemaArtifactEvidenceSchema,
  ValidatorEvidenceSchema,
} from './schema-evidence.ts';

/**
 * BE03b `EntryCreateRequest`: the CMS-03B-10 body.  Ownership, assignment,
 * acting party, capability, and authority are deliberately absent so the
 * server derives all of them from the authenticated principal.
 */
export const EntryCreateRequestSchema = z
  .strictObject({
    contentTypeId: CmsUuidSchema,
    contentTypeVersionId: CmsUuidSchema,
    locale: Bcp47Schema,
    changedPaths: ChangedPathsSchema,
    values: BoundedEntryValuesSchema,
    schemaArtifact: SchemaArtifactEvidenceSchema,
    validatorRefs: z.array(ValidatorEvidenceSchema).max(128).readonly(),
    workflowPolicy: WorkflowPolicyEvidenceSchema,
    activationEvidence: WorkflowPolicyEvidenceSchema,
  })
  .readonly();

/**
 * BE03b CMS-03B-10 headers: JSON plus Idempotency-Key and never If-Match,
 * because no prior entry version exists.  Deliberately a plain strict object
 * (no `.readonly()`) so the transport test can read `.shape` and prove
 * `ifMatch` is not a member.
 */
export const EntryCreateHeadersSchema = z.strictObject({
  contentType: z.literal('application/json'),
  idempotencyKey: IdempotencyKeySchema,
});

/** Canonical transport shape: create has no prior version to match. */
export const EntryCreateApiRequestSchema = z.strictObject({
  headers: EntryCreateHeadersSchema,
  body: EntryCreateRequestSchema,
});

const entryCreateMetaSchema = z.strictObject(entryRevisionResourceMetaShape);

/** BE03b `EntryCreateResource`: the created entry plus its first revision. */
export const EntryCreateResourceSchema = z
  .strictObject({
    entry: entryCreateMetaSchema,
    revision: entryCreateMetaSchema,
    revisionNumber: CmsVersionSchema,
    lifecycle: EntryLifecycleSchema,
    state: EntryRevisionStateSchema,
    locale: Bcp47Schema,
    contentHash: CmsHashSchema,
    validationState: EntryValidationStateSchema,
  })
  .readonly();

/** The closed authority names CMS-03B-10 must never accept from a caller. */
export const EntryCreateForbiddenAuthoritySchema = z
  .strictObject({})
  .readonly();

/**
 * Implementation checklist only.  These are the eight checks CMS-03B-10 must
 * perform at runtime against the registry; the names are NOT attestation
 * labels and this array is NOT proof that any check ran.  Nothing here binds a
 * caller-supplied list to a registry read, so a caller can trivially repeat all
 * eight strings; the runtime is the sole authority.
 */
export const ENTRY_CREATE_VERIFICATION_SEAMS = [
  'active_compiled_schema_identity_pairing',
  'schema_artifact_id_hash_compiler_match',
  'activation_evidence_non_null',
  'protected_validator_refs_present',
  'changed_paths_stable_id_binding',
  'values_against_active_schema_typing',
  'locale_set_membership',
  'off_registry_artifact_validator_rejection',
] as const;

export type EntryCreateVerificationSeam =
  (typeof ENTRY_CREATE_VERIFICATION_SEAMS)[number];

/**
 * The closed set of registry facts a trusted server-side check must resolve
 * before a create may be trusted.  These are the exact quantities the runtime
 * has, and the caller does not: a real registry read binds the artifact hash,
 * the active compiled schema pair, and the validator-decision outcome.
 */
const entryCreateRegistryEvidenceSchema = z
  .strictObject({
    schemaVersionId: CmsUuidSchema,
    contentTypeVersionId: CmsUuidSchema,
    artifactHash: CmsHashSchema,
    compilerVersion: z.string().min(1).max(32),
    validatorKeys: z.array(CmsValidatorKeySchema).min(1).max(128).readonly(),
  })
  .readonly();

/**
 * Server-produced create attestation.  A caller-supplied seam-name list can
 * never satisfy this schema: the only accepted input is the registry evidence
 * the runtime actually resolved, and the resolved shape must match the request
 * schema artifact it claims to prove.  A consumer that receives this object
 * still must cross-check it against the live registry read; the shape alone is
 * not authority.
 */
export const EntryCreateVerificationSchema = z
  .strictObject({
    request: EntryCreateRequestSchema,
    registry: entryCreateRegistryEvidenceSchema,
    /** Every checklist name, so the runtime must have considered each one. */
    seams: z
      .array(z.enum([...ENTRY_CREATE_VERIFICATION_SEAMS]))
      .length(ENTRY_CREATE_VERIFICATION_SEAMS.length)
      .refine(
        (seams) => new Set(seams).size === seams.length,
        'verification_seams_must_be_unique',
      )
      .readonly(),
  })
  .refine(
    ({ request, registry }) =>
      registry.schemaVersionId === request.schemaArtifact.id &&
      registry.contentTypeVersionId ===
        request.schemaArtifact.contentTypeVersionId &&
      registry.artifactHash === request.schemaArtifact.artifactHash &&
      registry.compilerVersion === request.schemaArtifact.compilerVersion &&
      request.schemaArtifact.contentTypeVersionId ===
        request.contentTypeVersionId,
    'registry_evidence_must_match_request_schema_artifact',
  )
  .readonly();

export type EntryCreateRequest = z.infer<typeof EntryCreateRequestSchema>;
export type EntryCreateHeaders = z.infer<typeof EntryCreateHeadersSchema>;
export type EntryCreateResource = z.infer<typeof EntryCreateResourceSchema>;
export type EntryCreateVerification = z.infer<
  typeof EntryCreateVerificationSchema
>;
