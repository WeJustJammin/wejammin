/**
 * Environment binding (DEC-184 / tracked boundary #128): the production claimed-preparation callback is
 * composed per Worker environment object, from that environment's validated service credentials, never from
 * module state. Real callback, real entry, real stages; only the HTTP edge is recorded.
 */
import type { CmsLeaseControl, JobEffectResult } from '@wejammin/application';
import { describe, expect, it, vi } from 'vitest';

import type { AsyncWorkerBindings } from './async-entrypoint';
import type { JobEffectDeliveryContext } from './async-runtime-job-context';
import { SCHEMA_MIGRATION_RPC as RPC } from './content-schema-registry/migration-worker-constants';
import {
  claimedResponse,
  CLAIM_VERSION,
  ENVELOPE,
  firstEmptyScript,
  IDS,
} from './production-async-entrypoint-cms-preparation.test-support';
import {
  createProductionClaimedPreparation,
  createProductionClaimedPreparationEffect,
} from './production-schema-migration-preparation-claimed';

const control: CmsLeaseControl = {
  checkpoint: async () => ({
    kind: 'current',
    claimedJob: {
      jobId: IDS.job,
      version: CLAIM_VERSION,
      leaseToken: IDS.other,
    },
    leaseUntilMs: Date.now() + 200_000,
  }),
};
const input = () => ({
  job: {
    id: IDS.job,
    type: 'cms.schema.dry_run',
    state: 'running' as const,
    version: '7',
    leaseUntilMs: null,
  },
  envelope: ENVELOPE,
  leaseToken: IDS.other,
  claimedLease: {
    jobId: IDS.job,
    leaseToken: IDS.other,
    expectedVersion: '7',
    version: CLAIM_VERSION,
    leaseUntilMs: Date.now() + 300_000,
  },
});
const envFor = (url: string, release = 'r1'): AsyncWorkerBindings => ({
  APP_ENVIRONMENT: 'production',
  APP_RELEASE: release,
  SUPABASE_SECRET_KEY: 'sb_secret_test_only',
  SUPABASE_URL: url,
  PLATFORM_JOBS: { send: vi.fn() },
});
const context = (
  env: AsyncWorkerBindings,
  deliveryAttempt = 1,
): JobEffectDeliveryContext => ({
  env,
  signal: new AbortController().signal,
  deliveryAttempt,
});

/** A fetch that answers the first-empty baseline for any base URL and records (url, operation, body). */
const recordingFetch = () => {
  const script = firstEmptyScript();
  const calls: Array<{
    base: string;
    operation: string;
    body: Record<string, unknown>;
  }> = [];
  const fetchImpl = vi.fn(
    async (resource: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(resource));
      const operation = url.pathname.split('/').at(-1)!;
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      calls.push({ base: url.origin, operation, body });
      const handler = script[operation as keyof typeof script];
      const request = (body.p_request ?? {}) as Record<string, unknown>;
      return Response.json(
        handler === undefined
          ? null
          : operation === RPC.readPlan
            ? claimedResponse(request)
            : handler(request, undefined as never),
      );
    },
  );
  return { fetchImpl: fetchImpl as unknown as typeof fetch, calls };
};

const succeeded = (result: JobEffectResult) => result.state === 'succeeded';

describe('[P2-S12-AC-050] production claimed preparation is composed per Worker environment (#128)', () => {
  it('sends each environment object to its own base URL and builds one preparation per environment object', async () => {
    const { fetchImpl, calls } = recordingFetch();
    const create = vi.fn(createProductionClaimedPreparation);
    const effect = createProductionClaimedPreparationEffect(
      fetchImpl,
      {},
      create,
    );
    const a = envFor('https://alpha.example.supabase.co');
    const b = envFor('https://bravo.example.supabase.co');

    const [first, second] = await Promise.all([
      effect(input(), control, context(a)),
      effect(input(), control, context(b)),
    ]);
    expect(succeeded(first) && succeeded(second)).toBe(true);
    expect(create).toHaveBeenCalledTimes(2);
    expect(new Set(calls.map((c) => c.base))).toEqual(
      new Set([
        'https://alpha.example.supabase.co',
        'https://bravo.example.supabase.co',
      ]),
    );
    // Within each environment every RPC went to that environment's own base URL, in stage order.
    for (const base of [
      'https://alpha.example.supabase.co',
      'https://bravo.example.supabase.co',
    ])
      expect(
        calls.filter((c) => c.base === base).map((c) => c.operation),
      ).toEqual([
        RPC.readPlan,
        RPC.claimLease,
        RPC.heartbeatLease,
        RPC.readSourceRows,
        RPC.processDryRunBatch,
        RPC.finalizeDryRun,
      ]);

    // A second delivery on the same environment object reuses its preparation.
    await effect(input(), control, context(a, 2));
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('shares nothing across effects: two callbacks for the same environment object build their own', async () => {
    const { fetchImpl } = recordingFetch();
    const create = vi.fn(createProductionClaimedPreparation);
    const env = envFor('https://alpha.example.supabase.co');
    await createProductionClaimedPreparationEffect(fetchImpl, {}, create)(
      input(),
      control,
      context(env),
    );
    await createProductionClaimedPreparationEffect(fetchImpl, {}, create)(
      input(),
      control,
      context(env),
    );
    expect(create).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['empty SUPABASE_URL', { SUPABASE_URL: '' }],
    ['blank SUPABASE_SECRET_KEY', { SUPABASE_SECRET_KEY: '' }],
    ['unknown APP_ENVIRONMENT', { APP_ENVIRONMENT: 'nowhere' }],
  ])(
    '%s: queued unavailable, failed on the last delivery, never thrown, never cached, no RPC',
    async (_label, patch) => {
      const { fetchImpl, calls } = recordingFetch();
      const create = vi.fn(createProductionClaimedPreparation);
      const effect = createProductionClaimedPreparationEffect(
        fetchImpl,
        {},
        create,
      );
      const env = {
        ...envFor('https://alpha.example.supabase.co'),
        ...patch,
      } as AsyncWorkerBindings;

      for (const attempt of [1, 2, 3])
        expect(await effect(input(), control, context(env, attempt))).toEqual({
          state: 'queued',
          errorCode: 'DEPENDENCY_UNAVAILABLE',
          resultRef: null,
        });
      expect(await effect(input(), control, context(env, 4))).toEqual({
        state: 'failed',
        errorCode: 'MIGRATION_RETRIES_EXHAUSTED',
        resultRef: null,
      });
      expect(calls).toEqual([]);
      // A failed construction is retried on every delivery rather than remembered.
      expect(create).toHaveBeenCalledTimes(4);
    },
  );

  it('a delivery without a Worker context is queued unavailable and makes no RPC', async () => {
    const { fetchImpl, calls } = recordingFetch();
    const effect = createProductionClaimedPreparationEffect(fetchImpl);
    expect(await effect(input(), control)).toEqual({
      state: 'queued',
      errorCode: 'DEPENDENCY_UNAVAILABLE',
      resultRef: null,
    });
    expect(calls).toEqual([]);
  });

  it('uses the release-level worker id and the configured batch tuning', async () => {
    const { fetchImpl, calls } = recordingFetch();
    const effect = createProductionClaimedPreparationEffect(fetchImpl, {
      maxBatchesPerInvocation: 2,
      leaseDurationMs: 20_000,
    });
    await effect(
      input(),
      control,
      context(envFor('https://alpha.example.supabase.co', 'rel-9')),
    );
    const claim = calls.find((c) => c.operation === RPC.claimLease)?.body
      .p_request as Record<string, unknown>;
    expect(claim.leaseOwner).toBe('cms-schema-migration-production-rel-9');
    expect(claim.workerId).toBe('cms-schema-migration-production-rel-9');
    expect(claim.leaseDurationMs).toBe(20_000);
  });

  it('logs one Job-path queue attempt with the delivery number', async () => {
    const { fetchImpl } = recordingFetch();
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };
    const effect = createProductionClaimedPreparationEffect(fetchImpl, {
      logger: logger as never,
    });
    await effect(
      input(),
      control,
      context(envFor('https://alpha.example.supabase.co'), 2),
    );
    const attempts = logger.info.mock.calls.filter(
      ([entry]) => entry.eventName === 'cms.registry.queue_attempt',
    );
    expect(attempts).toHaveLength(1);
    expect(attempts[0]?.[0]).toMatchObject({
      attempt: 2,
      outcome: 'success',
      retryable: false,
    });
  });

  it('passes every deployment option to the composed worker', async () => {
    const { fetchImpl, calls } = recordingFetch();
    const telemetry = vi.fn();
    const effect = createProductionClaimedPreparationEffect(fetchImpl, {
      workerId: 'custom-worker.1',
      now: () => Date.parse('2026-10-13T12:00:00.000Z'),
      leaseDurationMs: 20_000,
      maxBatchRows: 64,
      maxBatchesPerInvocation: 3,
      deadlineMs: 5_000,
      maxResponseBytes: 100_000,
      telemetry,
    });
    const result = await effect(
      input(),
      control,
      context(envFor('https://alpha.example.supabase.co')),
    );

    expect(succeeded(result)).toBe(true);
    const claim = calls.find((c) => c.operation === RPC.claimLease)?.body
      .p_request;
    expect(claim).toMatchObject({
      leaseOwner: 'custom-worker.1',
      workerId: 'custom-worker.1',
      leaseDurationMs: 20_000,
      now: '2026-10-13T12:00:00.000Z',
    });
    const read = calls.find((c) => c.operation === RPC.readSourceRows)?.body
      .p_request;
    expect(read).toMatchObject({ limit: 64 });
    expect(telemetry).toHaveBeenCalled();
  });

  it('a transport limit the RPC client refuses makes the environment unusable: queued unavailable, never thrown', async () => {
    const { fetchImpl, calls } = recordingFetch();
    const effect = createProductionClaimedPreparationEffect(fetchImpl, {
      deadlineMs: 999_999,
    });
    expect(
      await effect(
        input(),
        control,
        context(envFor('https://alpha.example.supabase.co')),
      ),
    ).toEqual({
      state: 'queued',
      errorCode: 'DEPENDENCY_UNAVAILABLE',
      resultRef: null,
    });
    expect(calls).toEqual([]);
  });

  it('a logger that throws never changes the disposition', async () => {
    const { fetchImpl } = recordingFetch();
    const logger = {
      info: vi.fn(() => {
        throw new Error('controlled logger failure');
      }),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };
    const effect = createProductionClaimedPreparationEffect(fetchImpl, {
      logger: logger as never,
    });
    const result = await effect(
      input(),
      control,
      context(envFor('https://alpha.example.supabase.co')),
    );
    expect(succeeded(result)).toBe(true);
  });
});
