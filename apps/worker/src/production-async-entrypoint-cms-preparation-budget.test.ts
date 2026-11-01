/**
 * DEC-184 through the production entrypoint: the last-delivery rollback and exhaustion, the Job lease stage
 * fence, the invocation deadline and the BE00 retry pacing, over a scripted PostgREST.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SCHEMA_MIGRATION_RPC as RPC } from './content-schema-registry/migration-worker-constants';
import {
  claimedResponse,
  createWorld,
  deliver,
  firstEmptyScript,
  operations,
  planOf,
  SCAN_TOKEN,
  type PlanScript,
} from './production-async-entrypoint-cms-preparation.test-support';

afterEach(() => vi.useRealTimers());

const progressBatch = () => ({
  done: false,
  cursor: '0',
  progress: 0.5,
  sourceCount: '0',
  targetCount: '0',
  rowErrorCount: '0',
  migratedCount: '0',
  failedCount: '0',
});

/** A scan that never finishes: the first claimed read sees the draft plan, later reads the leased scan. */
const unfinishedScan = (
  rollback: PlanScript[typeof RPC.rollback],
): PlanScript => {
  let reads = 0;
  return {
    ...firstEmptyScript(),
    [RPC.readPlan]: (request) =>
      reads++ === 0
        ? claimedResponse(request)
        : claimedResponse(request, {
            state: 'dry_running',
            version: '8',
            leaseOwner: 'cms-schema-migration-production-b128-release',
            leaseToken: SCAN_TOKEN,
            leaseExpiresAt: new Date(Date.now() + 30_000).toISOString(),
          }),
    [RPC.processDryRunBatch]: progressBatch,
    ...(rollback === undefined ? {} : { [RPC.rollback]: rollback }),
  };
};

describe('[P2-S12-AC-050] last-delivery exhaustion through the production entrypoint (DEC-184)', () => {
  it.each([1, 2, 3])(
    'delivery %s of an unfinished scan continues with progress and no rollback',
    async (attempts) => {
      const world = createWorld(
        unfinishedScan(() => ({
          plan: planOf({ state: 'blocked', version: '9' }),
        })),
      );
      const { ack, retry } = await deliver(world, attempts);
      expect(world.outcomes).toEqual([
        expect.objectContaining({
          p_next_state: 'queued',
          p_error_code: null,
          p_retryable: true,
        }),
      ]);
      expect(operations(world)).not.toContain(RPC.rollback);
      expect(ack).not.toHaveBeenCalled();
      expect(retry.mock.calls).toEqual([[]]);
    },
  );

  it('delivery 4 rolls the in-flight plan back with the exhaustion reason, fails the Job and acknowledges it', async () => {
    const world = createWorld(
      unfinishedScan(() => ({
        plan: planOf({ state: 'blocked', version: '9' }),
      })),
    );
    const { ack, retry } = await deliver(world, 4);

    const rollback = world.calls.find(
      (call) => call.operation === RPC.rollback,
    );
    expect(rollback?.body.p_request).toMatchObject({
      reasonCode: 'MIGRATION_RETRIES_EXHAUSTED',
      retryable: false,
      leaseToken: SCAN_TOKEN,
      preserveOldActive: true,
      deleteRows: false,
    });
    expect(world.outcomes).toEqual([
      expect.objectContaining({
        p_next_state: 'failed',
        p_error_code: 'MIGRATION_RETRIES_EXHAUSTED',
        p_result_ref: null,
        p_retryable: false,
      }),
    ]);
    expect(world.job.state).toBe('failed');
    expect(world.processed).toHaveLength(1);
    expect(ack).toHaveBeenCalledTimes(1);
    expect(retry).not.toHaveBeenCalled();
    // Checkpointed: a rollback is a state-advancing RPC.
    const names = operations(world);
    expect(
      names
        .slice(0, names.indexOf(RPC.rollback))
        .filter((n) => n === 'read_canonical_job').length,
    ).toBeGreaterThan(2);
  });

  it('a refused rollback on delivery 4 still fails the Job', async () => {
    const world = createWorld(
      unfinishedScan(() => {
        throw new Response('{}', { status: 503 });
      }),
    );
    const { ack } = await deliver(world, 4);
    expect(world.outcomes).toEqual([
      expect.objectContaining({
        p_next_state: 'failed',
        p_error_code: 'MIGRATION_RETRIES_EXHAUSTED',
      }),
    ]);
    expect(ack).toHaveBeenCalledTimes(1);
  });
});

describe('[P2-S12-AC-050] BE00 retry pacing through the production entrypoint (DEC-184)', () => {
  const unavailableClaim: PlanScript = {
    ...firstEmptyScript(),
    [RPC.claimLease]: () => ({
      acquired: false,
      leaseToken: null,
      plan: null,
      reasonCode: 'LEASE_UNAVAILABLE',
    }),
  };
  it.each([
    [1, [{ delaySeconds: 15 }]],
    [2, [{ delaySeconds: 60 }]],
    [3, [{ delaySeconds: 300 }]],
  ])(
    'a retry-type outcome on delivery %s is redelivered with %j',
    async (attempts, expected) => {
      const world = createWorld(unavailableClaim);
      const { retry } = await deliver(world, attempts);
      expect(retry.mock.calls).toEqual([expected]);
    },
  );

  it('a retry-type outcome on delivery 4 is failed as retries exhausted, never redelivered', async () => {
    const world = createWorld(unavailableClaim);
    const { ack, retry } = await deliver(world, 4);
    expect(world.outcomes).toEqual([
      expect.objectContaining({
        p_next_state: 'failed',
        p_error_code: 'MIGRATION_RETRIES_EXHAUSTED',
      }),
    ]);
    expect(ack).toHaveBeenCalledTimes(1);
    expect(retry).not.toHaveBeenCalled();
  });
});

describe('[P2-S12-AC-050] Job lease stage fence through the production entrypoint (stage fence 2C)', () => {
  it('a lost lease at the first checkpoint stops before any state-advancing worker RPC, writes nothing and redelivers on the BE00 schedule', async () => {
    // 80 s of lease remain, so the checkpoint heartbeat is due; the SQL refuses it (the lease was lost).
    const world = createWorld(firstEmptyScript(), {
      leaseMs: 80_000,
      heartbeat: false,
    });
    const { ack, retry } = await deliver(world, 2);

    expect(operations(world)).toContain('heartbeat_job_lease');
    expect(operations(world)).not.toContain(RPC.claimLease);
    expect(operations(world)).not.toContain(RPC.heartbeatLease);
    expect(world.outcomes).toEqual([]);
    expect(world.processed).toEqual([]);
    expect(world.job.state).toBe('running');
    expect(ack).not.toHaveBeenCalled();
    expect(retry.mock.calls).toEqual([[{ delaySeconds: 60 }]]);
  });
});

describe('[P2-S12-AC-050] invocation deadline through the production entrypoint (DEC-184)', () => {
  it('aborts a hung worker RPC at min(240000, lease remaining - 60000) and returns the Job to queued', async () => {
    vi.useFakeTimers();
    // Seventy seconds of Job lease leave a ten second invocation budget.
    const world = createWorld(firstEmptyScript(), {
      leaseMs: 70_000,
      hang: [RPC.claimLease],
    });
    const delivery = deliver(world, 1);

    await vi.advanceTimersByTimeAsync(9_999);
    expect(world.outcomes).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    const { ack, retry } = await delivery;

    expect(world.outcomes).toEqual([
      expect.objectContaining({
        p_next_state: 'queued',
        p_error_code: 'DEPENDENCY_UNAVAILABLE',
        p_retryable: true,
      }),
    ]);
    expect(ack).not.toHaveBeenCalled();
    expect(retry.mock.calls).toEqual([[{ delaySeconds: 15 }]]);
    expect(vi.getTimerCount()).toBe(0);
  });
});
