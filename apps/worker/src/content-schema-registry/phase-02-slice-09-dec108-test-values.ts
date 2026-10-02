/**
 * DEC-108 (CMS-03A-09..14) Worker fixtures. Every resource below is parsed
 * against the completed `@wejammin/contracts` schema at module load, so a drifted
 * fixture fails loudly instead of masking a Worker defect.
 */
import {
  ContentSchemaRegistryDetailSchema,
  SchemaDryRunResourceSchema,
  SchemaReviewAssignmentResourceSchema,
  SchemaReviewDecisionResourceSchema,
  SchemaReviewResourceSchema,
} from '@wejammin/contracts';

import {
  CMS_ORIGIN,
  DRY_RUN_ID,
  HASH,
  TYPE_ID,
  VERSION_ID,
  detail,
  resource,
} from './phase-02-slice-09-test-values';

export { CMS_ORIGIN, HASH, TYPE_ID, VERSION_ID, DRY_RUN_ID };

export const REVIEW_ID = 'a1000000-0000-4000-8000-0000000000a1';
export const ASSIGNMENT_ID = 'a2000000-0000-4000-8000-0000000000a2';
export const REVIEWER_PERSON_ID = 'a3000000-0000-4000-8000-0000000000a3';
export const ACTING_CONTEXT_ID = 'a4000000-0000-4000-8000-0000000000a4';
export const JOB_ID = 'a5000000-0000-4000-8000-0000000000a5';
export const PLAN_ID = 'a6000000-0000-4000-8000-0000000000a6';
export const ATTEMPT_ID = 'a7000000-0000-4000-8000-0000000000a7';
export const DECISION_ID = 'a8000000-0000-4000-8000-0000000000a8';
export const SESSION_ID = 'a9000000-0000-4000-8000-0000000000a9';
export const INSTANT = '2026-10-02T12:00:00.000Z';
const HASH_B = 'b'.repeat(64);

const meta = (id: string, version = '1') => ({
  id,
  version,
  contentHash: HASH,
  createdAt: INSTANT,
  updatedAt: INSTANT,
});

export const successorResource = resource;

export const dryRunResource = SchemaDryRunResourceSchema.parse({
  ...meta(DRY_RUN_ID),
  resourceKind: 'schema_dry_run',
  state: 'queued',
  contentTypeVersionId: VERSION_ID,
  classification: 'additive',
  attemptId: ATTEMPT_ID,
  jobId: JOB_ID,
  migrationPlanId: PLAN_ID,
  compilerVersion: 'compiler-1',
  transformKey: null,
  transformVersion: null,
  result: null,
  failureCode: null,
  sourceCount: null,
  targetCount: null,
  rowErrorCount: null,
  sourceHash: null,
  targetHash: null,
  reportHash: null,
});

const frozenEvidence = {
  contentTypeVersionId: VERSION_ID,
  contentTypeVersionNo: '2',
  definitionHash: HASH,
  schemaArtifact: {
    id: PLAN_ID,
    state: 'compiled' as const,
    compilerVersion: 'compiler-1',
    zodContractRef: 'cms/article/v2',
    artifactHash: HASH_B,
  },
  dependencyManifestHash: HASH,
  dryRun: {
    id: DRY_RUN_ID,
    state: 'completed' as const,
    result: 'passed' as const,
    reportHash: HASH_B,
  },
};

export const reviewResource = SchemaReviewResourceSchema.parse({
  ...meta(REVIEW_ID),
  resourceKind: 'schema_review',
  state: 'open',
  contentTypeId: TYPE_ID,
  contentTypeVersionId: VERSION_ID,
  contentTypeVersionNo: '2',
  riskClass: 'ordinary',
  requiredDecisionCount: 1,
  requiredCapabilities: ['cms.schema_review'],
  distinctApprovalCount: 0,
  recordedDecisionCount: 0,
  frozenEvidence,
  dryRunId: DRY_RUN_ID,
  policyKey: 'cms.standard',
  policyVersion: '1',
  policyHash: HASH,
  approvalEvidenceHash: null,
  submittedAt: INSTANT,
  decidedAt: null,
  decisions: [],
  permittedNextActions: ['assign_reviewer'],
});

export const decisionResource = SchemaReviewDecisionResourceSchema.parse({
  ...meta(DECISION_ID),
  resourceKind: 'schema_review_decision',
  reviewId: REVIEW_ID,
  decision: 'approve',
  capability: 'cms.schema_review',
  decidedAt: INSTANT,
});

const assignmentBase = {
  ...meta(ASSIGNMENT_ID),
  resourceKind: 'schema_review_assignment' as const,
  reviewId: REVIEW_ID,
  capability: 'cms.schema_review' as const,
  actions: ['read', 'decide'] as const,
  startsAt: INSTANT,
  expiresAt: '2026-10-05T12:00:00.000Z',
  reason: null,
};
export const assignmentCreated = SchemaReviewAssignmentResourceSchema.parse({
  ...assignmentBase,
  state: 'active',
});
export const assignmentRevoked = SchemaReviewAssignmentResourceSchema.parse({
  ...assignmentBase,
  state: 'revoked',
});

export const compatibleTemplate = {
  templateVersionId: PLAN_ID,
  templateKey: 'profile.header',
  templateVersionNo: '2',
  state: 'active' as const,
  compatible: true as const,
  withdrawn: false as const,
  templateDigest: HASH,
  contentTypeId: TYPE_ID,
  contentTypeVersionId: VERSION_ID,
};

export const activationPreparation = {
  dryRunRef: {
    id: DRY_RUN_ID,
    state: 'completed' as const,
    result: 'passed' as const,
    jobId: JOB_ID,
  },
  jobRef: { id: JOB_ID, state: 'succeeded' as const },
  reviewRef: { id: REVIEW_ID, state: 'approved' as const },
  templateCompatibility: compatibleTemplate,
  permittedNextActions: ['activate'] as const,
};

export const detailWithPreparation = ContentSchemaRegistryDetailSchema.parse({
  ...detail,
  activationPreparation,
});

export const successorBody = { expectedVersion: '1' };
export const dryRunBody = {
  expectedVersion: '1',
  transformKey: null,
  transformVersion: null,
};
export const submitBody = { expectedVersion: '1', dryRunId: DRY_RUN_ID };
export const decisionBody = { expectedVersion: '1', decision: 'approve' };
export const assignCreateBody = {
  action: 'create',
  expectedVersion: '1',
  reviewerPersonId: REVIEWER_PERSON_ID,
  expiresAt: '2026-10-05T12:00:00.000Z',
  reason: 'Independent schema review',
};
export const assignRevokeBody = {
  action: 'revoke',
  expectedVersion: '1',
  assignmentId: ASSIGNMENT_ID,
};

export const versionPath = (suffix: string): string =>
  `/api/v1/cms/content-types/${TYPE_ID}/versions/${VERSION_ID}/${suffix}`;
export const reviewPath = (suffix = ''): string =>
  `/api/v1/cms/schema-reviews/${REVIEW_ID}${suffix}`;
