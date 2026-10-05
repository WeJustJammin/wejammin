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
  CmsLabelSchema,
  CmsUuidSchema,
  CmsValidatorKeySchema,
  CmsWorkflowKeySchema,
  CmsVersionSchema,
} from './primitives.ts';
import {
  CmsCanonicalLocaleSchema,
  CmsFallbackChainsSchema,
  CmsSupportedLocalesSchema,
  LOCALE_CONFIG_MESSAGES,
  refineLocaleConfig,
} from './locale-config.ts';
import { TEMPLATE_BINDING_MESSAGES } from './template-binding-messages.ts';

export { TEMPLATE_BINDING_MESSAGES };

/**
 * DEC-123: a brand-new content type carries no template. A compatible template
 * names the type id, which exists only after this command commits, so a default
 * template or a template binding is bound later, through a successor version
 * (CMS-03A-09). The members stay in the strict request so the wire shape is
 * unchanged, but a present value is a 422: `defaultTemplateVersionId` must be
 * null and `templateBindings` empty.
 */
export const ContentTypeDraftRequestSchema = z
  .strictObject({
    typeKey: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/u),
    label: CmsLabelSchema,
    ownerCapability: CmsCapabilityKeySchema,
    sourceLocale: CmsCanonicalLocaleSchema,
    defaultLocale: CmsCanonicalLocaleSchema,
    supportedLocales: CmsSupportedLocalesSchema,
    fallbackChains: CmsFallbackChainsSchema,
    workflowKey: CmsWorkflowKeySchema,
    workflowVersion: CmsVersionSchema,
    defaultTemplateVersionId: z.null(),
    fields: z.array(FieldDefinitionInputSchema).max(128).readonly(),
    relations: z.array(RelationBindingInputSchema).max(128).readonly(),
    templateBindings: z.array(TemplateBindingInputSchema).max(0).readonly(),
    capabilityBindings: z
      .array(CapabilityBindingInputSchema)
      .max(32)
      .readonly(),
  })
  .superRefine((value, context) => {
    refineLocaleConfig(value, context);
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

/**
 * CMS-03A-09 clones the source locale configuration (both fields null) or
 * replaces it (both present). `sourceLocale` and `defaultLocale` are always
 * inherited from the immutable source version, so the Worker validates only
 * what it can see; the database validator owns the inherited-locale rules.
 *
 * DEC-123: the same both-null / both-present pair governs the template
 * members. Both null clones the source default template and template bindings;
 * both present replaces them, which is the only way a type gains its first
 * template (CMS-03A-01 creates a type without one). The compatibility of each
 * referenced template with the type is decided by the database resolver.
 */
export const WORKFLOW_MEMBER_MESSAGES = {
  pair: 'workflowKey and workflowVersion must be both null or both present',
} as const;

/**
 * The database accepts only the canonical lowercase form of an identifier, so
 * the successor's template members refuse any other case before the Worker
 * reaches the database.
 */
const SuccessorTemplateVersionIdSchema = CmsUuidSchema.refine(
  (value) => value === value.toLowerCase(),
  { message: 'template version id must be lowercase' },
);
const SuccessorTemplateBindingSchema = z
  .strictObject({ templateVersionId: SuccessorTemplateVersionIdSchema })
  .readonly();

export const SchemaSuccessorRequestSchema = z
  .strictObject({
    expectedVersion: CmsVersionSchema,
    supportedLocales: CmsSupportedLocalesSchema.nullable(),
    fallbackChains: CmsFallbackChainsSchema.nullable(),
    defaultTemplateVersionId: SuccessorTemplateVersionIdSchema.nullable(),
    templateBindings: z
      .array(SuccessorTemplateBindingSchema)
      .max(32)
      .readonly()
      .nullable(),
    // AC390: both null or absent keeps the source workflow policy member; both
    // present replaces it with a seeded member of the code-owned registry (the
    // database owns the membership check and the strictest-of review rule).
    workflowKey: CmsWorkflowKeySchema.nullable().optional(),
    workflowVersion: CmsVersionSchema.nullable().optional(),
  })
  .superRefine((value, context) => {
    const { supportedLocales, fallbackChains } = value;
    if ((supportedLocales === null) !== (fallbackChains === null))
      context.addIssue({
        code: 'custom',
        path: ['fallbackChains'],
        message: LOCALE_CONFIG_MESSAGES.pair,
      });
    else if (supportedLocales !== null && fallbackChains !== null)
      refineLocaleConfig(
        {
          sourceLocale: null,
          defaultLocale: null,
          supportedLocales,
          fallbackChains,
        },
        context,
      );
    // BE03a OD-4 table order: the locale rules and the locale pair first, then
    // the workflow member pair, then the template binding rules.
    if (
      (value.workflowKey === undefined || value.workflowKey === null) !==
      (value.workflowVersion === undefined || value.workflowVersion === null)
    )
      context.addIssue({
        code: 'custom',
        path: ['workflowVersion'],
        message: WORKFLOW_MEMBER_MESSAGES.pair,
      });
    const { defaultTemplateVersionId, templateBindings } = value;
    if ((defaultTemplateVersionId === null) !== (templateBindings === null))
      context.addIssue({
        code: 'custom',
        path: ['templateBindings'],
        message: TEMPLATE_BINDING_MESSAGES.pair,
      });
    else if (templateBindings !== null) {
      const seen = new Set<string>();
      templateBindings.forEach((binding, index) => {
        const identity = binding.templateVersionId;
        if (seen.has(identity))
          context.addIssue({
            code: 'custom',
            path: ['templateBindings', index, 'templateVersionId'],
            message: TEMPLATE_BINDING_MESSAGES.unique,
          });
        seen.add(identity);
      });
    }
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
        message: 'transform key and version must be both null or both present',
      });
  })
  .readonly();

export const SchemaReviewSubmissionRequestSchema = z
  .strictObject({
    expectedVersion: CmsVersionSchema,
    dryRunId: CmsUuidSchema,
  })
  .readonly();

export const SchemaReviewDetailParamsSchema = z
  .strictObject({ reviewId: CmsUuidSchema })
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
