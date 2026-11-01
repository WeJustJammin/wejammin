/** Real receiving composition for private CMS lease control; no SQL or stage-authority proof. */
import type {
  CmsLeaseCheckpoint,
  CmsLeaseControl,
} from '@wejammin/application';
import type { QueueEnvelope } from '@wejammin/contracts';
import { describe, expect, it, vi } from 'vitest';

import {
  createAsyncEntrypoint,
  type AsyncWorkerBindings,
  type PlatformJobsMessage,
  type PlatformJobsQueue,
} from './async-entrypoint';
import { createAsyncJobDependencies } from './async-runtime';
import type { AsyncRpcClient } from './async-runtime-rpc-types';
import { createProductionJobEffectDispatcher } from './production-job-effect-dispatcher';

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
const job = (
  state: string,
  version: string,
  type = CMS,
  lease: number | null = null,
) => ({
  id: JOB,
  type,
  state,
  version,
  leaseUntilMs: lease,
});
const succeeded = Object.freeze({
  state: 'succeeded',
  resultRef: null,
  errorCode: null,
} as const);
const op = (operation: string, body: Record<string, unknown> = {}) => [
  operation,
  body,
];
const read = op('read_canonical_job', { p_job_id: JOB });
const restore = op('read_restore_fence');
const heartbeat = op('heartbeat_job_lease', {
  p_job_id: JOB,
  p_expected_version: '19',
  p_lease_token: TOKEN,
  p_lease_seconds: 300,
});
const apply = (version: string) =>
  op('apply_job_outcome', {
    p_job_id: JOB,
    p_expected_version: version,
    p_lease_token: TOKEN,
    p_next_state: 'succeeded',
    p_result_ref: null,
    p_error_code: null,
    p_retryable: false,
  });
const processed = op('record_processed_event', {
  p_event_id: EVENT,
  p_event_type: 'job.requested',
  p_schema_version: 1,
  p_aggregate_id: JOB,
  p_pending_manual_review: false,
});
const claim = op('claim_job', {
  p_job_id: JOB,
  p_expected_version: '7',
  p_lease_token: TOKEN,
  p_lease_seconds: 300,
});

type Options = Readonly<{
  type?: string;
  heartbeat?: unknown;
  now?: () => number;
}>;

const fixture = (options: Options = {}) => {
  const type = options.type ?? CMS;
  const calls: unknown[][] = [];
  let reads = 0;
  const rpc: AsyncRpcClient = async <T>(
    _env: unknown,
    operation: string,
    input: Record<string, unknown>,
  ): Promise<T> => {
    calls.push([operation, input]);
    const reply: Record<string, () => unknown> = {
      read_canonical_job: () =>
        reads++ < 2
          ? job('queued', '7', type)
          : job('running', '37', type, 501_000),
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
        leaseUntilMs: 301_000,
      }),
      heartbeat_job_lease: () =>
        options.heartbeat === undefined ? true : options.heartbeat,
      apply_job_outcome: () => true,
      record_processed_event: () => 'recorded',
    };
    return reply[operation]?.() as T;
  };
  const snapshots: CmsLeaseCheckpoint[] = [];
  const prepareSchemaDryRun = vi.fn(
    async (_input: unknown, control?: CmsLeaseControl) => {
      if (control !== undefined) snapshots.push(await control.checkpoint());
      return succeeded;
    },
  );
  const verifyObject = vi.fn(async () => succeeded);
  const verifyCmsSchemaDryRunOrigin = vi.fn(async () => true);
  const send = vi.fn<PlatformJobsQueue['send']>(async () => ({
    metadata: { metrics: { backlogBytes: 0, backlogCount: 0 } },
  }));
  const env = {
    APP_ENVIRONMENT: 'staging',
    APP_RELEASE: 'controlled-lease-control',
    PLATFORM_JOBS: { send },
    SUPABASE_SECRET_KEY: 'controlled-not-a-real-secret',
    SUPABASE_URL: 'https://controlled.invalid',
  } satisfies AsyncWorkerBindings;
  const ack = vi.fn<PlatformJobsMessage['ack']>();
  const retry = vi.fn<PlatformJobsMessage['retry']>();
  const entrypoint = createAsyncEntrypoint(
    createAsyncJobDependencies({
      rpc,
      effect: createProductionJobEffectDispatcher({
        prepareSchemaDryRun,
        verifyObject,
      }),
      verifyCmsSchemaDryRunOrigin,
      leaseToken: () => TOKEN,
      leaseSeconds: 300,
      now: options.now ?? (() => 201_000),
    }),
  );
  return {
    calls,
    snapshots,
    ack,
    retry,
    prepareSchemaDryRun,
    verifyObject,
    verifyCmsSchemaDryRunOrigin,
    run: () =>
      entrypoint.queue(
        {
          queue: 'platform-jobs-staging',
          messages: [{ ack, retry, body: envelope, attempts: 1, id: 'lease' }],
        },
        env,
        { waitUntil: vi.fn() },
      ),
  };
};

describe('private CMS lease control through the real receiving composition', () => {
  it('renews through the protected heartbeat RPC and finalizes at the renewed version', async () => {
    const f = fixture();
    await f.run();
    expect(f.calls).toEqual([
      read,
      read,
      restore,
      restore,
      claim,
      restore,
      heartbeat,
      read,
      apply('37'),
      processed,
    ]);
    expect(f.snapshots).toEqual([
      {
        kind: 'current',
        claimedJob: { jobId: JOB, version: '37', leaseToken: TOKEN },
        leaseUntilMs: 501_000,
      },
    ]);
    // Input, private lease control, and the Worker-layer delivery context (DEC-184).
    expect(f.prepareSchemaDryRun.mock.calls[0]).toHaveLength(3);
    expect((f.prepareSchemaDryRun.mock.calls[0] as unknown[])[2]).toMatchObject(
      { deliveryAttempt: 1 },
    );
    expect(f.ack).toHaveBeenCalledTimes(1);
    expect(f.retry).not.toHaveBeenCalled();
  });

  it.each([false, 'true', null])(
    'retries without an outcome when the protected heartbeat answers %j',
    async (answer) => {
      const f = fixture({ heartbeat: answer });
      await f.run();
      expect(f.calls).toEqual([
        read,
        read,
        restore,
        restore,
        claim,
        restore,
        heartbeat,
      ]);
      expect(f.snapshots).toEqual([{ kind: 'lost' }]);
      expect(f.retry).toHaveBeenCalledTimes(1);
      expect(f.ack).not.toHaveBeenCalled();
    },
  );

  it('asks the trusted clock afresh instead of reusing the frozen request time', async () => {
    const times = [1_000, 400_000];
    const f = fixture({ now: () => times.shift() ?? 400_000 });
    await f.run();
    // The session cannot open on the second reading (the lease is past), so nothing runs and the unopened claim is
    // returned to queued at the claim version (BE00: a retryable pre-effect failure returns the Job to queued).
    expect(f.calls).toEqual([
      read,
      read,
      restore,
      restore,
      claim,
      op('apply_job_outcome', {
        p_job_id: JOB,
        p_expected_version: '19',
        p_lease_token: TOKEN,
        p_next_state: 'queued',
        p_result_ref: null,
        p_error_code: 'LEASE_CONTROL_UNAVAILABLE',
        p_retryable: true,
      }),
    ]);
    expect(f.prepareSchemaDryRun).not.toHaveBeenCalled();
    expect(f.retry).toHaveBeenCalledTimes(1);
    expect(f.ack).not.toHaveBeenCalled();
  });

  it('keeps ordinary verification on one argument with no heartbeat', async () => {
    const f = fixture({ type: 'object.verify' });
    await f.run();
    expect(f.calls).toEqual([
      read,
      read,
      restore,
      restore,
      claim,
      apply('19'),
      processed,
    ]);
    expect(f.verifyObject.mock.calls[0]).toHaveLength(1);
    expect(f.ack).toHaveBeenCalledTimes(1);
  });

  it('retries before the origin reader when the receiver signal is already aborted', async () => {
    const NativeController = AbortController;
    class PreAbortedController extends NativeController {
      constructor() {
        super();
        this.abort();
      }
    }
    const f = fixture();
    vi.stubGlobal('AbortController', PreAbortedController);
    try {
      await f.run();
    } finally {
      vi.unstubAllGlobals();
    }
    expect(f.calls).toEqual([read]);
    expect(f.verifyCmsSchemaDryRunOrigin).not.toHaveBeenCalled();
    expect(f.retry).toHaveBeenCalledTimes(1);
    expect(f.ack).not.toHaveBeenCalled();
  });
});
