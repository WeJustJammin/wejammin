/**
 * The `cms.taxonomy.merge_converge` job through the real production receiving composition (BE03c 1334; lane
 * taxonomy-terms f2): queue message -> canonical read -> restore fence -> claim -> the fenced converge RPC with the
 * claimed version and lease token -> `apply_job_outcome` `succeeded` with a non-null result reference -> processed event
 * -> ACK. The job is never re-queued and the Worker never enqueues the continuation (the SQL already did).
 */
import { describe, expect, it, vi } from 'vitest';

import type {
  AsyncExecutionContext,
  AsyncWorkerBindings,
  PlatformJobsMessage,
} from './async-entrypoint';
import {
  MERGE_RETRY_JITTER_FRACTION,
  MERGE_RETRY_PAUSES_MS,
} from './cms-taxonomy-merge-converge-effect';
import { createProductionAsyncEntrypoint } from './production-async-entrypoint';

const JOB_ID = '11111111-1111-4111-8111-111111111111';
const NEXT_JOB = '22222222-2222-4222-8222-222222222222';
const TYPE = 'cms.taxonomy.merge_converge';
const send = vi.fn();
const bindings = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'local',
  PLATFORM_JOBS: { send },
  SUPABASE_SECRET_KEY: 'sb_secret_0123456789abcdef',
  SUPABASE_URL: 'https://staging.example.supabase.co',
} as unknown as AsyncWorkerBindings;
const executionContext = { waitUntil: vi.fn() } satisfies AsyncExecutionContext;
const envelope = {
  aggregateId: JOB_ID,
  aggregateType: 'job',
  aggregateVersion: '1',
  causationId: null,
  correlationId: '33333333-3333-4333-8333-333333333333',
  eventId: '44444444-4444-4444-8444-444444444444',
  eventType: 'job.requested',
  schemaVersion: 1,
};
const fence = {
  expected_epoch: '3',
  consumer_epoch: '3',
  integrity_verified: true,
  reconciliation_complete: true,
};

type Scenario = Readonly<{
  type?: string;
  converge: () => Response | Promise<Response>;
}>;

const run = async (scenario: Scenario, attempts = 1) => {
  send.mockReset();
  const calls: { operation: string; body: Record<string, unknown> }[] = [];
  const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
    const operation = url.split('/rest/v1/rpc/')[1] ?? '';
    const body = JSON.parse(String(init?.body ?? '{}')) as Record<
      string,
      unknown
    >;
    calls.push({ operation, body });
    switch (operation) {
      case 'read_canonical_job':
        return Response.json({
          id: JOB_ID,
          type: scenario.type ?? TYPE,
          state: 'queued',
          version: '1',
          leaseUntilMs: null,
        });
      case 'read_restore_fence':
        return Response.json(fence);
      case 'claim_job':
        return Response.json({
          jobId: JOB_ID,
          leaseToken: body.p_lease_token,
          expectedVersion: '1',
          version: '2',
          leaseUntilMs: Date.now() + 300_000,
        });
      case 'cms_run_taxonomy_merge_converge':
        return scenario.converge();
      case 'apply_job_outcome':
        return Response.json(true);
      case 'record_processed_event':
        return Response.json('recorded');
      default:
        throw new Error(`unexpected RPC ${operation}`);
    }
  });
  const entrypoint = createProductionAsyncEntrypoint(
    fetchImpl as unknown as typeof fetch,
  );
  const message: PlatformJobsMessage = {
    ack: vi.fn(),
    attempts,
    body: envelope,
    id: 'm',
    retry: vi.fn(),
  };
  await entrypoint.queue(
    { messages: [message], queue: 'platform-jobs-staging' },
    bindings,
    executionContext,
  );
  return { calls, message };
};

describe('merge-converge job through the production async entrypoint', () => {
  it('converges with the claimed version and token, records succeeded naming the continuation, ACKs and enqueues nothing', async () => {
    const { calls, message } = await run({
      converge: () =>
        Response.json({
          converged: 5000,
          remaining: 12,
          continuationJobId: NEXT_JOB,
        }),
    });
    expect(calls.map((c) => c.operation)).toEqual([
      'read_canonical_job',
      'read_canonical_job',
      'read_restore_fence',
      'read_restore_fence',
      'claim_job',
      'cms_run_taxonomy_merge_converge',
      'apply_job_outcome',
      'record_processed_event',
    ]);
    const claim = calls.find((c) => c.operation === 'claim_job')!.body;
    const converge = calls.find(
      (c) => c.operation === 'cms_run_taxonomy_merge_converge',
    )!;
    expect(converge.body).toEqual({
      p_request: {
        claimedJob: {
          jobId: JOB_ID,
          version: '2',
          leaseToken: claim.p_lease_token,
        },
      },
    });
    const outcome = calls.find(
      (c) => c.operation === 'apply_job_outcome',
    )!.body;
    expect(outcome).toMatchObject({
      p_job_id: JOB_ID,
      p_expected_version: '2',
      p_lease_token: claim.p_lease_token,
      p_next_state: 'succeeded',
      p_result_ref: { type: TYPE, id: NEXT_JOB },
      p_error_code: null,
      p_retryable: false,
    });
    expect(message.ack).toHaveBeenCalledOnce();
    expect(message.retry).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('a drained tail is recorded succeeded with the job itself as the result reference', async () => {
    const { calls, message } = await run({
      converge: () =>
        Response.json({ converged: 3, remaining: 0, continuationJobId: null }),
    });
    expect(
      calls.find((c) => c.operation === 'apply_job_outcome')!.body,
    ).toMatchObject({
      p_next_state: 'succeeded',
      p_result_ref: { type: TYPE, id: JOB_ID },
    });
    expect(message.ack).toHaveBeenCalledOnce();
  });

  it('a revoked curator fails the job CAPABILITY_MISSING, non-retryable, and ACKs', async () => {
    const { calls, message } = await run({
      converge: () =>
        Response.json(
          { code: 'P0001', message: 'capability_missing' },
          { status: 400 },
        ),
    });
    expect(
      calls.filter((c) => c.operation === 'cms_run_taxonomy_merge_converge'),
    ).toHaveLength(1);
    expect(
      calls.find((c) => c.operation === 'apply_job_outcome')!.body,
    ).toMatchObject({
      p_next_state: 'failed',
      p_result_ref: null,
      p_error_code: 'CAPABILITY_MISSING',
      p_retryable: false,
    });
    expect(message.ack).toHaveBeenCalledOnce();
    expect(message.retry).not.toHaveBeenCalled();
  });

  it('a persistent dependency fault is retried in the invocation, then fails the job (never queued)', async () => {
    vi.useFakeTimers();
    try {
      const pending = run({
        converge: () => new Response('{}', { status: 503 }),
      });
      // The two in-invocation pauses (BE00 retry schedule: 15 s, then 60 s, each plus up to 10 % jitter from the real
      // Math.random), through the real abort-aware delay: advance by the upper edge so that any draw has elapsed.
      await vi.advanceTimersByTimeAsync(
        Math.ceil(
          MERGE_RETRY_PAUSES_MS.reduce((sum, ms) => sum + ms, 0) *
            (1 + MERGE_RETRY_JITTER_FRACTION),
        ),
      );
      const { calls, message } = await pending;
      expect(
        calls.filter((c) => c.operation === 'cms_run_taxonomy_merge_converge'),
      ).toHaveLength(3);
      expect(
        calls.find((c) => c.operation === 'apply_job_outcome')!.body,
      ).toMatchObject({
        p_next_state: 'failed',
        p_error_code: 'DEPENDENCY_UNAVAILABLE',
        p_retryable: false,
      });
      expect(message.ack).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it('other job types never reach the merge RPC', async () => {
    const { calls } = await run({
      type: 'object.verify',
      converge: () => Response.json({}),
    });
    expect(
      calls.some((c) => c.operation === 'cms_run_taxonomy_merge_converge'),
    ).toBe(false);
  });
});
