/**
 * Slice 12 real-stack latency, part 1: the governed-review routes (CMS-03C-06 .. -11), measured where BE00 puts a Tier target (655): at the
 * API. Browser request -> production Worker routes (session, capability, quota, strict envelopes, fresh-context re-proof)
 * -> production RPC adapter -> Kong -> PostgREST -> the newest SQL, over the same bounded worlds as the database benches
 * (`supabase/tests/phase_02_slice_12_gaps_perf_governed.sql`, `..._templates.sql`). Each operation is timed 24 times after
 * 3 discarded warm-ups, so every p95 is taken over at least twenty samples with the estimator of the SQL benches
 * (`percentile_cont`). Every sample must succeed: a refusal fails the measurement instead of passing quickly.
 *
 *   CMS-03C-06 submit, -08 assignment, -07 decision, -09 activate / schedule / retire   Tier 2  p95 < 1,200 ms
 *   CMS-03C-10 detail, CMS-03C-11 queue (first and cursor page of 50)                   Tier 1  p95 <   750 ms
 *
 * The figures are only meaningful on a quiet host (the canonical gate holds /tmp/wejammin-quiet.lock exclusively).
 * Commits fixtures; run right after `pnpm db:reset`, and reset again afterwards. Not run by the author of this file.
 */
import { randomUUID } from 'node:crypto';

import {
  GovernedReviewDetailResourceSchema,
  GovernedReviewQueuePageSchema,
} from '@wejammin/contracts';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  type DefinedVersion,
  type LatencyWorld,
  type SubmittedReview,
  actOnReview,
  addReviewers,
  approveReview,
  assignReviewer,
  defineTemplate,
  expectCreated,
  expectOk,
  prepareLatencyWorld,
  revokeAssignment,
  reviewOf,
  scheduleBody,
  submitReview,
} from './support/phase-02-slice-12-latency-world';
import {
  type LatencyResponse,
  type LatencyStack,
  createLatencyStack,
} from './support/phase-02-slice-12-latency-stack';
import {
  type Measurement,
  measure,
} from './support/phase-02-slice-11-latency-stats';

const RUN = { samples: 24, warmups: 3 } as const;
const COUNT = RUN.samples + RUN.warmups;
/** Reviews in the queue population: every one is assigned to the queue reviewer (the page is the maximum 50, with a cursor). */
const POPULATION = 60;
const TIER_1_P95_MS = 750;
const TIER_2_P95_MS = 1_200;
const WRITE_DEADLINE_MS = 15_000;
const READ_DEADLINE_MS = 8_000;

let world: LatencyWorld;
let stack: LatencyStack;
const measurements: Measurement[] = [];
const record = (measurement: Measurement): Measurement => {
  measurements.push(measurement);
  return measurement;
};
const tag = randomUUID().slice(0, 6);

/** The state the chain threads from one measured operation to the next. */
const templates: DefinedVersion[] = [];
const reviews: SubmittedReview[] = [];
let detailReview: SubmittedReview | null = null;
let queueCursor: string | null = null;

beforeAll(async () => {
  world = await prepareLatencyWorld();
  stack = createLatencyStack(world.owner);
  // POPULATION draft templates, defined through CMS-03C-01 (untimed here; the define route is measured below).
  for (let index = 0; index < POPULATION; index += 1)
    templates.push(await defineTemplate(stack, world, `lat-${tag}-${index}`));
}, 900_000);

/** A `check` that stores each answer's review (id and version) at `offset + n`: the measured calls run in order, one at a time. */
const collect = (offset: number, what: string, status = 200) => {
  let done = 0;
  return (answer: LatencyResponse): void => {
    expectOk(answer, what, status);
    reviews[offset + done] = reviewOf(answer);
    done += 1;
  };
};

/** A counter for the closure of a measured operation: the n-th call works on the n-th prepared item. */
const nextIndex = (): (() => number) => {
  let index = 0;
  return () => {
    const current = index;
    index += 1;
    return current;
  };
};

describe('Slice 12 governed-review latency through the real stack', () => {
  it('[CMS-03C-06] submit over a real draft template: p95 under the Tier 2 target of 1,200 ms [P2-S12-AC-067]', async () => {
    const at = nextIndex();
    const result = record(
      await measure(
        'governed_submit',
        () =>
          submitReview(
            stack,
            world,
            'template_version',
            templates[at()] as DefinedVersion,
          ),
        (answer) => {
          expectCreated(answer, 'submit');
          reviews.push(reviewOf(answer));
        },
        RUN,
      ),
    );
    expect(result.p95).toBeLessThan(TIER_2_P95_MS);
    // the rest of the population is submitted untimed
    for (let index = COUNT; index < POPULATION; index += 1) {
      const answer = await submitReview(
        stack,
        world,
        'template_version',
        templates[index] as DefinedVersion,
      );
      expectCreated(answer, 'submit (population)');
      reviews.push(reviewOf(answer));
    }
    expect(reviews).toHaveLength(POPULATION);
  }, 900_000);

  it('[CMS-03C-08] assignment of the reviewer: p95 under the Tier 2 target of 1,200 ms [P2-S12-AC-079]', async () => {
    const at = nextIndex();
    const result = record(
      await measure(
        'governed_assign',
        () =>
          assignReviewer(
            stack,
            world,
            reviews[at()] as SubmittedReview,
            world.reviewer,
          ),
        (answer) => expect(answer.status, answer.text.slice(0, 300)).toBe(201),
        RUN,
      ),
    );
    expect(result.p95).toBeLessThan(TIER_2_P95_MS);
    for (let index = COUNT; index < POPULATION; index += 1)
      expectCreated(
        await assignReviewer(
          stack,
          world,
          reviews[index] as SubmittedReview,
          world.reviewer,
        ),
        'assign (population)',
      );
  }, 900_000);

  it('[CMS-03C-07] approval by the assigned reviewer: p95 under the Tier 2 target of 1,200 ms [P2-S12-AC-073]', async () => {
    const at = nextIndex();
    const result = record(
      await measure(
        'governed_decision',
        () =>
          approveReview(
            stack,
            world.reviewer,
            reviews[at()] as SubmittedReview,
          ),
        collect(0, 'approve'),
        RUN,
      ),
    );
    expect(result.p95).toBeLessThan(TIER_2_P95_MS);
    // approved reviews 0 .. COUNT-1 are the activation set; COUNT .. 2*COUNT-1 are the schedule set
    for (let index = COUNT; index < 2 * COUNT; index += 1) {
      const answer = await approveReview(
        stack,
        world.reviewer,
        reviews[index] as SubmittedReview,
      );
      expectOk(answer, 'approve (schedule set)');
      reviews[index] = reviewOf(answer);
    }
  }, 900_000);

  it('[CMS-03C-09] activation of an approved review: p95 under the Tier 2 target of 1,200 ms [P2-S12-AC-085]', async () => {
    const at = nextIndex();
    const result = record(
      await measure(
        'governed_activate',
        () => {
          const review = reviews[at()] as SubmittedReview;
          return actOnReview(stack, world, review, {
            action: 'activate',
            expectedVersion: review.version,
          });
        },
        collect(0, 'activate'),
        RUN,
      ),
    );
    expect(result.p95).toBeLessThan(TIER_2_P95_MS);
  }, 900_000);

  it('[CMS-03C-09] scheduling of an approved review: p95 under the Tier 2 target of 1,200 ms [P2-S12-AC-085]', async () => {
    const at = nextIndex();
    const result = record(
      await measure(
        'governed_schedule',
        () => {
          const review = reviews[COUNT + at()] as SubmittedReview;
          return actOnReview(stack, world, review, scheduleBody(world, review));
        },
        collect(COUNT, 'schedule', 202),
        RUN,
      ),
    );
    expect(result.p95).toBeLessThan(TIER_2_P95_MS);
  }, 900_000);

  it('[CMS-03C-09] retirement of an active version: p95 under the Tier 2 target of 1,200 ms [P2-S12-AC-085]', async () => {
    // the activation answers advanced each review of the activation set to its activated version
    const at = nextIndex();
    const result = record(
      await measure(
        'governed_retire',
        () => {
          const review = reviews[at()] as SubmittedReview;
          return actOnReview(stack, world, review, {
            action: 'retire',
            expectedVersion: review.version,
          });
        },
        (answer) => expectOk(answer, 'retire'),
        RUN,
      ),
    );
    expect(result.p95).toBeLessThan(TIER_2_P95_MS);
  }, 900_000);
});

describe('Slice 12 governed-review read latency through the real stack', () => {
  it('[CMS-03C-10] the detail of a review with 16 active and 20 revoked assignments: p95 under the Tier 1 target of 750 ms [P2-S12-AC-091]', async () => {
    const subject = await defineTemplate(stack, world, `lat-detail-${tag}`);
    const submitted = await submitReview(
      stack,
      world,
      'template_version',
      subject,
    );
    expectCreated(submitted, 'submit the detail review');
    const review = reviewOf(submitted);
    // 16 active assignments: the queue reviewer and fifteen more members
    const reviewers = [world.reviewer, ...addReviewers(world, 15)];
    let last: Record<string, string> = {};
    for (const reviewer of reviewers) {
      const answer = await assignReviewer(stack, world, review, reviewer);
      expectCreated(answer, 'assign (detail)');
      last[reviewer.personId] = String(answer.body.id);
    }
    // 20 revoked cycles of the last reviewer: the review version never moves on assign or revoke
    const cycler = reviewers[reviewers.length - 1];
    if (cycler === undefined)
      throw new Error('the detail review needs reviewers');
    for (let cycle = 0; cycle < 20; cycle += 1) {
      expectOk(
        await revokeAssignment(
          stack,
          world,
          review,
          last[cycler.personId] as string,
        ),
        'revoke (detail)',
      );
      const again = await assignReviewer(stack, world, review, cycler);
      expectCreated(again, 're-assign (detail)');
      last = { ...last, [cycler.personId]: String(again.body.id) };
    }
    const approved = await approveReview(stack, world.reviewer, review);
    expectOk(approved, 'approve (detail)');
    detailReview = reviewOf(approved);
    stack.as(world.owner);
    const path = `/api/v1/cms/governed-reviews/${detailReview.id}`;
    const first = await stack.get(path);
    expectOk(first, 'detail');
    const resource = GovernedReviewDetailResourceSchema.parse(first.body);
    expect(resource.assignments).toHaveLength(32);
    expect(resource.decisions).toHaveLength(1);
    const result = record(
      await measure(
        'governed_detail',
        () => stack.get(path),
        (answer) => expectOk(answer, 'detail'),
        RUN,
      ),
    );
    expect(result.p95).toBeLessThan(TIER_1_P95_MS);
  }, 900_000);

  it('[CMS-03C-11] first page at the maximum limit of 50 from the reviewer queue: p95 under the Tier 1 target of 750 ms [P2-S12-AC-097]', async () => {
    stack.as(world.reviewer);
    const path = '/api/v1/cms/governed-reviews?scope=assigned&limit=50';
    const first = await stack.get(path);
    expectOk(first, 'queue');
    const page = GovernedReviewQueuePageSchema.parse(first.body);
    expect(page.items).toHaveLength(50);
    expect(typeof page.nextCursor).toBe('string');
    queueCursor = page.nextCursor;
    const result = record(
      await measure(
        'queue_page1_limit50',
        () => stack.get(path),
        (answer) => expectOk(answer, 'queue'),
        RUN,
      ),
    );
    expect(result.p95).toBeLessThan(TIER_1_P95_MS);
  }, 300_000);

  it('[CMS-03C-11] cursor page at the maximum limit of 50: p95 under the Tier 1 target of 750 ms [P2-S12-AC-097]', async () => {
    stack.as(world.reviewer);
    expect(queueCursor, 'the first page returned a cursor').not.toBeNull();
    const path = `/api/v1/cms/governed-reviews?scope=assigned&limit=50&cursor=${encodeURIComponent(queueCursor ?? '')}`;
    const first = await stack.get(path);
    expectOk(first, 'queue cursor page');
    expect(
      GovernedReviewQueuePageSchema.parse(first.body).items.length,
    ).toBeGreaterThan(0);
    const result = record(
      await measure(
        'queue_cursor_page',
        () => stack.get(path),
        (answer) => expectOk(answer, 'queue cursor page'),
        RUN,
      ),
    );
    expect(result.p95).toBeLessThan(TIER_1_P95_MS);
  }, 300_000);

  it('every request of every measured operation, warm-ups included, completed within its exact deadline [P2-S12-AC-067]', () => {
    expect(measurements.length).toBeGreaterThanOrEqual(9);
    for (const entry of measurements) {
      expect(
        entry.samples.length,
        `${entry.op} samples`,
      ).toBeGreaterThanOrEqual(20);
      const deadline =
        entry.op.startsWith('governed_detail') ||
        entry.op.startsWith('queue') ||
        entry.op.startsWith('template_context') ||
        entry.op.startsWith('template_latest')
          ? READ_DEADLINE_MS
          : WRITE_DEADLINE_MS;
      for (const elapsed of [...entry.warmups, ...entry.samples])
        expect(elapsed, entry.op).toBeLessThan(deadline);
    }
  });
});
