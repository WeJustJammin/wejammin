/**
 * CMS-03B-06 ordinary policy proofs; parent owns execution.
 * Shared world's synthetic activation/session setup does not prove fixture authority.
 * Protected, count-eight and grant/expiry policy fixtures remain unaccepted.
 */
import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { EditorialReviewResourceSchema } from '@wejammin/contracts';
import {
  expectSafeEqual,
  expectSafeError,
  expectStatus,
  expectUnchanged,
  snapshotDigest,
} from './support/phase-02-slice-11-assert';
import {
  type S11World,
  prepareS11World,
} from './support/phase-02-slice-11-world';
import {
  type S11Stack,
  createS11Stack,
} from './support/phase-02-slice-11-stack';
import {
  expectCommandEffects,
  expectCommandIdentity,
} from './support/phase-02-slice-11-submit-support';
import {
  DECISION_EFFECTS,
  decisionFixture,
  expectDecisionResource,
  expectDecisionRow,
  expectReasonPrivacy,
} from './support/phase-02-slice-11-decision-support';

let world: S11World;
let stack: S11Stack;
beforeAll(async () => {
  world = await prepareS11World();
  stack = createS11Stack(world.owner);
});

describe('CMS-03B-06 ordinary decision policy and persistence', () => {
  for (const decision of ['approve', 'reject'] as const) {
    it(`[CMS-03B-06] ${decision} appends one assignment-bound decision with exact policy, count, privacy and atomic effects; replay is inert`, async () => {
      const fixture = await decisionFixture(stack, world);
      const body = { ...fixture.body, decision };
      const key = `decision-proof-${randomUUID()}`;
      const requestId = randomUUID();
      const correlationId = randomUUID();
      const options = {
        body,
        ifMatch: fixture.review.version,
        idempotencyKey: key,
        headers: {
          'x-request-id': requestId,
          'x-correlation-id': correlationId,
        },
      };
      stack.clearRpcs();
      const before = snapshotDigest();
      const response = await stack.post(fixture.path, options);
      expectDecisionResource(response, fixture.review, decision);
      expectCommandIdentity(
        stack.rpcs().find((rpc) => rpc.rpc === 'cms_record_review_decision'),
        world.reviewer,
        requestId,
        correlationId,
        true,
      );
      expectSafeEqual(
        stack.rpcs().map((rpc) => rpc.rpc),
        ['cms_record_review_decision'],
        'one decision RPC, no checker',
      );
      const after = expectCommandEffects(before, DECISION_EFFECTS);
      expectDecisionRow(fixture, world.reviewer, decision, body.reason);
      const replay = await stack.post(fixture.path, {
        ...options,
        headers: {
          'x-request-id': randomUUID(),
          'x-correlation-id': randomUUID(),
        },
      });
      expectStatus(replay, 200);
      EditorialReviewResourceSchema.parse(replay.body);
      expectSafeEqual(
        replay.body,
        response.body,
        'same complete strict decision resource on replay',
      );
      expect(stack.rpcs().at(-1)?.replayHeader).toBe('true');
      expectUnchanged(
        after,
        snapshotDigest(),
        'decision replay changes no rows',
      );
      await expectReasonPrivacy(stack, world, fixture, decision, body.reason);
      expectUnchanged(
        after,
        snapshotDigest(),
        'decision privacy reads change no rows',
      );
    });
  }

  for (const reason of ['A', '🎵'.repeat(2000)]) {
    const length = Array.from(reason).length;
    it(`[CMS-03B-06] ${length} Unicode code points are accepted and stored without normalizing the reason`, async () => {
      const fixture = await decisionFixture(stack, world);
      const before = snapshotDigest();
      const response = await stack.post(fixture.path, {
        body: { ...fixture.body, reason },
        ifMatch: fixture.review.version,
      });
      expectDecisionResource(response, fixture.review, 'approve');
      expectDecisionRow(fixture, world.reviewer, 'approve', reason);
      expectCommandEffects(before, DECISION_EFFECTS);
    });
  }

  it('[CMS-03B-06] revoked assignment loses decision authority and concealed review matches absence', async () => {
    const fixture = await decisionFixture(stack, world);
    stack.as(world.owner, 'fresh');
    expectStatus(
      await stack.post(`/api/v1/cms/reviews/${fixture.review.id}/assignments`, {
        body: {
          action: 'revoke',
          expectedVersion: fixture.review.version,
          assignmentId: fixture.assignment.id,
        },
        ifMatch: fixture.review.version,
      }),
      200,
    );
    stack.as(world.reviewer, 'fresh');
    const before = snapshotDigest();
    const response = await stack.post(fixture.path, {
      body: fixture.body,
      ifMatch: fixture.review.version,
    });
    expectSafeError(response, { status: 404, code: 'NOT_FOUND', details: {} });
    const absentId = randomUUID();
    const absent = await stack.post(
      `/api/v1/cms/reviews/${absentId}/decision`,
      {
        body: { ...fixture.body, reviewId: absentId },
        ifMatch: fixture.review.version,
      },
    );
    expectSafeError(absent, { status: 404, code: 'NOT_FOUND', details: {} });
    expectSafeEqual(
      {
        code: response.body.code,
        message: response.body.message,
        details: response.body.details,
      },
      {
        code: absent.body.code,
        message: absent.body.message,
        details: absent.body.details,
      },
      'revoked and absent review have identical safe semantics',
    );
    expectUnchanged(
      before,
      snapshotDigest(),
      'revoked assignment cannot write',
    );
  });
});
