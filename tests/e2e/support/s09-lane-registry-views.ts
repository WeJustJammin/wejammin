import { fixtureHash } from './s09-lane-hash';
import { lanePersonId, type LaneRole } from './s09-lane-ids';
import {
  iso,
  type DryRunRecord,
  type ReviewRecord,
  type VersionRecord,
  type World,
} from './s09-lane-world';

/** Resource builders: records in, contract-shaped JSON out. */

const POLICY_HASH = fixtureHash('cms.standard@1');

export const localeHash = (version: VersionRecord): string =>
  fixtureHash(JSON.stringify(version.locale));

const meta = (id: string, rev: number, created: string, updated: string) => ({
  id,
  version: String(rev),
  contentHash: fixtureHash(`${id}:${String(rev)}`),
  createdAt: created,
  updatedAt: updated,
});

export const dryRunOf = (world: World, version: VersionRecord) =>
  world.dryRuns.find((run) => run.id === version.dryRunId) ?? null;

export const reviewOf = (world: World, version: VersionRecord) =>
  world.reviews.find((review) => review.id === version.reviewId) ?? null;

export const dryRunResource = (run: DryRunRecord, version: VersionRecord) => ({
  ...meta(run.id, run.version, run.createdAt, run.updatedAt),
  resourceKind: 'schema_dry_run' as const,
  state: run.state,
  contentTypeVersionId: version.id,
  classification: 'additive' as const,
  attemptId: run.attemptId,
  jobId: run.jobId,
  migrationPlanId: run.planId,
  compilerVersion: '1.0.0',
  transformKey: null,
  transformVersion: null,
  result: run.result,
  failureCode: null,
  sourceCount: run.sourceCount,
  targetCount: run.targetCount,
  rowErrorCount: run.rowErrorCount,
  sourceHash: run.sourceHash,
  targetHash: run.targetHash,
  reportHash: run.reportHash,
});

const activationEvidence = (version: VersionRecord, review: ReviewRecord | null) =>
  version.state === 'active' || version.state === 'superseded'
    ? {
        key: 'cms.standard',
        version: '1',
        policyHash: POLICY_HASH,
        riskClass: 'ordinary' as const,
        requiredDecisionCount: 1,
        requiredCapabilities: ['cms.schema_review'],
        approvalEvidenceHash: review?.approvalEvidenceHash ?? POLICY_HASH,
      }
    : null;

export const versionResource = (world: World, version: VersionRecord) => ({
  ...meta(version.id, version.rev, version.createdAt, version.updatedAt),
  resourceKind: 'content_type_version' as const,
  state: version.state,
  contentTypeId: version.typeId,
  typeKey: version.typeKey,
  label: version.label,
  ownerCapability: 'cms.content.article',
  sourceLocale: version.locale.sourceLocale,
  defaultLocale: version.locale.defaultLocale,
  supportedLocales: version.locale.supportedLocales,
  fallbackChains: version.locale.fallbackChains,
  localeConfigHash: localeHash(version),
  workflowKey: 'editorial.default',
  workflowVersion: '1',
  defaultTemplateVersionId: null,
  schemaArtifactId: version.artifactId,
  fieldCount: 0,
  relationCount: 0,
  capabilityBindingCount: 0,
  compatibility: 'additive' as const,
  dryRunId: version.dryRunId,
  activationEvidence: activationEvidence(version, reviewOf(world, version)),
});

export const typeResource = (world: World, typeId: string) => {
  const type = world.types.find((entry) => entry.id === typeId);
  if (type === undefined) throw new Error('lane type missing');
  return {
    resourceKind: 'content_type' as const,
    id: type.id,
    version: '1',
    typeKey: type.key,
    builtIn: false,
    lifecycle: 'active' as const,
    createdAt: type.createdAt,
    updatedAt: type.createdAt,
  };
};

const nextActions = (world: World, version: VersionRecord) => {
  const run = dryRunOf(world, version);
  const actions: string[] = [];
  if (version.state === 'draft') {
    if (run === null || run.state === 'completed') actions.push('start_dry_run');
    if (run?.state === 'completed' && run.result === 'passed')
      actions.push('submit_review');
  }
  if (version.state === 'approved') actions.push('activate');
  if (version.state === 'active') actions.push('create_successor');
  return actions as ('start_dry_run' | 'submit_review' | 'activate' | 'create_successor')[];
};

const jobState = (run: DryRunRecord) =>
  run.state === 'completed' ? ('succeeded' as const) : run.state;

export const preparationFor = (world: World, version: VersionRecord) => {
  const run = dryRunOf(world, version);
  const review = reviewOf(world, version);
  const sealed = run?.state === 'completed';
  return {
    dryRunRef:
      run === null
        ? null
        : {
            id: run.id,
            state: run.state,
            result: run.result,
            jobId: run.jobId,
            ...(sealed
              ? {
                  sourceCount: run.sourceCount,
                  targetCount: run.targetCount,
                  rowErrorCount: run.rowErrorCount,
                  sourceHash: run.sourceHash,
                  targetHash: run.targetHash,
                  reportHash: run.reportHash,
                }
              : {}),
          },
    jobRef: run === null ? null : { id: run.jobId, state: jobState(run) },
    reviewRef: review === null ? null : { id: review.id, state: review.state },
    permittedNextActions: nextActions(world, version),
  };
};

const artifactResource = (version: VersionRecord) => ({
  resourceKind: 'schema_artifact' as const,
  id: version.artifactId,
  version: '1',
  state: 'compiled' as const,
  contentTypeVersionId: version.id,
  compilerVersion: '1.0.0',
  zodContractRef: `cms/${version.typeKey}/v${String(version.versionNo)}`,
  artifactHash: fixtureHash(`artifact:${version.id}`),
  createdAt: version.createdAt,
  updatedAt: version.createdAt,
  compiledAt: version.createdAt,
});

export const detailFor = (world: World, version: VersionRecord) => ({
  resourceKind: 'content_type_version' as const,
  resource: versionResource(world, version),
  fields: [],
  relations: [],
  schemaArtifact: artifactResource(version),
  templateBindings: [],
  capabilityBindings: [],
  blockDefinitions: [],
  activationPreparation: preparationFor(world, version),
});

const assignmentSummary = (review: ReviewRecord) =>
  review.assignments.map((entry) => ({
    assignmentId: entry.id,
    version: String(entry.version),
    state: entry.state,
    startsAt: entry.startsAt,
    endsAt: entry.endsAt,
    reviewerLabel: `Reviewer ${entry.reviewer}`,
  }));

export const reviewResource = (
  world: World,
  review: ReviewRecord,
  viewer: LaneRole,
) => {
  const version = world.versions.find((entry) => entry.id === review.versionId);
  const run = world.dryRuns.find((entry) => entry.id === version?.dryRunId);
  if (version === undefined || run === undefined)
    throw new Error('lane review is detached');
  const approves = review.decisions.filter((entry) => entry.decision === 'approve');
  const owner = viewer === 'owner';
  const reviewer = viewer === 'reviewer' || viewer === 'reviewer2';
  const actions: ('assign_reviewer' | 'record_decision' | 'activate')[] = [];
  if (review.state === 'open' && owner) actions.push('assign_reviewer');
  const assigned = review.assignments.some(
    (entry) =>
      entry.reviewer === viewer &&
      entry.state === 'active' &&
      Date.parse(entry.endsAt) > Date.now(),
  );
  if (review.state === 'open' && reviewer && assigned)
    actions.push('record_decision');
  if (review.state === 'approved' && (owner || viewer === 'designer'))
    actions.push('activate');
  return {
    ...meta(review.id, review.version, review.submittedAt, review.decidedAt ?? review.submittedAt),
    resourceKind: 'schema_review' as const,
    state: review.state,
    contentTypeId: version.typeId,
    contentTypeVersionId: version.id,
    contentTypeVersionNo: String(version.versionNo),
    riskClass: 'ordinary' as const,
    requiredDecisionCount: 1,
    requiredCapabilities: ['cms.schema_review'],
    distinctApprovalCount: new Set(approves.map((entry) => entry.reviewer)).size,
    recordedDecisionCount: review.decisions.length,
    frozenEvidence: {
      contentTypeVersionId: version.id,
      contentTypeVersionNo: String(version.versionNo),
      definitionHash: fixtureHash(`definition:${version.id}`),
      localeConfigHash: localeHash(version),
      schemaArtifact: {
        id: version.artifactId,
        state: 'compiled' as const,
        compilerVersion: '1.0.0',
        zodContractRef: `cms/${version.typeKey}/v${String(version.versionNo)}`,
        artifactHash: fixtureHash(`artifact:${version.id}`),
      },
      dependencyManifestHash: fixtureHash(`dependencies:${version.id}`),
      dryRun: {
        id: run.id,
        state: 'completed' as const,
        result: 'passed' as const,
        reportHash: run.reportHash,
      },
    },
    dryRunId: run.id,
    policyKey: 'cms.standard',
    policyVersion: '1',
    policyHash: POLICY_HASH,
    approvalEvidenceHash: review.approvalEvidenceHash,
    submittedAt: review.submittedAt,
    decidedAt: review.decidedAt,
    decisions: review.decisions.map((entry) => ({
      id: entry.id,
      decision: entry.decision,
      capability: 'cms.schema_review',
      decidedAt: entry.decidedAt,
    })),
    assignments: owner ? assignmentSummary(review) : [],
    permittedNextActions: actions,
  };
};

export const decisionResource = (review: ReviewRecord, decisionId: string) => {
  const entry = review.decisions.find((item) => item.id === decisionId);
  if (entry === undefined) throw new Error('lane decision missing');
  return {
    ...meta(entry.id, 1, entry.decidedAt, entry.decidedAt),
    resourceKind: 'schema_review_decision' as const,
    reviewId: review.id,
    decision: entry.decision,
    capability: 'cms.schema_review',
    decidedAt: entry.decidedAt,
  };
};

export const assignmentResource = (
  review: ReviewRecord,
  assignmentId: string,
) => {
  const entry = review.assignments.find((item) => item.id === assignmentId);
  if (entry === undefined) throw new Error('lane assignment missing');
  return {
    ...meta(entry.id, entry.version, entry.startsAt, entry.startsAt),
    resourceKind: 'schema_review_assignment' as const,
    reviewId: review.id,
    state: entry.state,
    capability: 'cms.schema_review' as const,
    actions: ['read', 'decide'] as ['read', 'decide'],
    startsAt: entry.startsAt,
    expiresAt: entry.endsAt,
    reason: entry.reason,
  };
};

export const reviewerPersonId = (role: LaneRole): string => lanePersonId(role);
export const nowIso = (): string => iso(Date.now());
