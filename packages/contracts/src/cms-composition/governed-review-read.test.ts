import { describe, expect, it } from 'vitest';

import {
  hash,
  hash2,
  instant,
  isRefused,
  issuePaths,
  laterInstant,
  resourceMeta,
  uid,
  without,
} from './composition-fixtures.test-support';
import {
  GovernedNextActionSchema,
  GovernedReviewDetailApiRequestSchema,
  GovernedReviewDetailResourceSchema,
} from './governed-review-read';

const decision = {
  id: uid(60),
  decision: 'approve',
  capability: 'cms.reviewer',
  decidedAt: instant,
  mine: true,
  reason: 'Looks right.',
} as const;
const assignmentSummary = {
  assignmentId: uid(61),
  version: '1',
  state: 'active',
  startsAt: instant,
  endsAt: laterInstant,
  reviewerLabel: 'Reviewer A',
} as const;
const detail = {
  ...resourceMeta,
  state: 'open',
  subjectKind: 'template_version',
  subjectId: uid(20),
  lineageId: uid(21),
  subjectKey: 'profile-header',
  subjectVersion: 2,
  subjectHash: hash,
  riskClass: 'ordinary',
  requiredDecisionCount: 2,
  recordedDecisionCount: 1,
  requiredCapabilities: ['cms.reviewer'],
  policyBasisHash: hash2,
  submittedAt: instant,
  decidedAt: null,
  activatedAt: null,
  invalidatedReason: null,
  blockRegistryDigest: hash,
  policyBasis: [
    {
      contentTypeLabel: 'Profile',
      policyKey: 'editorial.default',
      policyVersion: '1',
    },
  ],
  distinctApprovalCount: 1,
  decisions: [decision],
  assignments: [],
  myAssignment: null,
  subjectState: 'review',
  permittedNextActions: ['record_decision'],
} as const;

describe('CMS-03C-10 governed review detail contract', () => {
  it('[P2-S12-AC-089] accepts only a UUID reviewId path and an empty strict query', () => {
    expect(
      GovernedReviewDetailApiRequestSchema.parse({
        reviewId: uid(1),
        query: {},
      }),
    ).toEqual({ reviewId: uid(1), query: {} });
    for (const candidate of [
      { reviewId: uid(1), query: { debug: '1' } },
      { reviewId: uid(1), query: { cursor: 'x' } },
      { reviewId: 'not-a-uuid', query: {} },
      { query: {} },
      { reviewId: uid(1) },
      { reviewId: uid(1), query: {}, headers: {} },
    ])
      expect(isRefused(GovernedReviewDetailApiRequestSchema, candidate)).toBe(
        true,
      );
  });

  it('[P2-S12-AC-088] accepts the review base fields, nullable digest, policy basis, decisions, assignments and next actions', () => {
    expect(GovernedReviewDetailResourceSchema.parse(detail)).toEqual(detail);
    const full = {
      ...detail,
      blockRegistryDigest: null,
      assignments: [assignmentSummary],
      myAssignment: { assignmentId: uid(61), endsAt: laterInstant },
      permittedNextActions: [
        'record_decision',
        'assign_reviewer',
        'revoke_assignment',
        'activate',
        'schedule',
        'retire',
      ],
    };
    expect(GovernedReviewDetailResourceSchema.parse(full)).toEqual(full);
  });

  it('[P2-S12-AC-088] closes the next actions to the six the review may offer', () => {
    expect(GovernedNextActionSchema.options).toEqual([
      'record_decision',
      'assign_reviewer',
      'revoke_assignment',
      'activate',
      'schedule',
      'retire',
    ]);
    for (const permittedNextActions of [
      ['publish'],
      ['record_decision', 'record_decision'],
      Array.from({ length: 7 }, () => 'activate'),
    ])
      expect(
        isRefused(GovernedReviewDetailResourceSchema, {
          ...detail,
          permittedNextActions,
        }),
      ).toBe(true);
    expect(
      GovernedReviewDetailResourceSchema.safeParse({
        ...detail,
        permittedNextActions: [],
      }).success,
    ).toBe(true);
  });

  it('[P2-S12-AC-089] shows a decision reason only to its decider and exposes no decision member beyond the six', () => {
    expect(
      issuePaths(GovernedReviewDetailResourceSchema, {
        ...detail,
        decisions: [{ ...decision, mine: false }],
      }),
    ).toContain('decisions.0.reason');
    expect(
      GovernedReviewDetailResourceSchema.safeParse({
        ...detail,
        decisions: [{ ...decision, mine: false, reason: null }],
      }).success,
    ).toBe(true);
    for (const extra of [
      { deciderPersonId: uid(1) },
      { stepUpAt: instant },
      { reviewerLabel: 'A' },
    ])
      expect(
        isRefused(GovernedReviewDetailResourceSchema, {
          ...detail,
          decisions: [{ ...decision, ...extra }],
        }),
      ).toBe(true);
  });

  it('[P2-S12-AC-089] bounds decisions at 8 and assignments at 32 and keeps both internally consistent', () => {
    const eight = Array.from({ length: 8 }, (_, index) => ({
      ...decision,
      id: uid(100 + index),
      mine: index === 0,
      reason: index === 0 ? 'Looks right.' : null,
    }));
    expect(
      GovernedReviewDetailResourceSchema.safeParse({
        ...detail,
        requiredDecisionCount: 8,
        recordedDecisionCount: 8,
        decisions: eight,
        distinctApprovalCount: 8,
      }).success,
    ).toBe(true);
    expect(
      isRefused(GovernedReviewDetailResourceSchema, {
        ...detail,
        requiredDecisionCount: 8,
        recordedDecisionCount: 8,
        decisions: [
          ...eight,
          { ...decision, id: uid(200), mine: false, reason: null },
        ],
        distinctApprovalCount: 8,
      }),
    ).toBe(true);
    const assignments = (count: number) =>
      Array.from({ length: count }, (_, index) => ({
        ...assignmentSummary,
        assignmentId: uid(300 + index),
      }));
    expect(
      GovernedReviewDetailResourceSchema.safeParse({
        ...detail,
        assignments: assignments(32),
      }).success,
    ).toBe(true);
    expect(
      isRefused(GovernedReviewDetailResourceSchema, {
        ...detail,
        assignments: assignments(33),
      }),
    ).toBe(true);
    // One decision row per recorded decision; ids unique; one decision per human.
    expect(
      isRefused(GovernedReviewDetailResourceSchema, {
        ...detail,
        recordedDecisionCount: 0,
        distinctApprovalCount: 0,
      }),
    ).toBe(true);
    expect(
      isRefused(GovernedReviewDetailResourceSchema, {
        ...detail,
        requiredDecisionCount: 2,
        recordedDecisionCount: 2,
        decisions: [decision, { ...decision }],
        distinctApprovalCount: 2,
      }),
    ).toBe(true);
    expect(
      isRefused(GovernedReviewDetailResourceSchema, {
        ...detail,
        requiredDecisionCount: 2,
        recordedDecisionCount: 2,
        decisions: [decision, { ...decision, id: uid(62) }],
        distinctApprovalCount: 2,
      }),
    ).toBe(true);
    expect(
      isRefused(GovernedReviewDetailResourceSchema, {
        ...detail,
        distinctApprovalCount: 2,
      }),
    ).toBe(true);
    expect(
      isRefused(GovernedReviewDetailResourceSchema, {
        ...detail,
        assignments: [assignmentSummary, assignmentSummary],
      }),
    ).toBe(true);
  });

  it('[P2-S12-AC-089] gives every assignment a server-built label, never a person or party identifier', () => {
    for (const extra of [
      { reviewerPersonId: uid(1) },
      { reviewerLabel: uid(1) },
      { reviewerLabel: '   ' },
      { reviewerLabel: '' },
      { reviewerLabel: 'x'.repeat(121) },
      { state: 'expired' },
    ])
      expect(
        isRefused(GovernedReviewDetailResourceSchema, {
          ...detail,
          assignments: [{ ...assignmentSummary, ...extra }],
        }),
      ).toBe(true);
    expect(
      GovernedReviewDetailResourceSchema.safeParse({
        ...detail,
        assignments: [{ ...assignmentSummary, reviewerLabel: 'x'.repeat(120) }],
      }).success,
    ).toBe(true);
  });

  it('[P2-S12-AC-088] bounds the policy basis at 64 entries of label, policy key and policy version', () => {
    const entry = detail.policyBasis[0];
    expect(
      GovernedReviewDetailResourceSchema.safeParse({
        ...detail,
        policyBasis: Array.from({ length: 64 }, () => entry),
      }).success,
    ).toBe(true);
    for (const policyBasis of [
      Array.from({ length: 65 }, () => entry),
      [{ ...entry, contentTypeLabel: '' }],
      [{ ...entry, contentTypeLabel: 'x'.repeat(121) }],
      [{ ...entry, policyKey: 'Editorial Default' }],
      [{ ...entry, policyVersion: '0' }],
      [{ ...entry, policyVersion: 1 }],
      [{ ...entry, policyHash: hash }],
      [{ ...entry, contentTypeId: uid(1) }],
    ])
      expect(
        isRefused(GovernedReviewDetailResourceSchema, {
          ...detail,
          policyBasis,
        }),
      ).toBe(true);
  });

  it('[P2-S12-AC-088] limits subjectState to the eight definition states and an optional-nullable digest to a lowercase hash', () => {
    for (const subjectState of [
      'draft',
      'review',
      'approved',
      'scheduled',
      'active',
      'superseded',
      'retired',
      'blocked',
    ])
      expect(
        GovernedReviewDetailResourceSchema.safeParse({
          ...detail,
          subjectState,
        }).success,
      ).toBe(true);
    for (const candidate of [
      { ...detail, subjectState: 'published' },
      { ...detail, blockRegistryDigest: 'A'.repeat(64) },
      { ...detail, blockRegistryDigest: '' },
      without(detail, 'blockRegistryDigest'),
      without(detail, 'myAssignment'),
      without(detail, 'policyBasis'),
      { ...detail, ownerId: uid(1) },
      { ...detail, myAssignment: { assignmentId: uid(1) } },
      {
        ...detail,
        myAssignment: { assignmentId: uid(1), endsAt: instant, x: 1 },
      },
    ])
      expect(isRefused(GovernedReviewDetailResourceSchema, candidate)).toBe(
        true,
      );
  });

  it('[P2-S12-AC-088] keeps the review-base invariants on the detail', () => {
    expect(
      isRefused(GovernedReviewDetailResourceSchema, {
        ...detail,
        state: 'invalidated',
        invalidatedReason: null,
      }),
    ).toBe(true);
    expect(
      isRefused(GovernedReviewDetailResourceSchema, {
        ...detail,
        riskClass: 'protected',
        requiredDecisionCount: 1,
        recordedDecisionCount: 1,
      }),
    ).toBe(true);
  });
});
