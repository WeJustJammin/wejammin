/**
 * Tracked boundary #128 (finding B-08, DEC-184, stage fence 2C): the BE00 four-delivery budget, the
 * last-delivery rollback, and the Job lease checkpoints, through the production async entrypoint over the
 * real stack. A page size of one row makes a five-row type need as many deliveries as a 640-row type needs
 * at the default 128-row page (`2 x ceil(ceil(N / page) / m) - 1`), so the ceiling is reached cheaply.
 *
 * Five rows, one row per page:
 *   m = 1  scan 5 deliveries, so delivery 4 stops mid-scan (`dry_running`)
 *   m = 2  deliveries 1 to 3 scan and start the backfill, delivery 4 stops mid-backfill (`running`)
 *   m = 3  3 deliveries, m = 5  1 delivery
 */
import { beforeAll, describe, expect, it } from 'vitest';

import {
  changeDraft,
  deliver,
  editDraftForNextAttempt,
  evidenceCount,
  expireJobLease,
  jobRow,
  planRow,
  polledStatus,
  prepareB08World,
  processedCount,
  reportRow,
  startAttempt,
  type Attempt,
  type B08World,
} from './support/phase-02-b08-preparation-support';

const ROWS = 5;
let world: B08World;
beforeAll(async () => {
  world = await prepareB08World(ROWS);
  // An optional new field: an additive change, so the scan seals clean and the backfill follows.
  await changeDraft(world, {
    key: 'subtitle',
    constraints: {},
    required: false,
    order: 1,
  });
}, 600_000);

const migrationOf = (maxBatchesPerInvocation: number) =>
  ({ maxBatchRows: 1, maxBatchesPerInvocation }) as const;

/** Delivers until the Job leaves the queue; returns the number of deliveries it took. */
const runToSettlement = async (
  attempt: Attempt,
  migration: ReturnType<typeof migrationOf>,
  limit = 6,
): Promise<number> => {
  let deliveries = 0;
  while (jobRow(attempt.jobId).state === 'queued' && deliveries < limit) {
    deliveries += 1;
    await deliver(attempt.event, { attempts: deliveries, migration });
  }
  return deliveries;
};

/** Deliveries 1 to 3: each a healthy continuation (queued, no error code, redelivered at once, no marker). */
const expectContinuations = async (
  attempt: Attempt,
  migration: ReturnType<typeof migrationOf>,
) => {
  for (const delivery of [1, 2, 3]) {
    const { ack, retry } = await deliver(attempt.event, {
      attempts: delivery,
      migration,
    });
    expect(jobRow(attempt.jobId)).toMatchObject({
      state: 'queued',
      errorCode: null,
      resultRef: null,
      attemptCount: delivery,
    });
    expect(retry.mock.calls).toEqual([[]]);
    expect(ack).not.toHaveBeenCalled();
    expect(processedCount(attempt.event.eventId)).toBe(0);
  }
};

/** Delivery 4: the Job is failed, acknowledged and recorded, and the rolled-back plan frees the version pair. */
const expectExhaustion = async (
  attempt: Attempt,
  migration: ReturnType<typeof migrationOf>,
) => {
  const last = await deliver(attempt.event, { attempts: 4, migration });

  expect(jobRow(attempt.jobId)).toMatchObject({
    state: 'failed',
    errorCode: 'MIGRATION_RETRIES_EXHAUSTED',
    resultRef: null,
    attemptCount: 4,
  });
  expect(processedCount(attempt.event.eventId)).toBe(1);
  expect(last.ack).toHaveBeenCalledTimes(1);
  expect(last.retry).not.toHaveBeenCalled();
  expect(last.rpcs).toContain('cms_rollback_schema_migration');
  expect(await polledStatus(attempt.jobId)).toMatchObject({
    state: 'failed',
    error: { code: 'MIGRATION_RETRIES_EXHAUSTED', retryable: false },
  });
  // A new CMS-03A-10 attempt for the same version pair is admitted, not 409.
  const next = await startAttempt(world);
  expect(next.planId).not.toBe(attempt.planId);
};

describe('[P2-S12-AC-050] B-08 delivery budget (DEC-184), real stack', () => {
  it('five rows at one row per page and one batch per invocation: delivery 4 stops mid-scan, blocks the plan, fails the report and the Job', async () => {
    const attempt = await startAttempt(world);
    const migration = migrationOf(1);

    await expectContinuations(attempt, migration);
    expect(planRow(attempt.planId)).toMatchObject({
      state: 'dry_running',
      cursor: '3',
    });

    await expectExhaustion(attempt, migration);

    // The real rollback RPC for a scan: the plan is blocked and the attempt's own report is failed (unsealed).
    expect(planRow(attempt.planId)).toMatchObject({ state: 'blocked' });
    expect(reportRow(attempt.reportId)).toMatchObject({
      state: 'failed',
      failureCode: 'MIGRATION_RETRIES_EXHAUSTED',
      sealed: false,
    });
  }, 600_000);

  it('five rows at one row per page and two batches per invocation: delivery 4 stops mid-backfill and fails the plan terminally', async () => {
    const attempt = await startAttempt(world);
    const migration = migrationOf(2);

    await expectContinuations(attempt, migration);
    // The scan sealed clean on delivery 3 and the backfill is two rows in.
    expect(reportRow(attempt.reportId)).toMatchObject({
      state: 'completed',
      result: 'pass',
      sealed: true,
    });
    expect(planRow(attempt.planId)).toMatchObject({
      state: 'running',
      cursor: '2',
    });

    await expectExhaustion(attempt, migration);

    expect(planRow(attempt.planId)).toMatchObject({ state: 'failed_terminal' });
  }, 600_000);

  it('the same five rows complete in one delivery with five batches per invocation', async () => {
    const attempt = await startAttempt(world);

    const { ack, retry } = await deliver(attempt.event, {
      attempts: 1,
      migration: migrationOf(5),
    });

    expect(jobRow(attempt.jobId)).toMatchObject({
      state: 'succeeded',
      errorCode: null,
      attemptCount: 1,
      resultRef: { type: 'cms_schema_dry_run_report', id: attempt.reportId },
    });
    expect(planRow(attempt.planId)).toMatchObject({
      state: 'completed',
      sourceCount: String(ROWS),
    });
    expect(reportRow(attempt.reportId)).toMatchObject({
      state: 'completed',
      result: 'pass',
      sealed: true,
      sourceCount: String(ROWS),
    });
    expect(ack).toHaveBeenCalledTimes(1);
    expect(retry).not.toHaveBeenCalled();
  }, 300_000);

  it('with three batches per invocation they complete in 2 x ceil(5 / 3) - 1 = 3 deliveries and three claims', async () => {
    await editDraftForNextAttempt(world);
    const attempt = await startAttempt(world);

    const deliveries = await runToSettlement(attempt, migrationOf(3));

    expect(deliveries).toBe(3);
    expect(jobRow(attempt.jobId)).toMatchObject({
      state: 'succeeded',
      attemptCount: 3,
    });
    expect(planRow(attempt.planId)).toMatchObject({ state: 'completed' });
  }, 600_000);
});

describe('[P2-S12-AC-050] B-08 Job lease stage fence (2C), real stack', () => {
  it('a delivery whose Job lease lapsed mid-run issues no further stage RPC; the redelivery resumes from the plan cursor and finishes with unique evidence', async () => {
    await editDraftForNextAttempt(world);
    const attempt = await startAttempt(world);
    const migration = migrationOf(5);
    let expired = false;

    const stalled = await deliver(attempt.event, {
      attempts: 1,
      migration,
      afterRpc: (rpc) => {
        if (rpc === 'cms_process_schema_migration_dry_run_batch' && !expired) {
          expired = true;
          expireJobLease(attempt.jobId);
        }
      },
    });

    // One scan batch committed before the lapse; the next state-advancing RPC was never sent.
    expect(
      stalled.rpcs.filter(
        (rpc) => rpc === 'cms_process_schema_migration_dry_run_batch',
      ),
    ).toHaveLength(1);
    expect(stalled.rpcs).not.toContain('cms_finalize_schema_migration_dry_run');
    expect(stalled.rpcs).not.toContain('apply_job_outcome');
    expect(planRow(attempt.planId)).toMatchObject({
      state: 'dry_running',
      cursor: '1',
    });
    // No Job write and no marker: the lapsed lease is a retry, paced on the BE00 schedule.
    expect(jobRow(attempt.jobId)).toMatchObject({
      state: 'running',
      attemptCount: 1,
    });
    expect(processedCount(attempt.event.eventId)).toBe(0);
    expect(stalled.ack).not.toHaveBeenCalled();
    expect(stalled.retry.mock.calls).toEqual([[{ delaySeconds: 15 }]]);

    const resumed = await deliver(attempt.event, { attempts: 2, migration });

    expect(jobRow(attempt.jobId)).toMatchObject({
      state: 'succeeded',
      resultRef: { type: 'cms_schema_dry_run_report', id: attempt.reportId },
    });
    expect(resumed.ack).toHaveBeenCalledTimes(1);
    expect(planRow(attempt.planId)).toMatchObject({
      state: 'completed',
      sourceCount: String(ROWS),
    });
    expect(reportRow(attempt.reportId)).toMatchObject({
      state: 'completed',
      result: 'pass',
      sealed: true,
      sourceCount: String(ROWS),
      rowErrorCount: '0',
    });
    // The interrupted scan neither lost nor duplicated a row: one evidence row per source row.
    expect(evidenceCount(attempt.reportId)).toEqual({
      rows: ROWS,
      distinct: ROWS,
    });
  }, 600_000);
});
