/**
 * Slice 11 real composition, CMS-03B-18 assignment refusals (lane S11-4R read
 * families; split from the inherited combined refusal suite). The typed refusal
 * families of the owner reviewer-assignment command through the production
 * Worker routes, adapters, Kong, PostgREST and SQL: unconditional step-up before
 * any RPC or reservation, the uniform `reviewer_not_eligible` eligibility
 * collapse, the expiry bound, `assignment_exists`, owner-only authority, and the
 * create/revoke/duplicate-revoke lifecycle.
 *
 * Commits fixtures; run right after `pnpm db:reset`, and reset again afterwards.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import {
  EditorialReviewAssignmentResourceSchema,
  cmsSlice11ReasonStatus,
} from '@wejammin/contracts';

import { submitForReview } from './support/phase-02-slice-11-flow';
import { expectStatus } from './support/phase-02-slice-11-assert';
import {
  type S11Stack,
  createS11Stack,
} from './support/phase-02-slice-11-stack';
import {
  type S11World,
  prepareS11World,
  reservationCount,
  seedDraft,
} from './support/phase-02-slice-11-world';

let world: S11World;
let stack: S11Stack;

beforeAll(async () => {
  world = await prepareS11World();
  stack = createS11Stack(world.owner);
});

describe('CMS-03B-18 refusals through the real stack', () => {
  it('[CMS-03B-18] step-up, eligibility, duplicates, expiry bounds, revoke and conflict', async () => {
    const draft = await seedDraft(stack, world, 'Assignment refusals');
    const review = await submitForReview(stack, world, draft);
    const version = String(review.version);
    const path = `/api/v1/cms/reviews/${review.id}/assignments`;
    const createBody = (over: Record<string, unknown> = {}) => ({
      action: 'create',
      expectedVersion: version,
      reviewerPersonId: world.reviewer.personId,
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      ...over,
    });

    for (const proof of ['none', 'stale', 'future'] as const) {
      stack.as(world.owner, proof);
      stack.clearRpcs();
      const before = reservationCount();
      const refused = await stack.post(path, {
        body: createBody(),
        ifMatch: version,
      });
      expectStatus(refused, 401, proof);
      expect(refused.body.code).toBe('STEP_UP_REQUIRED');
      expect(stack.rpcs()).toEqual([]);
      expect(reservationCount()).toBe(before);
    }

    stack.as(world.owner, 'fresh');
    const ineligible = await stack.post(path, {
      body: createBody({ reviewerPersonId: world.outsider.personId }),
      ifMatch: version,
    });
    expectStatus(ineligible, cmsSlice11ReasonStatus('reviewer_not_eligible'));
    expect(ineligible.body.details).toMatchObject({
      reasonCode: 'reviewer_not_eligible',
    });

    const tooLong = await stack.post(path, {
      body: createBody({
        expiresAt: new Date(Date.now() + 8 * 86_400_000).toISOString(),
      }),
      ifMatch: version,
    });
    expectStatus(tooLong, cmsSlice11ReasonStatus('expiry_out_of_bounds'));
    expect(tooLong.body.details).toMatchObject({
      reasonCode: 'expiry_out_of_bounds',
      violations: [{ path: '/expiresAt' }],
    });

    const created = await stack.post(path, {
      body: createBody(),
      ifMatch: version,
    });
    expectStatus(created, 201);
    const assignment = EditorialReviewAssignmentResourceSchema.parse(
      created.body,
    );

    const duplicate = await stack.post(path, {
      body: createBody(),
      ifMatch: version,
    });
    expectStatus(duplicate, cmsSlice11ReasonStatus('assignment_exists'));
    expect(duplicate.body.details).toMatchObject({
      reasonCode: 'assignment_exists',
    });

    stack.as({ ...world.reviewer, capabilities: ['cms.reviewer'] }, 'fresh');
    const notOwner = await stack.post(path, {
      body: createBody({ reviewerPersonId: world.reviewer2.personId }),
      ifMatch: version,
    });
    expectStatus(notOwner, 403);
    expect(notOwner.body.details).toMatchObject({
      reasonCode: 'capability_missing',
    });

    stack.as(world.owner, 'fresh');
    const revoked = await stack.post(path, {
      body: {
        action: 'revoke',
        expectedVersion: version,
        assignmentId: assignment.id,
      },
      ifMatch: version,
    });
    expectStatus(revoked, 200);
    expect(
      EditorialReviewAssignmentResourceSchema.parse(revoked.body).state,
    ).toBe('revoked');
    expect(revoked.headers.get('location')).toBeNull();

    const again = await stack.post(path, {
      body: {
        action: 'revoke',
        expectedVersion: version,
        assignmentId: assignment.id,
      },
      ifMatch: version,
    });
    expectStatus(again, 409);
    expect(again.body.code).toBe('CONFLICT');
  });
});
