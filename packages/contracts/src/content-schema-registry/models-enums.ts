import { z } from 'zod';

export const CmsFieldKindSchema = z.enum([
  'short_text',
  'long_text',
  'rich_text',
  'boolean',
  'integer',
  'decimal',
  'date',
  'datetime',
  'enum',
  'taxonomy',
  'relation',
  'media',
  'object',
  'list',
]);
export const CmsDefinitionStateSchema = z.enum([
  'draft',
  'review',
  'approved',
  'scheduled',
  'active',
  'superseded',
  'retired',
  'blocked',
]);
export const CmsFieldLifecycleSchema = z.enum([
  'active',
  'deprecated',
  'retired',
]);
export const CmsBlockLifecycleSchema = z.enum([
  'supported',
  'deprecated',
  'withdrawn',
]);
export const CmsCompatibilitySchema = z.enum([
  'additive',
  'conditional',
  'breaking',
  'unknown',
]);
export const CmsDefaultModeSchema = z.enum(['none', 'literal', 'inherited']);
export const CmsLocalizationModeSchema = z.enum([
  'none',
  'localized',
  'no_fallback',
]);
export const CmsSchemaDryRunStateSchema = z.enum([
  'queued',
  'running',
  'completed',
  'failed',
]);
export const CmsSchemaReviewStateSchema = z.enum([
  'open',
  'approved',
  'rejected',
  'invalidated',
]);
export const CmsSchemaReviewDecisionSchema = z.enum(['approve', 'reject']);
export const CmsSchemaReviewAssignmentStateSchema = z.enum([
  'active',
  'revoked',
]);
export const CmsSchemaReviewNextActionSchema = z.enum([
  'create_successor',
  'start_dry_run',
  'submit_review',
  'assign_reviewer',
  'record_decision',
  'activate',
]);
export const CmsSchemaReviewAssignmentActionSchema = z.enum(['read', 'decide']);
export const CmsSchemaDryRunResultSchema = z.enum(['passed', 'failed']);
export const CmsSchemaDryRunFailureCodeSchema = z
  .string()
  .regex(/^[A-Z][A-Z0-9_]{0,63}$/u, 'dry_run_failure_code_invalid');
export const CmsSchemaReviewRiskClassSchema = z.enum(['ordinary', 'protected']);

export type CmsFieldKind = z.infer<typeof CmsFieldKindSchema>;
export type CmsDefinitionState = z.infer<typeof CmsDefinitionStateSchema>;
export type CmsBlockLifecycle = z.infer<typeof CmsBlockLifecycleSchema>;
export type CmsSchemaDryRunState = z.infer<typeof CmsSchemaDryRunStateSchema>;
export type CmsSchemaReviewState = z.infer<typeof CmsSchemaReviewStateSchema>;
export type CmsSchemaReviewDecision = z.infer<
  typeof CmsSchemaReviewDecisionSchema
>;
export type CmsSchemaReviewNextAction = z.infer<
  typeof CmsSchemaReviewNextActionSchema
>;
