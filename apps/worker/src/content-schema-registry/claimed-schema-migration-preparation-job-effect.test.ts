/**
 * The Job disposition of one delivery of the claimed preparation (DEC-183 map plus the DEC-184 delivery
 * budget): real stages and the real entry over the plan model, composed exactly as the production callback
 * composes them. Delivery 4 turns a would-be `queued` into a terminal plan rollback and a `failed` Job.
 */
import type {
  CmsLeaseCheckpoint,
  CmsLeaseControl,
  JobEffectResult,
} from '@wejammin/application';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createClaimedSchemaMigrationPreparation } from './claimed-schema-migration-preparation';
import {
  executeClaimedPreparationJob,
  PREPARATION_EXHAUSTION_BUDGET_MS,
  type ClaimedPreparationPort,
} from './claimed-schema-migration-preparation-job-effect';
import {
  createPlanSimulator,
  SIM_WORKER,
} from './claimed-schema-migration-preparation-sim.test-support';
import { SCHEMA_MIGRATION_RPC as RPC } from './migration-worker-constants';
import { IDS } from './schema-dry-run-claim-response-test-support';

const CURRENT: CmsLeaseCheckpoint = {
  kind: 'current',
  claimedJob: { jobId: 'job', version: '1', leaseToken: 'token' },
  leaseUntilMs: 9_999_999,
};
const control: CmsLeaseControl = { checkpoint: async () => CURRENT };
const lostControl: CmsLeaseControl = {
  checkpoint: async () => ({ kind: 'lost' }),
};
const queuedWith = (errorCode: string | null): JobEffectResult => ({
  state: 'queued',
  errorCode,
  resultRef: null,
});
const exhausted: JobEffectResult = {
  state: 'failed',
  errorCode: 'MIGRATION_RETRIES_EXHAUSTED',
  resultRef: null,
};

const world = (rows: number, clock = { now: 1_000_000 }) => {
  const sim = createPlanSimulator({ rows, now: () => clock.now });
  const preparation = createClaimedSchemaMigrationPreparation({
    port: sim.port,
    workerId: SIM_WORKER,
    now: () => clock.now,
    leaseDurationMs: 30_000,
    maxBatchRows: 128,
    maxBatchesPerInvocation: 1,
  });
  const deliver = (
    deliveryAttempt: number,
    overrides: Partial<{
      preparation: ClaimedPreparationPort | null;
      control: CmsLeaseControl | undefined;
      signal: AbortSignal;
    }> = {},
  ) =>
    executeClaimedPreparationJob({
      preparation:
        'preparation' in overrides ? overrides.preparation! : preparation,
      input: sim.input(),
      control: 'control' in overrides ? overrides.control : control,
      deliveryAttempt,
      signal: overrides.signal ?? new AbortController().signal,
    });
  return { sim, preparation, deliver, clock };
};

afterEach(() => vi.useRealTimers());

describe('[P2-S12-AC-050] claimed preparation Job disposition per delivery (DEC-183, DEC-184)', () => {
  it('a completed first-empty baseline is succeeded with the report reference', async () => {
    const w = world(0);
    expect(await w.deliver(1)).toEqual({
      state: 'succeeded',
      errorCode: null,
      resultRef: { type: 'cms_schema_dry_run_report', id: IDS.report },
    });
  });

  it('a batch limit reached is a progress continuation: queued with no error code', async () => {
    const w = world(300);
    expect(await w.deliver(1)).toEqual(queuedWith(null));
    expect(w.sim.plan()).toMatchObject({ state: 'dry_running', cursor: '128' });
  });

  it('a retry-type worker outcome is queued with its reason code', async () => {
    const w = world(300);
    await w.deliver(1);
    w.sim.fail({ rpc: RPC.heartbeatLease, nth: 2 });
    expect(await w.deliver(2)).toEqual(queuedWith('DEPENDENCY_UNAVAILABLE'));
  });

  it('without a lease control the stages run unfenced and the delivery still settles', async () => {
    const w = world(300);
    expect(await w.deliver(1, { control: undefined })).toEqual(
      queuedWith(null),
    );
    for (const attempt of [2, 3])
      await w.deliver(attempt, { control: undefined });
    expect(await w.deliver(4, { control: undefined })).toEqual(exhausted);
    expect(w.sim.plan().state).toBe('failed_terminal');
  });

  it('a lost lease control is a retryable stop with no worker write', async () => {
    const w = world(300);
    expect(await w.deliver(1, { control: lostControl })).toEqual(
      queuedWith('JOB_LEASE_LOST'),
    );
    expect(w.sim.rpcNames()).toEqual([RPC.readPlan]);
  });

  it('preparation 300 rows with one batch per invocation completes by delivery 5, so deliveries 1 to 4 end in exhaustion', async () => {
    const w = world(300);
    expect(await w.deliver(1)).toEqual(queuedWith(null));
    expect(await w.deliver(2)).toEqual(queuedWith(null));
    expect(await w.deliver(3)).toEqual(queuedWith(null));
    expect(w.sim.plan()).toMatchObject({ state: 'running', cursor: '128' });

    // Delivery 4 would continue with `progress`; it rolls the plan back and fails the Job instead.
    expect(await w.deliver(4)).toEqual(exhausted);
    expect(w.sim.plan().state).toBe('failed_terminal');
    const rollback = w.sim.calls.filter(({ rpc }) => rpc === RPC.rollback);
    expect(rollback).toHaveLength(1);
    expect(rollback[0]?.request).toMatchObject({
      reasonCode: 'MIGRATION_RETRIES_EXHAUSTED',
      retryable: false,
    });
  });

  it('a scan that cannot finish by delivery 4 blocks the plan and fails its report', async () => {
    const w = world(900);
    for (const attempt of [1, 2, 3]) await w.deliver(attempt);
    expect(w.sim.plan()).toMatchObject({ state: 'dry_running', cursor: '384' });
    expect(await w.deliver(4)).toEqual(exhausted);
    expect(w.sim.plan().state).toBe('blocked');
    expect(w.sim.reportState()).toBe('failed');
  });

  it('a retry-type outcome on delivery 4 is exhaustion too', async () => {
    const w = world(300);
    for (const attempt of [1, 2, 3]) await w.deliver(attempt);
    // Heartbeats: one per batch, i.e. deliveries 1 to 3 use four and delivery 4 its fifth.
    w.sim.fail({ rpc: RPC.heartbeatLease, nth: 5 });
    expect(await w.deliver(4)).toEqual(exhausted);
    expect(w.sim.plan().state).toBe('failed_terminal');
  });

  it('a delivery that completes on the fourth attempt is still succeeded and rolls nothing back', async () => {
    const w = world(256);
    for (const attempt of [1, 2]) await w.deliver(attempt);
    // 256 rows with one batch per invocation need three deliveries.
    expect(await w.deliver(3)).toMatchObject({ state: 'succeeded' });
    expect(w.sim.calls.some(({ rpc }) => rpc === RPC.rollback)).toBe(false);
    const again = world(256);
    for (const attempt of [1, 2]) await again.deliver(attempt);
    expect(await again.deliver(4)).toMatchObject({ state: 'succeeded' });
    expect(again.sim.calls.some(({ rpc }) => rpc === RPC.rollback)).toBe(false);
  });

  it('a terminal worker outcome on delivery 4 keeps its own disposition and does not roll back again', async () => {
    const w = world(300);
    await w.deliver(1);
    w.sim.fail({
      rpc: RPC.processDryRunBatch,
      nth: 2,
      error: Object.assign(new Error('x'), {
        code: 'VALIDATION_FAILED',
        retryable: false,
      }),
    });
    const result = await w.deliver(4);
    expect(result).toEqual({
      state: 'failed',
      errorCode: 'VALIDATION_FAILED',
      resultRef: null,
    });
    expect(w.sim.calls.filter(({ rpc }) => rpc === RPC.rollback)).toHaveLength(
      1,
    );
  });

  it('an environment that could not be composed is queued unavailable, then exhausted on delivery 4, with no worker RPC', async () => {
    const w = world(300);
    for (const attempt of [1, 2, 3])
      expect(await w.deliver(attempt, { preparation: null })).toEqual(
        queuedWith('DEPENDENCY_UNAVAILABLE'),
      );
    expect(await w.deliver(4, { preparation: null })).toEqual(exhausted);
    expect(w.sim.calls).toEqual([]);
  });

  it('a preparation that throws is queued unavailable and never throws out of the effect', async () => {
    const w = world(300);
    const throwing: ClaimedPreparationPort = {
      process: async () => {
        throw new Error('controlled');
      },
      exhaust: async () => 'unavailable',
    };
    expect(await w.deliver(1, { preparation: throwing })).toEqual(
      queuedWith('DEPENDENCY_UNAVAILABLE'),
    );
  });

  it('on delivery 4 a throwing preparation still fails the Job and still tries the rollback', async () => {
    const exhaust = vi.fn(async () => 'unavailable' as const);
    const throwing: ClaimedPreparationPort = {
      process: async () => {
        throw new Error('controlled');
      },
      exhaust,
    };
    const w = world(300);
    expect(await w.deliver(4, { preparation: throwing })).toEqual(exhausted);
    expect(exhaust).toHaveBeenCalledTimes(1);
  });

  it('a throwing rollback does not stop the Job from failing', async () => {
    const w = world(300);
    const broken: ClaimedPreparationPort = {
      process: w.preparation.process,
      exhaust: async () => {
        throw new Error('controlled');
      },
    };
    for (const attempt of [1, 2, 3]) await w.deliver(attempt);
    expect(await w.deliver(4, { preparation: broken })).toEqual(exhausted);
  });

  it('bounds the rollback by its own deadline, so a hung port cannot hold the Job open', async () => {
    vi.useFakeTimers();
    const hung: ClaimedPreparationPort = {
      process: async () => {
        throw new Error('controlled');
      },
      exhaust: (_input, options) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () =>
            reject(new Error('aborted')),
          );
        }),
    };
    const w = world(300);
    const pending = w.deliver(4, { preparation: hung });
    await vi.advanceTimersByTimeAsync(PREPARATION_EXHAUSTION_BUDGET_MS - 1);
    let settled = false;
    void pending.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toEqual(exhausted);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('never reports cancelled or pending_manual_review on any delivery', async () => {
    const w = world(300);
    for (const attempt of [1, 2, 3, 4, 5]) {
      const result = await w.deliver(attempt);
      expect(['queued', 'succeeded', 'failed']).toContain(result.state);
    }
  });
});
