/**
 * Slice 11 real composition, review chain (lane S11-4R): the production Worker routes
 * CMS-03B-15 -> 05 -> 18 -> 06 -> 16 -> 17 through the production adapters, Kong,
 * PostgREST and the newest SQL. No port is faked: the only supplied seams are the
 * verified authentication session and an always-allow rate limiter.
 *
 * What the transport-fake suites cannot prove: the request members the adapter puts on
 * the wire are the ones the SQL reads, the RPC answers parse through the strict resource
 * schemas, the typed refusals and their structured DETAIL members survive the PostgREST
 * boundary, and an exact-key replay (x-cms-idempotent-replay) adds nothing.
 *
 * Commits fixtures (an isolated organization, persons, an active content type): run right
 * after `pnpm db:reset`, and reset again afterwards.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import {
  EditorialReviewAssignmentResourceSchema,
  EditorialReviewDetailResourceSchema,
  EditorialReviewResourceSchema,
  EntryWorkflowResourceSchema,
} from '@wejammin/contracts';

import { collectQueue } from './support/phase-02-slice-11-flow';
import {
  expectEvidencePresent,
  resourceDigest,
  expectStatus,
} from './support/phase-02-slice-11-assert';
import {
  type S11World,
  prepareS11World,
  reservationCount,
  seedDraft,
  workflowEffects,
} from './support/phase-02-slice-11-world';
import {
  type S11Stack,
  createS11Stack,
} from './support/phase-02-slice-11-stack';

let world: S11World;
let stack: S11Stack;
let entryId = '';
let revisionId = '';
let entryVersion = '';
let reviewId = '';
let reviewVersion = '';
let assignmentId = '';

const workflowPath = (id: string): string =>
  `/api/v1/cms/entries/${id}/workflow`;

beforeAll(async () => {
  world = await prepareS11World();
  stack = createS11Stack(world.owner);
  const seeded = await seedDraft(stack, world, 'Review chain');
  entryId = seeded.entryId;
  revisionId = seeded.revisionId;
  entryVersion = seeded.entryVersion;
});

describe('CMS-03B-15 -> 05 -> 18 -> 06 -> 16 -> 17 through the real stack', () => {
  it('[CMS-03B-15] the workflow read of a draft serves its preparation and passes the strict resource schema', async () => {
    stack.as(world.owner);
    stack.clearRpcs();
    const response = await stack.get(workflowPath(entryId));
    expectStatus(response, 200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const parsed = EntryWorkflowResourceSchema.parse(response.body);
    expect(response.headers.get('etag')).toMatch(
      new RegExp(
        `^"${entryId}:${entryVersion}:${revisionId}:0:0:[0-9a-f]{64}"$`,
        'u',
      ),
    );
    expect(parsed.preparation).not.toBeNull();
    expect(parsed.review).toBeNull();
    expect(parsed.revision.id).toBe(revisionId);
    expect(stack.rpcs().map((rpc) => rpc.rpc)).toEqual([
      'cms_load_quality_gate_input',
      'cms_get_entry_workflow',
    ]);
    // The accessibility proof the Worker built was accepted by the database: the
    // accessibility category of the preparation report is not an unavailable one.
    const accessibility = parsed.preparation?.preflight.results.find(
      (result) => result.category === 'accessibility',
    );
    expect(accessibility?.outcome).toBe('passed');
  });

  it('[CMS-03B-05] submit freezes the preparation into an open review (201, Location, strong ETag) exactly once', async () => {
    stack.as(world.owner);
    const read = await stack.get(workflowPath(entryId));
    const preparation = EntryWorkflowResourceSchema.parse(read.body)
      .preparation as NonNullable<
      ReturnType<typeof EntryWorkflowResourceSchema.parse>['preparation']
    >;
    const key = `submit-${entryId}`;
    const body = {
      entryId,
      revisionId,
      frozenHash: preparation.frozenHash,
      dependencyManifest: preparation.dependencyManifest,
    };
    const before = reservationCount();
    stack.clearRpcs();
    const response = await stack.post(
      `/api/v1/cms/entries/${entryId}/reviews`,
      {
        body,
        idempotencyKey: key,
        ifMatch: entryVersion,
      },
    );
    expectStatus(response, 201);
    const review = EditorialReviewResourceSchema.parse(response.body);
    reviewId = review.id;
    reviewVersion = String(review.version);
    expect(review.state).toBe('open');
    expect(response.headers.get('etag')).toBe(`"${review.version}"`);
    expect(response.headers.get('location')).toBe(
      `/api/v1/cms/reviews/${review.id}`,
    );
    expect(reservationCount()).toBe(before + 1);
    expect(workflowEffects(entryId).reviews).toBe(1);
    // the wire request the adapter built carries the server-built members the SQL reads
    const sent = stack.rpcs().find((rpc) => rpc.rpc === 'cms_submit_review');
    expect(sent).toBeDefined();
    expectEvidencePresent(sent?.request ?? {});
    expect(sent?.request.expectedVersion).toBe(entryVersion);
    expect(sent?.request.ifMatch).toBe(entryVersion);

    stack.clearRpcs();
    const replay = await stack.post(`/api/v1/cms/entries/${entryId}/reviews`, {
      body,
      idempotencyKey: key,
      ifMatch: entryVersion,
    });
    expectStatus(replay, 201);
    expect(resourceDigest(replay.body)).toBe(resourceDigest(response.body));
    expect(
      stack.rpcs().find((rpc) => rpc.rpc === 'cms_submit_review')?.replayHeader,
    ).toBe('true');
    expect(workflowEffects(entryId).reviews).toBe(1);
    expect(reservationCount()).toBe(before + 1);
  });

  it('[CMS-03B-18] the owner assigns the reviewer (201 + Location + ETag) and the answer passes the strict schema', async () => {
    stack.as(world.owner, 'fresh');
    const response = await stack.post(
      `/api/v1/cms/reviews/${reviewId}/assignments`,
      {
        body: {
          action: 'create',
          expectedVersion: reviewVersion,
          reviewerPersonId: world.reviewer.personId,
          expiresAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
        },
        ifMatch: reviewVersion,
      },
    );
    expectStatus(response, 201);
    const assignment = EditorialReviewAssignmentResourceSchema.parse(
      response.body,
    );
    assignmentId = assignment.id;
    expect(response.headers.get('location')).toBe(
      `/api/v1/cms/reviews/${reviewId}/assignments/${assignment.id}`,
    );
    expect(workflowEffects(entryId).assignments).toBe(1);
  });

  it('[CMS-03B-06] the assigned reviewer approves with a fresh step-up (200, review version + 1) and a replay adds nothing', async () => {
    stack.as(world.reviewer, 'fresh');
    const key = `decide-${reviewId}`;
    const body = {
      reviewId,
      decision: 'approve',
      reason: 'The draft is accurate.',
      expectedVersion: reviewVersion,
    };
    const response = await stack.post(
      `/api/v1/cms/reviews/${reviewId}/decision`,
      { body, idempotencyKey: key, ifMatch: reviewVersion },
    );
    expectStatus(response, 200);
    const review = EditorialReviewResourceSchema.parse(response.body);
    expect(review.state).toBe('approved');
    expect(response.headers.get('etag')).toBe(`"${review.version}"`);
    expect(response.headers.get('location')).toBeNull();
    reviewVersion = String(review.version);
    expect(workflowEffects(entryId).decisions).toBe(1);

    stack.clearRpcs();
    const replay = await stack.post(
      `/api/v1/cms/reviews/${reviewId}/decision`,
      { body, idempotencyKey: key, ifMatch: String(Number(reviewVersion) - 1) },
    );
    expectStatus(replay, 200);
    expect(resourceDigest(replay.body)).toBe(resourceDigest(response.body));
    expect(
      stack.rpcs().find((rpc) => rpc.rpc === 'cms_record_review_decision')
        ?.replayHeader,
    ).toBe('true');
    expect(workflowEffects(entryId).decisions).toBe(1);
  });

  it('[CMS-03B-16] the review detail read serves the approved review with its assignment', async () => {
    stack.as(world.reviewer);
    const response = await stack.get(`/api/v1/cms/reviews/${reviewId}`);
    expectStatus(response, 200);
    const detail = EditorialReviewDetailResourceSchema.parse(response.body);
    expect(detail.state).toBe('approved');
    expect(response.headers.get('etag')).toBe(`"${detail.version}"`);
    expect(JSON.stringify(detail)).toContain(assignmentId);
  });

  it('[CMS-03B-17] the reviewer queue lists the review for its owner and passes the strict page schema', async () => {
    stack.as(world.owner);
    const items = await collectQueue(stack, 'scope=submitted');
    expect(items.some((item) => item.reviewId === reviewId)).toBe(true);
  });
});
