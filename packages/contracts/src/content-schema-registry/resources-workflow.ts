import { z } from 'zod';

import {
  CmsCapabilityKeySchema,
  CmsHashSchema,
  CmsInstantSchema,
  CmsUuidSchema,
  CmsVersionSchema,
} from './primitives.ts';
import {
  CmsCompatibilitySchema,
  CmsSchemaDryRunFailureCodeSchema,
  CmsSchemaDryRunResultSchema,
  CmsSchemaDryRunStateSchema,
  CmsSchemaReviewAssignmentActionSchema,
  CmsSchemaReviewDecisionSchema,
  CmsSchemaReviewNextActionSchema,
  CmsSchemaReviewRiskClassSchema,
  CmsSchemaReviewStateSchema,
} from './models.ts';
import { resourceMetaShape } from './resources-meta.ts';

const CmsSchemaDryRunJobStateSchema = z.enum([
  'queued',
  'running',
  'retrying',
  'completed',
  'failed_retryable',
  'failed_terminal',
]);

const NullableCountSchema = z.number().int().nonnegative().nullable();

export const SchemaDryRunResourceSchema = z
  .strictObject({
    ...resourceMetaShape,
    resourceKind: z.literal('schema_dry_run'),
    state: CmsSchemaDryRunStateSchema,
    contentTypeVersionId: CmsUuidSchema,
    classification: CmsCompatibilitySchema,
    attemptId: CmsUuidSchema,
    jobId: CmsUuidSchema,
    migrationPlanId: CmsUuidSchema,
    compilerVersion: z.string().min(1).max(32),
    transformKey: z.string().regex(/^[a-z][a-z0-9._-]{0,127}$/u).nullable(),
    transformVersion: CmsVersionSchema.nullable(),
    result: CmsSchemaDryRunResultSchema.nullable(),
    failureCode: CmsSchemaDryRunFailureCodeSchema.nullable(),
    sourceCount: NullableCountSchema,
    targetCount: NullableCountSchema,
    rowErrorCount: NullableCountSchema,
    sourceHash: CmsHashSchema.nullable(),
    targetHash: CmsHashSchema.nullable(),
    reportHash: CmsHashSchema.nullable(),
  })
  .superRefine((value, context) => {
    const sealed = value.state === 'completed';
    const sealedFields = [
      value.result,
      value.sourceCount,
      value.targetCount,
      value.rowErrorCount,
      value.sourceHash,
      value.targetHash,
      value.reportHash,
    ];
    if (sealed && sealedFields.some((field) => field === null))
      context.addIssue({
        code: 'custom',
        path: ['state'],
        message: 'completed_dry_run_requires_sealed_evidence',
      });
    if (!sealed && sealedFields.some((field) => field !== null))
      context.addIssue({
        code: 'custom',
        path: ['state'],
        message: 'unsealed_dry_run_forbids_final_evidence',
      });
    if (
      sealed &&
      value.result === 'passed' &&
      value.rowErrorCount !== 0
    )
      context.addIssue({
        code: 'custom',
        path: ['rowErrorCount'],
        message: 'passed_dry_run_requires_zero_row_error_count',
      });
    if (
      sealed &&
      value.result === 'failed' &&
      (value.rowErrorCount ?? 0) === 0
    )
      context.addIssue({
        code: 'custom',
        path: ['rowErrorCount'],
        message: 'sealed_failed_dry_run_requires_row_errors',
      });
    if (value.state === 'failed' && value.failureCode === null)
      context.addIssue({
        code: 'custom',
        path: ['failureCode'],
        message: 'unsealed_failed_dry_run_requires_failure_code',
      });
    if (value.state !== 'failed' && value.failureCode !== null)
      context.addIssue({
        code: 'custom',
        path: ['failureCode'],
        message: 'only_failed_dry_run_carries_failure_code',
      });
  })
  .readonly();

export const SchemaReviewFrozenEvidenceSchema = z
  .strictObject({
    contentTypeVersionId: CmsUuidSchema,
    contentTypeVersionNo: CmsVersionSchema,
    definitionHash: CmsHashSchema,
    schemaArtifact: z
      .strictObject({
        id: CmsUuidSchema,
        state: z.literal('compiled'),
        compilerVersion: z.string().min(1).max(32),
        zodContractRef: z.string().min(1).max(256),
        artifactHash: CmsHashSchema,
      })
      .readonly(),
    dependencyManifestHash: CmsHashSchema,
    dryRun: z
      .strictObject({
        id: CmsUuidSchema,
        state: CmsSchemaDryRunStateSchema,
        result: CmsSchemaDryRunResultSchema.nullable(),
        reportHash: CmsHashSchema.nullable(),
      })
      .readonly(),
  })
  .readonly();

export const SchemaReviewDecisionSummarySchema = z
  .strictObject({
    id: CmsUuidSchema,
    decision: CmsSchemaReviewDecisionSchema,
    capability: CmsCapabilityKeySchema,
    decidedAt: CmsInstantSchema,
  })
  .readonly();

export const SchemaReviewResourceSchema = z
  .strictObject({
    ...resourceMetaShape,
    resourceKind: z.literal('schema_review'),
    state: CmsSchemaReviewStateSchema,
    contentTypeId: CmsUuidSchema,
    contentTypeVersionId: CmsUuidSchema,
    contentTypeVersionNo: CmsVersionSchema,
    riskClass: CmsSchemaReviewRiskClassSchema,
    requiredDecisionCount: z.number().int().min(1).max(8),
    requiredCapabilities: z
      .array(CmsCapabilityKeySchema)
      .min(1)
      .max(16)
      .readonly(),
    distinctApprovalCount: z.number().int().nonnegative(),
    recordedDecisionCount: z.number().int().nonnegative(),
    frozenEvidence: SchemaReviewFrozenEvidenceSchema,
    dryRunId: CmsUuidSchema,
    policyKey: z.string().regex(/^[a-z][a-z0-9._-]{0,127}$/u),
    policyVersion: CmsVersionSchema,
    policyHash: CmsHashSchema,
    approvalEvidenceHash: CmsHashSchema.nullable(),
    submittedAt: CmsInstantSchema,
    decidedAt: CmsInstantSchema.nullable(),
    decisions: z.array(SchemaReviewDecisionSummarySchema).max(8).readonly(),
    permittedNextActions: z
      .array(CmsSchemaReviewNextActionSchema)
      .max(6)
      .readonly(),
  })
  .superRefine((value, context) => {
    const approves = value.decisions.filter(
      (decision) => decision.decision === 'approve',
    ).length;
    const decisionIds = new Set(value.decisions.map((decision) => decision.id));
    if (decisionIds.size !== value.decisions.length)
      context.addIssue({
        code: 'custom',
        path: ['decisions'],
        message: 'review_decision_references_must_be_unique',
      });
    if (value.recordedDecisionCount !== value.decisions.length)
      context.addIssue({
        code: 'custom',
        path: ['recordedDecisionCount'],
        message: 'recorded_decision_count_must_equal_references',
      });
    if (value.decisions.length > 8)
      context.addIssue({
        code: 'custom',
        path: ['decisions'],
        message: 'review_decisions_exceed_bound',
      });
    if (value.distinctApprovalCount > approves)
      context.addIssue({
        code: 'custom',
        path: ['distinctApprovalCount'],
        message: 'distinct_approvers_cannot_exceed_recorded_approvals',
      });
    if (
      value.state === 'approved' &&
      value.distinctApprovalCount !== value.requiredDecisionCount
    )
      context.addIssue({
        code: 'custom',
        path: ['state'],
        message: 'approved_review_requires_exact_policy_count',
      });
    if (
      value.state === 'approved' &&
      value.decisions.some((decision) => decision.decision === 'reject')
    )
      context.addIssue({
        code: 'custom',
        path: ['state'],
        message: 'rejected_review_cannot_be_approved',
      });
    if ((value.state === 'approved') !== (value.approvalEvidenceHash !== null))
      context.addIssue({
        code: 'custom',
        path: ['approvalEvidenceHash'],
        message: 'approval_evidence_hash_only_when_approved',
      });
    if ((value.state === 'approved') !== (value.decidedAt !== null))
      context.addIssue({
        code: 'custom',
        path: ['decidedAt'],
        message: 'decided_at_only_when_approved',
      });
  })
  .readonly();

export const SchemaReviewDecisionResourceSchema = z
  .strictObject({
    ...resourceMetaShape,
    resourceKind: z.literal('schema_review_decision'),
    reviewId: CmsUuidSchema,
    decision: CmsSchemaReviewDecisionSchema,
    capability: CmsCapabilityKeySchema,
    decidedAt: CmsInstantSchema,
  })
  .readonly();

export const SchemaReviewAssignmentResourceSchema = z
  .strictObject({
    ...resourceMetaShape,
    resourceKind: z.literal('schema_review_assignment'),
    reviewId: CmsUuidSchema,
    state: z.enum(['active', 'revoked']),
    capability: z.literal('cms.schema_review'),
    actions: z.tuple([
      z.literal(CmsSchemaReviewAssignmentActionSchema.options[0]),
      z.literal(CmsSchemaReviewAssignmentActionSchema.options[1]),
    ]),
    startsAt: CmsInstantSchema,
    expiresAt: CmsInstantSchema,
    reason: z.string().min(1).max(256).nullable(),
  })
  .readonly();

export const SchemaActivationPreparationSchema = z
  .strictObject({
    dryRunRef: z
      .strictObject({
        id: CmsUuidSchema,
        state: CmsSchemaDryRunStateSchema,
        result: CmsSchemaDryRunResultSchema.nullable(),
        jobId: CmsUuidSchema.nullable(),
      })
      .nullable(),
    jobRef: z
      .strictObject({
        id: CmsUuidSchema,
        state: CmsSchemaDryRunJobStateSchema,
      })
      .nullable(),
    reviewRef: z
      .strictObject({
        id: CmsUuidSchema,
        state: CmsSchemaReviewStateSchema,
      })
      .nullable(),
    permittedNextActions: z
      .array(CmsSchemaReviewNextActionSchema)
      .max(6)
      .readonly(),
  })
  .readonly();

export type SchemaDryRunResource = z.infer<typeof SchemaDryRunResourceSchema>;
export type SchemaReviewResource = z.infer<typeof SchemaReviewResourceSchema>;
export type SchemaReviewDecisionResource = z.infer<
  typeof SchemaReviewDecisionResourceSchema
>;
export type SchemaReviewAssignmentResource = z.infer<
  typeof SchemaReviewAssignmentResourceSchema
>;
export type SchemaActivationPreparation = z.infer<
  typeof SchemaActivationPreparationSchema
>;
