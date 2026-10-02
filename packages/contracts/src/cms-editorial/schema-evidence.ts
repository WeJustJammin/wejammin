import { z } from 'zod';

import {
  CmsHashSchema,
  CmsUuidSchema,
  CmsValidatorKeySchema,
  CmsVersionSchema,
} from '../content-schema-registry/primitives.ts';

/** BE03b `SchemaArtifactEvidence`: the compiled 03a artifact an entry binds to. */
export const SchemaArtifactEvidenceSchema = z
  .strictObject({
    id: CmsUuidSchema,
    contentTypeVersionId: CmsUuidSchema,
    artifactHash: CmsHashSchema,
    compilerVersion: z.string().min(1).max(32),
    zodContractRef: z.string().min(1).max(256),
  })
  .readonly();

/** BE03b `ValidatorEvidence`: a named, versioned off-registry validator ref. */
export const ValidatorEvidenceSchema = z
  .strictObject({
    key: CmsValidatorKeySchema,
    version: CmsVersionSchema,
  })
  .readonly();

export type SchemaArtifactEvidence = z.infer<
  typeof SchemaArtifactEvidenceSchema
>;
export type ValidatorEvidence = z.infer<typeof ValidatorEvidenceSchema>;
