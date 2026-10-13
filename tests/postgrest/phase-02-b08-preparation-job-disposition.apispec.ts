/**
 * Tracked boundary #128 (finding B-08, DEC-183): a production `cms.schema.dry_run` Job delivered through the
 * production async entrypoint reaches the claimed preparation and ends in the BE00 state the DEC-183 map
 * assigns: a sealed passing scan is `succeeded` with the report reference, a sealed failing scan is `failed`
 * `MIGRATION_BLOCKED`. Worker + Kong + PostgREST + the newest SQL; only the queue message is constructed.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { prepareClaimAttempt } from './support/phase-02-slice-11-claimed-dry-run-fixture';
import {
  changeDraft,
  deliver,
  jobRow,
  planRow,
  polledStatus,
  prepareB08World,
  processedCount,
  reportRow,
  startAttempt,
  type B08World,
} from './support/phase-02-b08-preparation-support';

describe('[P2-S12-AC-050] B-08 production dry-run Job disposition (DEC-183), real stack', () => {
  it('a first-empty baseline dry run is succeeded with the sealed report as its result reference', async () => {
    const attempt = await prepareClaimAttempt();
    const jobId = attempt.report.jobId;
    expect(jobRow(jobId)).toMatchObject({ state: 'queued', attemptCount: 0 });

    const { ack, retry, rpcs } = await deliver(attempt.event);

    expect(jobRow(jobId)).toMatchObject({
      state: 'succeeded',
      errorCode: null,
      attemptCount: 1,
      resultRef: { type: 'cms_schema_dry_run_report', id: attempt.report.id },
    });
    // A `completed` worker result is a sealed passing report (BE03a): asserted here, never inferred.
    expect(reportRow(attempt.report.id)).toMatchObject({
      state: 'completed',
      result: 'pass',
      sealed: true,
    });
    expect(planRow(attempt.report.migrationPlanId)).toMatchObject({
      state: 'ready',
    });
    expect(processedCount(attempt.event.eventId)).toBe(1);
    expect(ack).toHaveBeenCalledTimes(1);
    expect(retry).not.toHaveBeenCalled();
    // The Job was claimed, scanned and sealed by the worker stages in the delivery.
    expect(rpcs).toContain('cms_finalize_schema_migration_dry_run');
    expect(rpcs.at(-2)).toBe('apply_job_outcome');

    // The production status read and parser accept the stored Job (a non-UUID result id would not parse).
    expect(await polledStatus(jobId)).toMatchObject({
      id: jobId,
      type: 'cms.schema.dry_run',
      state: 'succeeded',
      resultRef: { type: 'cms_schema_dry_run_report', id: attempt.report.id },
      error: null,
    });
  }, 180_000);

  it('a redelivered message of a settled Job is acknowledged and changes nothing', async () => {
    const attempt = await prepareClaimAttempt();
    await deliver(attempt.event);
    const settled = jobRow(attempt.report.jobId);

    const { ack, retry, rpcs } = await deliver(attempt.event, { attempts: 2 });

    expect(jobRow(attempt.report.jobId)).toEqual(settled);
    expect(processedCount(attempt.event.eventId)).toBe(1);
    expect(rpcs).not.toContain('claim_job');
    expect(ack).toHaveBeenCalledTimes(1);
    expect(retry).not.toHaveBeenCalled();
  }, 180_000);

  describe('a populated type whose new required field fails the scan', () => {
    let world: B08World;
    beforeAll(async () => {
      world = await prepareB08World(3);
      // A new required field with no default: every existing entry lacks it, so identity.revalidate records
      // one row error per source row (an existing field's constraints cannot be tightened without a ready plan).
      await changeDraft(world, {
        key: 'subtitle',
        constraints: {},
        required: true,
        order: 1,
      });
    }, 600_000);

    it('a sealed failing scan is failed MIGRATION_BLOCKED, with no result reference, and the report stays the verdict', async () => {
      const attempt = await startAttempt(world, {
        key: 'identity.revalidate',
        version: '1',
      });

      const { ack, retry } = await deliver(attempt.event);

      expect(jobRow(attempt.jobId)).toMatchObject({
        state: 'failed',
        errorCode: 'MIGRATION_BLOCKED',
        resultRef: null,
        attemptCount: 1,
      });
      // The report is the only pass/fail authority (FE03:952): sealed, completed, result `fail`.
      expect(reportRow(attempt.reportId)).toMatchObject({
        state: 'completed',
        result: 'fail',
        sealed: true,
        sourceCount: '3',
        rowErrorCount: '3',
      });
      expect(planRow(attempt.planId)).toMatchObject({ state: 'blocked' });
      expect(processedCount(attempt.event.eventId)).toBe(1);
      expect(ack).toHaveBeenCalledTimes(1);
      expect(retry).not.toHaveBeenCalled();
      expect(await polledStatus(attempt.jobId)).toMatchObject({
        state: 'failed',
        resultRef: null,
        error: { code: 'MIGRATION_BLOCKED', retryable: false },
      });
    }, 240_000);
  });
});
