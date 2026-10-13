/**
 * Slice 11 composed read latency (P2-S11-AC-052 / AC-058 / AC-064): the BE03b p95 targets of CMS-03B-15, -16 and -17
 * measured where BE00 puts them, at the API: browser request -> production Worker routes (session, capability, quota, the
 * in-process accessibility checker, strict resource revalidation, digest ETag) -> production RPC adapter -> Kong ->
 * PostgREST -> the newest SQL, over the same bounded world the database-level benchmark
 * (`supabase/tests/phase_02_slice_11_reads_bench128.sql`) measures. Each read is timed 30 times after 3 discarded warm-up
 * requests, so every p95 is taken over at least twenty samples, with the estimator of the SQL benches (`percentile_cont`).
 *
 *   CMS-03B-15  Tier 2  p95 < 1,200 ms   (includes the 2,000 ms accessibility checker budget, which runs in the Worker)
 *   CMS-03B-16  Tier 1  p95 <   750 ms
 *   CMS-03B-17  Tier 1  p95 <   750 ms   (first page and cursor page at the maximum limit of 50)
 *
 * The figures are only meaningful on a quiet host: the canonical gate holds `/tmp/wejammin-quiet.lock` exclusively. Commits
 * fixtures; run right after `pnpm db:reset`, and reset again afterwards.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import {
  EditorialReviewDetailResourceSchema,
  EntryWorkflowResourceSchema,
  ReviewQueuePageSchema,
} from '@wejammin/contracts';

import { expectStatus } from './support/phase-02-slice-11-assert';
import {
  type LatencyWorld,
  LATENCY_BOUNDS,
  LATENCY_FIELD_COUNT,
  buildLatencyWorld,
} from './support/phase-02-slice-11-latency-world';
import {
  type Measurement,
  measure,
} from './support/phase-02-slice-11-latency-stats';
import {
  type S11Response,
  type S11Stack,
  createS11Stack,
} from './support/phase-02-slice-11-stack';
import {
  type S11World,
  prepareS11World,
} from './support/phase-02-slice-11-world';

/** Thirty counted samples after three discarded warm-ups: each p95 is taken over at least twenty. */
const RUN = { samples: 30, warmups: 3 } as const;
const TIER_1_P95_MS = 750;
const TIER_2_P95_MS = 1_200;
/** BE03b: every read has an 8,000 ms deadline. */
const READ_DEADLINE_MS = 8_000;
/** BE03b `PreflightResult` registry: the accessibility category is the eleventh of seventeen. */
const ACCESSIBILITY_INDEX = 10;

let world: S11World;
let stack: S11Stack;
let latency: LatencyWorld;
/** The CMS-03B-17 cursor of the first page, the operand of the cursor-page measurement. */
let cursor: string | null = null;
const measurements: Measurement[] = [];

beforeAll(async () => {
  world = await prepareS11World();
  stack = createS11Stack(world.owner);
  latency = await buildLatencyWorld(stack, world);
}, 900_000);

const record = (measurement: Measurement): Measurement => {
  measurements.push(measurement);
  return measurement;
};

const ok = (answer: S11Response): void => expectStatus(answer, 200);

describe('Slice 11 read latency through the real stack', () => {
  it(`[CMS-03B-15] on a ${LATENCY_FIELD_COUNT}-field draft with the full preparation and 17-result preflight: p95 under the Tier 2 target of 1,200 ms [P2-S11-AC-052]`, async () => {
    stack.as(latency.owner);
    const path = `/api/v1/cms/entries/${latency.draft.entryId}/workflow`;
    stack.clearRpcs();
    const first = await stack.get(path);
    expectStatus(first, 200);
    const resource = EntryWorkflowResourceSchema.parse(first.body);
    const preparation = resource.preparation;
    expect(
      preparation,
      'a draft revision carries the preparation',
    ).not.toBeNull();
    expect(preparation?.preflight.results).toHaveLength(17);
    expect(
      preparation?.preflight.results[ACCESSIBILITY_INDEX]?.outcome,
      'the in-process checker ran: the accessibility category is not an outage',
    ).not.toBe('unavailable');
    const calls = stack.rpcs().map((call) => call.rpc);
    expect(calls).toContain('cms_load_quality_gate_input');
    expect(calls).toContain('cms_get_entry_workflow');
    const result = record(
      await measure('workflow_draft128', () => stack.get(path), ok, RUN),
    );
    expect(result.p95).toBeLessThan(TIER_2_P95_MS);
  }, 300_000);

  it('[CMS-03B-15] on an entry at 16 schedules, 64 publications and an open review: p95 under the Tier 2 target of 1,200 ms [P2-S11-AC-052]', async () => {
    stack.as(latency.owner);
    const path = `/api/v1/cms/entries/${latency.bounds.entryId}/workflow`;
    const first = await stack.get(path);
    expectStatus(first, 200);
    const resource = EntryWorkflowResourceSchema.parse(first.body);
    expect(resource.schedules).toHaveLength(16);
    expect(resource.publications).toHaveLength(64);
    expect(resource.review?.id).toBe(latency.bounds.reviewId);
    const result = record(
      await measure('workflow_bounds', () => stack.get(path), ok, RUN),
    );
    expect(result.p95).toBeLessThan(TIER_2_P95_MS);
  }, 300_000);

  it('[CMS-03B-16] at 7 of 8 decisions, 32 assignment summaries and a 128-field frozen manifest: p95 under the Tier 1 target of 750 ms [P2-S11-AC-058]', async () => {
    stack.as(latency.owner);
    const path = `/api/v1/cms/reviews/${latency.detailReviewId}`;
    const first = await stack.get(path);
    expectStatus(first, 200);
    const resource = EditorialReviewDetailResourceSchema.parse(first.body);
    expect(resource.assignments).toHaveLength(32);
    expect(resource.decisions).toHaveLength(LATENCY_BOUNDS.recordedDecisions);
    const result = record(
      await measure('review_detail', () => stack.get(path), ok, RUN),
    );
    expect(result.p95).toBeLessThan(TIER_1_P95_MS);
  }, 300_000);

  it('[CMS-03B-17] first page at the maximum limit of 50 from 200 assigned reviews among 500: p95 under the Tier 1 target of 750 ms [P2-S11-AC-064]', async () => {
    stack.as(latency.queueReviewer);
    const first = await stack.get(
      '/api/v1/cms/reviews?scope=assigned&limit=50',
    );
    expectStatus(first, 200);
    const page = ReviewQueuePageSchema.parse(first.body);
    expect(page.items).toHaveLength(50);
    expect(typeof page.nextCursor).toBe('string');
    cursor = page.nextCursor;
    const result = record(
      await measure(
        'queue_page1_limit50',
        () => stack.get('/api/v1/cms/reviews?scope=assigned&limit=50'),
        ok,
        RUN,
      ),
    );
    expect(result.p95).toBeLessThan(TIER_1_P95_MS);
  }, 300_000);

  it('[CMS-03B-17] cursor page at the maximum limit of 50: p95 under the Tier 1 target of 750 ms [P2-S11-AC-064]', async () => {
    stack.as(latency.queueReviewer);
    expect(cursor, 'the first page returned a cursor').not.toBeNull();
    const path = `/api/v1/cms/reviews?scope=assigned&limit=50&cursor=${encodeURIComponent(cursor ?? '')}`;
    const first = await stack.get(path);
    expectStatus(first, 200);
    expect(ReviewQueuePageSchema.parse(first.body).items).toHaveLength(50);
    const result = record(
      await measure('queue_page2_cursor', () => stack.get(path), ok, RUN),
    );
    expect(result.p95).toBeLessThan(TIER_1_P95_MS);
  }, 300_000);

  it('every request of the five measured reads, warm-ups included, completed within the exact 8,000 ms read deadline [P2-S11-AC-052]', () => {
    expect(measurements.map((entry) => entry.op)).toEqual([
      'workflow_draft128',
      'workflow_bounds',
      'review_detail',
      'queue_page1_limit50',
      'queue_page2_cursor',
    ]);
    for (const entry of measurements) {
      expect(
        entry.samples.length,
        `${entry.op} samples`,
      ).toBeGreaterThanOrEqual(20);
      for (const elapsed of [...entry.warmups, ...entry.samples])
        expect(elapsed, entry.op).toBeLessThan(READ_DEADLINE_MS);
    }
  });
});
