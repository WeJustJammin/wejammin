import { z } from 'zod';

import { JsonValueSchema } from '../api-error.ts';
import {
  CapabilityBindingInputSchema,
  CmsDefaultModeSchema,
  CmsFieldKindSchema,
  CmsFieldLifecycleSchema,
  CmsLocalizationModeSchema,
  CmsSchemaReviewDecisionSchema,
  FieldConstraintsSchema,
  FieldDefinitionInputSchema,
  FieldEditorConfigSchema,
  RelationBindingInputSchema,
  TemplateBindingInputSchema,
} from './models.ts';
import {
  CmsCapabilityKeySchema,
  CmsFieldKeySchema,
  CmsHashSchema,
  CmsInstantSchema,
  CmsLocaleSchema,
  CmsUuidSchema,
  CmsValidatorKeySchema,
  CmsWorkflowKeySchema,
  CmsVersionSchema,
} from './primitives.ts';

export const ContentTypeDraftRequestSchema = z
  .strictObject({
    typeKey: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/u),
    label: z.string().trim().min(2).max(120),
    ownerCapability: CmsCapabilityKeySchema,
    sourceLocale: CmsLocaleSchema,
    defaultLocale: CmsLocaleSchema,
    workflowKey: CmsWorkflowKeySchema,
    workflowVersion: CmsVersionSchema,
    defaultTemplateVersionId: CmsUuidSchema.nullable(),
    fields: z.array(FieldDefinitionInputSchema).max(128).readonly(),
    relations: z.array(RelationBindingInputSchema).max(128).readonly(),
    templateBindings: z.array(TemplateBindingInputSchema).max(32).readonly(),
    capabilityBindings: z
      .array(CapabilityBindingInputSchema)
      .max(32)
      .readonly(),
  })
  .readonly();

export const FieldSchemaChangeRequestSchema = z
  .strictObject({
    stableFieldId: CmsUuidSchema.optional(),
    key: CmsFieldKeySchema,
    kind: CmsFieldKindSchema,
    constraints: FieldConstraintsSchema,
    required: z.boolean(),
    validatorKey: CmsValidatorKeySchema.nullable(),
    validatorVersion: CmsVersionSchema.nullable(),
    defaultMode: CmsDefaultModeSchema,
    defaultValue: JsonValueSchema.nullable().optional(),
    localizationMode: CmsLocalizationModeSchema,
    editorConfig: FieldEditorConfigSchema,
    lifecycle: CmsFieldLifecycleSchema,
    migrationPlanId: CmsUuidSchema.nullable(),
  })
  .superRefine((value, context) => {
    const base = {
      stableFieldId:
        value.stableFieldId ?? '123e4567-e89b-42d3-a456-426614174000',
      key: value.key,
      kind: value.kind,
      constraints: value.constraints,
      required: value.required,
      validatorKey: value.validatorKey,
      validatorVersion: value.validatorVersion,
      defaultMode: value.defaultMode,
      ...(Object.hasOwn(value, 'defaultValue')
        ? { defaultValue: value.defaultValue }
        : {}),
      localizationMode: value.localizationMode,
      editorConfig: value.editorConfig,
      lifecycle: value.lifecycle,
    };
    const parsed = FieldDefinitionInputSchema.safeParse(base);
    if (!parsed.success)
      for (const issue of parsed.error.issues)
        context.addIssue({
          code: 'custom',
          path: issue.path,
          message: issue.message,
        });
  })
  .readonly();

export const SchemaActivationRequestSchema = z
  .strictObject({
    expectedVersion: CmsVersionSchema,
    dryRunId: CmsUuidSchema,
    approvalIds: z.array(CmsUuidSchema).min(1).max(8).readonly(),
    expectedActivationEvidenceHash: CmsHashSchema.optional(),
    migrationPlanId: CmsUuidSchema.nullable(),
  })
  .superRefine((value, context) => {
    if (new Set(value.approvalIds).size !== value.approvalIds.length)
      context.addIssue({
        code: 'custom',
        path: ['approvalIds'],
        message: 'approval_ids_must_be_distinct',
      });
  })
  .readonly();

export const SchemaSuccessorRequestSchema = z
  .strictObject({
    expectedVersion: CmsVersionSchema,
  })
  .readonly();

export const SchemaDryRunRequestSchema = z
  .strictObject({
    expectedVersion: CmsVersionSchema,
    transformKey: CmsValidatorKeySchema.nullable(),
    transformVersion: CmsVersionSchema.nullable(),
  })
  .superRefine((value, context) => {
    if ((value.transformKey === null) !== (value.transformVersion === null))
      context.addIssue({
        code: 'custom',
        path: ['transformVersion'],
        message: 'transform_pair_must_be_both_present_or_both_absent',
      });
  })
  .readonly();

export const SchemaReviewSubmissionRequestSchema = z
  .strictObject({
    expectedVersion: CmsVersionSchema,
    dryRunId: CmsUuidSchema,
  })
  .readonly();

export const SchemaReviewDecisionRequestSchema = z
  .strictObject({
    expectedVersion: CmsVersionSchema,
    decision: CmsSchemaReviewDecisionSchema,
  })
  .readonly();

const SchemaReviewAssignmentReasonSchema = z.string().min(1).max(256);

export const SchemaReviewAssignmentRequestSchema = z
  .discriminatedUnion('action', [
    z
      .strictObject({
        action: z.literal('create'),
        expectedVersion: CmsVersionSchema,
        reviewerPersonId: CmsUuidSchema,
        expiresAt: CmsInstantSchema,
        reason: SchemaReviewAssignmentReasonSchema.optional(),
      })
      .readonly(),
    z
      .strictObject({
        action: z.literal('revoke'),
        expectedVersion: CmsVersionSchema,
        assignmentId: CmsUuidSchema,
        reason: SchemaReviewAssignmentReasonSchema.optional(),
      })
      .readonly(),
  ])
  .readonly();
