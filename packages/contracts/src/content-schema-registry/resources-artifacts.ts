import { z } from 'zod';

import { WorkflowPolicyEvidenceSchema } from './models.ts';
import {
  CmsArtifactRefSchema,
  CmsHashSchema,
  CmsInstantSchema,
  CmsUuidSchema,
  CmsVersionSchema,
} from './primitives.ts';
import { resourceMetaShape } from './resources-meta.ts';

export const SchemaArtifactResourceSchema = z
  .strictObject({
    resourceKind: z.literal('schema_artifact'),
    id: CmsUuidSchema,
    version: CmsVersionSchema,
    state: z.literal('compiled'),
    contentTypeVersionId: CmsUuidSchema,
    compilerVersion: z.string().min(1).max(32),
    zodContractRef: CmsArtifactRefSchema,
    artifactHash: CmsHashSchema,
    createdAt: CmsInstantSchema,
    updatedAt: CmsInstantSchema,
    compiledAt: CmsInstantSchema,
  })
  .readonly();

export const SchemaActivationResourceSchema = z
  .strictObject({
    ...resourceMetaShape,
    state: z.literal('active'),
    contentTypeVersionId: CmsUuidSchema,
    activatedAt: CmsInstantSchema.nullable(),
    migrationPlanId: CmsUuidSchema.nullable(),
    localeConfigHash: CmsHashSchema,
    activationEvidence: WorkflowPolicyEvidenceSchema,
    jobId: CmsUuidSchema.nullable(),
    eventType: z.literal('cms.schema.activated.v1'),
  })
  .readonly();

/**
 * `cms.schema.activated.v1` outbox payload. `localeConfigHash` is recomputed
 * from the activated candidate row (BE03a OD-4), never copied from a request.
 */
export const SchemaActivatedEventPayloadSchema = z
  .strictObject({
    contentTypeId: CmsUuidSchema,
    schemaVersionId: CmsUuidSchema,
    migrationPlanId: CmsUuidSchema.nullable(),
    localeConfigHash: CmsHashSchema,
    activationEvidence: WorkflowPolicyEvidenceSchema,
  })
  .readonly();
