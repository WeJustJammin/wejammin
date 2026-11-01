/**
 * Slice 11 real composition, CMS-03B-16 review-detail read (lane S11-4R read
 * families; split from the inherited combined refusal suite and extended for the
 * 16 obligations). The detail read through the production Worker routes,
 * adapters, Kong, PostgREST and SQL must expose the caller's OWN decision reason
 * and redact every other reader's; `assignments` is owner-only and carries no
 * person, actor or party identifier; a non-owner reader still receives its own
 * `myAssignment.assignmentId`; and the live `distinctApprovalCount` recount is
 * served. Every read writes nothing.

 * The fixture is built INLINE so the expected reason, assignment id and approval
 * count are the exact values this test issued, not producer-derived lists. All
 * failure diagnostics are safe: exact comparisons go through `expectSafeEqual`
 * (boolean + digests), identifier absence through `expectAbsent` (boolean), and no
 * raw resource body is ever diffed.
 *
 * Commits fixtures; run right after `pnpm db:reset`, and reset again afterwards.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import {
  EditorialReviewAssignmentResourceSchema,
  EditorialReviewDetailResourceSchema,
  EditorialReviewResourceSchema,
} from '@wejammin/contracts';

import {
  assignReviewer,
  readWorkflow,
  submitForReview,
} from './support/phase-02-slice-11-flow';
import {
  expectAbsent,
  expectSafeEqual,
  expectSafeError,
  expectStatus,
  expectUnchanged,
  snapshotDigest,
} from './support/phase-02-slice-11-assert';
import {
  expectReadHeaders,
  expectReadIdentity,
} from './support/phase-02-slice-11-read-support';
import {
  type S11Stack,
  createS11Stack,
} from './support/phase-02-slice-11-stack';
import {
  type S11World,
  prepareS11World,
  seedDraft,
} from './support/phase-02-slice-11-world';

/** The exact reason this test issues for its single approve decision. */
const REASON = 'Detail read fixture reason.';

let world: S11World;
let stack: S11Stack;
let reviewId = '';
let issuedAssignmentId = '';

beforeAll(async () => {
  world = await prepareS11World();
  stack = createS11Stack(world.owner);
  const draft = await seedDraft(stack, world, 'Detail subject');
  const review = await submitForReview(stack, world, draft);
  const reviewVersion = String(review.version);
  reviewId = review.id;
  // The owner creates exactly one assignment; capture the ISSUED assignment id.
  const assigned = await assignReviewer(stack, world, reviewId, reviewVersion);
  issuedAssignmentId = EditorialReviewAssignmentResourceSchema.parse(
    assigned.body,
  ).id;
  // The assigned reviewer records the single approve with the KNOWN reason.
  stack.as(world.reviewer, 'fresh');
  const decided = await stack.post(`/api/v1/cms/reviews/${reviewId}/decision`, {
    body: {
      reviewId,
      decision: 'approve',
      reason: REASON,
      expectedVersion: reviewVersion,
    },
    ifMatch: reviewVersion,
  });
  expectStatus(decided, 200);
  expect(EditorialReviewResourceSchema.parse(decided.body).state).toBe(
    'approved',
  );
  // Keep the workflow read exercised so the frozen manifest/version set are real.
  await readWorkflow(stack, draft.entryId);
});

describe('CMS-03B-16 review detail through the real stack', () => {
  it('[CMS-03B-16] the deciding reviewer sees its own reason and live recount while the owner sees assignments and a redacted reason, with no person identifiers', async () => {
    // The owner is a reader (receipt-derived owner scope) but not the decider.
    stack.as(world.owner);
    const before = snapshotDigest();
    const ownerResponse = await stack.get(`/api/v1/cms/reviews/${reviewId}`);
    expectStatus(ownerResponse, 200);
    expectReadHeaders(ownerResponse);
    const ownerDetail = EditorialReviewDetailResourceSchema.parse(
      ownerResponse.body,
    );
    expect(ownerDetail.state).toBe('approved');
    expectSafeEqual(
      ownerResponse.headers.get('etag'),
      `"${ownerDetail.version}"`,
      'owner detail ETag',
    );
    // Live recount: exactly the one approve this fixture issued.
    expectSafeEqual(ownerDetail.distinctApprovalCount, 1, 'owner recount');
    const ownerDecision = ownerDetail.decisions.find(
      (decision) => decision.decision === 'approve',
    );
    expect(ownerDecision).toBeDefined();
    // The owner is not the decider: the reason is redacted and mine is false.
    expect(ownerDecision?.mine === false).toBe(true);
    expect(ownerDecision?.reason === null).toBe(true);
    // The owner sees EXACTLY the one assignment this fixture issued (id, count).
    expectSafeEqual(
      ownerDetail.assignments.map((assignment) => assignment.assignmentId),
      [issuedAssignmentId],
      'owner assignment membership',
    );
    // No person, actor or party identifier is serialized in the owner response.
    expectAbsent(
      ownerResponse,
      world.reviewer.personId,
      'the detail read never discloses the decider person id',
    );
    expectAbsent(
      ownerResponse,
      world.owner.personId,
      'the detail read never discloses the owner person id',
    );

    // The decider sees its own reason and mine=true; it is not the owner, so its
    // assignment summary list is empty but its own myAssignment id is served.
    stack.as(world.reviewer);
    const deciderResponse = await stack.get(`/api/v1/cms/reviews/${reviewId}`);
    expectStatus(deciderResponse, 200);
    expectReadHeaders(deciderResponse);
    const deciderDetail = EditorialReviewDetailResourceSchema.parse(
      deciderResponse.body,
    );
    expectSafeEqual(deciderDetail.distinctApprovalCount, 1, 'decider recount');
    const deciderDecision = deciderDetail.decisions.find(
      (decision) => decision.mine,
    );
    expect(deciderDecision).toBeDefined();
    // The reason is EXACTLY the value this fixture issued.
    expect(deciderDecision?.reason === REASON).toBe(true);
    // A non-owner reader receives no assignment summaries but its own myAssignment.
    expectSafeEqual(deciderDetail.assignments, [], 'decider assignments');
    expectSafeEqual(
      deciderDetail.myAssignment?.assignmentId,
      issuedAssignmentId,
      'decider myAssignment binding',
    );

    // Every read writes nothing: the whole 14-table effect snapshot is unchanged.
    expectUnchanged(
      before,
      snapshotDigest(),
      'the CMS-03B-16 detail reads commit no durable effect',
    );
  });

  it('[CMS-03B-16] publisher detail redacts another decision reason and assignments while binding request identity without effects', async () => {
    stack.as(world.publisher);
    const before = snapshotDigest();
    const requestId = '77777777-7777-4777-8777-777777777777';
    const correlationId = '88888888-8888-4888-8888-888888888888';
    stack.clearRpcs();
    const response = await stack.get(`/api/v1/cms/reviews/${reviewId}`, {
      headers: { 'x-request-id': requestId, 'x-correlation-id': correlationId },
    });
    expectStatus(response, 200);
    expectReadHeaders(response);
    expectReadIdentity(stack, response, requestId, correlationId);
    const detail = EditorialReviewDetailResourceSchema.parse(response.body);
    expect(detail.decisions).toHaveLength(1);
    expectSafeEqual(
      detail.decisions.map(({ mine, reason }) => ({ mine, reason })),
      [{ mine: false, reason: null }],
      'publisher reason privacy',
    );
    expectSafeEqual(detail.assignments, [], 'publisher assignment privacy');
    expect(detail.myAssignment).toBeNull();
    expect(detail.distinctApprovalCount).toBe(1);
    expectSafeEqual(
      detail.permittedNextActions,
      ['schedule', 'publish'],
      'publisher next actions',
    );
    for (const identifier of [
      world.owner.personId,
      world.reviewer.personId,
      world.organizationId,
      world.reviewer.authUserId,
      REASON,
    ]) {
      expectAbsent(
        response,
        identifier,
        'publisher detail excludes private identity or reason',
      );
    }
    stack.as(world.reviewer2);
    const visibleDenied = await stack.get(`/api/v1/cms/reviews/${reviewId}`);
    expectSafeError(visibleDenied, {
      status: 403,
      code: 'FORBIDDEN',
      details: { reasonCode: 'capability_missing' },
    });
    expectUnchanged(
      before,
      snapshotDigest(),
      'publisher and unassigned-reader detail reads write nothing',
    );
  });
});
