/**
 * BE03a exact validation messages (CMS-03A-10, -11, -13, -15). Every string
 * asserted here is the exact `message` the BE03a Request/Response Contracts
 * snippets declare, reported on the path the snippet names.
 */
import { describe, expect, it } from 'vitest';

import {
  CapabilityGrantRequestSchema,
  SchemaDryRunRequestSchema,
} from './requests.ts';
import {
  CmsCapabilityGrantResourceSchema,
  SchemaDryRunResourceSchema,
  SchemaReviewResourceSchema,
} from './resources.ts';
import {
  approveDecision,
  approvedReview,
  completedPassedDryRun,
  hash2,
  instant,
  meta,
  openReview,
  queuedDryRun,
  uuid,
  uuid2,
  uuid3,
} from './review-fixtures.test-support.ts';

type Issue = Readonly<{ path: readonly PropertyKey[]; message: string }>;
type Parser = Readonly<{
  safeParse: (value: unknown) => {
    success: boolean;
    error?: { issues: Issue[] };
  };
}>;

const issuesOf = (schema: Parser, value: unknown): readonly Issue[] => {
  const parsed = schema.safeParse(value);
  return parsed.success ? [] : (parsed.error?.issues ?? []);
};

const expectIssue = (
  schema: Parser,
  value: unknown,
  path: readonly PropertyKey[],
  message: string,
): void => {
  expect(issuesOf(schema, value)).toContainEqual(
    expect.objectContaining({ path, message }),
  );
};

type MessageCase = Readonly<{
  marker: string;
  title: string;
  schema: Parser;
  value: unknown;
  path: readonly PropertyKey[];
  message: string;
}>;

const grant = {
  ...meta,
  resourceKind: 'cms_capability_grant',
  state: 'active',
  subjectPersonId: uuid2,
  capability: 'cms.author',
  validFrom: '2026-10-02',
  validThrough: '2026-10-08',
  endsAt: '2026-10-09T00:00:00.000Z',
  lastAction: 'granted',
  reason: null,
};

const reviewWithDecisions = (
  decisions: readonly unknown[],
  overrides: Record<string, unknown> = {},
): unknown => ({
  ...approvedReview,
  decisions,
  recordedDecisionCount: decisions.length,
  ...overrides,
});

const CASES: readonly MessageCase[] = [
  {
    marker: '[P2-S09-AC-329]',
    title:
      "CMS-03A-10 reports 'transform key and version must be both null or both present' on the transformVersion path",
    schema: SchemaDryRunRequestSchema,
    value: {
      expectedVersion: '1',
      transformKey: 'a.b',
      transformVersion: null,
    },
    path: ['transformVersion'],
    message: 'transform key and version must be both null or both present',
  },
  {
    marker: '[P2-S09-AC-335]',
    title:
      "CMS-03A-10 reports 'a completed dry-run must expose sealed report evidence' for a completed resource missing sealed fields",
    schema: SchemaDryRunResourceSchema,
    value: { ...completedPassedDryRun, reportHash: null },
    path: ['state'],
    message: 'a completed dry-run must expose sealed report evidence',
  },
  {
    marker: '[P2-S09-AC-336]',
    title:
      "CMS-03A-10 reports 'an unsealed dry-run cannot carry final report evidence' for a non-completed resource carrying sealed fields",
    schema: SchemaDryRunResourceSchema,
    value: { ...queuedDryRun, sourceCount: 0 },
    path: ['state'],
    message: 'an unsealed dry-run cannot carry final report evidence',
  },
  {
    marker: '[P2-S09-AC-337]',
    title:
      "CMS-03A-10 reports 'a passed dry-run requires zero row errors' for a passed resource with a nonzero rowErrorCount",
    schema: SchemaDryRunResourceSchema,
    value: { ...completedPassedDryRun, rowErrorCount: 1 },
    path: ['rowErrorCount'],
    message: 'a passed dry-run requires zero row errors',
  },
  {
    marker: '[P2-S09-AC-338]',
    title:
      "CMS-03A-10 reports 'a sealed failing scan must carry the actual scan errors' for a failed result with zero row errors",
    schema: SchemaDryRunResourceSchema,
    value: { ...completedPassedDryRun, result: 'failed', rowErrorCount: 0 },
    path: ['rowErrorCount'],
    message: 'a sealed failing scan must carry the actual scan errors',
  },
  {
    marker: '[P2-S09-AC-339]',
    title:
      "CMS-03A-10 reports 'an unsealed failed dry-run requires a safe failure code' for a failed state without failureCode",
    schema: SchemaDryRunResourceSchema,
    value: { ...queuedDryRun, state: 'failed', failureCode: null },
    path: ['failureCode'],
    message: 'an unsealed failed dry-run requires a safe failure code',
  },
  {
    marker: '[P2-S09-AC-340]',
    title:
      "CMS-03A-10 reports 'only a failed dry-run carries a failure code' for a non-failed state carrying failureCode",
    schema: SchemaDryRunResourceSchema,
    value: { ...queuedDryRun, failureCode: 'SCAN_ABORTED' },
    path: ['failureCode'],
    message: 'only a failed dry-run carries a failure code',
  },
  {
    marker: '[P2-S09-AC-376]',
    title:
      "CMS-03A-11 reports 'decision references must be unique' for duplicate decision references",
    schema: SchemaReviewResourceSchema,
    value: reviewWithDecisions([approveDecision, approveDecision], {
      requiredDecisionCount: 2,
      distinctApprovalCount: 2,
    }),
    path: ['decisions'],
    message: 'decision references must be unique',
  },
  {
    marker: '[P2-S09-AC-377]',
    title:
      "CMS-03A-11 reports 'recorded decision count must equal the decision references' for a mismatched recordedDecisionCount",
    schema: SchemaReviewResourceSchema,
    value: reviewWithDecisions([approveDecision], { recordedDecisionCount: 2 }),
    path: ['recordedDecisionCount'],
    message: 'recorded decision count must equal the decision references',
  },
  {
    marker: '[P2-S09-AC-378]',
    title:
      "CMS-03A-11 reports 'approval evidence hash exists only when the review is approved' for a mismatched approvalEvidenceHash",
    schema: SchemaReviewResourceSchema,
    value: { ...openReview, approvalEvidenceHash: hash2 },
    path: ['approvalEvidenceHash'],
    message: 'approval evidence hash exists only when the review is approved',
  },
  {
    marker: '[P2-S09-AC-379]',
    title:
      "CMS-03A-11 reports 'decidedAt exists only when the review is approved' for a mismatched decidedAt",
    schema: SchemaReviewResourceSchema,
    value: { ...openReview, decidedAt: instant },
    path: ['decidedAt'],
    message: 'decidedAt exists only when the review is approved',
  },
  {
    marker: '[P2-S09-AC-380]',
    title:
      "CMS-03A-11 reports 'distinct qualifying approvers cannot exceed recorded approvals' for an inflated distinctApprovalCount",
    schema: SchemaReviewResourceSchema,
    value: { ...openReview, distinctApprovalCount: 1 },
    path: ['distinctApprovalCount'],
    message: 'distinct qualifying approvers cannot exceed recorded approvals',
  },
  {
    marker: '[P2-S09-AC-381]',
    title:
      "CMS-03A-11 reports 'an approved review requires exactly the policy decision count' for an approved review whose distinctApprovalCount differs from requiredDecisionCount",
    schema: SchemaReviewResourceSchema,
    value: { ...approvedReview, requiredDecisionCount: 2 },
    path: ['state'],
    message: 'an approved review requires exactly the policy decision count',
  },
  {
    marker: '[P2-S09-AC-382]',
    title:
      "CMS-03A-11 reports 'a review with a rejection cannot be approved' for an approved review that holds a rejection",
    schema: SchemaReviewResourceSchema,
    value: reviewWithDecisions(
      [approveDecision, { ...approveDecision, id: uuid3, decision: 'reject' }],
      { requiredDecisionCount: 1 },
    ),
    path: ['state'],
    message: 'a review with a rejection cannot be approved',
  },
  {
    marker: '[P2-S09-AC-450]',
    title:
      "CMS-03A-13 reports 'assignment ids must be unique and each span at most seven days' for duplicate assignmentId values",
    schema: SchemaReviewResourceSchema,
    value: {
      ...openReview,
      assignments: [assignmentSummary(uuid, 2), assignmentSummary(uuid, 2)],
    },
    path: ['assignments'],
    message: 'assignment ids must be unique and each span at most seven days',
  },
  {
    marker: '[P2-S09-AC-450]',
    title:
      "CMS-03A-13 reports 'assignment ids must be unique and each span at most seven days' for a span longer than seven days",
    schema: SchemaReviewResourceSchema,
    value: { ...openReview, assignments: [assignmentSummary(uuid, 8)] },
    path: ['assignments'],
    message: 'assignment ids must be unique and each span at most seven days',
  },
  {
    marker: '[P2-S09-AC-450]',
    title:
      "CMS-03A-13 reports 'assignment ids must be unique and each span at most seven days' for a span that is not positive",
    schema: SchemaReviewResourceSchema,
    value: { ...openReview, assignments: [assignmentSummary(uuid, 0)] },
    path: ['assignments'],
    message: 'assignment ids must be unique and each span at most seven days',
  },
  {
    marker: '[P2-S09-AC-518]',
    title:
      "CMS-03A-15 reports the validation message 'not a real calendar date' for a non-calendar validThrough",
    schema: CapabilityGrantRequestSchema,
    value: {
      subjectPersonId: uuid2,
      capability: 'cms.author',
      validThrough: '2026-02-30',
    },
    path: ['validThrough'],
    message: 'not a real calendar date',
  },
  {
    marker: '[P2-S09-AC-519]',
    title:
      'CMS-03A-15 reports grant_term_spans_at_most_ninety_utc_days in the response-contract refinement for a resource whose validFrom to validThrough span exceeds 89 days',
    schema: CmsCapabilityGrantResourceSchema,
    value: {
      ...grant,
      validThrough: '2027-01-01',
      endsAt: '2027-01-02T00:00:00.000Z',
    },
    path: ['validThrough'],
    message: 'grant_term_spans_at_most_ninety_utc_days',
  },
];

function assignmentSummary(
  assignmentId: string,
  spanDays: number,
): Record<string, unknown> {
  return {
    assignmentId,
    version: '1',
    state: 'active',
    startsAt: instant,
    endsAt: new Date(Date.parse(instant) + spanDays * 86_400_000).toISOString(),
    reviewerLabel: 'Reviewer one',
  };
}

describe('BE03a exact validation messages', () => {
  it.each(CASES)('$marker $title', ({ schema, value, path, message }) => {
    expectIssue(schema, value, path, message);
  });

  it('[P2-S09-AC-519] accepts a resource whose term ends exactly 89 days after validFrom', () => {
    const lastValid = {
      ...grant,
      validThrough: '2026-12-30',
      endsAt: '2026-12-31T00:00:00.000Z',
    };
    expect(CmsCapabilityGrantResourceSchema.safeParse(lastValid).success).toBe(
      true,
    );
  });
});
