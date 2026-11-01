import { describe, expect, it, vi } from 'vitest';

import type { JobConsumerDecision } from '@wejammin/application';
import { createAsyncJobDependencies, queueOutcome } from './async-runtime';
import type {
  AsyncExecutionContext,
  AsyncWorkerBindings,
  PlatformJobsQueue,
} from './async-entrypoint';
import {
  type AsyncRpcClient,
  type AsyncRpcOperation,
} from './async-runtime-support';

const JOB_ID = '11111111-1111-4111-8111-111111111111';
const EVENT_ID = '22222222-2222-4222-8222-222222222222';
const CORRELATION_ID = '33333333-3333-4333-8333-333333333333';
const LEASE_TOKEN = '44444444-4444-4444-8444-444444444444';
const envelope = {
  aggregateId: JOB_ID,
  aggregateType: 'job',
  aggregateVersion: '1',
  causationId: null,
  correlationId: CORRELATION_ID,
  eventId: EVENT_ID,
  eventType: 'job.requested' as const,
  schemaVersion: 1 as const,
};
const canonical = {
  id: JOB_ID,
  type: 'object.verify',
  state: 'queued' as const,
  version: '1',
  leaseUntilMs: null,
};
const lease = {
  jobId: JOB_ID,
  expectedVersion: '1',
  version: '2',
  leaseUntilMs: 300_000,
};
const outbox = {
  outboxId: EVENT_ID,
  leaseToken: LEASE_TOKEN,
  eventId: EVENT_ID,
  eventType: 'job.requested',
  schemaVersion: 1,
  aggregateType: 'job',
  aggregateId: JOB_ID,
  aggregateVersion: '1',
  correlationId: CORRELATION_ID,
  causationId: null,
};
const queue = (
  send = vi.fn(async () => ({
    metadata: { metrics: { backlogBytes: 0, backlogCount: 0 } },
  })),
): PlatformJobsQueue => ({ send });
const bindings = (jobs = queue()): AsyncWorkerBindings => ({
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'test',
  PLATFORM_JOBS: jobs,
  SUPABASE_SECRET_KEY: 'secret',
  SUPABASE_URL: 'https://staging.example.supabase.co',
});
const context = { waitUntil: vi.fn() } as AsyncExecutionContext;
const mappedRpc = (
  overrides: Partial<Record<AsyncRpcOperation, unknown>> = {},
): AsyncRpcClient => {
  const rpc = vi.fn(
    async (_env: AsyncWorkerBindings, operation: AsyncRpcOperation) => {
      if (operation in overrides) return overrides[operation];
      if (operation === 'read_canonical_job') return canonical;
      if (operation === 'read_restore_fence') {
        return {
          expected_epoch: '1',
          consumer_epoch: '1',
          integrity_verified: true,
          reconciliation_complete: true,
        };
      }
      if (operation === 'claim_job') return lease;
      if (operation === 'claim_outbox_batch') return [outbox];
      if (operation === 'record_processed_event') return 'recorded';
      return true;
    },
  );
  return rpc as unknown as AsyncRpcClient;
};

describe('async runtime decisions and fail-closed paths', () => {
  it('maps all queue decisions explicitly', () => {
    const decision = (value: unknown) => value as JobConsumerDecision;
    expect(
      queueOutcome(
        decision({ kind: 'completed', processed: { kind: 'recorded' } }),
      ),
    ).toBe('ack');
    expect(
      queueOutcome(
        decision({ kind: 'completed', processed: { kind: 'duplicate' } }),
      ),
    ).toBe('ack');
    expect(queueOutcome(decision({ kind: 'completed', processed: null }))).toBe(
      'retry',
    );
    expect(queueOutcome(decision({ kind: 'skip' }))).toBe('ack');
    expect(queueOutcome(decision({ kind: 'dead_letter' }))).toBe('ack');
    expect(queueOutcome(decision({ kind: 'manual_review' }))).toBe('ack');
    expect(queueOutcome(decision({ kind: 'retry' }))).toBe('retry');
  });

  it('uses defaults, heartbeats active leases, and rejects failed work safely', async () => {
    const effect = vi.fn(async () => ({
      state: 'succeeded' as const,
      resultRef: null,
      errorCode: null,
    }));
    const noDependencies = createAsyncJobDependencies();
    await expect(
      noDependencies.orchestrateQueueMessage?.({
        env: bindings(),
        executionContext: context,
        message: {
          ack: vi.fn(),
          attempts: 1,
          body: null,
          id: 'm',
          retry: vi.fn(),
        },
      }),
    ).resolves.toBe('retry');
    const defaultDeps = createAsyncJobDependencies({
      rpc: mappedRpc(),
      effect,
      now: () => 0,
    });
    await expect(
      defaultDeps.orchestrateQueueMessage?.({
        env: bindings(),
        executionContext: context,
        message: {
          ack: vi.fn(),
          attempts: 1,
          body: envelope,
          id: 'm',
          retry: vi.fn(),
        },
      }),
    ).resolves.toBe('ack');
    const malformed = createAsyncJobDependencies({
      rpc: mappedRpc({ read_canonical_job: null }),
      effect,
    });
    await expect(
      malformed.orchestrateQueueMessage?.({
        env: bindings(),
        executionContext: context,
        message: {
          ack: vi.fn(),
          attempts: 1,
          body: null,
          id: 'm',
          retry: vi.fn(),
        },
      }),
    ).resolves.toBe('retry');
    await expect(
      malformed.orchestrateQueueMessage?.({
        env: bindings(),
        executionContext: context,
        message: {
          ack: vi.fn(),
          attempts: 1,
          body: envelope,
          id: 'm',
          retry: vi.fn(),
        },
      }),
    ).resolves.toBe('retry');
    const throwingRpc = vi.fn(async () => {
      throw new Error('rpc unavailable');
    }) as unknown as AsyncRpcClient;
    const unavailable = createAsyncJobDependencies({
      rpc: throwingRpc,
      effect,
    });
    await expect(
      unavailable.orchestrateQueueMessage?.({
        env: bindings(),
        executionContext: context,
        message: {
          ack: vi.fn(),
          attempts: 1,
          body: envelope,
          id: 'm',
          retry: vi.fn(),
        },
      }),
    ).resolves.toBe('retry');
  });

  it('bounds outbox sweeps and retries every unsafe transport outcome', async () => {
    const input = {
      controller: { cron: '* * * * *', scheduledTime: 100 },
      env: bindings(),
      executionContext: context,
    };
    const sweep = (
      deps: ReturnType<typeof createAsyncJobDependencies>,
      env = input.env,
    ) => deps.sweepOutbox?.({ ...input, env });
    await expect(
      sweep(createAsyncJobDependencies({ rpc: mappedRpc(), leaseSeconds: 0 })),
    ).resolves.toBe('retry');
    await expect(
      sweep(
        createAsyncJobDependencies({ rpc: mappedRpc(), maxOutboxClaims: 0 }),
      ),
    ).resolves.toBe('retry');
    await expect(
      sweep(
        createAsyncJobDependencies({
          rpc: mappedRpc({ claim_outbox_batch: {} }),
        }),
      ),
    ).resolves.toBe('retry');
    await expect(
      sweep(
        createAsyncJobDependencies({
          rpc: mappedRpc({ claim_outbox_batch: [outbox, outbox] }),
          maxOutboxClaims: 1,
        }),
      ),
    ).resolves.toBe('retry');
    await expect(
      sweep(
        createAsyncJobDependencies({
          rpc: mappedRpc(),
          outboxLeaseToken: () => '55555555-5555-4555-8555-555555555555',
        }),
      ),
    ).resolves.toBe('retry');
    await expect(
      sweep(
        createAsyncJobDependencies({
          rpc: mappedRpc({ complete_outbox_event: false }),
          outboxLeaseToken: () => LEASE_TOKEN,
        }),
      ),
    ).resolves.toBe('retry');
    const send = vi.fn(async () => {
      throw new Error('queue unavailable');
    });
    await expect(
      sweep(
        createAsyncJobDependencies({
          rpc: mappedRpc(),
          outboxLeaseToken: () => LEASE_TOKEN,
        }),
        bindings(queue(send)),
      ),
    ).resolves.toBe('retry');
    expect(send).toHaveBeenCalledOnce();
    await expect(
      sweep(
        createAsyncJobDependencies({
          rpc: mappedRpc(),
          outboxLeaseToken: () => LEASE_TOKEN,
        }),
      ),
    ).resolves.toBe('completed');
  });
});
