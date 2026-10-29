/**
 * Slice 12 real-stack latency, the CMS-03C-08 REVOKE half of the Tier 2 target (BE03c 655; criterion P2-S12-AC-079).
 * `phase-02-slice-12-latency-governed.apispec.ts` times the assignment create and uses revoke only as untimed setup, so the
 * revoke half is measured here, through the same path: browser request -> production Worker route (session, capability, quota,
 * strict envelope, fresh-context re-proof) -> production RPC adapter -> Kong -> PostgREST -> the newest SQL, over the same
 * committed world and helpers.
 *
 * Population: two real draft templates, each submitted through CMS-03C-06. The first review carries the limit of 16 active
 * assignments (the queue reviewer and fifteen more members), the second 11, so the 27 revocations (3 discarded warm-ups, then
 * 24 counted samples, estimated with `percentile_cont` like the SQL benches) each run against a review that carries up to the
 * 16-active bound. Assignments are created untimed up front (an assignment cannot be revoked twice, and the timed region holds
 * the revoke request only). Every sample must succeed with 200: a refusal fails the measurement instead of passing quickly.
 *
 *   CMS-03C-08 revoke   Tier 2   p95 < 1,200 ms, every request inside the exact 15,000 ms deadline
 *
 * The figure is only meaningful on a quiet host (the canonical gate holds /tmp/wejammin-quiet.lock exclusively).
 * Commits fixtures; run right after `pnpm db:reset`, and reset again afterwards. Not run by the author of this file.
 */
import { randomUUID } from 'node:crypto';

import { beforeAll, describe, expect, it } from 'vitest';

import {
  type DefinedVersion,
  type LatencyWorld,
  type SubmittedReview,
  addReviewers,
  assignReviewer,
  defineTemplate,
  expectCreated,
  expectOk,
  prepareLatencyWorld,
  revokeAssignment,
  reviewOf,
  submitReview,
} from './support/phase-02-slice-12-latency-world';
import {
  type LatencyStack,
  createLatencyStack,
} from './support/phase-02-slice-12-latency-stack';
import {
  type Measurement,
  measure,
} from './support/phase-02-slice-11-latency-stats';

const RUN = { samples: 24, warmups: 3 } as const;
const COUNT = RUN.samples + RUN.warmups;
/** BE03c 1276: a review admits at most 16 active assignments. */
const ACTIVE_LIMIT = 16;
const TIER_2_P95_MS = 1_200;
const WRITE_DEADLINE_MS = 15_000;

type Prepared = Readonly<{
  review: SubmittedReview;
  assignmentIds: readonly string[];
}>;

let world: LatencyWorld;
let stack: LatencyStack;
const prepared: Prepared[] = [];
const tag = randomUUID().slice(0, 6);

/** Defines and submits one template, then assigns `count` distinct reviewers to its review (untimed). */
const prepareReview = async (
  name: string,
  count: number,
  reviewers: LatencyWorld['reviewer'][],
): Promise<Prepared> => {
  const subject: DefinedVersion = await defineTemplate(stack, world, name);
  const submitted = await submitReview(
    stack,
    world,
    'template_version',
    subject,
  );
  expectCreated(submitted, `submit ${name}`);
  const review = reviewOf(submitted);
  const assignmentIds: string[] = [];
  for (const reviewer of reviewers.slice(0, count)) {
    const answer = await assignReviewer(stack, world, review, reviewer);
    expectCreated(answer, `assign ${name}`);
    assignmentIds.push(String(answer.body.id));
  }
  expect(
    assignmentIds,
    `${name}: one active assignment per reviewer`,
  ).toHaveLength(count);
  return { review, assignmentIds };
};

beforeAll(async () => {
  world = await prepareLatencyWorld();
  stack = createLatencyStack(world.owner);
  const reviewers = [world.reviewer, ...addReviewers(world, ACTIVE_LIMIT - 1)];
  expect(reviewers).toHaveLength(ACTIVE_LIMIT);
  prepared.push(
    await prepareReview(`lat-revoke-a-${tag}`, ACTIVE_LIMIT, reviewers),
    await prepareReview(`lat-revoke-b-${tag}`, COUNT - ACTIVE_LIMIT, reviewers),
  );
}, 900_000);

describe('Slice 12 governed-review revoke latency through the real stack', () => {
  let result: Measurement | null = null;

  it('[CMS-03C-08] revocation of an assignment on a review carrying up to the limit of 16 active assignments: p95 under the Tier 2 target of 1,200 ms [P2-S12-AC-079]', async () => {
    const queue: { review: SubmittedReview; assignmentId: string }[] =
      prepared.flatMap(({ review, assignmentIds }) =>
        assignmentIds.map((assignmentId) => ({ review, assignmentId })),
      );
    expect(
      queue,
      '3 warm-ups plus 24 samples need 27 assignments',
    ).toHaveLength(COUNT);
    let next = 0;
    result = await measure(
      'governed_revoke',
      () => {
        const item = queue[next] as {
          review: SubmittedReview;
          assignmentId: string;
        };
        next += 1;
        return revokeAssignment(stack, world, item.review, item.assignmentId);
      },
      (answer) => expectOk(answer, 'revoke'),
      RUN,
    );
    expect(result.samples).toHaveLength(RUN.samples);
    expect(result.p95).toBeLessThan(TIER_2_P95_MS);
  }, 900_000);

  it('every revoke request, warm-ups included, completed within the exact 15,000 ms deadline [P2-S12-AC-079]', () => {
    expect(result, 'the measurement above ran').not.toBeNull();
    const measurement = result as Measurement;
    for (const elapsed of [...measurement.warmups, ...measurement.samples])
      expect(elapsed, measurement.op).toBeLessThan(WRITE_DEADLINE_MS);
  });
});
