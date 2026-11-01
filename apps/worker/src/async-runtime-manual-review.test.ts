import { describe, expect, it, vi } from 'vitest';

import {
  createAsyncJobDependencies,
  type AsyncRpcClient,
  type AsyncRpcOperation,
} from './async-runtime';
import {
  AsyncRpcDependencyError,
  AsyncRpcManualReviewError,
  AsyncRpcTransportError,
} from './async-runtime-support';
import type {
  AsyncExecutionContext,
  AsyncWorkerBindings,
  PlatformJobsMessage,
  PlatformJobsQueue,
} from './async-entrypoint';

const JOB_ID = '11111111-1111-4111-8111-111111111111';
const EVENT_ID = '22222222-2222-4222-8222-222222222222';
const CORRELATION_ID = '33333333-3333-4333-8333-333333333333';
const LEASE_TOKEN = '44444444-4444-4444-8444-444444444444';

const envelope = {
  aggregateId: JOB_ID,
  aggregateType: 'job' as const,
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

const message = (): PlatformJobsMessage => ({
  ack: vi.fn(),
  attempts: 1,
  body: envelope,
  id: 'message-1',
  retry: vi.fn(),
});

const mappedRpc = (
  overrides: Partial<Record<AsyncRpcOperation, unknown>> = {},
): AsyncRpcClient => {
  const rpc = vi.fn(
    async (_env: AsyncWorkerBindings, operation: AsyncRpcOperation) => {
      if (operation in overrides) {
        const value = overrides[operation];
        if (value instanceof Error) throw value;
        return value;
      }
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

describe('async runtime manual-review transport routing', () => {
  it('acknowledges a manual-review read failure before effect execution', async () => {
    const effect = vi.fn(async () => ({
      state: 'succeeded' as const,
      resultRef: null,
      errorCode: null,
    }));
    const deps = createAsyncJobDependencies({
      rpc: mappedRpc({
        read_canonical_job: new AsyncRpcManualReviewError('malformed_response'),
      }),
      effect,
    });

    await expect(
      deps.orchestrateQueueMessage?.({
        env: bindings(),
        executionContext: context,
        message: message(),
      }),
    ).resolves.toBe('ack');
    expect(effect).not.toHaveBeenCalled();
  });

  it('acknowledges a manual-review post-effect failure without replaying the effect', async () => {
    const effect = vi.fn(async () => ({
      state: 'succeeded' as const,
      resultRef: null,
      errorCode: null,
    }));
    const rpc = mappedRpc({
      apply_job_outcome: new AsyncRpcTransportError(
        'malformed_response',
        'manual_review',
      ),
    });
    const deps = createAsyncJobDependencies({ rpc, effect });

    await expect(
      deps.orchestrateQueueMessage?.({
        env: bindings(),
        executionContext: context,
        message: message(),
      }),
    ).resolves.toBe('ack');
    expect(effect).toHaveBeenCalledOnce();
    expect(rpc).not.toHaveBeenCalledWith(
      expect.anything(),
      'record_processed_event',
      expect.anything(),
    );
  });

  it('keeps retry behavior for typed dependency-unavailable failures', async () => {
    const deps = createAsyncJobDependencies({
      rpc: mappedRpc({
        read_canonical_job: new AsyncRpcDependencyError('request_failed'),
      }),
      effect: vi.fn(),
    });

    await expect(
      deps.orchestrateQueueMessage?.({
        env: bindings(),
        executionContext: context,
        message: message(),
      }),
    ).resolves.toBe('retry');
  });

  it('completes a sweep on a manual-review claim failure without retrying the batch', async () => {
    const send = vi.fn();
    const deps = createAsyncJobDependencies({
      rpc: mappedRpc({
        claim_outbox_batch: new AsyncRpcManualReviewError('malformed_response'),
      }),
    });

    await expect(
      deps.sweepOutbox?.({
        controller: { cron: '* * * * *', scheduledTime: 100 },
        env: bindings(queue(send)),
        executionContext: context,
      }),
    ).resolves.toBe('completed');
    expect(send).not.toHaveBeenCalled();
  });

  it('completes a sweep after ambiguous completion without sending another queue message', async () => {
    const send = vi.fn(async () => ({
      metadata: { metrics: { backlogBytes: 0, backlogCount: 0 } },
    }));
    const deps = createAsyncJobDependencies({
      rpc: mappedRpc({
        complete_outbox_event: new AsyncRpcManualReviewError(
          'malformed_response',
        ),
      }),
      outboxLeaseToken: () => LEASE_TOKEN,
    });

    await expect(
      deps.sweepOutbox?.({
        controller: { cron: '* * * * *', scheduledTime: 100 },
        env: bindings(queue(send)),
        executionContext: context,
      }),
    ).resolves.toBe('completed');
    expect(send).toHaveBeenCalledOnce();
  });
});
