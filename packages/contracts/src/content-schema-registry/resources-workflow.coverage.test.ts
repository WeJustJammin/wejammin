import { describe, expect, it } from 'vitest';

import {
  SchemaActivationPreparationSchema,
  SchemaDryRunResourceSchema,
  SchemaReviewAssignmentResourceSchema,
  SchemaReviewDecisionResourceSchema,
  SchemaReviewResourceSchema,
} from './resources.ts';
import {
  approvedReview,
  approveDecision,
  assignment,
  completedPassedDryRun,
  compatibleTemplate,
  decisionResource,
  hash,
  instant,
  openReview,
  preparation,
  queuedDryRun,
  uuid,
  uuid2,
  uuid3,
} from './review-fixtures.test-support.ts';

const messages = (
  schema: { safeParse: (value: unknown) => unknown },
  value: unknown,
): string[] => {
  const result = schema.safeParse(value) as {
    success: boolean;
    error?: { issues: { message: string }[] };
  };
  return result.success
    ? []
    : (result.error?.issues.map((i) => i.message) ?? []);
};

describe('SchemaDryRunResource lifecycle seal', () => {
  it('accepts an unsealed queued attempt and a sealed passed attempt', () => {
    expect(SchemaDryRunResourceSchema.parse(queuedDryRun).state).toBe('queued');
    expect(SchemaDryRunResourceSchema.parse(completedPassedDryRun).result).toBe(
      'passed',
    );
  });

  it('accepts a sealed failed report with row errors and an unsealed failure', () => {
    expect(
      SchemaDryRunResourceSchema.safeParse({
        ...completedPassedDryRun,
        result: 'failed',
        rowErrorCount: 2,
      }).success,
    ).toBe(true);
    expect(
      SchemaDryRunResourceSchema.safeParse({
        ...queuedDryRun,
        state: 'failed',
        failureCode: 'SCAN_ABORTED',
      }).success,
    ).toBe(true);
  });

  it('requires sealed evidence when completed', () => {
    expect(
      messages(SchemaDryRunResourceSchema, {
        ...completedPassedDryRun,
        reportHash: null,
      }),
    ).toContain('a completed dry-run must expose sealed report evidence');
  });

  it('forbids final evidence before the seal', () => {
    expect(
      messages(SchemaDryRunResourceSchema, { ...queuedDryRun, sourceCount: 0 }),
    ).toContain('an unsealed dry-run cannot carry final report evidence');
  });

  it('requires zero row errors for a passed report', () => {
    expect(
      messages(SchemaDryRunResourceSchema, {
        ...completedPassedDryRun,
        rowErrorCount: 1,
      }),
    ).toContain('a passed dry-run requires zero row errors');
  });

  it('requires row errors for a sealed failed report', () => {
    expect(
      messages(SchemaDryRunResourceSchema, {
        ...completedPassedDryRun,
        result: 'failed',
        rowErrorCount: 0,
      }),
    ).toContain('a sealed failing scan must carry the actual scan errors');
  });

  it('treats a missing row-error count on a failed seal as zero', () => {
    expect(
      messages(SchemaDryRunResourceSchema, {
        ...completedPassedDryRun,
        result: 'failed',
        rowErrorCount: null,
      }),
    ).toEqual(
      expect.arrayContaining([
        'a completed dry-run must expose sealed report evidence',
        'a sealed failing scan must carry the actual scan errors',
      ]),
    );
  });

  it('requires a failure code exactly when the attempt failed', () => {
    expect(
      messages(SchemaDryRunResourceSchema, {
        ...queuedDryRun,
        state: 'failed',
      }),
    ).toContain('an unsealed failed dry-run requires a safe failure code');
    expect(
      messages(SchemaDryRunResourceSchema, {
        ...queuedDryRun,
        failureCode: 'SCAN_ABORTED',
      }),
    ).toContain('only a failed dry-run carries a failure code');
  });
});

describe('SchemaReviewResource decision accounting', () => {
  it('accepts an open review and an approved review at the exact policy count', () => {
    expect(SchemaReviewResourceSchema.parse(openReview).state).toBe('open');
    expect(SchemaReviewResourceSchema.parse(approvedReview).state).toBe(
      'approved',
    );
  });

  it('rejects repeated decision references and a mismatched recorded count', () => {
    expect(
      messages(SchemaReviewResourceSchema, {
        ...approvedReview,
        recordedDecisionCount: 2,
        decisions: [approveDecision, approveDecision],
        distinctApprovalCount: 2,
        requiredDecisionCount: 2,
      }),
    ).toContain('decision references must be unique');
    expect(
      messages(SchemaReviewResourceSchema, {
        ...approvedReview,
        recordedDecisionCount: 2,
      }),
    ).toContain('recorded decision count must equal the decision references');
  });

  it('bounds the decision history at eight', () => {
    const decisions = Array.from({ length: 9 }, (_, index) => ({
      ...approveDecision,
      id: `123e4567-e89b-42d3-a456-42661417410${index}`,
    }));
    expect(
      messages(SchemaReviewResourceSchema, {
        ...openReview,
        recordedDecisionCount: 9,
        decisions,
      }),
    ).toContain('review_decisions_exceed_bound');
  });

  it('keeps distinct approvers within recorded approvals', () => {
    expect(
      messages(SchemaReviewResourceSchema, {
        ...openReview,
        distinctApprovalCount: 1,
      }),
    ).toContain('distinct qualifying approvers cannot exceed recorded approvals');
  });

  it('requires the exact policy count for an approved review', () => {
    expect(
      messages(SchemaReviewResourceSchema, {
        ...approvedReview,
        requiredDecisionCount: 2,
      }),
    ).toContain('an approved review requires exactly the policy decision count');
  });

  it('never approves a review holding a rejection', () => {
    const rejection = {
      ...approveDecision,
      id: uuid2,
      decision: 'reject' as const,
    };
    expect(
      messages(SchemaReviewResourceSchema, {
        ...approvedReview,
        recordedDecisionCount: 2,
        decisions: [approveDecision, rejection],
      }),
    ).toContain('a review with a rejection cannot be approved');
  });

  it('carries the evidence hash and decision instant only when approved', () => {
    expect(
      messages(SchemaReviewResourceSchema, {
        ...openReview,
        approvalEvidenceHash: hash,
      }),
    ).toContain('approval evidence hash exists only when the review is approved');
    expect(
      messages(SchemaReviewResourceSchema, {
        ...openReview,
        decidedAt: instant,
      }),
    ).toContain('decidedAt exists only when the review is approved');
    expect(
      messages(SchemaReviewResourceSchema, {
        ...approvedReview,
        approvalEvidenceHash: null,
        decidedAt: null,
      }),
    ).toEqual(
      expect.arrayContaining([
        'approval evidence hash exists only when the review is approved',
        'decidedAt exists only when the review is approved',
      ]),
    );
  });

  it('refuses actor, person, party, and binding identifiers', () => {
    for (const key of [
      'actorId',
      'reviewerPersonId',
      'actingPartyId',
      'bindingId',
    ])
      expect(
        SchemaReviewResourceSchema.safeParse({ ...openReview, [key]: uuid })
          .success,
      ).toBe(false);
  });
});

describe('SchemaReviewDecisionResource and SchemaReviewAssignmentResource', () => {
  it('parses the closed decision resource without reviewer identity', () => {
    expect(
      SchemaReviewDecisionResourceSchema.parse(decisionResource).reviewId,
    ).toBe(uuid2);
    expect(
      SchemaReviewDecisionResourceSchema.safeParse({
        ...decisionResource,
        reviewerPersonId: uuid,
      }).success,
    ).toBe(false);
  });

  it('pins the fixed read/decide tuple of the assignment', () => {
    expect(
      SchemaReviewAssignmentResourceSchema.parse(assignment).actions,
    ).toEqual(['read', 'decide']);
    for (const actions of [
      ['decide', 'read'],
      ['read'],
      ['read', 'decide', 'read'],
    ])
      expect(
        SchemaReviewAssignmentResourceSchema.safeParse({
          ...assignment,
          actions,
        }).success,
      ).toBe(false);
  });

  it('accepts a revoked assignment and rejects an unknown state', () => {
    expect(
      SchemaReviewAssignmentResourceSchema.parse({
        ...assignment,
        state: 'revoked',
        reason: 'revoked by owner',
      }).state,
    ).toBe('revoked');
    expect(
      SchemaReviewAssignmentResourceSchema.safeParse({
        ...assignment,
        state: 'expired',
      }).success,
    ).toBe(false);
  });
});

describe('SchemaActivationPreparation', () => {
  it('uses the BE00 job vocabulary for jobRef', () => {
    for (const state of [
      'queued',
      'running',
      'succeeded',
      'failed',
      'cancelled',
    ])
      expect(
        SchemaActivationPreparationSchema.safeParse({
          ...preparation,
          jobRef: { id: uuid3, state },
        }).success,
      ).toBe(true);
    for (const state of [
      'retrying',
      'completed',
      'failed_retryable',
      'failed_terminal',
    ])
      expect(
        SchemaActivationPreparationSchema.safeParse({
          ...preparation,
          jobRef: { id: uuid3, state },
        }).success,
      ).toBe(false);
  });

  it('accepts null references and an absent template compatibility', () => {
    const empty = {
      dryRunRef: null,
      jobRef: null,
      reviewRef: null,
      permittedNextActions: ['create_successor'],
    };
    expect(SchemaActivationPreparationSchema.parse(empty)).toEqual(empty);
  });

  it('carries the safe template compatibility projection only', () => {
    expect(
      SchemaActivationPreparationSchema.parse({
        ...preparation,
        templateCompatibility: compatibleTemplate,
      }).templateCompatibility,
    ).toEqual(compatibleTemplate);
    expect(
      SchemaActivationPreparationSchema.safeParse({
        ...preparation,
        templateCompatibility: { ...compatibleTemplate, compatible: false },
      }).success,
    ).toBe(false);
    expect(
      SchemaActivationPreparationSchema.safeParse({
        ...preparation,
        templateCompatibility: { ...compatibleTemplate, ownerId: uuid },
      }).success,
    ).toBe(false);
  });

  it('has no server-derived readiness field; readiness is the next actions', () => {
    expect(
      SchemaActivationPreparationSchema.safeParse({
        ...preparation,
        readiness: 'ready',
      }).success,
    ).toBe(false);
  });
});

describe('SchemaActivationPreparation dryRunRef failureCode', () => {
  const ref = (over: Record<string, unknown>) => ({
    ...preparation,
    dryRunRef: { ...preparation.dryRunRef, ...over },
  });

  it('accepts a null or absent failureCode on a sealed or running reference', () => {
    expect(
      SchemaActivationPreparationSchema.parse(ref({ failureCode: null }))
        .dryRunRef?.failureCode,
    ).toBeNull();
    expect(
      SchemaActivationPreparationSchema.safeParse(preparation).success,
    ).toBe(true);
    expect(
      SchemaActivationPreparationSchema.safeParse(
        ref({ state: 'running', result: null, failureCode: null }),
      ).success,
    ).toBe(true);
  });

  it('accepts a sealed failure code only on an unsealed failed reference', () => {
    const failed = ref({
      state: 'failed',
      result: null,
      failureCode: 'MIGRATION_WORKER_TIMEOUT',
    });
    expect(
      SchemaActivationPreparationSchema.parse(failed).dryRunRef?.failureCode,
    ).toBe('MIGRATION_WORKER_TIMEOUT');
  });

  it.each([
    ['a completed passed', { failureCode: 'SCAN_FAILED' }],
    ['a completed failed', { result: 'failed', failureCode: 'SCAN_FAILED' }],
    [
      'a running',
      { state: 'running', result: null, failureCode: 'SCAN_FAILED' },
    ],
    ['a queued', { state: 'queued', result: null, failureCode: 'SCAN_FAILED' }],
  ])('rejects a failure code on %s reference', (_name, over) => {
    expect(SchemaActivationPreparationSchema.safeParse(ref(over)).success).toBe(
      false,
    );
  });

  it.each(['lowercase', 'HAS SPACE', '1LEADING', 'A'.repeat(65), '', 7])(
    'rejects the malformed failure code %j outside the sealed enum',
    (code) => {
      expect(
        SchemaActivationPreparationSchema.safeParse(
          ref({ state: 'failed', result: null, failureCode: code }),
        ).success,
      ).toBe(false);
    },
  );
});
