/**
 * DEC-184: on the last delivery a would-be `queued` disposition rolls an in-flight plan back to its terminal
 * failure, so a new CMS-03A-10 attempt is admitted (an earlier `running`, `verifying` or `failed_retryable`
 * plan otherwise answers 409). The rollback reads the plan again through the Job-fenced claimed read, uses
 * the plan lease it finds or claims a fresh one, and checkpoints every state-advancing RPC.
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
  type PlanSimulator,
  type SimulatorOptions,
} from './claimed-schema-migration-preparation-sim.test-support';
import { SCHEMA_MIGRATION_RPC as RPC } from './migration-worker-constants';

const REASON = 'MIGRATION_RETRIES_EXHAUSTED';
const CURRENT: CmsLeaseCheckpoint = {
  kind: 'current',
  claimedJob: { jobId: 'job', version: '1', leaseToken: 'token' },
  leaseUntilMs: 9_999_999,
};

const setup = (sim: PlanSimulator, clock: { now: number }, lostAt?: number) => {
  const order: string[] = [];
  let checkpoints = 0;
  const control: CmsLeaseControl = {
    checkpoint: async () => {
      checkpoints += 1;
      order.push('checkpoint');
      return lostAt === checkpoints ? { kind: 'lost' } : CURRENT;
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
    now: () => clock.now,
    leaseDurationMs: 30_000,
    maxBatchRows: 128,
    maxBatchesPerInvocation: 1,
  });
  const exhaust = () =>
    worker.exhaust(sim.input(), {
      signal: new AbortController().signal,
      control,
    });
  return { worker, exhaust, order };
};

/** Starts a plan of `options.rows` rows and runs `deliveries` full deliveries of the real worker. */
const advance = async (
  options: SimulatorOptions,
  deliveries: number,
  clock = { now: 1_000_000 },
) => {
  const sim = createPlanSimulator({ ...options, now: () => clock.now });
  const f = setup(sim, clock);
  for (let attempt = 1; attempt <= deliveries; attempt += 1)
    await f.worker.process(sim.input(), {
      signal: new AbortController().signal,
      attempt,
    });
  return { sim, clock, ...f };
};

const rollbackRequests = (sim: PlanSimulator) =>
  sim.calls
    .filter(({ rpc }) => rpc === RPC.rollback)
    .map(({ request }) => request);

describe('[P2-S12-AC-050] exhaustion rollback on the last delivery (DEC-184)', () => {
  it('rolls a mid-scan dry_running plan with a live plan lease back to blocked and fails its report, without a new claim', async () => {
    const f = await advance({ rows: 300 }, 1);
    expect(f.sim.plan()).toMatchObject({ state: 'dry_running', cursor: '128' });
    const held = f.sim.plan();
    const before = f.sim.calls.length;

    expect(await f.exhaust()).toBe('rolled_back');

    expect(f.sim.calls.slice(before).map(({ rpc }) => rpc)).toEqual([
      RPC.readPlan,
      RPC.rollback,
    ]);
    expect(f.order.slice(-3)).toEqual([
      RPC.readPlan,
      'checkpoint',
      RPC.rollback,
    ]);
    expect(rollbackRequests(f.sim)).toEqual([
      expect.objectContaining({
        migrationPlanId: held.id,
        expectedVersion: held.version,
        cursor: '128',
        leaseToken: held.leaseToken,
        reasonCode: REASON,
        retryable: false,
        preserveOldActive: true,
        deleteRows: false,
      }),
    ]);
    expect(f.sim.plan().state).toBe('blocked');
    expect(f.sim.reportState()).toBe('failed');
  });

  it('claims a fresh plan lease first when the previous one has lapsed', async () => {
    const f = await advance({ rows: 300 }, 1);
    f.clock.now += 90_000;
    const before = f.sim.calls.length;

    expect(await f.exhaust()).toBe('rolled_back');

    expect(f.sim.calls.slice(before).map(({ rpc }) => rpc)).toEqual([
      RPC.readPlan,
      RPC.claimLease,
      RPC.rollback,
    ]);
    expect(f.order.slice(-5)).toEqual([
      RPC.readPlan,
      'checkpoint',
      RPC.claimLease,
      'checkpoint',
      RPC.rollback,
    ]);
    expect(f.sim.plan().state).toBe('blocked');
    expect(f.sim.reportState()).toBe('failed');
  });

  it('fails a mid-backfill running plan terminally once its lease has lapsed, freeing the version pair', async () => {
    const f = await advance({ rows: 300 }, 4);
    expect(f.sim.plan()).toMatchObject({ state: 'running', cursor: '256' });
    f.clock.now += 90_000;

    expect(await f.exhaust()).toBe('rolled_back');

    expect(f.sim.plan().state).toBe('failed_terminal');
    expect(rollbackRequests(f.sim).at(-1)).toMatchObject({
      reasonCode: REASON,
      retryable: false,
    });
  });

  it('rolls a verifying plan back while its plan lease is still live', async () => {
    const f = await advance(
      { rows: 5, state: 'verifying', cursor: 5, holdLease: true },
      0,
    );
    expect(await f.exhaust()).toBe('rolled_back');
    expect(f.sim.rpcNames()).toEqual([RPC.readPlan, RPC.rollback]);
    expect(f.sim.plan().state).toBe('failed_terminal');
  });

  it('reports a verifying plan whose plan lease lapsed as unavailable: no lease can be claimed in that state', async () => {
    const f = await advance(
      { rows: 5, state: 'verifying', cursor: 5, holdLease: true },
      0,
    );
    f.clock.now += 90_000;
    expect(await f.exhaust()).toBe('unavailable');
    expect(f.sim.plan().state).toBe('verifying');
    expect(f.sim.rpcNames()).not.toContain(RPC.claimLease);
  });

  it('claims a lease for a failed_retryable plan and fails it terminally', async () => {
    const f = await advance(
      { rows: 5, state: 'failed_retryable', cursor: 3 },
      0,
    );
    expect(await f.exhaust()).toBe('rolled_back');
    expect(f.sim.rpcNames()).toEqual([
      RPC.readPlan,
      RPC.claimLease,
      RPC.rollback,
    ]);
    expect(f.sim.plan().state).toBe('failed_terminal');
  });

  it.each([
    'draft',
    'ready',
    'blocked',
    'completed',
    'failed_terminal',
  ] as const)(
    'leaves a %s plan alone: a new attempt supersedes it or it is already terminal',
    async (state) => {
      const f = await advance({ rows: 5, state }, 0);
      expect(await f.exhaust()).toBe('not_needed');
      expect(f.sim.rpcNames()).toEqual([RPC.readPlan]);
      expect(f.sim.plan().state).toBe(state);
    },
  );

  it('reports an unreadable plan as unavailable and issues no write', async () => {
    const f = await advance({ rows: 300 }, 1);
    f.sim.fail({ rpc: RPC.readPlan, nth: 2 });
    expect(await f.exhaust()).toBe('unavailable');
    expect(rollbackRequests(f.sim)).toEqual([]);
  });

  it('reports a refused rollback as unavailable and leaves the plan as it was', async () => {
    const f = await advance({ rows: 300 }, 1);
    f.sim.fail({ rpc: RPC.rollback });
    expect(await f.exhaust()).toBe('unavailable');
    expect(f.sim.plan().state).toBe('dry_running');
  });

  it('reports a refused lease claim as unavailable without a rollback', async () => {
    const f = await advance({ rows: 300 }, 1);
    f.clock.now += 90_000;
    f.sim.fail({ rpc: RPC.claimLease, nth: 2 });
    expect(await f.exhaust()).toBe('unavailable');
    expect(rollbackRequests(f.sim)).toEqual([]);
  });

  it.each([1, 2])(
    'a lost checkpoint %s stops the rollback with no further worker RPC',
    async (lostAt) => {
      const clock = { now: 1_000_000 };
      const sim = createPlanSimulator({ rows: 300, now: () => clock.now });
      const f = setup(sim, clock, lostAt);
      await f.worker.process(sim.input(), {
        signal: new AbortController().signal,
        attempt: 1,
      });
      clock.now += 90_000;
      const before = sim.calls.length;
      // The lease control above numbers checkpoints per run; the delivery above ran without one.
      expect(await f.exhaust()).toBe('unavailable');
      const issued = sim.calls.slice(before).map(({ rpc }) => rpc);
      expect(issued).toEqual(
        lostAt === 1 ? [RPC.readPlan] : [RPC.readPlan, RPC.claimLease],
      );
      expect(f.order.at(-1)).toBe('checkpoint');
      expect(sim.plan().state).toBe('dry_running');
    },
  );

  it('refuses an input that does not bind a claim', async () => {
    const f = await advance({ rows: 300 }, 0);
    const { claimedLease: _unbound, ...input } = f.sim.input();
    void _unbound;
    expect(
      await f.worker.exhaust(input, {
        signal: new AbortController().signal,
      }),
    ).toBe('unavailable');
    expect(f.sim.calls).toEqual([]);
  });

  it('reports a verifying plan that carries no plan lease at all as unavailable', async () => {
    const f = await advance({ rows: 5, state: 'verifying', cursor: 5 }, 0);
    expect(await f.exhaust()).toBe('unavailable');
    expect(f.sim.rpcNames()).toEqual([RPC.readPlan]);
  });

  it('reports a claimed-read answer that does not bind this claim as unavailable', async () => {
    const worker = createClaimedSchemaMigrationPreparation({
      port: { call: async () => ({ not: 'a claimed resolution' }) },
      workerId: SIM_WORKER,
      now: () => 1_000_000,
      leaseDurationMs: 30_000,
    });
    const sim = createPlanSimulator({ rows: 3 });
    expect(
      await worker.exhaust(sim.input(), {
        signal: new AbortController().signal,
      }),
    ).toBe('unavailable');
  });

  it('never throws: a clock that fails is reported as unavailable', async () => {
    const sim = createPlanSimulator({
      rows: 300,
      state: 'dry_running',
      cursor: 128,
      holdLease: true,
    });
    const worker = createClaimedSchemaMigrationPreparation({
      port: sim.port,
      workerId: SIM_WORKER,
      now: () => {
        throw new Error('controlled clock failure');
      },
      leaseDurationMs: 30_000,
    });
    expect(
      await worker.exhaust(sim.input(), {
        signal: new AbortController().signal,
      }),
    ).toBe('unavailable');
    expect(sim.plan().state).toBe('dry_running');
  });
});
