import { z } from 'zod';

import {
  CmsCapabilityKeySchema,
  CmsHashSchema,
  CmsLabelSchema,
  CmsTypeKeySchema,
  CmsUuidSchema,
  CmsWorkflowKeySchema,
  CmsVersionSchema,
  CmsInstantSchema,
} from './primitives.ts';
import {
  CmsCompatibilitySchema,
  WorkflowPolicyEvidenceSchema,
} from './models.ts';
import {
  CmsCanonicalLocaleSchema,
  CmsFallbackChainsSchema,
  CmsSupportedLocalesSchema,
  refineLocaleConfig,
} from './locale-config.ts';
import { resourceMetaShape } from './resources-meta.ts';

export const ContentTypeResourceSchema = z
  .strictObject({
    resourceKind: z.literal('content_type'),
    id: CmsUuidSchema,
    version: CmsVersionSchema,
    typeKey: CmsTypeKeySchema,
    builtIn: z.boolean(),
    lifecycle: z.enum(['active', 'retired']),
    createdAt: CmsInstantSchema,
    updatedAt: CmsInstantSchema,
  })
  .readonly();

export const ContentTypeVersionStateSchema = z.enum([
  'draft',
  'review',
  'approved',
  'scheduled',
  'active',
  'superseded',
  'retired',
  'blocked',
]);

export const ContentTypeVersionResourceSchema = z
  .strictObject({
    ...resourceMetaShape,
    resourceKind: z.literal('content_type_version'),
    state: ContentTypeVersionStateSchema,
    contentTypeId: CmsUuidSchema,
    typeKey: CmsTypeKeySchema,
    label: CmsLabelSchema,
    ownerCapability: CmsCapabilityKeySchema,
    sourceLocale: CmsCanonicalLocaleSchema,
    defaultLocale: CmsCanonicalLocaleSchema,
    supportedLocales: CmsSupportedLocalesSchema,
    fallbackChains: CmsFallbackChainsSchema,
    localeConfigHash: CmsHashSchema,
    workflowKey: CmsWorkflowKeySchema,
    workflowVersion: CmsVersionSchema,
    defaultTemplateVersionId: CmsUuidSchema.nullable(),
    schemaArtifactId: CmsUuidSchema,
    fieldCount: z.number().int().nonnegative().max(128),
    relationCount: z.number().int().nonnegative().max(128),
    capabilityBindingCount: z.number().int().nonnegative().max(32),
    compatibility: CmsCompatibilitySchema,
    dryRunId: CmsUuidSchema.nullable(),
    activationEvidence: WorkflowPolicyEvidenceSchema.nullable(),
  })
  .superRefine((value, context) => {
    refineLocaleConfig(value, context);
    if (
      ['active', 'superseded', 'retired'].includes(value.state) &&
      value.activationEvidence === null
    )
      context.addIssue({
        code: 'custom',
        path: ['activationEvidence'],
        message: 'activation_evidence_required',
      });
  })
  .readonly();
