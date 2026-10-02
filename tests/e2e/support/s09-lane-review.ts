import type { ContentSchemaRegistryPorts } from '../../../apps/worker/src/content-schema-registry/types';

import { fixtureHash } from './s09-lane-hash';
import { lanePersonRole } from './s09-lane-ids';
import {
  assignmentResource,
  decisionResource,
  reviewResource,
} from './s09-lane-registry-views';
import {
  conflict,
  forbidden,
  invalid,
  notFound,
  ok,
  unavailable,
  versionMismatch,
} from './s09-lane-result';
import { bodyOf, laneContext, touch, versionFor } from './s09-lane-support';
import {
  ID_KIND,
  iso,
  nextId,
  type AssignmentRecord,
  type ReviewRecord,
  type World,
} from './s09-lane-world';

const SEVEN_DAYS_MS = 7 * 24 * 3_600_000;

const reviewById = (world: World, id: string | undefined): ReviewRecord | null =>
  world.reviews.find((entry) => entry.id === id) ?? null;

const activeAssignment = (review: ReviewRecord, role: string): AssignmentRecord | null =>
  review.assignments.find(
    (entry) =>
      entry.reviewer === role &&
      entry.state === 'active' &&
      Date.parse(entry.endsAt) > Date.now(),
  ) ?? null;

const submitSchemaReview: ContentSchemaRegistryPorts['submitSchemaReview'] = async (input) => {
  const lane = laneContext(input);
  if (lane === null) return unavailable();
  const { world, claim } = lane;
  const version = versionFor(world, input);
  if (version === null) return notFound();
  const body = bodyOf(input);
  if (body.expectedVersion !== String(version.rev)) return versionMismatch();
  const run = world.dryRuns.find((entry) => entry.id === version.dryRunId);
  if (
    version.state !== 'draft' ||
    run === undefined ||
    run.id !== body.dryRunId ||
    run.state !== 'completed' ||
    run.result !== 'passed'
  )
    return conflict('sealed_passed_dry_run_required');
  const review: ReviewRecord = {
    id: nextId(world, ID_KIND.review),
    versionId: version.id,
    version: 1,
    state: 'open',
    submitter: claim.role,
    submittedAt: iso(Date.now()),
    decidedAt: null,
    approvalEvidenceHash: null,
    decisions: [],
    assignments: [],
  };
  world.reviews.push(review);
  version.state = 'review';
  version.reviewId = review.id;
  touch(version);
  return ok(reviewResource(world, review, claim.role)) as never;
};

const getSchemaReview: ContentSchemaRegistryPorts['getSchemaReview'] = async (input) => {
  const lane = laneContext(input);
  if (lane === null) return unavailable();
  const { world, claim } = lane;
  const review = reviewById(world, input.path?.reviewId);
  if (review === null) return notFound();
  const reviewer = claim.role === 'reviewer' || claim.role === 'reviewer2';
  // An assigned reader sees only reviews they are (or were) assigned to; any
  // other reviewer cannot learn the review exists.
  if (reviewer && !review.assignments.some((entry) => entry.reviewer === claim.role))
    return notFound();
  return ok(reviewResource(world, review, claim.role)) as never;
};

const assignSchemaReview: ContentSchemaRegistryPorts['assignSchemaReview'] = async (input) => {
  const lane = laneContext(input);
  if (lane === null) return unavailable();
  const { world } = lane;
  const review = reviewById(world, input.path?.reviewId);
  if (review === null) return notFound();
  const body = bodyOf(input);
  if (body.expectedVersion !== String(review.version)) return versionMismatch();
  if (review.state !== 'open') return conflict('review_not_open');
  if (body.action === 'revoke') {
    const entry = review.assignments.find((item) => item.id === body.assignmentId);
    if (entry === undefined) return notFound();
    if (entry.state === 'revoked') return conflict('assignment_already_revoked');
    entry.state = 'revoked';
    entry.version += 1;
    review.version += 1;
    return ok(assignmentResource(review, entry.id)) as never;
  }
  const reviewer = lanePersonRole(String(body.reviewerPersonId));
  if (reviewer !== 'reviewer' && reviewer !== 'reviewer2') return notFound();
  const endsAt = Date.parse(String(body.expiresAt));
  if (!(endsAt > Date.now()) || endsAt - Date.now() > SEVEN_DAYS_MS)
    return invalid('assignment_span_invalid');
  if (activeAssignment(review, reviewer) !== null)
    return conflict('assignment_exists');
  const entry: AssignmentRecord = {
    id: nextId(world, ID_KIND.assignment),
    reviewId: review.id,
    reviewer,
    state: 'active',
    startsAt: iso(Date.now()),
    endsAt: iso(endsAt),
    version: 1,
    reason: typeof body.reason === 'string' ? body.reason : null,
  };
  review.assignments.push(entry);
  review.version += 1;
  return ok(assignmentResource(review, entry.id)) as never;
};

const decideSchemaReview: ContentSchemaRegistryPorts['decideSchemaReview'] = async (input) => {
  const lane = laneContext(input);
  if (lane === null) return unavailable();
  const { world, claim } = lane;
  const review = reviewById(world, input.path?.reviewId);
  if (review === null || activeAssignment(review, claim.role) === null)
    return review === null ? notFound() : forbidden('assignment_required');
  const body = bodyOf(input);
  if (body.expectedVersion !== String(review.version)) return versionMismatch();
  if (review.state !== 'open') return conflict('review_not_open');
  if (review.decisions.some((entry) => entry.reviewer === claim.role))
    return conflict('already_decided');
  const decision = {
    id: nextId(world, ID_KIND.decision),
    reviewId: review.id,
    decision: body.decision as 'approve' | 'reject',
    reviewer: claim.role,
    decidedAt: iso(Date.now()),
  };
  review.decisions.push(decision);
  review.version += 1;
  const version = world.versions.find((entry) => entry.id === review.versionId);
  if (version !== undefined) {
    if (decision.decision === 'approve') {
      review.state = 'approved';
      review.decidedAt = decision.decidedAt;
      review.approvalEvidenceHash = fixtureHash(`approval:${review.id}:${decision.id}`);
      version.state = 'approved';
    } else {
      review.state = 'rejected';
      version.state = 'draft';
    }
    touch(version);
  }
  return ok(decisionResource(review, decision.id)) as never;
};

export const createLaneReviewPorts = () => ({
  submitSchemaReview,
  getSchemaReview,
  assignSchemaReview,
  decideSchemaReview,
});
