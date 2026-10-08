import { z } from 'zod';

import { WorkflowPolicyEvidenceSchema } from '../content-schema-registry/models-workflow.ts';
import {
  CmsHashSchema,
  CmsUuidSchema,
  CmsVersionSchema,
} from '../content-schema-registry/primitives.ts';
import { ProtectedValidatorEvidenceSchema } from '../content-schema-registry/protected-validators.ts';
import {
  IdempotencyKeySchema,
  QuotedVersionSchema,
} from '../request-navigation-security.ts';
import { Bcp47Schema } from './primitives.ts';
import { SchemaArtifactEvidenceSchema } from './schema-evidence.ts';

/*
 * BE03b review-side publication contracts: the frozen dependency evidence
 * (`VersionSet`, `DependencyManifest`) and the CMS-03B-05 review submission and
 * CMS-03B-06 decision bodies. The schedule, preview, and publication bodies
 * that consume `VersionSet` live in `publication-schedule-contracts.ts`.
 */

/**
 * BE03b dependency-manifest serialized ceiling: 32 KiB of UTF-8 for the
 * canonical JSON of the strict manifest. The schema rejects any parse whose
 * canonical serialization exceeds this bound.
 */
export const CMS_DEPENDENCY_MANIFEST_MAX_BYTES = 32_768;

/**
 * BE03b dependency-manifest total-entry ceiling: 256 entries counted across the
 * whole manifest. Every element of `validatorRefs`, `blocks`, `patterns`,
 * `terms`, `localeSources` and `relations` is one entry, and so is each present
 * singleton (`schema`, `template`, `settings`, `checker`). The per-array caps
 * alone would admit about 266 hash entries under the byte bound.
 */
export const CMS_DEPENDENCY_MANIFEST_MAX_ENTRIES = 256;

/** True when every key the selector derives from `items` is distinct. */
const allDistinct = <T>(
  items: readonly T[],
  select: (item: T) => string,
): boolean => new Set(items.map(select)).size === items.length;

/**
 * Protected validator references (BE03a registry): a manifest or version set
 * names only a registered protected member at its registered version, and names
 * each member once.
 */
const ProtectedValidatorRefsSchema = z
  .array(ProtectedValidatorEvidenceSchema)
  .max(128)
  .refine(
    (refs) => allDistinct(refs, (ref) => `${ref.key}@${ref.version}`),
    'validator_refs_must_be_unique',
  )
  .readonly();

/** A bounded id list in which every id is named once. */
const uniqueIdList = (max: number) =>
  z
    .array(CmsUuidSchema)
    .max(max)
    .refine((ids) => allDistinct(ids, (id) => id), 'version_ids_must_be_unique')
    .readonly();
/** BE03b `VersionSet`: the exact frozen dependency set shared by 03B-08 and 03B-09. */
export const VersionSetSchema = z
  .strictObject({
    schemaVersionId: CmsUuidSchema,
    schemaHash: CmsHashSchema,
    schemaArtifact: SchemaArtifactEvidenceSchema,
    validatorRefs: ProtectedValidatorRefsSchema,
    workflowPolicy: WorkflowPolicyEvidenceSchema,
    activationEvidence: WorkflowPolicyEvidenceSchema,
    templateVersionId: CmsUuidSchema.nullable(),
    templateHash: CmsHashSchema.nullable(),
    taxonomyVersionIds: uniqueIdList(64),
    blockVersionIds: uniqueIdList(128),
    patternVersionIds: uniqueIdList(128),
    settingsVersion: CmsVersionSchema,
    compilerVersion: z.string().min(1).max(32),
  })
  .superRefine((value, context) => {
    if (value.schemaArtifact.contentTypeVersionId !== value.schemaVersionId)
      context.addIssue({
        code: 'custom',
        path: ['schemaArtifact', 'contentTypeVersionId'],
        message: 'version_set_schema_artifact_must_bind_schema_version',
      });
    if (value.schemaArtifact.compilerVersion !== value.compilerVersion)
      context.addIssue({
        code: 'custom',
        path: ['compilerVersion'],
        message: 'version_set_compiler_must_match_schema_artifact',
      });
    if ((value.templateVersionId === null) !== (value.templateHash === null))
      context.addIssue({
        code: 'custom',
        path: ['templateVersionId'],
        message: 'version_set_template_id_and_hash_are_all_or_nothing',
      });
  })
  .readonly();

/** BE03b `DependencyManifest`: the frozen 03B-05 candidate dependency evidence. */
export const DependencyManifestSchema = z
  .strictObject({
    schema: z
      .strictObject({
        id: CmsUuidSchema,
        hash: CmsHashSchema,
        schemaArtifact: SchemaArtifactEvidenceSchema,
        validatorRefs: ProtectedValidatorRefsSchema,
        workflowPolicy: WorkflowPolicyEvidenceSchema,
        activationEvidence: WorkflowPolicyEvidenceSchema,
      })
      .superRefine((value, context) => {
        if (value.schemaArtifact.contentTypeVersionId !== value.id)
          context.addIssue({
            code: 'custom',
            path: ['schemaArtifact', 'contentTypeVersionId'],
            message: 'manifest_schema_artifact_must_bind_schema_version',
          });
      })
      .readonly(),
    template: z
      .strictObject({ id: CmsUuidSchema, hash: CmsHashSchema })
      .nullable(),
    blocks: z
      .array(
        z.strictObject({ id: CmsUuidSchema, hash: CmsHashSchema }).readonly(),
      )
      .max(128)
      .readonly(),
    patterns: z
      .array(
        z.strictObject({ id: CmsUuidSchema, hash: CmsHashSchema }).readonly(),
      )
      .max(128)
      .readonly(),
    terms: z
      .array(
        z.strictObject({ id: CmsUuidSchema, hash: CmsHashSchema }).readonly(),
      )
      .max(256)
      .readonly(),
    localeSources: z
      .array(
        z
          .strictObject({
            locale: Bcp47Schema,
            revisionId: CmsUuidSchema,
            hash: CmsHashSchema,
          })
          .readonly(),
      )
      .max(32)
      .readonly(),
    settings: z
      .strictObject({ version: CmsVersionSchema, hash: CmsHashSchema })
      .readonly(),
    relations: z
      .array(
        z
          .strictObject({
            fieldId: CmsUuidSchema,
            targetId: CmsUuidSchema,
            targetVersion: CmsVersionSchema,
          })
          .readonly(),
      )
      .max(128)
      .readonly(),
    checker: z
      .strictObject({
        key: z.string().min(1).max(64),
        version: CmsVersionSchema,
      })
      .readonly(),
  })
  .superRefine((value, context) => {
    const bytes = new TextEncoder().encode(JSON.stringify(value)).byteLength;
    if (bytes > CMS_DEPENDENCY_MANIFEST_MAX_BYTES)
      context.addIssue({
        code: 'custom',
        message: 'dependency_manifest_max_bytes',
      });
    const entries =
      value.schema.validatorRefs.length +
      value.blocks.length +
      value.patterns.length +
      value.terms.length +
      value.localeSources.length +
      value.relations.length +
      // schema, settings and checker are always present; template may be null.
      3 +
      (value.template === null ? 0 : 1);
    if (entries > CMS_DEPENDENCY_MANIFEST_MAX_ENTRIES)
      context.addIssue({
        code: 'custom',
        message: 'dependency_manifest_max_entries',
      });
    // A duplicate entry could hide a missing one, so each group names every
    // identity once.
    for (const [group, distinct] of [
      ['blocks', allDistinct(value.blocks, (entry) => entry.id)],
      ['patterns', allDistinct(value.patterns, (entry) => entry.id)],
      ['terms', allDistinct(value.terms, (entry) => entry.id)],
      [
        'localeSources',
        allDistinct(value.localeSources, (entry) => entry.locale),
      ],
      [
        'relations',
        allDistinct(
          value.relations,
          (entry) => `${entry.fieldId}:${entry.targetId}`,
        ),
      ],
    ] as const)
      if (!distinct)
        context.addIssue({
          code: 'custom',
          path: [group],
          message: 'dependency_manifest_entries_must_be_unique',
        });
  })
  .readonly();

/**
 * BE03b `ReviewSubmissionRequest`: the CMS-03B-05 body. The frozen hash and
 * dependency manifest are echoed from the served preparation and the runtime
 * revalidates both; ownership and capability are server-derived, so the body
 * carries neither. `riskClass` is likewise server-derived from the frozen
 * workflow-policy evidence, and a caller-supplied `riskClass` is an unknown
 * key.
 */
export const ReviewSubmissionRequestSchema = z
  .strictObject({
    entryId: CmsUuidSchema,
    revisionId: CmsUuidSchema,
    frozenHash: CmsHashSchema,
    dependencyManifest: DependencyManifestSchema,
  })
  .readonly();

/** BE03b CMS-03B-05 addressing: the entry under review. */
export const CmsEditorialReviewSubmissionPathParamsSchema = z
  .strictObject({ entryId: CmsUuidSchema })
  .readonly();

/** BE03b CMS-03B-05 headers: key + exact strong If-Match over JSON. */
export const CmsEditorialReviewSubmissionHeadersSchema = z
  .strictObject({
    contentType: z.literal('application/json'),
    idempotencyKey: IdempotencyKeySchema,
    ifMatch: QuotedVersionSchema,
  })
  .readonly();

/** BE03b CMS-03B-06 addressing: the review receiving the decision. */
export const CmsEditorialDecisionPathParamsSchema = z
  .strictObject({ reviewId: CmsUuidSchema })
  .readonly();

/**
 * The authority names CMS-03B-05 must never accept from a caller: the risk
 * class and submitter identity are derived from the frozen policy and the
 * authenticated principal. An empty strict object proves the closed set.
 */
export const CmsEditorialForbiddenServerDerivedSchema = z
  .strictObject({})
  .readonly();

/**
 * The authority names CMS-03B-06 must never accept from a caller: the MFA
 * instant and the satisfied reviewer capability are both server-derived.
 */
export const CmsEditorialDecisionForbiddenServerDerivedSchema = z
  .strictObject({})
  .readonly();

/** BE03b decision reason: 1 to 2000 safe Unicode characters (code points). */
export const CMS_DECISION_REASON_MAX_CHARACTERS = 2000;

/**
 * Control characters, line and paragraph separators and the bidirectional
 * formatting characters (U+200E/F, U+202A-E, U+2066-9, U+061C) are never safe
 * in a stored reviewer reason: they hide or reorder text on screen.
 */
const UNSAFE_REASON_CHARACTER_PATTERN =
  /[\p{Cc}\u2028\u2029\u200E\u200F\u061C\u202A-\u202E\u2066-\u2069]/u;

/**
 * BE03b `EditorialDecisionRequest.reason`. The length counts Unicode
 * characters (code points, BE03a), never UTF-16 units, so 2000 emoji are
 * accepted and 2001 refused. The text must already be NFC (it is refused, never
 * silently normalized, so the stored and hashed reason is exactly what the
 * reviewer submitted), must carry no control or bidirectional formatting
 * character, and must not contain markup delimiters.
 */
export const DecisionReasonSchema = z
  .string()
  .min(1)
  // A code point is at most two UTF-16 units: cheap bound before the exact count.
  .max(CMS_DECISION_REASON_MAX_CHARACTERS * 2)
  .refine(
    (value) => Array.from(value).length <= CMS_DECISION_REASON_MAX_CHARACTERS,
    'reason_too_long',
  )
  .refine((value) => value === value.normalize('NFC'), 'reason_must_be_nfc')
  .refine(
    (value) => !UNSAFE_REASON_CHARACTER_PATTERN.test(value),
    'reason_control_or_bidi_characters',
  )
  .refine((value) => !/[<>{}]/u.test(value), 'reason_unsafe_characters');

/**
 * BE03b `EditorialDecisionRequest`: the CMS-03B-06 body. `stepUpAt` and
 * `capability` are deliberately absent: the caller supplies neither, and
 * every decision requires server-verified recent binding-bound MFA and the
 * eligible assigned-reviewer capability.
 */
export const EditorialDecisionRequestSchema = z
  .strictObject({
    reviewId: CmsUuidSchema,
    decision: z.enum(['approve', 'reject']),
    reason: DecisionReasonSchema,
    expectedVersion: CmsVersionSchema,
  })
  .readonly();

/**
 * Implementation checklist only. These are the checks the CMS-03B-05 runtime
 * must perform against the live registry and store; the names are NOT
 * attestation labels and this array is NOT proof that any check ran.
 */
export const CMS_REVIEW_SUBMISSION_SEAMS = [
  'frozen_hash_equals_normalized_revision_hash',
  'dependency_manifest_resolves_to_live_registry',
  'one_open_review_per_revision',
] as const;

export { WorkflowPolicyEvidenceSchema };

export type VersionSet = z.infer<typeof VersionSetSchema>;
export type DependencyManifest = z.infer<typeof DependencyManifestSchema>;
export type ReviewSubmissionRequest = z.infer<
  typeof ReviewSubmissionRequestSchema
>;
export type EditorialDecisionRequest = z.infer<
  typeof EditorialDecisionRequestSchema
>;
