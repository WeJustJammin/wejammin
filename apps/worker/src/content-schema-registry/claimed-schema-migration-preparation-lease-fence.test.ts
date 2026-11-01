/**
 * Stage fence 2C (BE03a "Job lease checkpoints"): the claimed preparation awaits one `checkpoint()` of the
 * private BE00 lease control immediately before each of eight state-advancing worker RPCs, and stops with no
 * further worker RPC once a checkpoint is lost. Real stages and the real entry over the plan model; the
 * plan CAS and the BE00 outcome CAS stay the authority (a `current` checkpoint is not ownership).
 */
import type {
  CmsLeaseCheckpoint,
  CmsLeaseControl,
} from '@wejammin/application';
import { describe, expect, it } from 'vitest';

import { createClaimedSchemaMigrationPreparation } from './claimed-schema-migration-preparation';
import {
  createPlanSimulator,
  SIM_WORKER,
} from './claimed-schema-migration-preparation-sim.test-support';
import { withJobLeaseCheckpoints } from './claimed-schema-migration-preparation-lease-fence';
import { SCHEMA_MIGRATION_RPC as RPC } from './migration-worker-constants';
import type { MigrationWorkerRuntime } from './migration-worker-runtime';

const CHECKPOINTED = [
  RPC.claimLease,
  RPC.processDryRunBatch,
  RPC.finalizeDryRun,
  RPC.processBatch,
  RPC.beginVerification,
  RPC.verify,
  RPC.complete,
  RPC.rollback,
] as const;
const UNCHECKPOINTED = [RPC.readPlan, RPC.heartbeatLease, RPC.readSourceRows];
const CURRENT: CmsLeaseCheckpoint = {
  kind: 'current',
  claimedJob: { jobId: 'job', version: '1', leaseToken: 'token' },
  leaseUntilMs: 9_999_999,
};

type Order = Array<'checkpoint' | string>;

const run = async (
  options: Readonly<{
    rows?: number;
    lostAt?: number;
    withControl?: boolean;
    failBatchTerminally?: boolean;
  }> = {},
) => {
  const sim = createPlanSimulator({ rows: options.rows ?? 1 });
  if (options.failBatchTerminally === true)
    sim.fail({
      rpc: RPC.processDryRunBatch,
      error: Object.assign(new Error('x'), {
        code: 'VALIDATION_FAILED',
        retryable: false,
      }),
    });
  const order: Order = [];
  let checkpoints = 0;
  const control: CmsLeaseControl = {
    checkpoint: async () => {
      checkpoints += 1;
      order.push('checkpoint');
      return options.lostAt === checkpoints ? { kind: 'lost' } : CURRENT;
    },
  };
  const worker = createClaimedSchemaMigrationPreparation({
    port: {
      call: (rpc, request, signal) => {
        order.push(rpc);
        return sim.port.call(rpc, request, signal);
      },
    },
    workerId: SIM_WORKER,
    now: () => 1_000_000,
    leaseDurationMs: 30_000,
    maxBatchRows: 128,
    maxBatchesPerInvocation: 32,
  });
  const result = await worker.process(sim.input(), {
    signal: new AbortController().signal,
    attempt: 1,
    ...(options.withControl === false ? {} : { control }),
  });
  return { order, result, sim, checkpoints };
};

const outcomeOf = (result: Awaited<ReturnType<typeof run>>['result']) =>
  result.kind === 'processed' ? result.result : null;

describe('[P2-S12-AC-050] Job lease checkpoints before state-advancing worker RPCs (stage fence 2C)', () => {
  it('awaits one checkpoint immediately before each of the eight state-advancing RPCs and none before the three reads', async () => {
    const { order, result } = await run();
    expect(outcomeOf(result)?.outcome).toBe('completed');
    order.forEach((entry, index) => {
      if (entry === 'checkpoint') return;
      const before = order[index - 1];
      if ((CHECKPOINTED as readonly string[]).includes(entry))
        expect(before, `${entry} is preceded by a checkpoint`).toBe(
          'checkpoint',
        );
      else {
        expect(UNCHECKPOINTED as string[]).toContain(entry);
        expect(before, `${entry} is not preceded by a checkpoint`).not.toBe(
          'checkpoint',
        );
      }
    });
    // Every checkpoint is followed by the RPC it guards, never by another checkpoint.
    order.forEach((entry, index) => {
      if (entry === 'checkpoint')
        expect(order[index + 1]).not.toBe('checkpoint');
    });
    expect(order.filter((e) => e === 'checkpoint')).toHaveLength(8);
  });

  it('checkpoints the terminal rollback too', async () => {
    const { order, result } = await run({ failBatchTerminally: true });
    expect(outcomeOf(result)?.outcome).toBe('failed_terminal');
    const rollback = order.indexOf(RPC.rollback);
    expect(rollback).toBeGreaterThan(0);
    expect(order[rollback - 1]).toBe('checkpoint');
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8])(
    'a lost checkpoint %s stops the invocation before its RPC with no further worker RPC',
    async (k) => {
      const baseline = await run();
      let seen = 0;
      const stopAt = baseline.order.findIndex((entry) => {
        if (entry === 'checkpoint') seen += 1;
        return entry === 'checkpoint' && seen === k;
      });
      const lost = await run({ lostAt: k });

      // History ends exactly at the lost checkpoint: everything before it, then nothing.
      expect(lost.order).toEqual(baseline.order.slice(0, stopAt + 1));
      expect(lost.order.at(-1)).toBe('checkpoint');
      expect(lost.checkpoints).toBe(k);
      const outcome = outcomeOf(lost.result);
      expect(outcome?.outcome).toBe('retry');
      expect(outcome?.reasonCode).toBe('JOB_LEASE_LOST');
    },
  );

  it('keeps the legacy history exactly when the consumer supplies no lease control', async () => {
    const { order, result } = await run({ withControl: false });
    expect(order).not.toContain('checkpoint');
    expect(outcomeOf(result)?.outcome).toBe('completed');
    const guarded = await run();
    expect(guarded.order.filter((e) => e !== 'checkpoint')).toEqual(order);
  });

  it('passes every request to the port unchanged', async () => {
    const guarded = await run();
    const plain = await run({ withControl: false });
    expect(guarded.sim.calls).toEqual(plain.sim.calls);
  });

  it('treats a throwing checkpoint as a lost lease', async () => {
    const sim = createPlanSimulator({ rows: 1 });
    const worker = createClaimedSchemaMigrationPreparation({
      port: sim.port,
      workerId: SIM_WORKER,
      now: () => 1_000_000,
      leaseDurationMs: 30_000,
    });
    const result = await worker.process(sim.input(), {
      signal: new AbortController().signal,
      attempt: 1,
      control: {
        checkpoint: async () => {
          throw new Error('controlled');
        },
      },
    });
    expect(sim.rpcNames()).toEqual([RPC.readPlan]);
    expect(outcomeOf(result)?.reasonCode).toBe('JOB_LEASE_LOST');
  });

  it('latches: after one lost checkpoint every later call of any name is stopped before the runtime', async () => {
    const reached: string[] = [];
    const runtime = {
      call: async (rpc: string) => {
        reached.push(rpc);
        return { ok: true as const, value: {} };
      },
    } as unknown as MigrationWorkerRuntime;
    const fenced = withJobLeaseCheckpoints(runtime, {
      checkpoint: async () => ({ kind: 'lost' }),
    });
    const stop = {
      ok: false,
      failure: { code: 'JOB_LEASE_LOST', retryable: true },
    };
    const signal = new AbortController().signal;

    expect(await fenced.call(RPC.claimLease, {}, signal)).toEqual(stop);
    // Not state-advancing, but the invocation is already stopped.
    expect(await fenced.call(RPC.readSourceRows, {}, signal)).toEqual(stop);
    expect(await fenced.call(RPC.heartbeatLease, {}, signal)).toEqual(stop);
    expect(await fenced.call(RPC.readPlan, {}, signal)).toEqual(stop);
    expect(reached).toEqual([]);
  });

  it('answers the runtime unchanged for a current checkpoint and an unguarded read', async () => {
    const answer = { ok: true as const, value: { renewed: true } };
    const runtime = {
      call: async () => answer,
    } as unknown as MigrationWorkerRuntime;
    const fenced = withJobLeaseCheckpoints(runtime, {
      checkpoint: async () => CURRENT,
    });
    const signal = new AbortController().signal;
    expect(await fenced.call(RPC.heartbeatLease, {}, signal)).toBe(answer);
    expect(await fenced.call(RPC.claimLease, {}, signal)).toBe(answer);
  });
});
