/**
 * DEC-184 on the Job path: the per-message closure of `orchestrateQueueMessage` hands the CMS preparation
 * effect `{ env, signal, deliveryAttempt }`, bounds the invocation, and paces retry-type outcomes by the
 * BE00 15 / 60 / 300 second schedule (a progress continuation retries at once). Receiving composition:
 * real entrypoint, orchestration and consumer over a scripted RPC client.
 */
import type { JobEffectResult } from '@wejammin/application';
import type { QueueEnvelope } from '@wejammin/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createAsyncEntrypoint,
  type AsyncWorkerBindings,
  type PlatformJobsMessage,
} from './async-entrypoint';
import { createAsyncJobDependencies } from './async-runtime';
import type { AsyncRpcClient } from './async-runtime-rpc-types';

const JOB = '11111111-1111-4111-8111-111111111111';
const EVENT = '22222222-2222-4222-8222-222222222222';
const TOKEN = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CMS = 'cms.schema.dry_run';
const envelope = Object.freeze({
  eventId: EVENT,
  eventType: 'job.requested',
  schemaVersion: 1,
  aggregateType: 'job',
  aggregateId: JOB,
  aggregateVersion: '7',
  correlationId: '33333333-3333-4333-8333-333333333333',
  causationId: null,
} satisfies QueueEnvelope);
const NOW = 201_000;
const queuedWith = (errorCode: string | null): JobEffectResult => ({
  state: 'queued',
  errorCode,
  resultRef: null,
});

type Options = Readonly<{
  type?: string;
  leaseUntilMs?: number;
  heartbeat?: boolean;
  effectResult?: JobEffectResult;
  effect?: (...args: unknown[]) => Promise<JobEffectResult>;
}>;

const fixture = (options: Options = {}) => {
  const type = options.type ?? CMS;
  const leaseUntilMs = options.leaseUntilMs ?? NOW + 300_000;
  let reads = 0;
  const rpc: AsyncRpcClient = async <T>(
    _env: unknown,
    operation: string,
  ): Promise<T> => {
    const reply: Record<string, () => unknown> = {
      read_canonical_job: () =>
        reads++ < 2
          ? { id: JOB, type, state: 'queued', version: '7', leaseUntilMs: null }
          : { id: JOB, type, state: 'running', version: '19', leaseUntilMs },
      read_restore_fence: () => ({
        expected_epoch: '3',
        consumer_epoch: '3',
        integrity_verified: true,
        reconciliation_complete: true,
      }),
      claim_job: () => ({
        jobId: JOB,
        leaseToken: TOKEN,
        expectedVersion: '7',
        version: '19',
        leaseUntilMs,
      }),
      heartbeat_job_lease: () => options.heartbeat ?? true,
      apply_job_outcome: () => true,
      record_processed_event: () => 'recorded',
    };
    return reply[operation]?.() as T;
  };
  const effect = vi.fn(
    options.effect ??
      (async (
        _input: unknown,
        control?: { checkpoint(): Promise<unknown> },
      ) => {
        await control?.checkpoint();
        return options.effectResult ?? queuedWith(null);
      }),
  );
  const env = {
    APP_ENVIRONMENT: 'staging',
    APP_RELEASE: 'b128-delivery',
    PLATFORM_JOBS: { send: vi.fn() },
    SUPABASE_SECRET_KEY: 'controlled-not-a-real-secret',
    SUPABASE_URL: 'https://controlled.invalid',
  } satisfies AsyncWorkerBindings;
  const ack = vi.fn<PlatformJobsMessage['ack']>();
  const retry = vi.fn<PlatformJobsMessage['retry']>();
  const entrypoint = createAsyncEntrypoint(
    createAsyncJobDependencies({
      rpc,
      effect: effect as never,
      verifyCmsSchemaDryRunOrigin: async () => true,
      leaseToken: () => TOKEN,
      leaseSeconds: 300,
      now: () => NOW,
    }),
  );
  return {
    env,
    effect,
    ack,
    retry,
    run: (attempts: number) =>
      entrypoint.queue(
        {
          queue: 'platform-jobs-staging',
          messages: [{ ack, retry, body: envelope, attempts, id: 'm' }],
        },
        env,
        { waitUntil: vi.fn() },
      ),
  };
};

afterEach(() => vi.useRealTimers());

describe('[P2-S12-AC-050] Job delivery context (DEC-184)', () => {
  it.each([
    [1, 1],
    [2, 2],
    [3, 3],
    [4, 4],
    [0, 1],
    [Number.NaN, 1],
  ])(
    'message.attempts %j reaches the CMS effect as delivery %j with env and signal',
    async (attempts, expected) => {
      const f = fixture();
      await f.run(attempts);

      expect(f.effect).toHaveBeenCalledTimes(1);
      const call = f.effect.mock.calls[0] as unknown[];
      expect(call).toHaveLength(3);
      const context = call[2] as {
        env: unknown;
        signal: AbortSignal;
        deliveryAttempt: number;
      };
      expect(context.deliveryAttempt).toBe(expected);
      expect(context.env).toBe(f.env);
      expect(context.signal).toBeInstanceOf(AbortSignal);
      expect(context.signal.aborted).toBe(false);
      expect(Object.keys(context).sort()).toEqual([
        'deliveryAttempt',
        'env',
        'signal',
      ]);
    },
  );

  it('keeps ordinary verification on exactly one argument, with no env or delivery context', async () => {
    const f = fixture({
      type: 'object.verify',
      effect: async () => ({
        state: 'succeeded',
        errorCode: null,
        resultRef: null,
      }),
    });
    await f.run(2);

    expect(f.effect.mock.calls[0]).toHaveLength(1);
    expect(f.ack).toHaveBeenCalledTimes(1);
  });

  it('aborts the invocation signal at min(240000, lease remaining - 60000) milliseconds', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const f = fixture({
      leaseUntilMs: NOW + 100_000,
      effect: async (...args: unknown[]) => {
        signal = (args[2] as { signal: AbortSignal }).signal;
        await new Promise((resolve) => setTimeout(resolve, 100_000));
        return queuedWith(null);
      },
    });
    const run = f.run(1);
    await vi.advanceTimersByTimeAsync(39_999);
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(signal?.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(100_000);
    await run;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('starts the invocation already aborted when under sixty seconds of lease remain', async () => {
    const f = fixture({ leaseUntilMs: NOW + 59_000 });
    await f.run(1);
    const context = (f.effect.mock.calls[0] as unknown[])[2] as {
      signal: AbortSignal;
    };
    expect(context.signal.aborted).toBe(true);
  });

  it('clears the invocation timer when the effect throws', async () => {
    vi.useFakeTimers();
    const f = fixture({
      effect: async () => {
        throw new Error('controlled effect failure');
      },
    });
    await f.run(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('[P2-S12-AC-050] BE00 retry pacing on the Job path (DEC-184)', () => {
  it.each([
    [1, { delaySeconds: 15 }],
    [2, { delaySeconds: 60 }],
    [3, { delaySeconds: 300 }],
    [4, undefined],
  ])(
    'a retry-type outcome on delivery %j is redelivered with %j',
    async (attempts, expected) => {
      const f = fixture({ effectResult: queuedWith('LEASE_UNAVAILABLE') });
      await f.run(attempts);

      expect(f.ack).not.toHaveBeenCalled();
      expect(f.retry).toHaveBeenCalledTimes(1);
      expect(f.retry.mock.calls[0]).toEqual(
        expected === undefined ? [] : [expected],
      );
    },
  );

  it.each([1, 2, 3])(
    'a progress continuation on delivery %j is redelivered at once',
    async (attempts) => {
      const f = fixture({ effectResult: queuedWith(null) });
      await f.run(attempts);

      expect(f.retry).toHaveBeenCalledTimes(1);
      expect(f.retry.mock.calls[0]).toEqual([]);
    },
  );

  it('a lost lease is redelivered on the same schedule', async () => {
    const f = fixture({ heartbeat: false, leaseUntilMs: NOW + 80_000 });
    await f.run(2);
    expect(f.retry.mock.calls[0]).toEqual([{ delaySeconds: 60 }]);
  });

  it('a terminal outcome is acknowledged', async () => {
    const f = fixture({
      effectResult: {
        state: 'failed',
        errorCode: 'MIGRATION_BLOCKED',
        resultRef: null,
      },
    });
    await f.run(1);
    expect(f.ack).toHaveBeenCalledTimes(1);
    expect(f.retry).not.toHaveBeenCalled();
  });

  it('paces nothing outside the CMS preparation family', async () => {
    const f = fixture({
      type: 'object.verify',
      effectResult: queuedWith('DEPENDENCY_UNAVAILABLE'),
    });
    await f.run(1);
    expect(f.retry).toHaveBeenCalledTimes(1);
    expect(f.retry.mock.calls[0]).toEqual([]);
  });
});
