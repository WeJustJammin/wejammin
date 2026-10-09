import { describe, expect, it } from 'vitest';

import { SCHEMA_MIGRATION_RPC as RPC } from './migration-worker-constants';
import { runDryRunStage } from './migration-worker-dry-run';
import {
  batchRequest,
  EXPIRES,
  FINGERPRINTS,
  fixture,
  INSTANT,
  NEW_TOKEN,
  OLD_TOKEN,
  reclaimRequest,
  ROW_ONE,
  ROW_TWO,
  WORKER,
} from './migration-worker-sealed-lease-test-support';
import {
  job,
  PLAN_ID,
  TARGET_VERSION_ID,
} from './migration-worker-test-support';

const dryCalls = (signal: AbortSignal) => [
  [
    RPC.heartbeatLease,
    {
      migrationPlanId: PLAN_ID,
      expectedVersion: '8',
      cursor: '1',
      leaseToken: OLD_TOKEN,
      workerId: WORKER,
      now: INSTANT,
      leaseDurationMs: 30_000,
    },
    signal,
  ],
  [
    RPC.readSourceRows,
    {
      migrationPlanId: PLAN_ID,
      expectedVersion: '8',
      cursor: '1',
      limit: 1,
      leaseToken: OLD_TOKEN,
    },
    signal,
  ],
  [RPC.processDryRunBatch, batchRequest('8', '1', OLD_TOKEN, ROW_TWO), signal],
];
const sealCall = (signal: AbortSignal) => [
  RPC.finalizeDryRun,
  {
    migrationPlanId: PLAN_ID,
    expectedVersion: '8',
    cursor: '2',
    sourceCount: '2',
    targetCount: '2',
    rowErrorCount: '0',
    ...FINGERPRINTS,
  },
  signal,
];
const factoryPrefix = (signal: AbortSignal) => [
  [
    RPC.readPlan,
    {
      migrationPlanId: PLAN_ID,
      schemaVersionId: TARGET_VERSION_ID,
      expectedVersion: job.expectedVersion,
    },
    signal,
  ],
  [
    RPC.claimLease,
    { ...reclaimRequest, expectedVersion: '7', cursor: '1' },
    signal,
  ],
  ...dryCalls(signal),
  sealCall(signal),
];

describe('sealed dry-run lease handoff', () => {
  it('returns the canonical sealed ready plan without carrying the stale dry-run token', async () => {
    const f = fixture();
    const result = await runDryRunStage(f.input);

    expect(f.call.mock.calls).toEqual([
      ...dryCalls(f.signal),
      sealCall(f.signal),
    ]);
    expect(result).toEqual({ plan: f.sealed, leaseToken: null });
    expect(f.held.leaseToken).toBe(OLD_TOKEN);
  });

  it('actual worker reclaims with sealed operands before bounded backfill uses its fresh lease and reset cursor', async () => {
    const f = fixture();
    const result = await f.worker.process(job, {
      signal: f.signal,
      attempt: 1,
    });

    expect(f.call.mock.calls).toEqual([
      ...factoryPrefix(f.signal),
      [RPC.claimLease, reclaimRequest, f.signal],
      [
        RPC.heartbeatLease,
        {
          migrationPlanId: PLAN_ID,
          expectedVersion: '10',
          cursor: '0',
          leaseToken: NEW_TOKEN,
          workerId: WORKER,
          now: INSTANT,
          leaseDurationMs: 30_000,
        },
        f.signal,
      ],
      [
        RPC.readSourceRows,
        {
          migrationPlanId: PLAN_ID,
          expectedVersion: '10',
          cursor: '0',
          limit: 1,
          leaseToken: NEW_TOKEN,
        },
        f.signal,
      ],
      [RPC.processBatch, batchRequest('10', '0', NEW_TOKEN, ROW_ONE), f.signal],
    ]);
    expect(result).toEqual({
      outcome: 'progress',
      migrationPlanId: PLAN_ID,
      schemaVersionId: TARGET_VERSION_ID,
      eventId: null,
      state: 'running',
      cursor: '1',
      progress: 0.5,
      retryAfterMs: 15_000,
      reasonCode: null,
      activationSwitched: false,
    });
  });

  it.each([
    {
      reclaim: 'unavailable' as const,
      outcome: 'retry',
      reasonCode: 'LEASE_UNAVAILABLE',
      retryAfterMs: 60_000,
    },
    {
      reclaim: 'retryable' as const,
      outcome: 'retry',
      reasonCode: 'DEPENDENCY_UNAVAILABLE',
      retryAfterMs: 60_000,
    },
    {
      reclaim: 'terminal' as const,
      outcome: 'failed_terminal',
      reasonCode: 'DEPENDENCY_UNAVAILABLE',
      retryAfterMs: null,
    },
  ])(
    'sealed reclaim $reclaim preserves failure semantics and prevents backfill verification and activation',
    async (row) => {
      const f = fixture(row.reclaim);
      const result = await f.worker.process(job, {
        signal: f.signal,
        attempt: 1,
      });

      expect(f.call.mock.calls).toEqual([
        ...factoryPrefix(f.signal),
        [RPC.claimLease, reclaimRequest, f.signal],
      ]);
      expect(result).toEqual({
        outcome: row.outcome,
        migrationPlanId: PLAN_ID,
        schemaVersionId: TARGET_VERSION_ID,
        eventId: null,
        state: 'ready',
        cursor: '2',
        progress: 1,
        retryAfterMs: row.retryAfterMs,
        reasonCode: row.reasonCode,
        activationSwitched: false,
      });
    },
  );

  it('unfinished bounded dry-run retains its held token on every request and yields without sealing or reclaim', async () => {
    const f = fixture('acquired', false);
    const result = await runDryRunStage(f.input);

    expect(f.call.mock.calls).toEqual(dryCalls(f.signal));
    expect(result).toEqual({
      outcome: 'progress',
      migrationPlanId: PLAN_ID,
      schemaVersionId: TARGET_VERSION_ID,
      eventId: null,
      state: 'dry_running',
      cursor: '2',
      progress: 2 / 3,
      retryAfterMs: 15_000,
      reasonCode: null,
      activationSwitched: false,
    });
    expect(f.input.leaseToken).toBe(OLD_TOKEN);
    expect(f.held).toMatchObject({
      leaseOwner: WORKER,
      leaseToken: OLD_TOKEN,
      leaseExpiresAt: EXPIRES,
    });
  });

  it('completed read-only job replay never claims a lease or reopens a stage', async () => {
    const f = fixture('acquired', true, true);
    const result = await f.worker.process(job, {
      signal: f.signal,
      replay: true,
    });

    expect(f.call.mock.calls).toEqual([
      [
        RPC.readPlan,
        {
          migrationPlanId: PLAN_ID,
          schemaVersionId: TARGET_VERSION_ID,
          expectedVersion: job.expectedVersion,
        },
        f.signal,
      ],
    ]);
    expect(result).toEqual({
      outcome: 'completed',
      migrationPlanId: PLAN_ID,
      schemaVersionId: TARGET_VERSION_ID,
      eventId: null,
      state: 'completed',
      cursor: '2',
      progress: 1,
      retryAfterMs: null,
      reasonCode: null,
      activationSwitched: false,
    });
  });
});
