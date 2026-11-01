/**
 * BE03a 2484-2491 (locked): on the fourth delivery the terminal rollback uses the plan lease it
 * finds or claims a fresh one (a verifying plan cannot be re-leased), and a plan that cannot be
 * rolled back (no live lease and none claimable, or an unreadable plan) is left as it was: the Job
 * is failed all the same and the migration retry >3 and DLQ alerts are the operator signal.
 *
 * This suite asserts that locked fallback against the real worker and the existing plan simulator:
 * an expired verifying plan is reported unavailable and left unchanged, no fresh lease is claimed
 * for it, and the Job lease fence is honored. It does NOT assert that the Job is failed or that an
 * alert fires -- that requires the actual Job handler, which is not exercised here. It does NOT
 * assert the optional expired-verifying recovery (preserved, unapproved, under docs/handoffs/.../proposals).
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
} from './claimed-schema-migration-preparation-sim.test-support';
import { SCHEMA_MIGRATION_RPC as RPC } from './migration-worker-constants';

const CURRENT: CmsLeaseCheckpoint = {
  kind: 'current',
  claimedJob: { jobId: 'job', version: '1', leaseToken: 'token' },
  leaseUntilMs: 9_999_999,
};

const LIVE_VERIFYING = {
  rows: 5,
  state: 'verifying' as const,
  cursor: 5,
  holdLease: true,
};

/** A control that counts its checkpoints and answers the same result every time. */
const countingControl = (
  counter: { calls: number },
  result: 'current' | 'lost',
): CmsLeaseControl => ({
  checkpoint: async () => {
    counter.calls += 1;
    return result === 'lost' ? { kind: 'lost' } : CURRENT;
  },
});

const create = (
  sim: PlanSimulator,
  clock: { now: number },
  control?: CmsLeaseControl,
) => {
  const worker = createClaimedSchemaMigrationPreparation({
    port: sim.port,
    workerId: SIM_WORKER,
    now: () => clock.now,
    leaseDurationMs: 30_000,
    maxBatchRows: 128,
    maxBatchesPerInvocation: 1,
  });
  return worker.exhaust(sim.input(), {
    signal: new AbortController().signal,
    // `exactOptionalPropertyTypes` forbids assigning an explicit `undefined` to the optional
    // `control` property, so it is omitted entirely when absent.
    ...(control === undefined ? {} : { control }),
  });
};

describe('[P2-S12-AC-050] locked fallback for an expired verifying lease (BE03a 2488-2491)', () => {
  it('reports an expired verifying plan unavailable: no fresh claim, refused rollback leaves the plan unchanged', async () => {
    const clock = { now: 1_000_000 };
    const sim = createPlanSimulator({
      ...LIVE_VERIFYING,
      now: () => clock.now,
    });
    const before = sim.plan();
    clock.now += 90_000; // the stored plan lease has lapsed

    expect(await create(sim, clock)).toBe('unavailable');

    // The plan is left exactly as it was: state, version, cursor, counts and lease.
    expect(sim.plan()).toEqual(before);
    expect(sim.plan().state).toBe('verifying');
    // A verifying plan cannot be re-leased: no fresh lease is claimed for it.
    expect(sim.rpcNames()).not.toContain(RPC.claimLease);
    // The worker still attempts the terminal rollback with the stored (lapsed) token; the RPC
    // refuses it (LEASE_EXPIRED) and the plan is left unchanged, so the outcome is unavailable.
    expect(sim.rpcNames()).toEqual([RPC.readPlan, RPC.rollback]);
  });

  it('honors the Job fence on the reachable rollback path: a lost checkpoint stops before the rollback', async () => {
    // A LIVE verifying lease so the code reaches the checkpointed rollback path; the clock is not advanced.
    const clock = { now: 1_000_000 };
    const sim = createPlanSimulator({
      ...LIVE_VERIFYING,
      now: () => clock.now,
    });
    const before = sim.plan();
    const counter = { calls: 0 };

    expect(await create(sim, clock, countingControl(counter, 'lost'))).toBe(
      'unavailable',
    );

    // The fence actually ran: the checkpoint was reached before the rollback and answered lost.
    expect(counter.calls).toBeGreaterThan(0);
    // The read is unfenced; the rollback is fenced and must not be issued after a lost checkpoint.
    expect(sim.rpcNames()).toEqual([RPC.readPlan]);
    expect(sim.plan()).toEqual(before);
  });

  it('reaches the rollback when the Job checkpoint is current (fence is not vacuous)', async () => {
    const clock = { now: 1_000_000 };
    const sim = createPlanSimulator({
      ...LIVE_VERIFYING,
      now: () => clock.now,
    });
    const counter = { calls: 0 };

    expect(await create(sim, clock, countingControl(counter, 'current'))).toBe(
      'rolled_back',
    );

    expect(counter.calls).toBeGreaterThan(0);
    expect(sim.rpcNames()).toEqual([RPC.readPlan, RPC.rollback]);
    expect(sim.plan().state).toBe('failed_terminal');
  });
});
