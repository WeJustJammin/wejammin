/** Valid DEC-108 resource fixtures shared by the Slice 09 contract tests. */
export const uuid = '123e4567-e89b-42d3-a456-426614174000';
export const uuid2 = '123e4567-e89b-42d3-a456-426614174001';
export const uuid3 = '123e4567-e89b-42d3-a456-426614174002';
export const uuid4 = '123e4567-e89b-42d3-a456-426614174003';
export const hash = 'a'.repeat(64);
export const hash2 = 'b'.repeat(64);
export const instant = '2026-10-02T12:00:00.000Z';

export const meta = {
  id: uuid,
  version: '1',
  contentHash: hash,
  createdAt: instant,
  updatedAt: instant,
} as const;

export const queuedDryRun = {
  ...meta,
  resourceKind: 'schema_dry_run' as const,
  state: 'queued' as const,
  contentTypeVersionId: uuid2,
  classification: 'additive' as const,
  attemptId: uuid3,
  jobId: uuid4,
  migrationPlanId: uuid,
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
};

export const completedPassedDryRun = {
  ...queuedDryRun,
  state: 'completed' as const,
  result: 'passed' as const,
  sourceCount: 0,
  targetCount: 0,
  rowErrorCount: 0,
  sourceHash: hash,
  targetHash: hash,
  reportHash: hash2,
};

export const frozenEvidence = {
  contentTypeVersionId: uuid2,
  contentTypeVersionNo: '2',
  definitionHash: hash,
  schemaArtifact: {
    id: uuid3,
    state: 'compiled' as const,
    compilerVersion: 'compiler-1',
    zodContractRef: 'cms/release_notes/v2',
    artifactHash: hash2,
  },
  dependencyManifestHash: hash,
  dryRun: {
    id: uuid4,
    state: 'completed' as const,
    result: 'passed' as const,
    reportHash: hash2,
  },
};

export const approveDecision = {
  id: uuid,
  decision: 'approve' as const,
  capability: 'cms.schema_review',
  decidedAt: instant,
};

export const openReview = {
  ...meta,
  resourceKind: 'schema_review' as const,
  state: 'open' as const,
  contentTypeId: uuid3,
  contentTypeVersionId: uuid2,
  contentTypeVersionNo: '2',
  riskClass: 'ordinary' as const,
  requiredDecisionCount: 1,
  requiredCapabilities: ['cms.schema_review'],
  distinctApprovalCount: 0,
  recordedDecisionCount: 0,
  frozenEvidence,
  dryRunId: uuid4,
  policyKey: 'cms.standard',
  policyVersion: '1',
  policyHash: hash,
  approvalEvidenceHash: null,
  submittedAt: instant,
  decidedAt: null,
  decisions: [] as readonly (typeof approveDecision)[],
  permittedNextActions: ['assign_reviewer'] as const,
};

export const approvedReview = {
  ...openReview,
  state: 'approved' as const,
  distinctApprovalCount: 1,
  recordedDecisionCount: 1,
  approvalEvidenceHash: hash2,
  decidedAt: instant,
  decisions: [approveDecision],
  permittedNextActions: ['activate'] as const,
};

export const assignment = {
  ...meta,
  resourceKind: 'schema_review_assignment' as const,
  reviewId: uuid2,
  state: 'active' as const,
  capability: 'cms.schema_review' as const,
  actions: ['read', 'decide'] as const,
  startsAt: instant,
  expiresAt: '2026-10-05T12:00:00.000Z',
  reason: null,
};

export const decisionResource = {
  ...meta,
  resourceKind: 'schema_review_decision' as const,
  reviewId: uuid2,
  decision: 'approve' as const,
  capability: 'cms.schema_review',
  decidedAt: instant,
};

export const compatibleTemplate = {
  templateVersionId: uuid,
  templateKey: 'profile.header',
  templateVersionNo: '2',
  state: 'active' as const,
  compatible: true as const,
  withdrawn: false as const,
  templateDigest: hash,
  contentTypeId: uuid2,
  contentTypeVersionId: uuid3,
};

export const preparation = {
  dryRunRef: {
    id: uuid,
    state: 'completed' as const,
    result: 'passed' as const,
    jobId: uuid2,
  },
  jobRef: { id: uuid2, state: 'succeeded' as const },
  reviewRef: { id: uuid3, state: 'approved' as const },
  permittedNextActions: ['activate'] as const,
};
