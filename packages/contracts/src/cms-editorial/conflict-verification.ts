import { z } from 'zod';

import {
  CmsHashSchema,
  CmsUuidSchema,
  CmsVersionSchema,
} from '../content-schema-registry/primitives.ts';
import {
  CONFLICT_RESOLUTION_SEAMS,
  ConflictResolutionRequestSchema,
} from './conflict-resolution.ts';
import { ConflictYoursSourceSchema } from './models.ts';
import { JsonPointerSchema } from './primitives.ts';

/** The revision branch: the yours side became a real revision, referenced by id. */
const conflictRevisionSourceEvidenceSchema = z.strictObject({
  source: ConflictYoursSourceSchema.extract(['revision']),
  yoursRevisionId: CmsUuidSchema,
});

/**
 * The proposed branch: a rejected or late autosave that never became a revision
 * is identified only by the 64-hex hash of its bounded values, with
 * yoursRevisionId null.  The raw values are deliberately absent, so evidence can
 * never leak unpublished draft content.
 */
const conflictProposedSourceEvidenceSchema = z.strictObject({
  source: ConflictYoursSourceSchema.extract(['proposed']),
  yoursRevisionId: z.null(),
  proposedValuesHash: CmsHashSchema,
});

/**
 * Discriminated yours-side evidence.  BE03b permits yours_source='proposed' with
 * a null yoursRevisionId, which a flat nullable id could not distinguish from a
 * malformed revision reference; the union states the coupling directly and
 * refuses a proposed record that also names a revision id.  The union members
 * stay bare strict objects because a discriminated union requires them, so the
 * readonly wrapper sits on the union itself.
 */
export const ConflictYoursSourceEvidenceSchema = z
  .discriminatedUnion('source', [
    conflictRevisionSourceEvidenceSchema,
    conflictProposedSourceEvidenceSchema,
  ])
  .readonly();

/**
 * The closed set of conflict facts a trusted server-side resolve must read
 * before a two-parent revision may be trusted.  A caller cannot supply the
 * conflict hash, the recorded divergent paths, the current versions, or the
 * yours-side source, which is what separates this evidence from a repeated list
 * of seam names.
 */
const conflictResolutionRegistryEvidenceSchema = z
  .strictObject({
    conflictId: CmsUuidSchema,
    conflictVersion: CmsVersionSchema,
    conflictHash: CmsHashSchema,
    baseRevision: CmsVersionSchema,
    baseRevisionId: CmsUuidSchema,
    theirsRevisionId: CmsUuidSchema,
    entryVersion: CmsVersionSchema,
    changedPaths: z.array(JsonPointerSchema).min(1).max(128).readonly(),
    yours: ConflictYoursSourceEvidenceSchema,
  })
  .readonly();

/**
 * Server-produced resolve attestation.  A caller-supplied seam-name list can
 * never satisfy this schema: the accepted input is the conflict-record evidence
 * the runtime actually read, and every choice must fall inside the conflict own
 * recorded divergent paths.  The yours-side source is bound through its
 * discriminated branch rather than a bare nullable id.  A consumer still must
 * cross-check the evidence against the live record read; the shape alone is not
 * authority.
 */
export const ConflictResolutionVerificationSchema = z
  .strictObject({
    request: ConflictResolutionRequestSchema,
    registry: conflictResolutionRegistryEvidenceSchema,
    /** Every checklist name, so the runtime must have considered each one. */
    seams: z
      .array(z.enum([...CONFLICT_RESOLUTION_SEAMS]))
      .length(CONFLICT_RESOLUTION_SEAMS.length)
      .refine(
        (seams) => new Set(seams).size === seams.length,
        'resolution_seams_must_be_unique',
      )
      .readonly(),
  })
  .refine(
    ({ request, registry }) =>
      registry.conflictId === request.conflictId &&
      registry.baseRevision === request.baseRevision &&
      registry.entryVersion === request.expectedVersion &&
      request.choices.every(({ path }) => registry.changedPaths.includes(path)),
    'conflict_evidence_must_match_request',
  )
  .readonly();

export type ConflictYoursSourceEvidence = z.infer<
  typeof ConflictYoursSourceEvidenceSchema
>;
export type ConflictResolutionVerification = z.infer<
  typeof ConflictResolutionVerificationSchema
>;
