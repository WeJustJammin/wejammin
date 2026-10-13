import {
  EditorialReviewDetailResourceSchema,
  type EditorialReviewDetailResource,
} from '@wejammin/contracts';
import { describe, it } from 'vitest';

import {
  at,
  breachRows,
  expectRefused,
  expectServed,
  uuid,
  type Breach,
  type BreachSchema,
} from './workflow-read-breach.test-support';
import {
  assignmentId,
  hash2,
  instant,
  policyEvidence,
  reviewDetailResource,
  reviewId,
} from './workflow-fixtures.test-support';

/*
 * CMS-03B-16 response bounds (BE03b "decisions / assignments" and the review
 * invariants; AC-056, AC-059): `invalidatedReason` exactly when invalidated,
 * `decidedAt` exactly when approved or rejected, recorded at most required, a
 * protected review requiring 2 decisions, count and class equal to the frozen
 * workflow policy, at most 8 decisions and 32 assignments, one decision row per
 * recorded decision, and no member beyond the contract. Any other answer is
 * refused and never served; the inclusive bound is served.
 */

const schema = EditorialReviewDetailResourceSchema as BreachSchema;
const path = `/api/v1/cms/reviews/${reviewId}`;
const base: EditorialReviewDetailResource = reviewDetailResource;

const decision = (index: number, patch: Record<string, unknown> = {}) => ({
  id: uuid(index),
  decision: 'approve',
  capability: 'cms.reviewer',
  decidedAt: instant,
  mine: false,
  reason: null,
  ...patch,
});
const assignment = (index: number, patch: Record<string, unknown> = {}) => ({
  assignmentId: uuid(index),
  version: '1',
  state: 'active',
  startsAt: instant,
  endsAt: '2026-10-09T12:00:00Z',
  reviewerLabel: `Reviewer ${index + 1}`,
  ...patch,
});
const many = <T>(count: number, make: (index: number) => T): T[] =>
  Array.from({ length: count }, (_, index) => make(index));

/** An approved review requiring 8 decisions with `count` recorded decisions. */
const decided = (count: number, patch: Record<string, unknown> = {}) => ({
  ...base,
  state: 'approved',
  decidedAt: instant,
  requiredDecisionCount: 8,
  recordedDecisionCount: count,
  workflowPolicy: { ...policyEvidence, requiredDecisionCount: 8 },
  distinctApprovalCount: Math.min(count, 8),
  decisions: many(count, (index) => decision(index)),
  ...patch,
});

const breaches: readonly Breach[] = [
  [
    'an invalidatedReason on a review that is not invalidated',
    { ...base, invalidatedReason: 'dependency_changed' },
    at('invalidatedReason'),
  ],
  [
    'an invalidated review with no invalidatedReason',
    { ...base, state: 'invalidated' },
    at('invalidatedReason'),
  ],
  [
    'a decidedAt on a review that is still open',
    { ...base, decidedAt: instant },
    at('decidedAt'),
  ],
  [
    'an approved review with no decidedAt',
    { ...base, state: 'approved' },
    at('decidedAt'),
  ],
  [
    'more recorded decisions than required',
    {
      ...base,
      recordedDecisionCount: 2,
      decisions: many(2, (index) => decision(index)),
    },
    at('recordedDecisionCount'),
  ],
  [
    'a protected review requiring fewer than 2 decisions',
    {
      ...base,
      riskClass: 'protected',
      workflowPolicy: { ...policyEvidence, riskClass: 'protected' },
    },
    at('requiredDecisionCount', 'workflowPolicy'),
  ],
  [
    'a required count that is not the frozen workflow policy count',
    { ...base, requiredDecisionCount: 2 },
    at('requiredDecisionCount'),
  ],
  [
    'a risk class that is not the frozen workflow policy class',
    {
      ...base,
      riskClass: 'protected',
      requiredDecisionCount: 2,
      workflowPolicy: { ...policyEvidence, requiredDecisionCount: 2 },
    },
    at('riskClass'),
  ],
  [
    '9 decisions',
    decided(8, { decisions: many(9, (index) => decision(index)) }),
    at('decisions'),
  ],
  [
    '33 assignments',
    { ...base, assignments: many(33, (index) => assignment(index)) },
    at('assignments'),
  ],
  [
    'a decision with a member the contract does not name',
    decided(1, { decisions: [decision(0, { deciderPersonId: assignmentId })] }),
    at('decisions'),
  ],
  [
    'a decision reason on a decision that is not the caller own',
    decided(1, { decisions: [decision(0, { reason: 'Looks fine to me.' })] }),
    at('decisions'),
  ],
  [
    'two decisions marked as the caller own',
    decided(2, {
      decisions: [decision(0, { mine: true }), decision(1, { mine: true })],
    }),
    at('decisions'),
  ],
  [
    'two decisions with the same id',
    decided(2, { decisions: [decision(0), decision(0)] }),
    at('decisions'),
  ],
  [
    'fewer decision rows than recorded decisions',
    decided(2, { decisions: [decision(0)], distinctApprovalCount: 1 }),
    at('decisions'),
  ],
  [
    'more qualifying approvals than approve decisions',
    decided(1, { distinctApprovalCount: 2 }),
    at('distinctApprovalCount'),
  ],
  [
    'an assignment that names a person',
    {
      ...base,
      assignments: [assignment(0, { reviewerPersonId: assignmentId })],
    },
    at('assignments'),
  ],
  [
    'two assignments with the same id',
    { ...base, assignments: [assignment(0), assignment(0)] },
    at('assignments'),
  ],
  [
    '6 permitted next actions',
    { ...base, permittedNextActions: many(6, () => 'publish') },
    at('permittedNextActions'),
  ],
  [
    'a frozen candidate that restates another frozen hash',
    { ...base, frozen: { ...base.frozen, frozenHash: hash2 } },
    at('frozen'),
  ],
];

describe('CMS-03B-16 response bounds are refused, never served [P2-S11-AC-056] [P2-S11-AC-059]', () => {
  it.each(breachRows(breaches))('refuses %s', async (_name, breach) => {
    await expectRefused('getEditorialReview', schema, path, breach);
  });

  it('serves 8 decisions and 32 assignments, one fewer than a refused list', async () => {
    await expectServed(
      'getEditorialReview',
      schema,
      path,
      decided(8, { assignments: many(32, (index) => assignment(index)) }),
    );
  });

  it('serves a protected review requiring 2 decisions with one recorded', async () => {
    await expectServed('getEditorialReview', schema, path, {
      ...base,
      riskClass: 'protected',
      requiredDecisionCount: 2,
      recordedDecisionCount: 1,
      workflowPolicy: {
        ...policyEvidence,
        riskClass: 'protected',
        requiredDecisionCount: 2,
      },
      distinctApprovalCount: 1,
      decisions: [decision(0, { mine: true, reason: 'Candidate is correct.' })],
    });
  });
});
