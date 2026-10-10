/** CMS-03B-18 lifecycle: canonical owner receipt, real commands, full effects. */
import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  EditorialReviewAssignmentResourceSchema,
  EditorialReviewDetailResourceSchema,
} from '@wejammin/contracts';

import {
  assignReviewer,
  decide,
  submitForReview,
} from './support/phase-02-slice-11-flow';
import {
  expectAbsent,
  expectSafeEqual,
  expectSafeError,
  expectSameInstant,
  expectStatus,
  expectUnchanged,
  snapshotDigest,
} from './support/phase-02-slice-11-assert';
import {
  expectAssignmentEvent,
  expectOrdinaryAssignmentEffects,
} from './support/phase-02-slice-11-assignment-support';
import { expectReadIdentity } from './support/phase-02-slice-11-read-support';
import {
  createS11Stack,
  type S11Stack,
} from './support/phase-02-slice-11-stack';
import {
  addMember,
  prepareS11World,
  seedDraft,
  type S11World,
} from './support/phase-02-slice-11-world';

let world: S11World;
let stack: S11Stack;
const conflict = (reasonCode: string) => ({
  reasonCode,
});

beforeAll(async () => {
  world = await prepareS11World();
  stack = createS11Stack(world.owner);
});

describe('CMS-03B-18 assignment lifecycle', () => {
  it('[CMS-03B-18] create and ordinary revoke replay identical resources with exact audit event and unchanged review operand', async () => {
    const draft = await seedDraft(stack, world, 'Assignment lifecycle');
    const review = await submitForReview(stack, world, draft);
    const version = String(review.version);
    const path = `/api/v1/cms/reviews/${review.id}/assignments`;
    const expiresAt = new Date(Date.now() + 86_400_000).toISOString();
    const createBody = {
      action: 'create',
      expectedVersion: version,
      reviewerPersonId: world.reviewer.personId,
      expiresAt,
      reason: 'é'.repeat(256),
    };
    stack.as(world.owner, 'fresh');
    const before = snapshotDigest();
    const createId = randomUUID();
    const createKey = `assignment-create-${randomUUID()}`;
    stack.clearRpcs();
    const created = await stack.post(path, {
      body: createBody,
      ifMatch: version,
      idempotencyKey: createKey,
      headers: { 'x-request-id': createId },
    });
    expectStatus(created, 201);
    const assignment = EditorialReviewAssignmentResourceSchema.parse(
      created.body,
    );
    expectSafeEqual(assignment.reviewId, review.id, 'assignment review');
    expectSafeEqual(
      assignment.reason,
      createBody.reason,
      'NFC 256-character reason retained',
    );
    expectSafeEqual(
      assignment.actions,
      ['read', 'decide'],
      'only read and decide granted',
    );
    expectSameInstant(assignment.expiresAt, expiresAt, 'accepted expiry');
    expectSafeEqual(
      created.headers.get('etag'),
      `"${assignment.version}"`,
      'assignment create ETag',
    );
    expectSafeEqual(
      created.headers.get('location'),
      `${path}/${assignment.id}`,
      'created assignment Location',
    );
    expectReadIdentity(stack, created, createId, createId);
    expectAbsent(
      created,
      world.reviewer.personId,
      'reviewer identity excluded from assignment resource',
    );
    const afterCreate = snapshotDigest();
    expectOrdinaryAssignmentEffects(before, afterCreate, 'create');
    expectAssignmentEvent(
      review.id,
      draft.revisionId,
      version,
      createId,
      'create',
    );
    const replay = await stack.post(path, {
      body: createBody,
      ifMatch: version,
      idempotencyKey: createKey,
    });
    expectStatus(replay, 201);
    EditorialReviewAssignmentResourceSchema.parse(replay.body);
    expectSafeEqual(replay.body, created.body, 'create replay entire resource');
    expectSafeEqual(
      replay.headers.get('etag'),
      created.headers.get('etag'),
      'create replay ETag',
    );
    expectSafeEqual(
      replay.headers.get('location'),
      created.headers.get('location'),
      'create replay Location',
    );
    expectUnchanged(
      afterCreate,
      snapshotDigest(),
      'create replay writes nothing',
    );

    stack.as(world.reviewer);
    const detail = await stack.get(`/api/v1/cms/reviews/${review.id}`);
    expectStatus(detail, 200);
    const parsed = EditorialReviewDetailResourceSchema.parse(detail.body);
    expectSafeEqual(
      parsed.myAssignment?.assignmentId,
      assignment.id,
      'own assignment ID is legitimate',
    );
    expectSafeEqual(parsed.assignments, [], 'reviewer cannot list assignments');
    expectSafeEqual(
      parsed.permittedNextActions,
      ['record_decision'],
      'assignment confers decision only',
    );
    expectSafeEqual(
      detail.headers.get('etag'),
      `"${version}"`,
      'review operand unchanged after create',
    );

    stack.as(world.owner, 'fresh');
    const revokeBody = {
      action: 'revoke',
      expectedVersion: version,
      assignmentId: assignment.id,
    };
    const revokeKey = `assignment-revoke-${randomUUID()}`;
    const revokeId = randomUUID();
    const beforeRevoke = snapshotDigest();
    const revoked = await stack.post(path, {
      body: revokeBody,
      ifMatch: version,
      idempotencyKey: revokeKey,
      headers: { 'x-request-id': revokeId },
    });
    expectStatus(revoked, 200);
    const revokedResource = EditorialReviewAssignmentResourceSchema.parse(
      revoked.body,
    );
    expect(revokedResource.state).toBe('revoked');
    expectSafeEqual(revokedResource.id, assignment.id, 'revocation identity');
    expectSafeEqual(
      revokedResource.version,
      String(BigInt(assignment.version) + 1n),
      'assignment version advances once',
    );
    expect(revoked.headers.get('location')).toBeNull();
    const afterRevoke = snapshotDigest();
    expectOrdinaryAssignmentEffects(beforeRevoke, afterRevoke, 'revoke');
    expectAssignmentEvent(
      review.id,
      draft.revisionId,
      version,
      revokeId,
      'revoke',
    );
    const replayRevoke = await stack.post(path, {
      body: revokeBody,
      ifMatch: version,
      idempotencyKey: revokeKey,
    });
    expectStatus(replayRevoke, 200);
    EditorialReviewAssignmentResourceSchema.parse(replayRevoke.body);
    expectSafeEqual(
      replayRevoke.body,
      revoked.body,
      'revoke replay entire resource',
    );
    expectUnchanged(
      afterRevoke,
      snapshotDigest(),
      'revoke replay writes nothing',
    );
    stack.as(world.reviewer);
    const denied = await stack.get(`/api/v1/cms/reviews/${review.id}`);
    expectSafeError(denied, {
      status: 403,
      code: 'FORBIDDEN',
      details: { reasonCode: 'capability_missing' },
    });
    expectUnchanged(
      afterRevoke,
      snapshotDigest(),
      'revoked reader denial writes nothing',
    );
  });

  it('[CMS-03B-18] absent nonmember ungranted and submitter reviewers share one exact eligibility refusal without effects', async () => {
    const draft = await seedDraft(stack, world, 'Uniform eligibility');
    const review = await submitForReview(stack, world, draft);
    stack.as(world.owner, 'fresh');
    const before = snapshotDigest();
    for (const reviewerPersonId of [
      randomUUID(),
      world.stranger.personId,
      world.outsider.personId,
      world.owner.personId,
    ]) {
      const response = await stack.post(
        `/api/v1/cms/reviews/${review.id}/assignments`,
        {
          body: {
            action: 'create',
            expectedVersion: String(review.version),
            reviewerPersonId,
            expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
          },
          ifMatch: String(review.version),
        },
      );
      expectSafeError(response, {
        status: 409,
        code: 'CONFLICT',
        details: conflict('reviewer_not_eligible'),
      });
      expectAbsent(
        response,
        reviewerPersonId,
        'eligibility conceals supplied human identity',
      );
      expectUnchanged(
        before,
        snapshotDigest(),
        'eligibility refusal writes nothing',
      );
    }
  });

  it('[CMS-03B-18] stale review closed review and concealed review refuse exactly without effects', async () => {
    const draft = await seedDraft(stack, world, 'Assignment version states');
    const review = await submitForReview(stack, world, draft);
    const version = String(review.version);
    const body = (expectedVersion: string) => ({
      action: 'create',
      expectedVersion,
      reviewerPersonId: world.reviewer2.personId,
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    });
    stack.as(world.owner, 'fresh');
    const before = snapshotDigest();
    const stale = await stack.post(
      `/api/v1/cms/reviews/${review.id}/assignments`,
      {
        body: body('99'),
        ifMatch: '99',
      },
    );
    expectSafeError(stale, {
      status: 409,
      code: 'CONFLICT',
      details: {
        conflict: 'VERSION_MISMATCH',
        recoveryAction: 'reload',
        expectedVersion: '99',
        currentVersion: version,
      },
    });
    const absent = await stack.post(
      `/api/v1/cms/reviews/${randomUUID()}/assignments`,
      {
        body: body(version),
        ifMatch: version,
      },
    );
    expectSafeError(absent, { status: 404, code: 'NOT_FOUND', details: {} });
    stack.as(world.stranger, 'fresh');
    const hidden = await stack.post(
      `/api/v1/cms/reviews/${review.id}/assignments`,
      {
        body: body(version),
        ifMatch: version,
      },
    );
    expectSafeError(hidden, { status: 404, code: 'NOT_FOUND', details: {} });
    expectUnchanged(
      before,
      snapshotDigest(),
      'stale and concealed assignments write nothing',
    );
    await assignReviewer(stack, world, review.id, version);
    const closed = await decide(stack, world, review.id, version);
    stack.as(world.owner, 'fresh');
    const beforeClosed = snapshotDigest();
    const response = await stack.post(
      `/api/v1/cms/reviews/${review.id}/assignments`,
      {
        body: body(String(closed.version)),
        ifMatch: String(closed.version),
      },
    );
    expectSafeError(response, {
      status: 409,
      code: 'CONFLICT',
      details: conflict('review_not_open'),
    });
    expectUnchanged(
      beforeClosed,
      snapshotDigest(),
      'closed review assignment writes nothing',
    );
  });

  it('[CMS-03B-18] sixteen active assignments are accepted and the seventeenth refuses without effects', async () => {
    const draft = await seedDraft(stack, world, 'Assignment limit');
    const review = await submitForReview(stack, world, draft);
    const reviewers = Array.from({ length: 17 }, () =>
      addMember(world.organizationId, world.owner.personId, ['cms.reviewer']),
    );
    const ids: string[] = [];
    for (const reviewer of reviewers.slice(0, 16)) {
      const response = await assignReviewer(
        stack,
        world,
        review.id,
        String(review.version),
        reviewer,
      );
      ids.push(EditorialReviewAssignmentResourceSchema.parse(response.body).id);
    }
    const detail = await stack.get(`/api/v1/cms/reviews/${review.id}`);
    expectStatus(detail, 200);
    const parsed = EditorialReviewDetailResourceSchema.parse(detail.body);
    expectSafeEqual(
      parsed.assignments.map((assignment) => assignment.assignmentId).sort(),
      ids.sort(),
      'all sixteen assignments are represented exactly',
    );
    expectSafeEqual(
      parsed.version,
      review.version,
      'sixteen creates leave review version unchanged',
    );
    const before = snapshotDigest();
    const overflow = await stack.post(
      `/api/v1/cms/reviews/${review.id}/assignments`,
      {
        body: {
          action: 'create',
          expectedVersion: String(review.version),
          reviewerPersonId: reviewers[16]!.personId,
          expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        },
        ifMatch: String(review.version),
      },
    );
    expectSafeError(overflow, {
      status: 409,
      code: 'CONFLICT',
      details: conflict('assignment_limit'),
    });
    expectUnchanged(
      before,
      snapshotDigest(),
      'assignment cap refusal writes nothing',
    );
  });
});
