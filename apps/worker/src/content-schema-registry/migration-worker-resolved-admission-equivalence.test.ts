import { describe, expect, it, vi } from 'vitest';

import { SCHEMA_MIGRATION_RPC } from './migration-worker-constants';
import { createSchemaMigrationWorker } from './migration-worker-engine';
import type { MigrationPlanRecord } from './migration-worker-plan-types';
import {
  basePlan,
  event,
  job,
  makePort,
  NOW,
} from './migration-worker-test-support';

const CLAIM_TOKEN = '81000000-0000-4000-8000-000000000001';
const NEXT_CLAIM_TOKEN = '82000000-0000-4000-8000-000000000002';
const FOREIGN_PLAN_ID = '84000000-0000-4000-8000-000000000004';
const identity = {
  eventId: event.eventId,
  eventType: event.eventType,
  schemaVersion: event.schemaVersion,
  aggregateType: event.aggregateType,
  aggregateId: event.aggregateId,
  aggregateVersion: event.aggregateVersion,
  migrationPlanId: event.payload.migrationPlanId,
};
const readCall = {
  rpc: SCHEMA_MIGRATION_RPC.readPlan,
  request: {
    migrationPlanId: job.migrationPlanId,
    schemaVersionId: job.schemaVersionId,
    expectedVersion: job.expectedVersion,
  },
};
const claimCall = (claimToken = CLAIM_TOKEN, replay = false) => ({
  rpc: SCHEMA_MIGRATION_RPC.claimEvent,
  request: { ...identity, claimToken, replay },
});
const ackCall = (outcome: 'success' | 'failure', claimToken = CLAIM_TOKEN) => ({
  rpc: SCHEMA_MIGRATION_RPC.acknowledgeEvent,
  request: { ...identity, claimToken, outcome },
});
const completedPlan = () =>
  basePlan({ state: 'completed', version: '53', cursor: '100', progress: 1 });
const completedResult = {
  outcome: 'completed',
  migrationPlanId: job.migrationPlanId,
  schemaVersionId: job.schemaVersionId,
  eventId: event.eventId,
  state: 'completed',
  cursor: '100',
  progress: 1,
  retryAfterMs: null,
  reasonCode: null,
  activationSwitched: false,
} as const;

const harness = (
  plan: MigrationPlanRecord,
  handlers: Parameters<typeof makePort>[0] = {},
  eventClaimTokenFactory = () => CLAIM_TOKEN,
) => {
  const signal = new AbortController().signal;
  const port = makePort({
    [SCHEMA_MIGRATION_RPC.claimEvent]: () => ({ status: 'new' }),
    [SCHEMA_MIGRATION_RPC.readPlan]: () => ({ plan }),
    [SCHEMA_MIGRATION_RPC.acknowledgeEvent]: () => ({ accepted: true }),
    ...handlers,
  });
  const worker = createSchemaMigrationWorker({
    port,
    workerId: 'resolved-admission-equivalence',
    now: () => NOW,
    eventClaimTokenFactory,
  });
  return { port, signal, worker };
};

const expectHistory = (
  port: ReturnType<typeof makePort>,
  signal: AbortSignal,
  calls: typeof port.calls,
) => {
  expect(port.calls).toEqual(calls);
  for (const [, , actualSignal] of vi.mocked(port.call).mock.calls)
    expect(actualSignal).toBe(signal);
};

describe('legacy resolved admission equivalence through the worker engine', () => {
  it('refuses a foreign plan ID even when target and version match', async () => {
    const { port, signal, worker } = harness(basePlan({ id: FOREIGN_PLAN_ID }));

    await expect(worker.process(job, { signal })).resolves.toEqual({
      outcome: 'stale',
      migrationPlanId: job.migrationPlanId,
      schemaVersionId: job.schemaVersionId,
      eventId: null,
      state: 'ready',
      cursor: null,
      progress: null,
      retryAfterMs: null,
      reasonCode: 'PLAN_TARGET_MISMATCH',
      activationSwitched: false,
    });
    expectHistory(port, signal, [readCall]);
  });

  it('refuses foreign completed identity before the completed-version exception', async () => {
    const { port, signal, worker } = harness({
      ...completedPlan(),
      id: FOREIGN_PLAN_ID,
    });

    await expect(worker.process(event, { signal })).resolves.toEqual({
      outcome: 'stale',
      migrationPlanId: job.migrationPlanId,
      schemaVersionId: job.schemaVersionId,
      eventId: event.eventId,
      state: 'completed',
      cursor: null,
      progress: null,
      retryAfterMs: null,
      reasonCode: 'PLAN_TARGET_MISMATCH',
      activationSwitched: false,
    });
    expectHistory(port, signal, [claimCall(), readCall, ackCall('failure')]);
  });

  it('ACKs completed replay with the acquired identity despite nonadjacent versions', async () => {
    const { port, signal, worker } = harness(completedPlan(), {
      [SCHEMA_MIGRATION_RPC.claimEvent]: () => ({ status: 'replayable' }),
    });

    await expect(
      worker.replayDlq(event, { signal, attempt: 2 }),
    ).resolves.toEqual(completedResult);
    expectHistory(port, signal, [
      claimCall(CLAIM_TOKEN, true),
      readCall,
      ackCall('success'),
    ]);
  });

  it('ACKs failed-terminal admission as failure and preserves result metadata', async () => {
    const { port, signal, worker } = harness(
      basePlan({ state: 'failed_terminal', cursor: '43', progress: 0.43 }),
    );

    await expect(worker.process(event, { signal })).resolves.toEqual({
      outcome: 'failed_terminal',
      migrationPlanId: job.migrationPlanId,
      schemaVersionId: job.schemaVersionId,
      eventId: event.eventId,
      state: 'failed_terminal',
      cursor: '43',
      progress: 0.43,
      retryAfterMs: null,
      reasonCode: 'MIGRATION_TERMINAL',
      activationSwitched: false,
    });
    expectHistory(port, signal, [claimCall(), readCall, ackCall('failure')]);
  });

  it('releases blocked admission exactly once with the acquired identity and signal', async () => {
    let releaseAttempts = 0;
    const { port, signal, worker } = harness(
      basePlan({ state: 'blocked', cursor: '27', progress: 0.27 }),
      {
        [SCHEMA_MIGRATION_RPC.releaseEvent]: () => {
          releaseAttempts += 1;
          return releaseAttempts === 1
            ? { released: true }
            : { released: false, code: 'EVENT_CLAIM_LOST', retryable: true };
        },
      },
    );

    await expect(worker.process(event, { signal })).resolves.toEqual({
      outcome: 'blocked',
      migrationPlanId: job.migrationPlanId,
      schemaVersionId: job.schemaVersionId,
      eventId: event.eventId,
      state: 'blocked',
      cursor: '27',
      progress: 0.27,
      retryAfterMs: null,
      reasonCode: 'MIGRATION_BLOCKED',
      activationSwitched: false,
    });
    expect(releaseAttempts).toBe(1);
    expectHistory(port, signal, [
      claimCall(),
      readCall,
      {
        rpc: SCHEMA_MIGRATION_RPC.releaseEvent,
        request: { ...identity, claimToken: CLAIM_TOKEN },
      },
    ]);
  });

  it('evicts rejected normalized work after ACK and durable dead-letter failure', async () => {
    let acknowledgementAttempts = 0;
    const tokenFactory = vi
      .fn<() => string>()
      .mockReturnValueOnce(CLAIM_TOKEN)
      .mockReturnValue(NEXT_CLAIM_TOKEN);
    const { port, signal, worker } = harness(
      completedPlan(),
      {
        [SCHEMA_MIGRATION_RPC.acknowledgeEvent]: () => {
          acknowledgementAttempts += 1;
          if (acknowledgementAttempts === 1)
            throw { code: 'ACK_REJECTED', retryable: false } as const;
          return { accepted: true };
        },
        [SCHEMA_MIGRATION_RPC.deadLetter]: () => {
          throw { code: 'DLQ_UNAVAILABLE', retryable: true } as const;
        },
      },
      tokenFactory,
    );
    const firstHistory = [
      claimCall(),
      readCall,
      ackCall('success'),
      {
        rpc: SCHEMA_MIGRATION_RPC.deadLetter,
        request: {
          ...identity,
          claimToken: CLAIM_TOKEN,
          reasonCode: 'ACK_REJECTED',
        },
      },
    ];

    await expect(worker.process(event, { signal })).rejects.toMatchObject({
      message: 'Durable dead-letter persistence failed: DLQ_UNAVAILABLE',
      code: 'DLQ_UNAVAILABLE',
      retryable: true,
    });
    expectHistory(port, signal, firstHistory);

    await expect(
      worker.process(event, { signal, attempt: 1 }),
    ).resolves.toEqual(completedResult);
    expectHistory(port, signal, [
      ...firstHistory,
      claimCall(NEXT_CLAIM_TOKEN),
      readCall,
      ackCall('success', NEXT_CLAIM_TOKEN),
    ]);
    expect(tokenFactory).toHaveBeenCalledTimes(2);
    expect(acknowledgementAttempts).toBe(2);
  });
});
