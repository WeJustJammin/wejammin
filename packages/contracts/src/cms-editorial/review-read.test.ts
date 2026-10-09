import { describe, expect, it } from 'vitest';

import {
  EditorialDecisionSummarySchema,
  EditorialReviewAssignmentSummarySchema,
  EditorialReviewDetailApiRequestSchema,
  EditorialReviewDetailPathParamsSchema,
  EditorialReviewDetailQuerySchema,
  EditorialReviewDetailResourceSchema,
  ReviewNextActionSchema,
  ReviewQueueApiRequestSchema,
  ReviewQueueItemSchema,
  ReviewQueuePageSchema,
  ReviewQueueQuerySchema,
  ReviewQueueScopeSchema,
} from './index';
import {
  hash2,
  uid,
  uuid,
  validAssignmentSummary,
  validDecisionSummary,
  validFrozenCandidate,
  validQueueItem,
  validQueuePage,
  validReviewDetail,
  without,
} from './workflow-fixtures.test-support';

type Parser = { safeParse: (value: unknown) => { success: boolean } };
const refused = (schema: Parser, value: unknown): boolean =>
  !schema.safeParse(value).success;

const approve = (index: number, mine = false) => ({
  ...validDecisionSummary,
  id: uid(40 + index),
  mine,
  reason: mine ? 'Matches the frozen candidate.' : null,
});

describe('[P2-S11-AC-055][P2-S11-AC-056] CMS-03B-16 request contracts', () => {
  it('addresses the review by a UUID path and accepts no query key', () => {
    expect(
      EditorialReviewDetailPathParamsSchema.parse({ reviewId: uuid }),
    ).toEqual({ reviewId: uuid });
    expect(
      refused(EditorialReviewDetailPathParamsSchema, { reviewId: 'x' }),
    ).toBe(true);
    expect(
      refused(EditorialReviewDetailPathParamsSchema, {
        reviewId: uuid,
        extra: 1,
      }),
    ).toBe(true);
    expect(EditorialReviewDetailQuerySchema.parse({})).toEqual({});
    expect(refused(EditorialReviewDetailQuerySchema, { cursor: 'x' })).toBe(
      true,
    );
    expect(
      EditorialReviewDetailApiRequestSchema.parse({
        reviewId: uuid,
        query: {},
      }),
    ).toEqual({ reviewId: uuid, query: {} });
    expect(
      refused(EditorialReviewDetailApiRequestSchema, {
        reviewId: uuid,
        query: { a: 1 },
      }),
    ).toBe(true);
    expect(
      refused(EditorialReviewDetailApiRequestSchema, {
        reviewId: uuid,
        query: {},
        headers: {},
      }),
    ).toBe(true);
  });
});

describe('[P2-S11-AC-055] EditorialReviewDetailResource', () => {
  it('accepts an open review with no decisions and a review with approvals', () => {
    expect(
      EditorialReviewDetailResourceSchema.parse(validReviewDetail),
    ).toEqual(validReviewDetail);
    const decided = {
      ...validReviewDetail,
      state: 'approved',
      requiredDecisionCount: 1,
      recordedDecisionCount: 1,
      decidedAt: '2026-10-09T12:00:00Z',
      distinctApprovalCount: 1,
      decisions: [approve(1, true)],
      permittedNextActions: ['schedule', 'publish'],
    };
    expect(EditorialReviewDetailResourceSchema.parse(decided)).toEqual(decided);
  });

  it('rejects unknown keys, ownership identifiers and every missing member', () => {
    for (const key of [
      'ownerId',
      'submittedBy',
      'reviewerPersonId',
      'assignmentId',
      'authorPersonId',
    ])
      expect(
        refused(EditorialReviewDetailResourceSchema, {
          ...validReviewDetail,
          [key]: uuid,
        }),
        key,
      ).toBe(true);
    for (const key of Object.keys(validReviewDetail).filter(
      (k) => k !== 'assignments',
    )) {
      const rest = without(
        validReviewDetail,
        key as keyof typeof validReviewDetail,
      );
      expect(refused(EditorialReviewDetailResourceSchema, rest), key).toBe(
        true,
      );
    }
  });

  it('defaults assignments to the empty list for every reader but the owner', () => {
    const withoutAssignments = without(validReviewDetail, 'assignments');
    expect(
      EditorialReviewDetailResourceSchema.parse(withoutAssignments).assignments,
    ).toEqual([]);
  });

  it('inherits the review invariants (invalidated reason, decidedAt, counts, policy binding)', () => {
    expect(
      refused(EditorialReviewDetailResourceSchema, {
        ...validReviewDetail,
        state: 'invalidated',
      }),
    ).toBe(true);
    expect(
      refused(EditorialReviewDetailResourceSchema, {
        ...validReviewDetail,
        state: 'approved',
      }),
    ).toBe(true);
    expect(
      refused(EditorialReviewDetailResourceSchema, {
        ...validReviewDetail,
        recordedDecisionCount: 2,
      }),
    ).toBe(true);
    expect(
      refused(EditorialReviewDetailResourceSchema, {
        ...validReviewDetail,
        riskClass: 'protected',
      }),
    ).toBe(true);
    expect(
      refused(EditorialReviewDetailResourceSchema, {
        ...validReviewDetail,
        frozen: { ...validFrozenCandidate, frozenHash: hash2 },
      }),
    ).toBe(true);
  });

  it('bounds distinctApprovalCount 0-8 and never lets it exceed the approve decisions', () => {
    const decided = (approvals: number, counted: number) => ({
      ...validReviewDetail,
      workflowPolicy: {
        ...validReviewDetail.workflowPolicy,
        requiredDecisionCount: 8,
      },
      requiredDecisionCount: 8,
      recordedDecisionCount: approvals,
      distinctApprovalCount: counted,
      decisions: Array.from({ length: approvals }, (_, index) =>
        approve(index),
      ),
    });
    expect(
      EditorialReviewDetailResourceSchema.safeParse(decided(3, 3)).success,
    ).toBe(true);
    expect(
      EditorialReviewDetailResourceSchema.safeParse(decided(3, 2)).success,
    ).toBe(true);
    expect(
      EditorialReviewDetailResourceSchema.safeParse(decided(8, 8)).success,
    ).toBe(true);
    expect(refused(EditorialReviewDetailResourceSchema, decided(3, 4))).toBe(
      true,
    );
    expect(refused(EditorialReviewDetailResourceSchema, decided(0, 1))).toBe(
      true,
    );
    expect(refused(EditorialReviewDetailResourceSchema, decided(8, 9))).toBe(
      true,
    );
    expect(
      refused(EditorialReviewDetailResourceSchema, {
        ...decided(3, 3),
        distinctApprovalCount: -1,
      }),
    ).toBe(true);
  });

  it('lists one decision row per recorded decision, at most eight, with unique ids', () => {
    expect(
      refused(EditorialReviewDetailResourceSchema, {
        ...validReviewDetail,
        recordedDecisionCount: 0,
        decisions: [approve(1)],
      }),
    ).toBe(true);
    expect(
      refused(EditorialReviewDetailResourceSchema, {
        ...validReviewDetail,
        workflowPolicy: {
          ...validReviewDetail.workflowPolicy,
          requiredDecisionCount: 2,
        },
        requiredDecisionCount: 2,
        recordedDecisionCount: 2,
        distinctApprovalCount: 2,
        decisions: [approve(1), approve(1)],
      }),
    ).toBe(true);
    const nine = Array.from({ length: 9 }, (_, index) => approve(index));
    expect(
      refused(EditorialReviewDetailResourceSchema, {
        ...validReviewDetail,
        decisions: nine,
      }),
    ).toBe(true);
  });

  it('allows at most one decision of the caller and a reason only on that decision', () => {
    const own = approve(1, true);
    expect(EditorialDecisionSummarySchema.parse(own)).toEqual(own);
    expect(
      refused(EditorialDecisionSummarySchema, {
        ...validDecisionSummary,
        reason: 'Visible to others.',
      }),
    ).toBe(true);
    expect(
      EditorialDecisionSummarySchema.safeParse({ ...own, reason: null })
        .success,
    ).toBe(true);
    expect(
      refused(EditorialDecisionSummarySchema, { ...own, reason: '<script>' }),
    ).toBe(true);
    expect(
      refused(EditorialDecisionSummarySchema, { ...own, reason: '' }),
    ).toBe(true);
    expect(
      refused(EditorialDecisionSummarySchema, {
        ...own,
        reviewerPersonId: uuid,
      }),
    ).toBe(true);
    expect(
      refused(EditorialDecisionSummarySchema, { ...own, decision: 'abstain' }),
    ).toBe(true);
    expect(
      refused(EditorialDecisionSummarySchema, {
        ...own,
        capability: 'Not A Key',
      }),
    ).toBe(true);
    expect(
      refused(EditorialReviewDetailResourceSchema, {
        ...validReviewDetail,
        workflowPolicy: {
          ...validReviewDetail.workflowPolicy,
          requiredDecisionCount: 2,
        },
        requiredDecisionCount: 2,
        recordedDecisionCount: 2,
        distinctApprovalCount: 2,
        decisions: [approve(1, true), approve(2, true)],
      }),
    ).toBe(true);
  });

  it('bounds owner-only assignments at 32 and exposes no person, actor or party identifier', () => {
    const summaries = (count: number) =>
      Array.from({ length: count }, (_, index) => ({
        ...validAssignmentSummary,
        assignmentId: uid(60 + index),
        reviewerLabel: `Reviewer ${index + 1}`,
      }));
    expect(
      EditorialReviewDetailResourceSchema.safeParse({
        ...validReviewDetail,
        assignments: summaries(32),
      }).success,
    ).toBe(true);
    expect(
      refused(EditorialReviewDetailResourceSchema, {
        ...validReviewDetail,
        assignments: summaries(33),
      }),
    ).toBe(true);
    expect(
      refused(EditorialReviewDetailResourceSchema, {
        ...validReviewDetail,
        assignments: [validAssignmentSummary, validAssignmentSummary],
      }),
    ).toBe(true);
    expect(
      EditorialReviewAssignmentSummarySchema.parse(validAssignmentSummary),
    ).toEqual(validAssignmentSummary);
    expect(
      refused(EditorialReviewAssignmentSummarySchema, {
        ...validAssignmentSummary,
        reviewerPersonId: uuid,
      }),
    ).toBe(true);
    expect(
      refused(EditorialReviewAssignmentSummarySchema, {
        ...validAssignmentSummary,
        reviewerLabel: uuid,
      }),
    ).toBe(true);
    expect(
      refused(EditorialReviewAssignmentSummarySchema, {
        ...validAssignmentSummary,
        reviewerLabel: '   ',
      }),
    ).toBe(true);
    expect(
      refused(EditorialReviewAssignmentSummarySchema, {
        ...validAssignmentSummary,
        endsAt: '2026-10-20T12:00:00Z',
      }),
    ).toBe(true);
    expect(
      refused(EditorialReviewAssignmentSummarySchema, {
        ...validAssignmentSummary,
        state: 'expired',
      }),
    ).toBe(true);
  });

  it('carries the caller assignment and at most five unique closed next actions', () => {
    expect(
      EditorialReviewDetailResourceSchema.safeParse({
        ...validReviewDetail,
        myAssignment: { assignmentId: uid(11), endsAt: '2026-10-10T12:00:00Z' },
      }).success,
    ).toBe(true);
    expect(
      refused(EditorialReviewDetailResourceSchema, {
        ...validReviewDetail,
        myAssignment: {
          assignmentId: uid(11),
          endsAt: '2026-10-10T12:00:00Z',
          personId: uuid,
        },
      }),
    ).toBe(true);
    expect(ReviewNextActionSchema.options).toEqual([
      'record_decision',
      'assign_reviewer',
      'revoke_assignment',
      'schedule',
      'publish',
    ]);
    expect(
      EditorialReviewDetailResourceSchema.safeParse({
        ...validReviewDetail,
        permittedNextActions: [...ReviewNextActionSchema.options],
      }).success,
    ).toBe(true);
    expect(
      refused(EditorialReviewDetailResourceSchema, {
        ...validReviewDetail,
        permittedNextActions: ['record_decision', 'record_decision'],
      }),
    ).toBe(true);
    expect(
      refused(EditorialReviewDetailResourceSchema, {
        ...validReviewDetail,
        permittedNextActions: ['submit_review'],
      }),
    ).toBe(true);
  });

  it('bounds the revision number, locale and content type label', () => {
    expect(
      refused(EditorialReviewDetailResourceSchema, {
        ...validReviewDetail,
        revisionNumber: '0',
      }),
    ).toBe(true);
    expect(
      refused(EditorialReviewDetailResourceSchema, {
        ...validReviewDetail,
        locale: 'x',
      }),
    ).toBe(true);
    expect(
      refused(EditorialReviewDetailResourceSchema, {
        ...validReviewDetail,
        contentTypeLabel: '',
      }),
    ).toBe(true);
    expect(
      refused(EditorialReviewDetailResourceSchema, {
        ...validReviewDetail,
        contentTypeLabel: 'x'.repeat(121),
      }),
    ).toBe(true);
  });
});

describe('[P2-S11-AC-061][P2-S11-AC-062] CMS-03B-17 request contracts', () => {
  it('defaults scope to assigned and limit to 25 and takes only the allowlisted keys', () => {
    expect(ReviewQueueScopeSchema.options).toEqual(['assigned', 'submitted']);
    expect(ReviewQueueQuerySchema.parse({})).toEqual({
      limit: 25,
      scope: 'assigned',
    });
    expect(
      ReviewQueueQuerySchema.parse({
        scope: 'submitted',
        state: 'open',
        limit: 50,
        cursor: 'c'.repeat(512),
      }),
    ).toMatchObject({ scope: 'submitted', state: 'open', limit: 50 });
    expect(ReviewQueueQuerySchema.parse({ cursor: null }).cursor).toBeNull();
    for (const bad of [
      { scope: 'all' },
      { scope: 'owned' },
      { state: 'pending' },
      { state: 'submitted' },
      { limit: 0 },
      { limit: 51 },
      { limit: 1.5 },
      { cursor: 'c'.repeat(513) },
      { contentTypeId: uuid },
      { extra: 1 },
    ])
      expect(refused(ReviewQueueQuerySchema, bad), JSON.stringify(bad)).toBe(
        true,
      );
  });

  it('declares the OpenAPI transport view as the allowlisted query only', () => {
    expect(ReviewQueueApiRequestSchema.parse({ query: {} }).query.scope).toBe(
      'assigned',
    );
    expect(
      refused(ReviewQueueApiRequestSchema, { query: { scope: 'owned' } }),
    ).toBe(true);
    expect(
      refused(ReviewQueueApiRequestSchema, { query: {}, headers: {} }),
    ).toBe(true);
    expect(refused(ReviewQueueApiRequestSchema, { query: {}, body: {} })).toBe(
      true,
    );
    expect(refused(ReviewQueueApiRequestSchema, {})).toBe(true);
  });
});

describe('[P2-S11-AC-061] ReviewQueuePage and ReviewQueueItem', () => {
  it('accepts a bounded page and a continuation cursor', () => {
    expect(ReviewQueuePageSchema.parse(validQueuePage)).toEqual(validQueuePage);
    expect(
      ReviewQueuePageSchema.parse({
        ...validQueuePage,
        nextCursor: 'c'.repeat(512),
      }).nextCursor,
    ).toHaveLength(512);
    expect(
      ReviewQueuePageSchema.safeParse({ ...validQueuePage, items: [] }).success,
    ).toBe(true);
  });

  it('rejects unknown keys, a missing cursor member and an oversized cursor', () => {
    expect(
      refused(ReviewQueuePageSchema, { ...validQueuePage, total: 9 }),
    ).toBe(true);
    expect(
      refused(ReviewQueuePageSchema, {
        items: [validQueueItem],
        pageVersion: '5',
      }),
    ).toBe(true);
    expect(
      refused(ReviewQueuePageSchema, {
        ...validQueuePage,
        nextCursor: 'c'.repeat(513),
      }),
    ).toBe(true);
    expect(
      refused(ReviewQueuePageSchema, { ...validQueuePage, pageVersion: '0' }),
    ).toBe(true);
    expect(
      refused(ReviewQueueItemSchema, { ...validQueueItem, ownerId: uuid }),
    ).toBe(true);
    expect(
      refused(ReviewQueueItemSchema, { ...validQueueItem, submittedBy: uuid }),
    ).toBe(true);
    for (const key of Object.keys(validQueueItem)) {
      const rest = without(validQueueItem, key as keyof typeof validQueueItem);
      expect(refused(ReviewQueueItemSchema, rest), key).toBe(true);
    }
  });

  it('bounds the page at 50 items in strict (updatedAt DESC, reviewId DESC) order', () => {
    const at = (index: number, updatedAt: string) => ({
      ...validQueueItem,
      reviewId: uid(200 + index),
      updatedAt,
    });
    const fifty = Array.from({ length: 50 }, (_, index) =>
      at(
        index,
        new Date(Date.parse('2026-10-08T12:00:00Z') - index * 1000)
          .toISOString()
          .replace('.000Z', 'Z'),
      ),
    );
    expect(
      ReviewQueuePageSchema.safeParse({ ...validQueuePage, items: fifty })
        .success,
    ).toBe(true);
    expect(
      refused(ReviewQueuePageSchema, {
        ...validQueuePage,
        items: [...fifty, at(50, '2026-10-08T11:00:00Z')],
      }),
    ).toBe(true);
    expect(
      refused(ReviewQueuePageSchema, {
        ...validQueuePage,
        items: [at(1, '2026-10-08T11:00:00Z'), at(2, '2026-10-08T12:00:00Z')],
      }),
    ).toBe(true);
    // Equal instants fall back to reviewId DESC.
    expect(
      ReviewQueuePageSchema.safeParse({
        ...validQueuePage,
        items: [at(2, instantOf), at(1, instantOf)],
      }).success,
    ).toBe(true);
    expect(
      refused(ReviewQueuePageSchema, {
        ...validQueuePage,
        items: [at(1, instantOf), at(2, instantOf)],
      }),
    ).toBe(true);
    expect(
      refused(ReviewQueuePageSchema, {
        ...validQueuePage,
        items: [at(1, instantOf), at(1, instantOf)],
      }),
    ).toBe(true);
    // The same instant written with another offset compares equal.
    expect(
      ReviewQueuePageSchema.safeParse({
        ...validQueuePage,
        items: [at(2, '2026-10-08T14:00:00+02:00'), at(1, instantOf)],
      }).success,
    ).toBe(true);
  });

  it('keeps the closed state, risk class, myDecision and count bounds', () => {
    expect(
      refused(ReviewQueueItemSchema, { ...validQueueItem, state: 'pending' }),
    ).toBe(true);
    expect(
      refused(ReviewQueueItemSchema, {
        ...validQueueItem,
        myDecision: 'abstain',
      }),
    ).toBe(true);
    expect(
      ReviewQueueItemSchema.safeParse({
        ...validQueueItem,
        myDecision: 'approve',
      }).success,
    ).toBe(true);
    expect(
      refused(ReviewQueueItemSchema, {
        ...validQueueItem,
        requiredDecisionCount: 9,
      }),
    ).toBe(true);
    expect(
      refused(ReviewQueueItemSchema, {
        ...validQueueItem,
        recordedDecisionCount: 2,
      }),
    ).toBe(true);
    expect(
      refused(ReviewQueueItemSchema, {
        ...validQueueItem,
        riskClass: 'protected',
      }),
    ).toBe(true);
    expect(
      ReviewQueueItemSchema.safeParse({
        ...validQueueItem,
        riskClass: 'protected',
        requiredDecisionCount: 2,
        recordedDecisionCount: 1,
      }).success,
    ).toBe(true);
    expect(
      ReviewQueueItemSchema.safeParse({
        ...validQueueItem,
        assignmentEndsAt: null,
      }).success,
    ).toBe(true);
    expect(
      refused(ReviewQueueItemSchema, {
        ...validQueueItem,
        assignmentEndsAt: '2026-10-10',
      }),
    ).toBe(true);
    expect(
      refused(ReviewQueueItemSchema, {
        ...validQueueItem,
        contentTypeLabel: '',
      }),
    ).toBe(true);
  });
});

const instantOf = '2026-10-08T12:00:00Z';
